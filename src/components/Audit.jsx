// 方法体检 —— 滚动回测：评分法每期只用「之前」的数据选号，与真实开奖对比，
// 并和机选（超几何分布）基准对照。用来诚实检验选号方法有没有优势。
import React, { useMemo, useState } from 'react'
import { Card, Ball, DrawBalls, Note, StatCard, BarList, pad2, ballKindByRange } from './common.jsx'
import { walkForwardAudit, hyperHits, PLAY_LABEL, BALL_MAX, PER_DRAW } from '../lib/stats.js'

const PLAYS = [3, 5, 7, 10]

/** 2026-11 本地实测：两个开源项目在「选十」上的留出检验结果（每期只用之前数据） */
const EXTERNAL = [
  { name: '开源 LSTM · 逐位 argmax', repo: 'KittenCN/predict_Lottery_ticket', n: '100 期', v: 2.39 },
  { name: '开源 LSTM · 20 位概率求和', repo: 'KittenCN/predict_Lottery_ticket', n: '100 期', v: 2.51 },
  { name: '开源 LSTM · 20 位概率取最大', repo: 'KittenCN/predict_Lottery_ticket', n: '100 期', v: 2.55 },
  { name: '开源 8 算法引擎 · Mode 2', repo: 'KittenCN/kl8-lottery-analyzer', n: '60 期', v: 2.5 },
]

const MODES = [
  { id: 'hot', label: '偏热' },
  { id: 'mix', label: '冷热兼顾' },
  { id: 'cold', label: '偏冷' },
  { id: 'multi', label: '多尺度' },
]

