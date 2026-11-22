// 大乐透 总览 —— 最新开奖、结构指标、近期走势、冷热速览
import React from 'react'
import { Card, StatCard, Note, Ball, DltDraw } from './common.jsx'
import {
  analyzeDraw,
  patternSummary,
  frontStats,
  backStats,
  recent5Pool,
  FRONT_NUMS,
  BACK_NUMS,
} from '../lib/dltPredict.js'

export default function DLTOverview({ draws }) {
  if (!draws || !draws.length) return <Note>暂无数据</Note>

  const latest = draws[0]
  const a = analyzeDraw(latest)
  const p = patternSummary(draws, 30)
  const fStats = frontStats(draws)
  const bStats = backStats(draws)
  const pool = recent5Pool(draws)

  const hot = [...fStats].sort((x, y) => y.count - x.count).slice(0, 5)
  const cold = [...fStats].sort((x, y) => y.curOmit - x.curOmit).slice(0, 5)
  const backHot = [...bStats].sort((x, y) => y.count - x.count).slice(0, 4)

  const zone3Text = (z) => (z || []).join(':')
  const recent = draws.slice(0, 10)

  const oddRatio = ((p.oddDist.reduce((s, x) => s + x.v * x.count, 0) / p.period) || 0).toFixed(2)
  const bigRatio = ((p.bigDist.reduce((s, x) => s + x.v * x.count, 0) / p.period) || 0).toFixed(2)

  return (
    <div className="page">
      <Card title="最新一期" tag={`第 ${latest.id} 期${latest.date ? ' · ' + latest.date : ''}`}>
        <div className="ssq-latest">
          {latest.front.map((n) => (
            <Ball key={n} n={n} kind="red" size="lg" />
          ))}
          <span className="ssq-divider ssq-divider-lg" aria-hidden="true" />
          {latest.back.map((n) => (
            <Ball key={n} n={n} kind="blue" size="lg" />
          ))}
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
          note={`区间 ${p.sumMin} – ${p.sumMax} · 理论均值 90`}
        />
        <StatCard
          label="近 30 期跨度均值"
          value={p.spanAvg}
          tone="blue"
          note="5 个前区跨度的均值约 29"
        />
        <StatCard
          label="近 30 期奇数均值"
          value={oddRatio}
          tone="amber"
          note="理论均值 2.5 个 / 期"
        />
        <StatCard
          label="近 30 期大数均值"
          value={bigRatio}
          tone="green"
          note="大号 ≥18，理论均值 2.5 个 / 期"
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
                <DltDraw draw={d} size="xs" />
                <span className="muted small">
                  和{da.sum} 跨{da.span} 三区{da.zone3.join(':')}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="two-col">
        <Card title="前区热号 Top5" tag="近 200 期出现次数">
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
        <Card title="前区冷号 Top5" tag="按当前遗漏排序">
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
          <Note>最近 5 期出现过的前区号，总量 ≥17 个时视为重号偏强。</Note>
        </Card>
        <Card title="后区热度 Top4" tag="近 200 期出现次数">
          <div className="ssq-ball-row">
            {backHot.map((b) => (
              <span key={b.n} className="ssq-hot-item">
                <Ball n={b.n} kind="blue" size="sm" />
                <em>{b.count} 次</em>
              </span>
            ))}
          </div>
          <Note>后区 12 选 2，单个号码的理论出现率恒为 1/6。</Note>
        </Card>
      </div>

      <Card title="号码基数" tag="数据完整性">
        <div className="ssq-base-grid mono">
          <div>前区 35 选 5，单注组合数 C(35,5) = 324,632</div>
          <div>后区 12 选 2，后区组合 C(12,2) = 66</div>
          <div>全部单注 324,632 × 66 = 21,425,712</div>
          <div>
            前区池 {FRONT_NUMS.length} 个 · 后区池 {BACK_NUMS.length} 个 · 当前库内 {draws.length} 期（
            {draws[draws.length - 1].id} – {draws[0].id}）
          </div>
        </div>
      </Card>
    </div>
  )
}
