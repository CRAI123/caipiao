// 福彩3D 方法体检 —— 滚动回测：每期只用「之前」的数据预测，与真实开奖对比
// 排列三额外提供 Pro 档位（9 专家 + Hedge 自适应权重 + 结构约束）
import React, { useMemo, useState } from 'react'
import { Card, Note, StatCard } from './common.jsx'
import * as fc3dEngine from '../lib/fc3dPredict.js'

const PERIODS = [20, 30, 50, 80]

const AUDIT_FN = {
  v1: 'walkForwardAuditFC3D',
  v2: 'walkForwardAuditFC3Dv2',
  v4: 'walkForwardAuditFC3Dv4',
  pro: 'walkForwardAuditPL3Pro',
}
const PREDICT_FN = { v1: 'predictFC3D', v2: 'predictFC3Dv2', v4: 'predictFC3Dv4', pro: 'predictPL3Pro' }

// 3 位 0-9 均匀开奖下的精确分布，用来算「给定取值个数时的命中率上限」
const SUM_DIST = (() => {
  const c = Array(28).fill(0)
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let d = 0; d < 10; d++) c[a + b + d]++
  return c.map((v) => v / 1000)
})()
const SPAN_DIST = (() => {
  const c = Array(10).fill(0)
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      for (let d = 0; d < 10; d++) c[Math.max(a, b, d) - Math.min(a, b, d)]++
    }
  }
  return c.map((v) => v / 1000)
})()
function bestCoverage(dist, width) {
  let m = 0
  for (let i = 0; i + width < dist.length; i++) {
    let s = 0
    for (let j = i; j <= i + width; j++) s += dist[j]
    if (s > m) m = s
  }
  return +((m || 0) * 100).toFixed(1)
}

function Digit({ d, hit }) {
  return (
    <span className={`digit-ball ${hit ? 'hot' : ''}`} style={hit ? {} : { opacity: 0.45 }}>
      {d}
    </span>
  )
}

