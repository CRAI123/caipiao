// 下期推荐 —— 近期加权频次 + 遗漏打分，输出结构均衡的研究用号码（多玩法 + 导出）
// ⚠️ 仅为历史数据的加权统计结果，不改变任何号码 25% 的开出概率
import React, { useMemo, useState } from 'react'
import { Card, Ball, Note, StatCard, pad2, yuan } from './common.jsx'
import {
  scoreBalls,
  pickBalanced,
  comb,
  PLAY_LABEL,
  BALL_MAX,
  PRICE,
  isOdd,
  isBig,
  road,
} from '../lib/stats.js'
import { aiPredict, storePrediction } from '../lib/api.js'
import { v7Recommend } from '../lib/kl8V7.js'
import { fmtPct } from '../lib/kl8Math.js'
import BetVerify from './BetVerify.jsx'

const MODES = [
  { id: 'hot', label: '偏热', desc: '只用近期加权频次' },
  { id: 'mix', label: '冷热兼顾', desc: '加权频次为主，叠加遗漏' },
  { id: 'cold', label: '偏冷', desc: '以当前遗漏期数为主' },
  { id: 'multi', label: '多尺度', desc: '用户模型：长期25% + 近50期30% + 近20期30% + 近10期15%' },
]
const PLAYS = [3, 4, 5, 6, 7, 8, 9, 10]

const bandOf = (n) => Math.min(3, Math.floor((n - 1) / 20))

function profile(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const odd = sorted.filter(isOdd).length
  const big = sorted.filter(isBig).length
  const r012 = [0, 0, 0]
  const bands = [0, 0, 0, 0]
  sorted.forEach((n) => {
    r012[road(n)]++
    bands[bandOf(n)]++
  })
  return {
    oddEven: `${odd}:${sorted.length - odd}`,
    bigSmall: `${big}:${sorted.length - big}`,
    r012: r012.join(' / '),
    bands: bands.join(' / '),
    sum: sorted.reduce((s, n) => s + n, 0),
    span: sorted[sorted.length - 1] - sorted[0],
  }
}

