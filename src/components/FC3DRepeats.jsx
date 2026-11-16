// 福彩3D 重号分析 —— 相邻期重号统计、号码跟随关系
import React, { useState } from 'react'
import { Card, StatCard, Note } from './common.jsx'
import * as defaultStats from '../lib/fc3dStats.js'

const WINDOWS = [20, 30, 50, 100]

export default function FC3DRepeats({ draws, stats = defaultStats, digitCount = 3 }) {
  const [windowN, setWindowN] = useState(30)
  const { analyzeDraw, repeatStats, takeLatest } = stats

  const rep = repeatStats(draws, windowN)
  const recent = takeLatest(draws, 15)

  // 构建重号明细表
  const repeatRows = []
  for (let i = 0; i < recent.length - 1; i++) {
    const curr = recent[i]
    const prev = recent[i + 1]
    const common = [...new Set(curr.num)].filter((d) => prev.num.includes(d))
    repeatRows.push({ curr, prev, common })
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOWS.map((n) => (
          <button key={n} className={`tab-btn ${windowN === n ? 'active' : ''}`} onClick={() => setWindowN(n)}>
            近 {n} 期
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <StatCard label="平均重号个数" value={rep.avg} note={`${rep.totalPairs} 对相邻期`} />
        <StatCard label="0个重号占比" value={`${((rep.distribution[0] || 0) / rep.totalPairs * 100).toFixed(0)}%`} tone="blue" />
        <StatCard label="1个重号占比" value={`${((rep.distribution[1] || 0) / rep.totalPairs * 100).toFixed(0)}%`} tone="amber" />
        <StatCard
          label={digitCount === 3 ? '2-3个重号占比' : '2个以上重号占比'}
          value={`${
            (Array.from({ length: digitCount - 1 }, (_, i) => rep.distribution[i + 2] || 0).reduce((a, b) => a + b, 0) /
              rep.totalPairs *
              100).toFixed(0)
          }%`}
          tone="green"
        />
      </div>

      <Card title="近期重号明细" tag="最近 15 期">
        <div className="fc3d-repeat-list">
          {repeatRows.map(({ curr, prev, common }) => (
            <div key={curr.id} className="fc3d-repeat-row">
              <span className="mono muted">{String(prev.id).slice(-4)}</span>
              <span className="fc3d-repeat-num mono">{prev.num.join(' ')}</span>
              <span className="fc3d-repeat-arrow">→</span>
              <span className="mono muted">{String(curr.id).slice(-4)}</span>
              <span className="fc3d-repeat-num mono">
                {curr.num.map((d, i) => (
                  <span key={i} className={common.includes(d) ? 'fc3d-repeat-hit' : ''}>{d}</span>
                ))}
              </span>
              <span className="muted">重号 {common.length} 个</span>
            </div>
          ))}
        </div>
        <Note>红色标记为与上期相同的重号。重号个数反映号码连续性，可辅助判断冷热转换。</Note>
      </Card>
    </div>
  )
}