export default function FC3DAudit({
  draws,
  engine = fc3dEngine,
  defaultPeriods = 30,
  v2Label = '精准 v2',
  proEnabled = false,
  proLabel = '排列三 v3 Pro',
}) {
  const [periods, setPeriods] = useState(defaultPeriods)
  const [algo, setAlgo] = useState('v2')
  // v4 只存在于 3D/排列三引擎；其他引擎（或旧引擎）没有这两个函数时不展示该档，避免调用未定义
  const v4Enabled =
    typeof engine.walkForwardAuditFC3Dv4 === 'function' && typeof engine.predictFC3Dv4 === 'function'

  const audit = useMemo(
    () => engine[AUDIT_FN[algo]](draws, { periods, minTrain: algo === 'pro' ? 40 : 20 }),
    [draws, periods, algo, engine],
  )

  // v1 vs v2 vs v4 指标档（vs Pro）对比
  const compare = useMemo(() => {
    if (draws.length < 40) return null
    const a1 = engine.walkForwardAuditFC3D(draws, { periods, minTrain: 20 })
    const a2 = engine.walkForwardAuditFC3Dv2(draws, { periods, minTrain: 20 })
    const a4 = v4Enabled ? engine.walkForwardAuditFC3Dv4(draws, { periods, minTrain: 20 }) : null
    const a3 = proEnabled
      ? engine.walkForwardAuditPL3Pro(draws, { periods, minTrain: 40 })
      : null
    return { a1, a2, a4, a3 }
  }, [draws, periods, engine, proEnabled, v4Enabled])

  // 理论上限：由实际给出的取值个数反推，与任何算法无关
  const ceiling = useMemo(() => {
    if (!compare) return null
    const avgWidth = (key) => {
      const rows = compare.a2.rows
      if (!rows.length) return 0
      return rows.reduce((s, r) => s + (r.prediction[key][1] - r.prediction[key][0]), 0) / rows.length
    }
    const oddCount = compare.a2.rows[0]?.prediction.recommendedOdd.length || 6
    return {
      hits: compare.a1.baseline,
      span: bestCoverage(SPAN_DIST, Math.round(avgWidth('spanRange'))),
      sum: bestCoverage(SUM_DIST, Math.round(avgWidth('sumRange'))),
      odd: +((oddCount / 8) * 100).toFixed(1),
      form: 99.9,
      pos: 48.8, // 每位取 2 码时，至少中 1 位的概率 = 1 - 0.8³
    }
  }, [compare])

  // 最新一期的回滚验证
  const rollback = useMemo(() => {
    if (draws.length < 21) return null
    const train = draws.slice(1)
    const actual = draws[0]
    const pred = engine[PREDICT_FN[algo]](train)
    if (!pred) return null
    const a = engine.analyzeDraw(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.filter((d) => allRec.includes(d))
    return { draw: actual, prediction: pred, hits, analysis: a }
  }, [draws, algo, engine])

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
        <button className={`tab-btn ${algo === 'v2' ? 'active' : ''}`} onClick={() => setAlgo('v2')}>{v2Label}</button>
        {v4Enabled && (
          <button className={`tab-btn ${algo === 'v4' ? 'active' : ''}`} onClick={() => setAlgo('v4')}>v4 技术指标</button>
        )}
        {proEnabled && (
          <button className={`tab-btn ${algo === 'pro' ? 'active' : ''}`} onClick={() => setAlgo('pro')}>
            {proLabel}
          </button>
        )}
      </div>

      <Note>
        体检规则：对最近 {audit.periods} 个历史期，<b>每一期只用它之前的数据</b>推算胆码/拖码，
        再和该期真实开奖对答案。这样预测时看不到未来，结果才是对方法本身的公平检验。
      </Note>

      {/* v1 vs v2 vs Pro 对比 */}
      {compare && (
        <Card title="算法对比" tag={`近 ${periods} 期滚动回测`}>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th>经典 v1</th>
                  <th>{v2Label}</th>
                  {v4Enabled && <th>v4 技术指标</th>}
                  {proEnabled && <th>{proLabel}</th>}
                  <th>机选基准</th>
                  <th>理论上限</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>平均组选命中</td>
                  <td className="mono">{compare.a1.avgHits}</td>
                  <td className="mono"><b>{compare.a2.avgHits}</b></td>
                  {v4Enabled && <td className="mono">{compare.a4.avgHits}</td>}
                  {proEnabled && <td className="mono"><b>{compare.a3?.avgHits}</b></td>}
                  <td className="mono muted">{compare.a1.baseline}</td>
                  <td className="mono muted">{ceiling?.hits}</td>
                </tr>
                <tr>
                  <td>跨度命中率</td>
                  <td className="mono">{compare.a1.spanRate}%</td>
                  <td className="mono"><b>{compare.a2.spanRate}%</b></td>
                  {v4Enabled && <td className="mono">{compare.a4.spanRate}%</td>}
                  {proEnabled && <td className="mono"><b>{compare.a3?.spanRate}%</b></td>}
                  <td className="muted">—</td>
                  <td className="mono muted">{ceiling?.span}%</td>
                </tr>
                <tr>
                  <td>和值命中率</td>
                  <td className="mono">{compare.a1.sumRate}%</td>
                  <td className="mono"><b>{compare.a2.sumRate}%</b></td>
                  {v4Enabled && <td className="mono">{compare.a4.sumRate}%</td>}
                  {proEnabled && <td className="mono"><b>{compare.a3?.sumRate}%</b></td>}
                  <td className="muted">—</td>
                  <td className="mono muted">{ceiling?.sum}%</td>
                </tr>
                <tr>
                  <td>奇偶命中率</td>
                  <td className="mono">{compare.a1.oddRate}%</td>
                  <td className="mono">{compare.a2.oddRate}%</td>
                  {v4Enabled && <td className="mono">{compare.a4.oddRate}%</td>}
                  {proEnabled && <td className="mono"><b>{compare.a3?.oddRate}%</b></td>}
                  <td className="muted">—</td>
                  <td className="mono muted">{ceiling?.odd}%</td>
                </tr>
                <tr>
                  <td>形态命中率</td>
                  <td className="mono">{compare.a1.formRate}%</td>
                  <td className="mono">{compare.a2.formRate}%</td>
                  {v4Enabled && <td className="mono">{compare.a4.formRate}%</td>}
                  {proEnabled && <td className="mono">{compare.a3?.formRate}%</td>}
                  <td className="muted">—</td>
                  <td className="mono muted">{ceiling?.form}%</td>
                </tr>
                {proEnabled && (
                  <tr>
                    <td>定位至少中 1 位</td>
                    <td className="muted">—</td>
                    <td className="muted">—</td>
                    {v4Enabled && <td className="muted">—</td>}
                    <td className="mono"><b>{compare.a3?.posRate}%</b></td>
                    <td className="muted">—</td>
                    <td className="mono muted">{ceiling?.pos}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Note>
            {v2Label} 用四个窗口的频率 + 位置转移合成概率，再穷举 1000 种结果得到和值/跨度/奇偶的
            精确分布，区间按覆盖目标取最短段落（80% → 奇偶取 7 种，上限 87.5%）。
            {v4Enabled && (
              <>
                v4 技术指标档把和值/跨度区间换成 MA5 + 布林 + MACD 投影，并叠加和值兼容度与 KDJ 读数修正，
                参数固定、不做逐期调优——它只是换了一种描述方式，和 v2 的差异属于随机波动。
              </>
            )}
            {proEnabled && (
              <>
                {' '}
                {proLabel} 在此基础上换成 9 个专家并用 Hedge 自动定权重，再叠加跨度/和值/形态/奇偶/
                和值尾/重号六个结构约束，区间宽度不变但命中率略高；数字命中与 v2 的差距仍在随机波动内。
              </>
            )}
            <br />
            <b>「理论上限」列</b>是按同样取值个数、在真实均匀分布下能拿到的最高命中率。可以看到实测值
            已经贴着上限——想再高只能加宽区间（多加取值），那是纯粹的覆盖面扩张，没有任何信息增益。
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
