// 每日打卡 —— 开奖后询问：买了吗 / 选的号 / 花多少 / 中几个 / 中多少
// 保存到浏览器 localStorage，并按设置同步到 Neon 云数据库；可一键 AI 分析。
// ⚠️ 记录仅用于个人复盘，不改变任何一期的中奖概率。
import React, { useMemo, useState } from 'react'
import { Card, Note, Ball, DrawBalls, yuan } from './common.jsx'
import { scoreBalls, pickBalanced, BALL_MAX } from '../lib/stats.js'
import {
  loadJournal,
  persistJournal,
  getRecord,
  upsertRecord,
  parseTickets,
  formatTickets,
  autoHits,
  perTicketHits,
  normalizeRecord,
} from '../lib/journal.js'
import { loadSettings, isNeonReady, isLlmReady } from '../lib/settings.js'
import { syncRecordToNeon, analyzeRecord } from '../lib/sync.js'

const NO_BUY_REASONS = ['今天没开', '忘了买', '理性停购', '出差/忙', '其他']

/** 推荐页同款「票1」：冷热兼顾 + 结构约束的选十单式（仅作带入 convenience） */
function suggestTicket(draws) {
  const { scores } = scoreBalls(draws, { periods: 100, halfLife: 20, hotMode: 'mix' })
  const ranked = Array.from({ length: BALL_MAX }, (_, i) => i + 1)
    .map((n) => ({ n, score: scores[n] }))
    .sort((a, b) => b.score - a.score)
  return pickBalanced(ranked, 10).map((x) => x.n).sort((a, b) => a - b)
}

