// 大乐透 方法体检 —— 滚动回测：每期只用之前的数据推算，再与真实开奖对比
import React, { useMemo, useState } from 'react'
import { Card, StatCard, Note, Ball } from './common.jsx'
import { walkForwardAuditDLT, PRIZE_TABLE, FRONT_PICK, BACK_PICK } from '../lib/dltPredict.js'
import AiHitLog from './AiHitLog.jsx'
import RandomnessCard from './RandomnessCard.jsx'

const PERIODS = [30, 50, 80, 120]

/** 5/35 前区命中分布的理论占比（超几何分布） */
const THEORY = [0.439, 0.4221, 0.1251, 0.0134, 0.00046, 0.0000031]

export default function DLTAudit({ draws }) {
  const [periods, setPeriods] = useState(50)
  const audit = useMemo(() => walkForwardAuditDLT(draws, { periods, minTrain: 30 }), [draws, periods])

  const frontDelta = (audit.avgFrontHits - audit.baselineFront).toFixed(3)
  const backDelta = (audit.backRate - audit.baselineBack).toFixed(1)
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
          label="前区平均命中"
          value={audit.avgFrontHits}
          note={`纯随机基准 ${audit.baselineFront} · 差 ${frontDelta > 0 ? '+' : ''}${frontDelta}`}
        />
        <StatCard
          label="后区全中率"
          value={`${audit.backRate}%`}
          tone="blue"
          note={`纯随机基准 ${audit.baselineBack}% · 差 ${backDelta > 0 ? '+' : ''}${backDelta}`}
        />
        <StatCard
          label="中奖期数"
          value={`${audit.winCount} / ${audit.periods}`}
          tone="amber"
          note="含九等奖（最低奖级）"
        />
        <StatCard label="样本期数" value={audit.periods} tone="green" note={`数据总量 ${draws.length} 期`} />
      </div>

      <Card title="前区命中分布" tag={`${audit.periods} 期`}>
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
          理论期望：
          {audit.dist
            .map((d) => `${d.k} 中 ${(audit.periods * (THEORY[d.k] || 0)).toFixed(1)} 期`)
            .join(' · ')}
        </div>
        <Note>
          命中个数的理论分布来自超几何分布（35 选 5，实际开出 5 个）。若实测与理论接近，
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
                <th>推荐前区</th>
                <th>推荐后区</th>
                <th>前区命中</th>
                <th>后区</th>
                <th>奖级</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.slice(0, 100).map((r) => {
                const hitSet = new Set(r.prediction.front)
                const actualHit = r.draw.front.filter((n) => hitSet.has(n))
                const backSet = new Set(r.prediction.back)
                return (
                  <tr key={r.draw.id}>
                    <td className="mono">{r.draw.id}</td>
                    <td>
                      <span className="ssq-repeat-nums">
                        {r.draw.front.map((n) => (
                          <Ball key={`a${n}`} n={n} kind="red" size="xs" className={hitSet.has(n) ? 'ball-hit' : ''} />
                        ))}
                        <span className="ssq-divider" aria-hidden="true" />
                        {r.draw.back.map((n) => (
                          <Ball key={`ab${n}`} n={n} kind="blue" size="xs" className={backSet.has(n) ? 'ball-hit' : ''} />
                        ))}
                      </span>
                    </td>
                    <td>
                      <span className="ssq-repeat-nums">
                        {r.prediction.front.map((n) => (
                          <Ball key={`p${n}`} n={n} kind="red" size="xs" dim={!actualHit.includes(n)} />
                        ))}
                      </span>
                    </td>
                    <td>
                      <span className="ssq-repeat-nums">
                        {r.prediction.back.map((n) => (
                          <Ball key={`pb${n}`} n={n} kind="blue" size="xs" dim={!r.draw.back.includes(n)} />
                        ))}
                      </span>
                    </td>
                    <td className="mono">{r.frontHits}</td>
                    <td className="mono">{r.backHits}/{BACK_PICK}</td>
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

      <AiHitLog kind="dlt" game="dlt" draws={draws} />

      <Note tone="warn">
        回测结果与理论基准的差异属于随机波动。样本越小波动越大，
        请勿把某一时段的“超出基准”理解为方法有效。
      </Note>

      <RandomnessCard draws={draws} game="dlt" maxNum={35} />
    </div>
  )
}
