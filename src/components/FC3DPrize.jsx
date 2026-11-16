// 福彩3D 中奖计算 —— 填写本期购买号码 → 选择玩法 → 自动算中几注、多少钱
// 玩法与单注奖金（每注 2 元）：直选 1040 元 / 组选3 346 元 / 组选6 173 元
import React, { useMemo, useState } from 'react'
import { Card, Note, StatCard, yuan } from './common.jsx'
import { loadJournal, persistJournal, upsertRecord, getRecord, buildFc3dRecord } from '../lib/journal.js'
import { loadSettings, isNeonReady } from '../lib/settings.js'
import { syncRecordToNeon } from '../lib/sync.js'

const PLAYS = [
  { id: 'direct', name: '直选', amount: 1040, desc: '三位号码与开奖完全相同（位置一致）' },
  { id: 'group3', name: '组选3', amount: 346, desc: '两同一不同，不限位置' },
  { id: 'group6', name: '组选6', amount: 173, desc: '三位各不相同，不限位置' },
]

const PL5_PLAYS = [
  { id: 'direct', name: '直选', amount: 100000, desc: '五位号码与开奖完全相同（位置一致），单注 2 元' },
]

const UNIT = 2 // 每注 2 元

function sortedKey(arr) {
  return [...arr].sort((a, b) => a - b).join('')
}

/** 形态：3 位为豹子/组三/组六，5 位按重复结构描述 */
function betShape(digits, digitCount = 3) {
  const n = new Set(digits).size
  if (digitCount !== 3) return `${n} 种数字`
  if (n === 1) return '豹子'
  if (n === 2) return '组三'
  return '组六'
}

/** 解析用户填写的购买号码：每行一注，支持 "123" / "1 2 3" / "1,2,3" */
function parseBets(text, digitCount = 3) {
  const rows = []
  const errors = []
  const re = new RegExp(`^\\d{${digitCount}}$`)
  text.split(/\r?\n/).forEach((line, i) => {
    const s = line.trim()
    if (!s) return
    let digits = null
    if (re.test(s)) {
      digits = s.split('').map(Number)
    } else {
      const parts = s.split(/[\s,，]+/).filter(Boolean)
      if (parts.length === digitCount && parts.every((p) => /^\d$/.test(p))) {
        digits = parts.map(Number)
      }
    }
    if (!digits) {
      errors.push(`第 ${i + 1} 行「${s}」不是有效的 ${digitCount} 位号码`)
      return
    }
    rows.push({ raw: s, digits })
  })
  return { rows, errors }
}

/** 判定单注是否中奖 */
function judgeBet(digits, playId, drawDigits, digitCount = 3) {
  const shape = betShape(digits, digitCount)
  if (playId === 'group3' && shape !== '组三') {
    return { status: 'invalid', hitDigits: 0, reason: '组选3 需要「两同一不同」' }
  }
  if (playId === 'group6' && shape !== '组六') {
    return { status: 'invalid', hitDigits: 0, reason: '组选6 需要「三位各不相同」' }
  }
  if (playId === 'direct') {
    const hitDigits = digits.filter((d, i) => d === drawDigits[i]).length
    return { status: hitDigits === digitCount ? 'win' : 'lose', hitDigits }
  }
  // 组选：号码集合完全相同即中奖（不限位置）
  const win = sortedKey(digits) === sortedKey(drawDigits)
  const drawSet = new Set(drawDigits)
  const hitDigits = [...new Set(digits)].filter((d) => drawSet.has(d)).length
  return { status: win ? 'win' : 'lose', hitDigits }
}

const STATUS_LABEL = { win: '中奖', lose: '未中', invalid: '形态不符' }

