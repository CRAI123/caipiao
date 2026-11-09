// 福彩3D 方法体检 —— 滚动回测：每期只用「之前」的数据预测，与真实开奖对比
// 支持 v1 / v2 双算法对比
import React, { useMemo, useState } from 'react'
import { Card, Note, StatCard } from './common.jsx'
import {
  walkForwardAuditFC3D, predictFC3D, analyzeDraw,
  walkForwardAuditFC3Dv2, predictFC3Dv2,
} from '../lib/fc3dPredict.js'

const PERIODS = [20, 30, 50, 80]

function Digit({ d, hit }) {
  return (
    <span className={`digit-ball ${hit ? 'hot' : ''}`} style={hit ? {} : { opacity: 0.45 }}>
      {d}
    </span>
  )
}

export default function FC3DAudit({ draws }) {
  const [periods, setPeriods] = useState(30)
  const [algo, setAlgo] = useState('v2')

  const audit = useMemo(
    () => (algo === 'v2'
      ? walkForwardAuditFC3Dv2(draws, { periods, minTrain: 20 })
      : walkForwardAuditFC3D(draws, { periods, minTrain: 20 })),
    [draws, periods, algo],
  )

  // v1 vs v2 对比
  const compare = useMemo(() => {
    if (draws.length < 40) return null
    const a1 = walkForwardAuditFC3D(draws, { periods, minTrain: 20 })
    const a2 = walkForwardAuditFC3Dv2(draws, { periods, minTrain: 20 })
    return { a1, a2 }
  }, [draws, periods])

  // 最新一期的回滚验证
  const rollback = useMemo(() => {
    if (draws.length < 21) return null
    const train = draws.slice(1)
    const actual = draws[0]
    const pred = algo === 'v2' ? predictFC3Dv2(train) : predictFC3D(train)
    if (!pred) return null
    const a = analyzeDraw(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.filter((d) => allRec.includes(d))
    return { draw: actual, prediction: pred, hits, analysis: a }
  }, [draws, algo])

  if (audit.periods === 0) {
    return (
      <div className="page">
        <Note>数据不足，至少需要 40 期才能进行滚动回测。</Note>
      </div>
    )
  }

  const diff = +(audit.avgHits - audit.baseline).toFixed(2)
  const avgScore = audit.rows.length
    ? +(audit.rows.reduce((s, r) => s + r.score, 0) / audit.rows.length).toFixed(1)
    : 0

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">回测期数</span>
        {PERIODS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${periods === n ? 'active' : ''}`}
            onClick={() => setPeriods(n)}
          >
            近 {n} 期
          </button>
        ))}
        <span className="toolbar-sep" />
        <span className="toolbar-label">算法</span>
        <button className={`tab-btn ${algo === 'v1' ? 'active' : ''}`} onClick={() => setAlgo('v1')}>经典 v1</button>
        <button className={`tab-btn ${algo === 'v2' ? 'active' : ''}`} onClick={() => setAlgo('v2')}>精准 v2</button>
      </div>

      <Note>
        体检规则：对最近 {audit.periods} 个历史期，<b>每一期只用它之前的数据</b>推算胆码/拖码，
        再和该期真实开奖对答案。这样预测时看不到未来，结果才是对方法本身的公平检验。
      </Note>

      {/* v1 vs v2 对比 */}
      {compare && (
        <Card title="算法对比" tag={`近 ${periods} 期滚动回测`}>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th>经典 v1</th>
                  <th>精准 v2</th>
                  <th>机选基准</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>平均组选命中</td>
                  <td className="mono">{compare.a1.avgHits}</td>
                  <td className="mono"><b>{compare.a2.avgHits}</b></td>
                  <td className="mono muted">{compare.a1.baseline}</td>
                </tr>
                <tr>
                  <td>跨度命中率</td>
                  <td className="mono">{compare.a1.spanRate}%</td>
                  <td className="mono"><b>{compare.a2.spanRate}%</b></td>
                  <td className="muted">—</td>
                </tr>
                <tr>
                  <td>和值命中率</td>
                  <td className="mono">{compare.a1.sumRate}%</td>
                  <td className="mono"><b>{compare.a2.sumRate}%</b></td>
                  <td className="muted">—</td>
                </tr>
                <tr>
                  <td>奇偶命中率</td>
                  <td className="mono">{compare.a1.oddRate}%</td>
                  <td className="mono">{compare.a2.oddRate}%</td>
                  <td className="muted">—</td>
                </tr>
                <tr>
                  <td>形态命中率</td>
                  <td className="mono">{compare.a1.formRate}%</td>
                  <td className="mono">{compare.a2.formRate}%</td>
                  <td className="muted">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Note>
            v2 在跨度/和值区间估计上更准（用正态分布 ±1σ，覆盖约 68% 样本），
            但<b>数字平均命中仍在 1.8 附近</b>，与机选基准几乎重合——这正是独立随机事件的诚实结论。
          </Note>
        </Card>
      )}

      {/* 回滚验证 */}
      {rollback && (
        <Card title="回滚验证 · 最新一期" tag={`删掉第 ${rollback.draw.id} 期 → 用剩下 ${draws.length - 1} 期推算 → 对答案`}>
          <div className="predict-sub">推算出的胆码（金圈=命中）+ 拖码</div>
          <div className="fc3d-digits" style={{ marginBottom: 12 }}>
            {rollback.prediction.dan.map((d) => (
              <Digit key={`rb-dan-${d}`} d={d} hit={rollback.hits.includes(d)} />
            ))}
            <span className="muted" style={{ margin: '0 8px' }}>拖</span>
            {rollback.prediction.tuo.map((d) => (
              <Digit key={`rb-tuo-${d}`} d={d} hit={rollback.hits.includes(d)} />
            ))}
          </div>
          <div className="predict-sub">第 {rollback.draw.id} 期实际开奖</div>
          <div className="fc3d-digits">
            {rollback.draw.num.map((d, i) => (
              <span key={i} className="digit-ball">{d}</span>
            ))}
          </div>
          <div className="chip-row" style={{ marginTop: 14 }}>
            <span className="chip"><i>组选命中 {rollback.hits.length}/3</i></span>
            <span className="chip"><i>跨度 {rollback.analysis.span}（推 {rollback.prediction.spanRange.join('-')}）</i></span>
            <span className="chip"><i>和值 {rollback.analysis.sum}（推 {rollback.prediction.sumRange.join('-')}）</i></span>
            <span className="chip"><i>{rollback.analysis.oddPattern} · {rollback.analysis.form}</i></span>
          </div>
          <Note>单期结果波动很大，下面的 {audit.periods} 期滚动统计才更能说明问题。</Note>
        </Card>
      )}

      {/* 核心指标 */}
      <div className="stat-grid stat-grid-4">
        <StatCard label="平均组选命中" value={audit.avgHits} unit="个" tone="red" note={`${audit.periods} 期`} />
        <StatCard label="机选理论平均" value={audit.baseline} unit="个" tone="blue" note="6 码中 3 的期望" />
        <StatCard label="超出基准" value={(diff >= 0 ? '+' : '') + diff} unit="个" tone={Math.abs(diff) <= 0.3 ? 'amber' : 'red'} note="±0.3 以内即无差异" />
        <StatCard label="平均综合评分" value={avgScore} unit="分" tone="amber" note="满分 100" />
      </div>

      {/* 各项命中率 */}
      <div className="stat-grid stat-grid-4">
        <StatCard label="跨度命中率" value={`${audit.spanRate}%`} tone="blue" note="预测跨度范围" />
        <StatCard label="和值命中率" value={`${audit.sumRate}%`} tone="blue" note="预测和值范围" />
        <StatCard label="奇偶命中率" value={`${audit.oddRate}%`} tone="amber" note="推荐奇偶形态" />
        <StatCard label="形态命中率" value={`${audit.formRate}%`} tone="green" note="组三/组六/豹子/顺子" />
      </div>

      {/* 命中分布 */}
      <Card title="组选命中分布" tag={`柱=实际次数 · 机选期望 = 概率 × ${audit.periods} 期`}>
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>命中</th>
                <th>实际次数</th>
                <th>机选理论期望</th>
                <th>偏差</th>
              </tr>
            </thead>
            <tbody>
              {audit.dist.map(({ k, count }) => {
                // 机选期望：从 10 个里选 6 个，命中 k 个的概率
                // P(k) = C(3,k)*C(7,6-k)/C(10,6)
                const c = (n, r) => {
                  if (r < 0 || r > n) return 0
                  let v = 1
                  for (let i = 0; i < r; i++) v = v * (n - i) / (i + 1)
                  return v
                }
                const p = (c(3, k) * c(7, 6 - k)) / c(10, 6)
                const expect = +(p * audit.periods).toFixed(1)
                return (
                  <tr key={k}>
                    <td className="mono">中 {k} 个</td>
                    <td className="mono">{count}</td>
                    <td className="mono muted">{expect}</td>
                    <td className="mono" style={{ color: count - expect >= 0 ? 'var(--blue)' : 'var(--red)' }}>
                      {(count - expect >= 0 ? '+' : '') + (count - expect).toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 逐期明细 */}
      <Card title="逐期明细" tag={`最近 ${Math.min(audit.rows.length, 20)} 期`}>
        <div className="table-scroll tall">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>实际开奖</th>
                <th>胆码</th>
                <th>拖码</th>
                <th>命中</th>
                <th>跨</th>
                <th>和</th>
                <th>奇</th>
                <th>形</th>
                <th>评分</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.slice(0, 20).map((r) => (
                <tr key={r.draw.id}>
                  <td className="mono">{String(r.draw.id).slice(-4)}</td>
                  <td className="mono">{r.draw.num.join(' ')}</td>
                  <td className="mono">{r.prediction.dan.join(' ')}</td>
                  <td className="mono muted">{r.prediction.tuo.join(' ')}</td>
                  <td className="mono">{r.hits}/3</td>
                  <td className="mono">{r.spanHit ? '✓' : '✗'}</td>
                  <td className="mono">{r.sumHit ? '✓' : '✗'}</td>
                  <td className="mono">{r.oddHit ? '✓' : '✗'}</td>
                  <td className="mono">{r.formHit ? '✓' : '✗'}</td>
                  <td className="mono">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Note tone="warn">
        如果推算结果和机选的理论值几乎重合——这正是预期结果。历史频次、遗漏、形态都不携带对未来的信息，
        体检页的存在就是为了防止「看起来有规律」的错觉。请把它当作数据学习工具，而不是投注依据。
      </Note>
    </div>
  )
}
