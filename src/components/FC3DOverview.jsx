// 福彩3D 总览页 —— 最新开奖、关键指标、近期走势速览
import React from 'react'
import { Card, StatCard, Note } from './common.jsx'
import {
  analyzeDraw,
  digitFrequency,
  digitMissing,
  spanDistribution,
  sumDistribution,
  formDistribution,
  sizeDistribution,
  primeDistribution,
  hotColdClass,
  takeLatest,
} from '../lib/fc3dStats.js'

export default function FC3DOverview({ draws }) {
  if (!draws.length) return <Note>暂无数据</Note>
  const latest = draws[0]
  const a = analyzeDraw(latest.num)

  const freq = digitFrequency(draws, 30)
  const omit = digitMissing(draws, 30)
  const { hot, cold } = hotColdClass(freq)
  const spanDist = spanDistribution(draws, 30)
  const sumDist = sumDistribution(draws, 30)
  const formDist = formDistribution(draws, 50)
  const sizeDist = sizeDistribution(draws, 30)
  const primeDist = primeDistribution(draws, 30)

  const recent = takeLatest(draws, 10)

  return (
    <div className="page">
      <Card title="最新一期" tag={`第 ${latest.id} 期${latest.date ? ' · ' + latest.date : ''}`}>
        <div className="fc3d-latest">
          {latest.num.map((d, i) => (
            <div key={i} className="fc3d-pos-col">
              <div className="fc3d-pos-label">{['百', '十', '个'][i]}</div>
              <div className="fc3d-latest-ball">{d}</div>
            </div>
          ))}
        </div>
        <div className="fc3d-latest-meta mono">
          <span>和值 {a.sum}</span>
          <span>跨度 {a.span}</span>
          <span>合值 {a.sumTail}</span>
          <span>{a.oddPattern}</span>
          <span>{a.form}</span>
          <span>质{a.primeCount}/合{3 - a.primeCount}</span>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard label="近30期和值均值" value={sumDist.avg} note="理论均值 13.5" />
        <StatCard label="近30期跨度均值" value={spanDist.avg} tone="blue" note="理论均值约 5.5" />
        <StatCard label="近50期组三占比" value={`${((formDist.find(([f]) => f === '组三')?.[1] || 0) / 50 * 100).toFixed(0)}%`} tone="amber" note="理论约 27%" />
        <StatCard label="近30期大号占比" value={`${sizeDist.bigPct}%`} tone="green" note={`小${sizeDist.smallPct}% / 中${sizeDist.midPct}%`} />
      </div>

      <Card title="近期开奖" tag="最近 10 期">
        <div className="fc3d-recent-list">
          {recent.map((d) => {
            const da = analyzeDraw(d.num)
            return (
              <div key={d.id} className="fc3d-recent-row">
                <span className="mono muted">{String(d.id).slice(-4)}</span>
                <span className="fc3d-recent-num mono">{d.num.join(' ')}</span>
                <span className="muted">和{da.sum}</span>
                <span className="muted">跨{da.span}</span>
                <span className="muted">{da.form}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="two-col">
        <Card title="热号 Top3" tag="近30期">
          <div className="fc3d-digits">
            {hot.map((d) => (
              <span key={d} className="digit-ball hot">{d}<em>{omit[d]}</em></span>
            ))}
          </div>
        </Card>
        <Card title="冷号 Top3" tag="近30期">
          <div className="fc3d-digits">
            {cold.map((d) => (
              <span key={d} className="digit-ball cold">{d}<em>{omit[d]}</em></span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