export default function FC3DPrize({
  draws,
  lottery = 'fc3d',
  label = '福彩3D',
  digitCount = 3,
  plays = digitCount === 5 ? PL5_PLAYS : PLAYS,
}) {
  const [drawIdx, setDrawIdx] = useState(0)
  const [text, setText] = useState('')
  const [play, setPlay] = useState(digitCount === 5 ? 'direct' : '')
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(0)
  const [ledgerMsg, setLedgerMsg] = useState(null)

  const draw = draws[Math.min(drawIdx, draws.length - 1)] || draws[0]
  const drawLabel = draw ? (draw.drawId ?? draw.id) : '—'
  const { rows, errors } = useMemo(() => parseBets(text, digitCount), [text, digitCount])

  const playDef = plays.find((p) => p.id === play)
  const results = useMemo(() => {
    if (!play || !draw) return []
    return rows.map((r) => {
      const j = judgeBet(r.digits, play, draw.num, digitCount)
      return { ...r, ...j, prize: j.status === 'win' ? playDef.amount : 0 }
    })
  }, [rows, play, draw, playDef, digitCount])

  const valid = results.filter((r) => r.status !== 'invalid')
  const wins = results.filter((r) => r.status === 'win')
  const invalid = results.filter((r) => r.status === 'invalid')
  const cost = valid.length * UNIT
  const prize = wins.length * (playDef?.amount || 0)
  const net = prize - cost

  const askPlay = rows.length > 0 && !play

  // 本期是否已经有账本记录（同一天同一彩种只保留一条）
  const existingRec = useMemo(
    () => (draw ? getRecord(loadJournal(), draw.date, lottery) : null),
    [draw, savedTick, lottery],
  )

  async function saveToLedger() {
    if (!draw || !play || valid.length === 0) {
      return setLedgerMsg({ tone: 'warn', text: '请先填写号码并选择玩法' })
    }
    setSaving(true)
    try {
      const rec = buildFc3dRecord(
        {
          draw,
          lottery,
          playId: play,
          playName: playDef.name,
          bets: valid.map((r) => r.digits),
          spend: cost,
          wins: wins.length,
          prize,
        },
        existingRec,
      )
      let next = upsertRecord(loadJournal(), rec)
      persistJournal(next)
      if (isNeonReady(loadSettings())) {
        try {
          const synced = await syncRecordToNeon(rec)
          next = upsertRecord(next, synced)
          persistJournal(next)
        } catch {
          /* 云端同步失败不影响本地记录 */
        }
      }
      setSavedTick((t) => t + 1)
      setLedgerMsg({
        tone: 'info',
        text: `${draw.date} 已记入账本：${valid.length} 注 · 投入 ${cost} 元 · 奖金 ${prize} 元`,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <Note tone="warn">
        本工具只按固定奖金规则计算<b>已知开奖结果</b>的命中与奖金，不预测、不改变中奖概率。
        单注 2 元，奖金为{label}固定奖：{plays.map((p) => `${p.name} ${p.amount} 元`).join(' / ')}。
      </Note>

      <Card title="中奖计算" tag="填号码 → 选玩法 → 自动算奖金">
        {/* 步骤 1：选择开奖期号 */}
        <div className="prize-step">
          <div className="prize-step-head">
            <span className="prize-step-no">1</span> 选择本期开奖
          </div>
          <div className="prize-draw-row">
            <select
              className="text-input"
              value={drawIdx}
              onChange={(e) => setDrawIdx(Number(e.target.value))}
            >
              {draws.map((d, i) => (
                <option key={d.drawId ?? d.id ?? i} value={i}>
                  第 {d.drawId ?? d.id} 期 · {d.date || '—'}
                </option>
              ))}
            </select>
            <div className="fc3d-digits">
              {draw?.num.map((n, i) => (
                <span key={i} className="digit-ball">{n}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 步骤 2：填写购买号码 */}
        <div className="prize-step">
          <div className="prize-step-head">
            <span className="prize-step-no">2</span> 填写本期购买号码
            <span className="muted small">
              （每行一注，如 {Array.from({ length: digitCount }, (_, i) => i + 1).join('')} 或{' '}
              {Array.from({ length: digitCount }, (_, i) => i + 1).join(' ')}）
            </span>
          </div>
          <textarea
            className="import-area mono"
            rows={6}
            placeholder={
              digitCount === 3
                ? '例如：\n123\n1 2 3\n456'
                : '例如：\n03243\n0 3 2 4 3\n71829'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {errors.length > 0 && (
            <div className="note note-warn">
              <b>{errors.length} 行未识别：</b>
              <ul className="error-list">
                {errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* 步骤 3：选择玩法 */}
        <div className="prize-step">
          <div className="prize-step-head">
            <span className="prize-step-no">3</span> 选择玩法
          </div>
          {askPlay ? (
            <div className="prize-prompt">
              <b>号码已填写（共 {rows.length} 注），请选择你要计算的玩法：</b>
              <div className="prize-play-opts">
                {plays.map((p) => (
                  <button key={p.id} className="prize-play-btn" onClick={() => setPlay(p.id)}>
                    <span className="prize-play-name">{p.name}</span>
                    <span className="prize-play-amt">{p.amount} 元/注</span>
                    <span className="prize-play-desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="prize-play-opts">
              {plays.map((p) => (
                <button
                  key={p.id}
                  className={`prize-play-btn ${play === p.id ? 'active' : ''}`}
                  onClick={() => setPlay(p.id)}
                >
                  <span className="prize-play-name">{p.name}</span>
                  <span className="prize-play-amt">{p.amount} 元/注</span>
                  <span className="prize-play-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 结果 */}
      {play && rows.length > 0 && (
        <>
          <div className="stat-grid">
            <StatCard label="有效投注" value={valid.length} unit="注" note={`${playDef.name} · 每注 ${UNIT} 元`} />
            <StatCard label="中奖注数" value={wins.length} unit="注" tone="red" note={`单注 ${playDef.amount} 元`} />
            <StatCard label="总投入" value={cost} unit="元" note={`${valid.length} 注 × ${UNIT} 元`} />
            <StatCard label="总奖金" value={prize} unit="元" tone="blue" note={wins.length ? `命中 ${wins.length} 注` : '未中奖'} />
            <StatCard
              label="净盈亏"
              value={`${net >= 0 ? '+' : ''}${net}`}
              unit="元"
              tone={net >= 0 ? 'blue' : 'red'}
              note={`回报率 ${cost ? ((prize / cost) * 100).toFixed(0) : 0}%`}
            />
          </div>

          {invalid.length > 0 && plays.length > 1 && (
            <Note tone="warn">
              有 {invalid.length} 注号码形态与所选玩法不符（如组选3 却填了三位不同号），已不计入投注与奖金。
            </Note>
          )}

          <Card
            title="记入购彩账本"
            tag={existingRec ? `本期已记录 · ${existingRec.betCount ?? 0} 注` : '一天一条 · 日期 + 彩种'}
          >
            <div className="row-actions">
              <button className="btn-primary" onClick={saveToLedger} disabled={saving || valid.length === 0}>
                {saving ? '保存中…' : existingRec ? '更新本期账本记录' : '记入本期账本'}
              </button>
              <span className="muted small">
                记入后到「快乐8 → 购彩账本」筛选「{label}」可查看，并一起同步到飞书
              </span>
            </div>
            {ledgerMsg && <Note tone={ledgerMsg.tone === 'warn' ? 'warn' : 'info'}>{ledgerMsg.text}</Note>}
          </Card>

          <Card title="逐注判定" tag={`对照第 ${drawLabel} 期开奖 ${draw.num.join(' ')}`}>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>购买号码</th>
                    <th>形态</th>
                    <th>命中位数</th>
                    <th>结果</th>
                    <th>奖金</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td className="mono muted">{i + 1}</td>
                      <td className="mono">
                        <span className="fc3d-bet-num">{r.digits.join(' ')}</span>
                      </td>
                      <td className="small muted">{betShape(r.digits, digitCount)}</td>
                      <td className="mono">{r.hitDigits} 位</td>
                      <td>
                        <span className={`prize-badge prize-badge-${r.status}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="mono">{r.prize ? yuan(r.prize) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
