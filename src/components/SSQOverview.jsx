// 双色球 总览 —— 最新开奖、结构指标、近期走势、冷热速览
import React from 'react'
import { Card, StatCard, Note, Ball, SsqDraw } from './common.jsx'
import {
  analyzeDraw,
  patternSummary,
  redStats,
  blueStats,
  recent5Pool,
  RED_NUMS,
  BLUE_NUMS,
} from '../lib/ssqPredict.js'

export default function SSQOverview({ draws }) {
  if (!draws || !draws.length) return <Note>暂无数据</Note>

  const latest = draws[0]
  const a = analyzeDraw(latest)
  const p = patternSummary(draws, 30)
  const rStats = redStats(draws)
  const bStats = blueStats(draws)
  const pool = recent5Pool(draws)

  const hot = [...rStats].sort((x, y) => y.count - x.count).slice(0, 6)
  const cold = [...rStats].sort((x, y) => y.curOmit - x.curOmit).slice(0, 6)
  const blueHot = [...bStats].sort((x, y) => y.count - x.count).slice(0, 4)

  const zone3Text = (z) => (z || []).join(':')
  const recent = draws.slice(0, 10)

  // 近 30 期相对理论值的偏离（用于诚实提示）
  const oddRatio = ((p.oddDist.reduce((s, x) => s + x.v * x.count, 0) / p.period) || 0).toFixed(2)
  const bigRatio = ((p.bigDist.reduce((s, x) => s + x.v * x.count, 0) / p.period) || 0).toFixed(2)

  return (
    <div className="page">
      <Card title="最新一期" tag={`第 ${latest.id} 期${latest.date ? ' · ' + latest.date : ''}`}>
        <div className="ssq-latest">
          {latest.red.map((n) => (
            <Ball key={n} n={n} kind="red" size="lg" />
          ))}
          <span className="ssq-divider ssq-divider-lg" aria-hidden="true" />
          <Ball n={latest.blue} kind="blue" size="lg" />
        </div>
        <div className="fc3d-latest-meta mono">
          <span>和值 {a.sum}</span>
          <span>跨度 {a.span}</span>
          <span>AC {a.ac}</span>
          <span>三区 {zone3Text(a.zone3)}</span>
          <span>大小 {a.big}:{a.small}</span>
          <span>单双 {a.odd}:{a.even}</span>
          <span>质合 {a.prime}:{a.composite}</span>
          <span>尾号组数 {a.tailGroups}</span>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard
          label="近 30 期和值均值"
          value={p.sumAvg}
          note={`区间 ${p.sumMin} – ${p.sumMax} · 理论均值 102`}
        />
        <StatCard
          label="近 30 期跨度均值"
          value={p.spanAvg}
          tone="blue"
          note="6 红球跨度的均值约 24.3"
        />
        <StatCard
          label="近 30 期奇数均值"
          value={oddRatio}
          tone="amber"
          note="理论均值 3.0 个 / 期"
        />
        <StatCard
          label="近 30 期大数均值"
          value={bigRatio}
          tone="green"
          note="大号 ≥17，理论均值 3.0 个 / 期"
        />
      </div>

      <Card title="近期开奖" tag="最近 10 期">
        <div className="ssq-recent-list">
          {recent.map((d) => {
            const da = analyzeDraw(d)
            return (
              <div key={d.id} className="ssq-recent-row">
                <span className="mono muted">{String(d.id).slice(-5)}</span>
                <span className="mono muted ssq-recent-date">{d.date || '—'}</span>
                <SsqDraw draw={d} size="xs" />
                <span className="muted small">
                  和{da.sum} 跨{da.span} 三区{da.zone3.join(':')}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="two-col">
        <Card title="红球热号 Top6" tag="近 200 期出现次数">
          <div className="ssq-ball-row">
            {hot.map((r) => (
              <span key={r.n} className="ssq-hot-item">
                <Ball n={r.n} kind="red" size="sm" />
                <em>{r.count} 次</em>
              </span>
            ))}
          </div>
          <Note>热号只是过去开得多，不代表下期更容易开出。</Note>
        </Card>
        <Card title="红球冷号 Top6" tag="按当前遗漏排序">
          <div className="ssq-ball-row">
            {cold.map((r) => (
              <span key={r.n} className="ssq-hot-item">
                <Ball n={r.n} kind="red" size="sm" dim />
                <em>漏 {r.curOmit} 期</em>
              </span>
            ))}
          </div>
          <Note>遗漏越久也不会“该出了”，这是典型的赌徒谬误。</Note>
        </Card>
      </div>

      <div className="two-col">
        <Card title="5 期重号池" tag={`${pool.count} 个 · ${pool.strong ? '信号偏强' : '信号一般'}`}>
          <div className="ssq-ball-row">
            {pool.nums.map((n) => (
              <Ball key={n} n={n} kind="red" size="xs" />
            ))}
          </div>
          <Note>最近 5 期出现过的红球，总量 ≥20 个时视为重号偏强。</Note>
        </Card>
        <Card title="蓝球热度 Top4" tag="近 200 期出现次数">
          <div className="ssq-ball-row">
            {blueHot.map((b) => (
              <span key={b.n} className="ssq-hot-item">
                <Ball n={b.n} kind="blue" size="sm" />
                <em>{b.count} 次</em>
              </span>
            ))}
          </div>
          <Note>蓝球 16 选 1，理论命中率恒为 6.25%。</Note>
        </Card>
      </div>

      <Card title="号码基数" tag="数据完整性">
        <div className="ssq-base-grid mono">
          <div>红球 33 选 6，单注组合数 C(33,6) = 1,107,568</div>
          <div>蓝球 16 选 1，全组合 17,721,088</div>
          <div>红球池 {RED_NUMS.length} 个 · 蓝球池 {BLUE_NUMS.length} 个</div>
          <div>当前库内 {draws.length} 期，覆盖 {draws[draws.length - 1].id} – {draws[0].id}</div>
        </div>
      </Card>
    </div>
  )
}
