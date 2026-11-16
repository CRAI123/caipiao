// 双色球 方法体检 —— 滚动回测：每期只用之前的数据推算，再与真实开奖对比
import React, { useMemo, useState } from 'react'
import { Card, StatCard, Note, Ball } from './common.jsx'
import { walkForwardAuditSSQ, PRIZE_TABLE } from '../lib/ssqPredict.js'
import AiHitLog from './AiHitLog.jsx'

const PERIODS = [30, 50, 80, 120]

export default function SSQAudit({ draws }) {
  const [periods, setPeriods] = useState(50)
  const audit = useMemo(
    () => walkForwardAuditSSQ(draws, { periods, minTrain: 30 }),
    [draws, periods],
  )

  const redDelta = (audit.avgRedHits - audit.baselineRed).toFixed(3)
  const blueDelta = (audit.blueRate - audit.baselineBlue).toFixed(1)
  const prizeMap = {}
  for (const r of audit.rows) if (r.prize) prizeMap[r.prize] = (prizeMap[r.prize] || 0) + 1

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">回测期数</span>
        {PERIODS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${periods === n ? 'active' : ''}`}
            onClick={() => setPeriods(n)}
            disabled={n > draws.length - 30}
          >
            {n} 期
          </button>
        ))}
        <span className="toolbar-note">训练窗口：每期之前全部数据（最少 30 期）</span>
      </div>

      <Note>
        滚动回测的规则：预测第 t 期时，只使用第 t 期之前的开奖数据，绝不使用未来信息。
        这样得到的命中率才是该方法真实的水平。
      </Note>

      <div className="stat-grid">
        <StatCard
          label="红球平均命中"
          value={audit.avgRedHits}
          note={`纯随机基准 ${audit.baselineRed} · 差 ${redDelta > 0 ? '+' : ''}${redDelta}`}
        />
        <StatCard
          label="蓝球命中率"
          value={`${audit.blueRate}%`}
          tone="blue"
          note={`纯随机基准 ${audit.baselineBlue}% · 差 ${blueDelta > 0 ? '+' : ''}${blueDelta}`}
        />
        <StatCard
          label="中奖期数"
          value={`${audit.winCount} / ${audit.periods}`}
          tone="amber"
          note="含六等奖（仅中蓝球）"
        />
        <StatCard
          label="样本期数"
          value={audit.periods}
          tone="green"
          note={`数据总量 ${draws.length} 期`}
        />
      </div>

      <Card title="红球命中分布" tag={`${audit.periods} 期`}>
        <div className="ssq-dist-bars">
          {audit.dist.map((d) => (
            <div key={d.k} className="ssq-dist-item">
              <div className="ssq-dist-bar-wrap">
                <div
                  className="ssq-dist-bar"
                  style={{ height: `${(d.count / Math.max(...audit.dist.map((x) => x.count), 1)) * 100}%` }}
                />
              </div>
              <div className="ssq-dist-label">{d.k} 中</div>
              <div className="ssq-dist-val mono">{d.count}</div>
            </div>
          ))}
        </div>
        <div className="mono small muted" style={{ marginTop: 10 }}>
          理论期望：0 中 {(audit.periods * 0.304).toFixed(1)} 期 · 1 中 {(audit.periods * 0.437).toFixed(1)} 期 · 2 中{' '}
          {(audit.periods * 0.198).toFixed(1)} 期 · 3 中 {(audit.periods * 0.053).toFixed(1)} 期
        </div>
        <Note>
          命中个数的理论分布来自超几何分布（33 选 6，实际开出 6 个）。若实测与理论接近，
          说明方法没有提供额外信息——这正是随机开奖应有的结果。
        </Note>
      </Card>

      <Card title="奖级分布" tag="回测期间">
        {audit.winCount ? (
          <div className="ssq-wuxing-grid">
            {PRIZE_TABLE.map((p) => (
              <div key={p.level} className="ssq-wuxing-item">
                <div className="ssq-wuxing-name">{p.level}</div>
                <div className="ssq-wuxing-count">{prizeMap[p.level] || 0}</div>
                <div className="ssq-wuxing-nums mono">{p.condition}</div>
              </div>
            ))}
          </div>
        ) : (
          <Note>回测期间没有中奖，属正常情况（任意一注中奖率约 6.7%）。</Note>
        )}
      </Card>

      <Card title="逐期明细" tag="最新在前">
        <div className="table-scroll tall">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>实际开奖</th>
                <th>推荐红球</th>
                <th>推荐蓝球</th>
                <th>红球命中</th>
                <th>蓝球</th>
                <th>奖级</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.slice(0, 100).map((r) => {
                const hitSet = new Set(r.prediction.red)
                const actualHit = r.draw.red.filter((n) => hitSet.has(n))
                return (
                  <tr key={r.draw.id}>
                    <td className="mono">{r.draw.id}</td>
                    <td>
                      <span className="ssq-repeat-nums">
                        {r.draw.red.map((n) => (
                          <Ball
                            key={`a${n}`}
                            n={n}
                            kind="red"
                            size="xs"
                            className={hitSet.has(n) ? 'ball-hit' : ''}
                          />
                        ))}
                        <span className="ssq-divider" aria-hidden="true" />
                        <Ball
                          n={r.draw.blue}
                          kind="blue"
                          size="xs"
                          className={r.blueHit ? 'ball-hit' : ''}
                        />
                      </span>
                    </td>
                    <td>
                      <span className="ssq-repeat-nums">
                        {r.prediction.red.map((n) => (
                          <Ball key={`p${n}`} n={n} kind="red" size="xs" dim={!actualHit.includes(n)} />
                        ))}
                      </span>
                    </td>
                    <td>
                      <Ball n={r.prediction.blue} kind="blue" size="xs" dim={!r.blueHit} />
                    </td>
                    <td className="mono">{r.redHits}</td>
                    <td>{r.blueHit ? '中' : '—'}</td>
                    <td>
                      {r.prize ? (
                        <span className="prize-badge prize-badge-win">{r.prize}</span>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AiHitLog kind="ssq" game="ssq" draws={draws} />

      <Note tone="warn">
        回测结果与理论基准的差异属于随机波动。样本越小波动越大，
        请勿把某一时段的“超出基准”理解为方法有效。
      </Note>
    </div>
  )
}
