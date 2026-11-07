// 总览页 —— 最新开奖、关键指标、数据速览
import React from 'react'
import { Ball, DrawBalls, Card, StatCard, Note, Seal } from './common.jsx'
import {
  ballFrequency,
  ballMissing,
  shapeStats,
  repeatStats,
  BALL_MAX,
  takeLatest,
} from '../lib/stats.js'

export default function Overview({ draws }) {
  const latest = draws[0]
  const freq = ballFrequency(draws, 30)
  const missing = ballMissing(draws, 100)
  const shapes = shapeStats(draws, 100)
  const rep = repeatStats(draws, 30)

  const hottest = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const coldest = Object.entries(freq)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
  const biggestMissing = Object.entries(missing)
    .sort((a, b) => b[1].current - a[1].current)
    .slice(0, 3)
  const recent = takeLatest(draws, 10)

  return (
    <div className="page">
      <Card title="最新一期" tag={`第 ${latest.id} 期${latest.date ? ' · ' + latest.date : ''} · 20 个开奖号`}>
        <div className="latest-row">
          <DrawBalls draw={latest} size="md" />
        </div>
        <div className="range-legend mono">
          <span><i className="lg-dot lg-red" />01-20</span>
          <span><i className="lg-dot lg-blue" />21-40</span>
          <span><i className="lg-dot lg-green" />41-60</span>
          <span><i className="lg-dot lg-amber" />61-80</span>
          <span className="muted">号码按区间着色，一眼看出分布是否集中</span>
        </div>
        {latest.sample && (
          <Note tone="warn">
            当前为内置<b>演示数据</b>（非真实开奖）。请到「数据管理」抓取或导入真实历史数据后再做复盘。
          </Note>
        )}
      </Card>

      <div className="stat-grid">
        <StatCard
          label="近100期平均和值"
          value={shapes.avgSum}
          note="20 号理论均值约 810，范围 210-1410"
        />
        <StatCard
          label="近100期平均跨度"
          value={shapes.avgSpan}
          tone="blue"
          note="最大号 − 最小号"
        />
        <StatCard
          label="近100期含连号比例"
          value={shapes.consecutiveRate}
          unit="%"
          tone="amber"
          note={`其中 ${shapes.consecutiveCount} 期出现连号`}
        />
        <StatCard
          label="近30期重号出现率"
          value={rep.repeatRate}
          unit="%"
          tone="red"
          note={`平均每期 ${rep.avgRepeat} 个重号`}
        />
      </div>

      <div className="grid-2">
        <Card title="近30期热号 TOP3" tag="80 个号码">
          <div className="chip-row">
            {hottest.map(([n, c]) => (
              <span key={n} className="chip">
                <Ball n={Number(n)} kind="auto" size="sm" />
                <i>{c} 次</i>
              </span>
            ))}
          </div>
          <p className="muted small">冷热仅为历史频次的三分位排名，不代表未来开出概率。</p>
        </Card>
        <Card title="近30期冷号 BOTTOM3" tag="80 个号码">
          <div className="chip-row">
            {coldest.map(([n, c]) => (
              <span key={n} className="chip">
                <Ball n={Number(n)} kind="auto" size="sm" dim />
                <i>{c} 次</i>
              </span>
            ))}
          </div>
          <p className="muted small">「追冷」依赖均值回归假设，冷号可能持续走冷，请勿据此加投。</p>
        </Card>
        <Card title="当前遗漏最深 TOP3" tag="近100期窗口">
          <div className="chip-row">
            {biggestMissing.map(([n, m]) => (
              <span key={n} className="chip">
                <Ball n={Number(n)} kind="auto" size="sm" />
                <i>遗漏 {m.current} 期</i>
              </span>
            ))}
          </div>
          <p className="muted small">每个号码每期理论开出概率均为 20/80 = 25%，遗漏深浅不改变下期概率。</p>
        </Card>
        <Card title="号码形态速览" tag="近100期均值">
          <div className="chip-row">
            <span className="chip">
              <i>奇 : 偶 ≈ {shapes.oddDist[0]?.[0] || '—'}</i>
            </span>
            <span className="chip">
              <i>大 : 小 ≈ {shapes.bigDist[0]?.[0] || '—'}</i>
            </span>
            <span className="chip">
              <i>012 路累计 {shapes.roadDist.join(' / ')}</i>
            </span>
          </div>
        </Card>
      </div>

      <Card title="近10期开奖速览">
        <ul className="recent-list">
          {recent.map((d) => (
            <li key={d.id}>
              <span className="recent-id mono">{d.id}</span>
              <span className="recent-date muted mono">{d.date || '—'}</span>
              <DrawBalls draw={d} size="xs" />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="disclaimer-card">
        <div className="disclaimer-inner">
          <Seal />
          <div>
            <h4>⚠️ 前置重要提醒</h4>
            <p>
              所有号码统计、选号思路仅做<b>数据学习、复盘研究</b>，不能作为投注依据。彩票开奖是完全随机独立事件，任何方法都无法提高中奖概率。购彩务必<b>小额娱乐</b>，切勿大额投入。未满 18 周岁禁止购彩。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