export default function DailyCheckin({ draws, draw, onChanged }) {
  const latest = draw || draws[0]
  const date = latest?.date || ''
  const [list, setList] = useState(loadJournal)
  const existing = getRecord(list, date)
  const [editing, setEditing] = useState(!existing)
  const [bought, setBought] = useState(existing?.bought ?? null)
  const [ticketText, setTicketText] = useState(existing ? formatTickets(existing.tickets) : '')
  const [spend, setSpend] = useState(existing?.spend ?? '')
  const [hits, setHits] = useState(existing?.hits ?? '')
  const [prize, setPrize] = useState(existing?.prize ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const tickets = useMemo(() => parseTickets(ticketText), [ticketText])
  const hitSet = useMemo(() => new Set(latest?.nums || []), [latest])
  const auto = autoHits(tickets, latest)
  const perTicket = perTicketHits(tickets, latest)
  const autoSpend = tickets.length * 2

  if (!latest) {
    return (
      <Card title="每日打卡" tag="暂无开奖数据">
        <Note tone="warn">当前没有开奖数据，请先到「数据管理」页抓取或导入。</Note>
      </Card>
    )
  }

  function setStatus(tone, text) {
    setMsg({ tone, text })
  }

  async function save() {
    if (bought === null) return setStatus('warn', '请先选择「买了」或「没买」')
    setBusy(true)
    try {
      const rec = normalizeRecord(
        { date, drawId: latest.id, bought, tickets, spend, hits, prize, note },
        latest,
        existing,
      )
      let next = upsertRecord(list, rec)
      setList(next)
      persistJournal(next)

      // 按设置同步 Neon（分析结果也随整条 payload 一起上传）
      if (isNeonReady(loadSettings())) {
        try {
          const synced = await syncRecordToNeon(rec)
          next = upsertRecord(next, synced)
          setList(next)
          persistJournal(next)
          setStatus('info', '已保存到本地，并同步到 Neon 云数据库')
        } catch (e) {
          setStatus('warn', `已保存到本地，但 Neon 同步失败：${e.message}`)
        }
      } else {
        setStatus('info', '已保存到本地（未配置 Neon，仅存浏览器）')
      }
      setEditing(false)
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  async function runAi() {
    if (!existing) return
    if (!isLlmReady(loadSettings())) {
      return setStatus('warn', '尚未配置大模型 API，请先到「设置」页填写 Base URL / Key / 模型名')
    }
    setBusy(true)
    try {
      const analyzed = await analyzeRecord(existing, list, latest)
      const next = upsertRecord(list, analyzed)
      setList(next)
      persistJournal(next)
      setStatus('info', 'AI 分析完成，已存档到本地' + (analyzed.synced?.neon ? '和 Neon' : ''))
      onChanged?.()
    } catch (e) {
      setStatus('warn', `AI 分析失败：${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  function fillSuggestion() {
    setTicketText(formatTickets([suggestTicket(draws)]))
    setBought(true)
    setSpend(2)
    setStatus('info', '已带入「下期推荐 · 冷热兼顾」票1（选十单式，2 元），可自行修改')
  }

  // ---------- 已保存的汇总视图 ----------
  if (!editing && existing) {
    const profit = (existing.prize || 0) - (existing.spend || 0)
    return (
      <Card title={`第 ${latest.id} 期打卡`} tag={`${date} · 已记录`}>
        <div className="checkin-summary">
          <div>
            <div className="predict-sub">本期开奖号</div>
            <DrawBalls draw={latest} size="sm" />
          </div>
          <div className="checkin-rows">
            {existing.bought ? (
              <>
                <div>
                  <b>买了</b> · 命中 <b className="text-red">{existing.hits ?? '?'}</b> 个 · 花费 {yuan(existing.spend || 0)} · 奖金{' '}
                  {yuan(existing.prize || 0)} · 盈亏{' '}
                  <b style={{ color: profit >= 0 ? 'var(--blue)' : 'var(--red)' }}>
                    {profit >= 0 ? '+' : ''}
                    {yuan(profit)}
                  </b>
                </div>
                {existing.picks?.length > 0 && (
                  <div className="checkin-picks">
                    {existing.picks.map((n) => (
                      <Ball key={n} n={n} size="sm" kind="auto" className={hitSet.has(n) ? 'ball-hit' : ''} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div>
                <b>没买</b>
                {existing.note ? ` · ${existing.note}` : ' · 理性消费，也很好'}
              </div>
            )}
          </div>
          <div className="row-actions">
            <button className="tab-btn" onClick={() => setEditing(true)}>修改记录</button>
            <button className="btn-primary" onClick={runAi} disabled={busy}>
              {busy ? '分析中…' : existing.aiReport ? '重新 AI 分析' : 'AI 分析本期'}
            </button>
            {existing.synced?.neon && <span className="sync-badge">Neon 已同步</span>}
          </div>
        </div>
        {existing.aiReport && (
          <div className="ai-report">
            <div className="ai-report-head">
              AI 分析 · {existing.aiReport.model} · {new Date(existing.aiReport.at).toLocaleString('zh-CN')}
            </div>
            <div className="ai-report-body">{existing.aiReport.text}</div>
          </div>
        )}
        {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
      </Card>
    )
  }

  // ---------- 打卡表单 ----------
  return (
    <Card title={`第 ${latest.id} 期打卡`} tag={`${date} · 开奖后请核对`}>
      <div className="checkin-draw">
        <div>
          <div className="predict-sub">本期开奖号（20 个）</div>
          <DrawBalls draw={latest} size="sm" />
        </div>
      </div>

      <div className="mode-row" style={{ marginTop: 14 }}>
        <span className="toolbar-label">今天买彩票了吗？</span>
        <button
          className={`mode-btn ${bought === true ? 'active-dan' : ''}`}
          onClick={() => setBought(true)}
        >
          买了
        </button>
        <button
          className={`mode-btn ${bought === false ? 'active' : ''}`}
          onClick={() => {
            setBought(false)
            setHits('')
            setPrize('')
          }}
        >
          没买
        </button>
      </div>

      {bought && (
        <>
          <div className="field">
            <label className="field-label">
              买的号码（每行一注，如 <code>01 05 12 23 34 45 56 67 78 80</code>）
            </label>
            <textarea
              className="import-area mono"
              rows={3}
              value={ticketText}
              onChange={(e) => setTicketText(e.target.value)}
              placeholder={'01 05 12 23 34 45 56 67 78 80\n02 08 15 21 33 44 55 66 77 79'}
            />
            <div className="row-actions">
              <button className="tab-btn" onClick={fillSuggestion}>带入今日推荐票（选十）</button>
              <button className="tab-btn" onClick={() => setTicketText('')}>清空号码</button>
              {tickets.length > 0 && (
                <span className="muted small">
                  共 {tickets.length} 张票 · 自动命中 <b className="text-red">{auto}</b> 个（各注：
                  {perTicket.join(' / ')}）
                </span>
              )}
            </div>
          </div>

          {tickets.length > 0 && (
            <div className="checkin-preview">
              <div className="predict-sub">号码对照（金圈 = 命中）</div>
              {tickets.map((t, i) => (
                <div key={i} className="checkin-preview-row">
                  <span className="muted small mono">票{i + 1} 中{perTicket[i]}</span>
                  {t.map((n) => (
                    <Ball key={n} n={n} size="sm" kind="auto" className={hitSet.has(n) ? 'ball-hit' : ''} />
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label className="field-label">花费（元）</label>
              <input
                className="text-input mono"
                type="number"
                min="0"
                step="2"
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                placeholder={tickets.length ? `约 ${autoSpend}` : '0'}
              />
            </div>
            <div className="field">
              <label className="field-label">中几个（可手改，默认按号码自动算）</label>
              <input
                className="text-input mono"
                type="number"
                min="0"
                max="20"
                value={hits}
                onChange={(e) => setHits(e.target.value)}
                placeholder={tickets.length ? `自动 ${auto}` : '0'}
              />
            </div>
            <div className="field">
              <label className="field-label">中奖金额（元，没中填 0）</label>
              <input
                className="text-input mono"
                type="number"
                min="0"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </>
      )}

      {bought === false && (
        <div className="chip-row">
          {NO_BUY_REASONS.map((r) => (
            <button key={r} className="tab-btn" onClick={() => setNote(note.includes(r) ? note : (note ? `${note}；${r}` : r))}>
              {r}
            </button>
          ))}
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field-label">备注（可选，会进入 AI 分析与飞书表格）</label>
        <input
          className="text-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如：机选两张 / 用了推荐票1 / 差一个号中八…"
        />
      </div>

      <div className="row-actions">
        <button className="btn-primary" onClick={save} disabled={busy || bought === null}>
          {busy ? '保存中…' : '保存本期记录'}
        </button>
        {existing && (
          <button className="tab-btn" onClick={() => setEditing(false)}>取消修改</button>
        )}
      </div>
      {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
      <Note>
        记录保存在浏览器本地；若在「设置」页填了 Neon 连接串，保存时会自动上传。没买也要点一下「没买」——
        不购买的日子同样是账本的一部分，AI 分析会参考。
      </Note>
    </Card>
  )
}