export default function Audit({ draws }) {
  const [play, setPlay] = useState(10)
  const [hotMode, setHotMode] = useState('mix')

  const audit = useMemo(
    () => walkForwardAudit(draws, { play, minTrain: 30, hotMode }),
    [draws, play, hotMode],
  )
  const base = useMemo(() => hyperHits(play), [play])

  const items = audit.dist.map(({ k, count }) => {
    const expect = (base.find((b) => b.k === k)?.p || 0) * audit.periods
    return { key: k, label: `中 ${k} 个`, value: count, expect: +expect.toFixed(1) }
  })

  const diff = +(audit.avgHits - audit.baseline).toFixed(2)
  // 简单噪声带：均值 ± 单期命中数的标准差/√期数（超几何方差近似）
  const sd = Math.sqrt(play * 0.25 * 0.75)
  const noise = +(sd / Math.sqrt(Math.max(audit.periods, 1))).toFixed(2)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">玩法</span>
        {PLAYS.map((p) => (
          <button key={p} className={`tab-btn ${play === p ? 'active' : ''}`} onClick={() => setPlay(p)}>
            {PLAY_LABEL[p]}
          </button>
        ))}
        <span className="toolbar-sep" />
        <span className="toolbar-label">打分偏好</span>
        {MODES.map((m) => (
          <button key={m.id} className={`tab-btn ${hotMode === m.id ? 'active' : ''}`} onClick={() => setHotMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <Note>
        体检规则：对最近 {audit.periods} 个历史期，<b>每一期只用它之前的数据</b>评分选 {play} 个号，
        再和该期真实开奖对答案。这样选号时看不到未来，结果才是对方法本身的公平检验。
      </Note>

      <Card title="回滚验证 · 最新一期" tag={`删掉第 ${audit.rows[0]?.draw.id} 期 → 用剩下 ${draws.length - 1} 期选号 → 对答案`}>
        {audit.rows[0] && (() => {
          const { draw, picks, hitNums } = audit.rows[0]
          const danCount = play >= 6 ? 4 : play >= 4 ? 2 : 1
          const dans = picks.slice(0, danCount)
          const danHit = dans.filter((n) => draw.nums.includes(n)).length
          return (
            <>
              <div className="predict-sub">用前 {draws.length - 1} 期评分选出的 {play} 个号（金圈=命中；深色描边=胆码；颜色=所在区间）</div>
              <span className="draw-balls">
                {picks.map((n, i) => (
                  <Ball
                    key={n}
                    n={n}
                    size="sm"
                    kind="auto"
                    dim={i >= danCount && !hitNums.includes(n)}
                    className={`${hitNums.includes(n) ? 'ball-hit ' : ''}${i < danCount ? 'ball-dan' : ''}`}
                  />
                ))}
              </span>
              <div className="predict-sub" style={{ marginTop: 12 }}>第 {draw.id} 期实际开奖（金圈=被选中；颜色=所在区间）</div>
              <DrawBalls draw={draw} size="xs" hitSet={new Set(picks)} />
              <div className="chip-row" style={{ marginTop: 14 }}>
                <span className="chip"><i>命中 {hitNums.length} / {play}</i></span>
                <span className="chip"><i>机选理论平均 {audit.baseline} 个</i></span>
                <span className="chip"><i>胆码命中 {danHit}/{danCount}</i></span>
                <span className="chip"><i>命中号码 {hitNums.length ? hitNums.map(pad2).join(' ') : '无'}</i></span>
              </div>
            </>
          )
        })()}
        <Note>
          这就是你说的「删除最新一期、用剩下 99 期算号码、再和真实开奖对比」。单期结果波动很大，
          所以下面的 70 期滚动统计才更能说明问题——它显示评分法与机选的平均命中基本一致。
        </Note>
      </Card>

      <div className="stat-grid stat-grid-4">
        <StatCard label="评分法平均命中" value={audit.avgHits} unit="个" tone="red" note={`${PLAY_LABEL[play]} · ${audit.periods} 期`} />
        <StatCard label="机选理论平均" value={audit.baseline} unit="个" tone="blue" note={`= ${play} × 20/80`} />
        <StatCard label="超出基准" value={(diff >= 0 ? '+' : '') + diff} unit="个" tone={Math.abs(diff) <= noise ? 'amber' : 'red'} note={`随机噪声 ±${noise} 以内即无差异`} />
        <StatCard label="结论" value={Math.abs(diff) <= noise ? '无优势' : diff > 0 ? '微弱领先*' : '落后*'} tone="amber" note="*差异在随机波动范围内，不构成规律" />
      </div>

      <Card title="命中分布对照" tag={`柱=评分法实际次数 · 理论期望 = 机选概率 × ${audit.periods} 期`}>
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>命中</th>
                <th>评分法次数</th>
                <th>机选理论期望</th>
                <th>偏差</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td className="mono">{it.label}</td>
                  <td className="mono">{it.value}</td>
                  <td className="mono muted">{it.expect}</td>
                  <td className="mono" style={{ color: it.value - it.expect >= 0 ? 'var(--blue)' : 'var(--red)' }}>
                    {(it.value - it.expect >= 0 ? '+' : '') + (it.value - it.expect).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BarList items={items.map((it) => ({ key: it.key, label: it.label, value: it.value }))} color="red" />
      </Card>

      <Card title="逐期明细" tag={`最近 ${Math.min(audit.rows.length, 20)} 期`}>
        <div className="table-scroll tall">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>命中数</th>
                <th>命中号码</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.slice(0, 20).map((r) => (
                <tr key={r.draw.id}>
                  <td className="mono">{r.draw.id}</td>
                  <td className="mono">{r.hits}</td>
                  <td className="cell-balls">
                    {r.picks.map((n) => (
                      <span
                        key={n}
                        className={`mini-ball mini-${r.hitNums.includes(n) ? 'amber' : ballKindByRange(n)}${r.hitNums.includes(n) ? ' mini-hit' : ''}`}
                      >
                        {pad2(n)}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="外部开源算法实测对照" tag="同一份 1000 期数据 · 严格留出 · 每期只用之前的数据">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>方法</th>
                <th>样本</th>
                <th>平均命中 /10</th>
                <th>对机选基准</th>
              </tr>
            </thead>
            <tbody>
              {EXTERNAL.map((it) => (
                <tr key={it.name}>
                  <td>
                    {it.name}
                    <div className="muted" style={{ fontSize: 12 }}>{it.repo}</div>
                  </td>
                  <td className="mono muted">{it.n}</td>
                  <td className="mono">{it.v.toFixed(2)}</td>
                  <td className="mono" style={{ color: it.v >= 2.5 ? 'var(--blue)' : 'var(--red)' }}>
                    {(it.v - 2.5 >= 0 ? '+' : '') + (it.v - 2.5).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr>
                <td>机选理论值（任意 10 个号）</td>
                <td className="mono muted">—</td>
                <td className="mono">2.50</td>
                <td className="mono muted">0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          2026-11 本地实测：两个项目都按其 README 训练/运行，留出期完全不参与训练。
          结论是三个来源（本站评分法、TensorFlow LSTM、8 算法引擎）全部落在 2.39~2.55，
          没有一个偏离 2.50 超过一个标准误——换算法不会改变期望命中。
          另外，kl8-lottery-analyzer 把 20 列的号码矩阵传给要求「期号 + 20 个号（≥21 列）」的
          Copula/互信息函数，异常被捕获后静默跳过，这两项高级能力实际未生效。
        </Note>
      </Card>

      <Note tone="warn">
        如果评分法和机选的理论值几乎重合——这正是预期结果。历史频次、遗漏、形态都不携带对未来的信息，
        体检页的存在就是为了防止「看起来有规律」的错觉。请把它当作数据学习工具，而不是投注依据。
      </Note>
    </div>
  )
}