export default function Predict({ draws }) {
  const [hotMode, setHotMode] = useState('mix')
  const [play, setPlay] = useState(10)
  const [aiPicks, setAiPicks] = useState(null)
  const [aiReasoning, setAiReasoning] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState(null)
  const [showV7, setShowV7] = useState(false)

  const { scores, weighted, missing, window } = useMemo(
    () => scoreBalls(draws, { periods: 100, halfLife: 20, hotMode }),
    [draws, hotMode],
  )

  const ranked = useMemo(
    () =>
      Array.from({ length: BALL_MAX }, (_, i) => i + 1)
        .map((n) => ({
          n,
          score: +(scores[n] * 100).toFixed(1),
          freq: +weighted[n].toFixed(2),
          miss: missing[n].current,
        }))
        .sort((a, b) => b.score - a.score),
    [scores, weighted, missing],
  )

  // 三张单式票：评分榜首段 + 两个错位段，均做结构约束
  const tickets = useMemo(
    () => [0, 3, 6].map((off) => pickBalanced(ranked.slice(off), play).map((x) => x.n).sort((a, b) => a - b)),
    [ranked, play],
  )
  const mainNums = tickets[0]
  const mainSet = new Set(mainNums)
  const backup = ranked.filter((x) => !mainSet.has(x.n)).slice(0, 10)

  const danCount = play >= 6 ? 4 : play >= 4 ? 2 : 1
  const dans = mainNums.slice(0, danCount)
  const need = play - danCount
  const tuos = [...mainNums.slice(danCount), ...backup.map((x) => x.n)].slice(0, need + 4)

  const p = profile(mainNums)
  const latest = draws[0]
  const nextId = latest ? latest.id + 1 : '—'
  const latestHit = new Set(latest?.nums || [])
  const danHitNow = dans.filter((n) => latestHit.has(n)).length

  // v7：按期号固定的四层统计选号，点按钮才计算
  const v7 = useMemo(
    () => (showV7 ? v7Recommend(draws, { play, nextId: latest ? latest.id + 1 : undefined }) : null),
    [showV7, draws, play, latest],
  )

  const bet = useMemo(
    () => ({
      ok: true,
      mode: 'dantuo',
      play,
      dans,
      tuos,
      picks: null,
      count: comb(tuos.length, need),
      cost: comb(tuos.length, need) * PRICE,
      combos: null,
    }),
    [play, dans, tuos, need],
  )

  const costRows = Array.from({ length: 5 }, (_, i) => need + i).map((t) => ({
    t,
    count: comb(t, need),
    cost: comb(t, need) * PRICE,
  }))

  function exportTxt() {
    const lines = [
      `# 快乐8 研究推荐 · 第 ${nextId} 期 · ${PLAY_LABEL[play]}（仅供数据学习，非投注建议）`,
      `# 偏好：${MODES.find((m) => m.id === hotMode).label} · 样本 ${window} 期 · ${hotMode === 'multi' ? '四窗口加权 25/30/30/15' : '半衰期 20 期'}`,
      '',
      '单式票：',
      ...tickets.map((t, i) => `  票${i + 1}: ${t.map(pad2).join(' ')}`),
      '',
      `胆拖：${danCount} 胆 [${dans.map(pad2).join(' ')}] + ${tuos.length} 拖 [${tuos.map(pad2).join(' ')}]`,
      `  = ${bet.count} 注 · ${bet.cost} 元`,
    ]
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kl8_${nextId}_${PLAY_LABEL[play]}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** AI 选号：底层统计逻辑之后，调用 AI 辅助分析选号，并自动存储预测 */
  async function doAiPredict() {
    setAiBusy(true)
    setAiMsg(null)
    try {
      const result = await aiPredict({ draws, play, mode: hotMode })
      setAiPicks(result.aiPicks)
      setAiReasoning(result.aiReasoning)
      // 自动存储预测，供每日 cron 复盘对比
      const latest = draws[0]
      const nextId = latest ? latest.id + 1 : null
      if (nextId) {
        try {
          await storePrediction({
            drawId: nextId,
            play,
            mode: hotMode,
            picks: mainNums,
            dans,
            tuos,
            aiPicks: result.aiPicks,
          })
          setAiMsg({ tone: 'info', text: `AI 选号已生成，预测已自动存档（第 ${nextId} 期）` })
        } catch {
          setAiMsg({ tone: 'info', text: 'AI 选号已生成（存档失败，不影响使用）' })
        }
      }
    } catch (e) {
      setAiMsg({ tone: 'warn', text: `AI 选号失败：${e.message}` })
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">玩法</span>
        {PLAYS.map((pp) => (
          <button key={pp} className={`tab-btn ${play === pp ? 'active' : ''}`} onClick={() => setPlay(pp)}>
            {PLAY_LABEL[pp]}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span className="toolbar-label">打分偏好</span>
        {MODES.map((m) => (
          <button key={m.id} className={`tab-btn ${hotMode === m.id ? 'active' : ''}`} onClick={() => setHotMode(m.id)}>
            {m.label}
          </button>
        ))}
        <span className="toolbar-note">样本 {window} 期 · {hotMode === 'multi' ? '四窗口加权 25/30/30/15' : '半衰期 20 期'}</span>
        <span className="toolbar-sep" />
        <button className="btn-primary" onClick={doAiPredict} disabled={aiBusy}>
          {aiBusy ? 'AI 分析中…' : '🤖 AI 选号'}
        </button>
        <button
          className={`tab-btn ${showV7 ? 'active' : ''}`}
          onClick={() => setShowV7((v) => !v)}
        >
          v7 算法推荐
        </button>
        <button className="tab-btn" onClick={exportTxt}>导出推荐方案（.txt）</button>
      </div>

      <Card title={`第 ${nextId} 期 · ${PLAY_LABEL[play]} 研究推荐`} tag="评分前列 + 结构约束 · 三张单式票">
        {tickets.map((t, i) => (
          <div key={i} className="predict-head" style={{ marginTop: i ? 12 : 0 }}>
            <div>
              <div className="predict-sub">
                票 {i + 1}
                {i === 0 && `（前 ${danCount} 个为胆码）`}
              </div>
              <span className="draw-balls predict-balls">
                {t.map((n, j) => (
                  <Ball
                    key={n}
                    n={n}
                    size={i === 0 ? 'md' : 'sm'}
                    kind="auto"
                    className={i === 0 && j < danCount ? 'ball-dan' : ''}
                  />
                ))}
              </span>
            </div>
          </div>
        ))}
        <div className="predict-head" style={{ marginTop: 12 }}>
          <div>
            <div className="predict-sub">备选 10 码（灰色）</div>
            <span className="draw-balls">
              {backup.map((x) => (
                <Ball key={x.n} n={x.n} size="sm" kind="plain" dim />
              ))}
            </span>
          </div>
        </div>

        <div className="range-legend mono">
          <span><i className="lg-dot lg-red" />01-20</span>
          <span><i className="lg-dot lg-blue" />21-40</span>
          <span><i className="lg-dot lg-green" />41-60</span>
          <span><i className="lg-dot lg-amber" />61-80</span>
          <span className="muted">深色描边 = 胆码（票 1 前 {danCount} 个）</span>
        </div>

        <div className="chip-row" style={{ marginTop: 14 }}>
          <span className="chip"><i>奇:偶 {p.oddEven}</i></span>
          <span className="chip"><i>大:小 {p.bigSmall}</i></span>
          <span className="chip"><i>012 路 {p.r012}</i></span>
          <span className="chip"><i>区间分布 {p.bands}</i></span>
          <span className="chip"><i>和值 {p.sum} · 跨度 {p.span}</i></span>
        </div>

        <Note>
          三张票取评分榜不同段位（第 1-10、4-13、7-16 名附近）并做结构约束：四区间各有号、单区间不超限、
          奇偶接近均衡。这让号码形态更像常见开奖，<b>但不提高中奖概率</b>。
        </Note>
      </Card>

      {v7 && (
        <Card
          title={`v7 算法 · 第 ${v7.nextId} 期 · ${PLAY_LABEL[v7.play]} 推荐`}
          tag={`30 码推荐池 → 动态概率抽样 · 主窗口 ${v7.primaryWindow} 期`}
        >
          <div className="predict-head">
            <div>
              <div className="predict-sub">v7 推荐 {v7.play} 码（按期号固定，重复点击结果一致）</div>
              <span className="draw-balls predict-balls">
                {v7.picks.map((n) => (
                  <Ball key={n} n={n} size="md" kind="auto" />
                ))}
              </span>
            </div>
          </div>
          <div className="predict-head" style={{ marginTop: 12 }}>
            <div>
              <div className="predict-sub">备选 3 码（灰色）</div>
              <span className="draw-balls">
                {v7.backup.map((n) => (
                  <Ball key={n} n={n} size="sm" kind="plain" dim />
                ))}
              </span>
            </div>
          </div>

          <div className="chip-row" style={{ marginTop: 14 }}>
            <span className="chip"><i>推荐池 30 码 · 上期重号 {v7.lastHitInPool}</i></span>
            <span className="chip"><i>排除池 30 码 · 上期重号 {v7.lastHitInKill}</i></span>
            <span className="chip"><i>单注期望 {v7.stats.ev.toFixed(2)} 元</i></span>
            <span className="chip"><i>返还率 {fmtPct(v7.stats.returnRate, 1)}</i></span>
          </div>

          <div className="predict-sub" style={{ marginTop: 12 }}>推荐池（30 码）</div>
          <div className="mono small" style={{ lineHeight: 1.9 }}>
            {v7.pool.map((x) => pad2(x.n)).join(' ')}
          </div>
          <div className="predict-sub" style={{ marginTop: 12 }}>排除池（30 码）</div>
          <div className="mono small muted" style={{ lineHeight: 1.9 }}>
            {v7.kill.map((x) => pad2(x.n)).join(' ')}
          </div>

          <Note tone="warn">
            v7 = 组合概率层 + 100/50/30/20 期多窗口轮动 + 遗漏分档加权抽样，四个窗口权重（主窗口 55%，其余各 15%）
            和抽样过程写死在代码里，<b>没有用历史开奖拟合参数</b>。同一期号重复点击结果相同。
            它只是把统计偏好落成一张具体号码，<b>不提高中奖概率</b>；{PLAY_LABEL[v7.play]}头奖概率仍是
            1 / {Math.round(comb(BALL_MAX, v7.play) / comb(20, v7.play)).toLocaleString()}。
          </Note>
        </Card>
      )}

      {aiPicks && (
        <Card title={`🤖 AI 选号 · 第 ${nextId} 期`} tag="底层统计 + AI 分析">
          <div className="predict-head">
            <div>
              <div className="predict-sub">AI 推荐 {play} 码</div>
              <span className="draw-balls predict-balls">
                {aiPicks.map((n) => (
                  <Ball key={n} n={n} size="md" kind="auto" />
                ))}
              </span>
            </div>
          </div>
          {aiReasoning && (
            <div className="settings-guide" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
              <b>AI 分析理由：</b>
              {'\n'}{aiReasoning}
            </div>
          )}
          <Note tone="warn">
            AI 选号仅基于历史数据统计做参考分析，开奖为独立随机事件，不提高中奖概率。理性购彩，量力而行。
          </Note>
        </Card>
      )}

      {aiMsg && <Note tone={aiMsg.tone === 'warn' ? 'warn' : 'info'}>{aiMsg.text}</Note>}

      <div className="stat-grid stat-grid-4">
        <StatCard label="参与打分号码" value={BALL_MAX} note="全部 80 个号码" />
        <StatCard label="单号每期理论概率" value="25" unit="%" tone="blue" note="20 / 80，固定不变" />
        <StatCard label={`${PLAY_LABEL[play]}中${play}概率`} value={`1 / ${Math.round(comb(BALL_MAX, play) / comb(20, play)).toLocaleString()}`} tone="red" note="任一组合等概率" />
        <StatCard label={`${danCount} 胆全中概率`} value={((comb(20, danCount) / comb(80, danCount)) * 100).toFixed(danCount === 4 ? 3 : 1)} unit="%" tone="amber" note={`C(20,${danCount})/C(80,${danCount})`} />
      </div>

      <Card title="评分明细 TOP20" tag={`${MODES.find((m) => m.id === hotMode).desc} · 分值 0-100`}>
        <div className="table-scroll">
          <table className="ledger-table score-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>号码</th>
                <th>加权频次</th>
                <th>当前遗漏</th>
                <th>综合评分</th>
                <th>角色</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 20).map((x, i) => (
                <tr key={x.n}>
                  <td className="mono muted">{i + 1}</td>
                  <td><Ball n={x.n} size="sm" /></td>
                  <td className="mono">{x.freq}</td>
                  <td className="mono">{x.miss} 期</td>
                  <td className="mono">{x.score}</td>
                  <td className="small">
                    {dans.includes(x.n) ? (
                      <b className="text-red">胆码</b>
                    ) : mainSet.has(x.n) ? (
                      '主推'
                    ) : (
                      '备选'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`${danCount} 胆 + N 拖 方案`} tag={`${PLAY_LABEL[play]} · 胆码 ${dans.map(pad2).join(' ')}`}>
        <div className="table-scroll">
          <table className="ledger-table drag-table">
            <thead>
              <tr>
                <th>方案</th>
                <th>拖码</th>
                <th>注数</th>
                <th>金额</th>
                <th>头奖条件</th>
              </tr>
            </thead>
            <tbody>
              {costRows.map((r) => (
                <tr key={r.t} className={r.t === tuos.length ? 'row-active' : ''}>
                  <td>{danCount} 胆 + {r.t} 拖</td>
                  <td className="mono">{tuos.slice(0, r.t).map(pad2).join(' ')}</td>
                  <td className="mono">{r.count}</td>
                  <td className="mono">{yuan(r.cost)}</td>
                  <td className="muted small">{danCount} 胆全中 + 拖码中 {need} 个</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="result-bar" style={{ marginTop: 12 }}>
          <div>
            <b>默认方案 {danCount} 胆 + {tuos.length} 拖：</b>
            <span className="result-count mono" style={{ marginLeft: 12 }}>{bet.count}</span>
            <span className="result-unit">注 · 合计 {yuan(bet.cost)}</span>
          </div>
        </div>
        <Note tone="warn">
          最近一期（{latest?.id}）开奖中，这 {danCount} 个胆码命中 <b>{danHitNow}/{danCount}</b> 个。
          {danHitNow < danCount && `按这组胆码生成的全部 ${bet.count} 注，当期都拿不到头奖——胆码全中才有高奖，一个不中全组失效。`}
        </Note>
      </Card>

      <BetVerify bet={bet} draws={draws} />
    </div>
  )
}
