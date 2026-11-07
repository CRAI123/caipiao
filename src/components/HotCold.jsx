// 冷热号 & 遗漏 —— 80 号全景网格、频次榜、遗漏走势图
import React, { useState } from 'react'
import { Ball, Card, BarList, Note, pad2 } from './common.jsx'
import { ballFrequency, ballMissing, hotColdClass, trendMatrix, BALL_MAX, range } from '../lib/stats.js'

const WINDOW_OPTIONS = [20, 30, 50, 100]

export default function HotCold({ draws }) {
  const [windowN, setWindowN] = useState(30)
  const [trendPeriods, setTrendPeriods] = useState(15)

  const freq = ballFrequency(draws, windowN)
  const missing = ballMissing(draws, windowN)
  const cls = hotColdClass(freq)
  const maxFreq = Math.max(...Object.values(freq), 1)

  const sorted = range(BALL_MAX)
    .map((n) => ({ n, c: freq[n] }))
    .sort((a, b) => b.c - a.c)
  const topItems = sorted.slice(0, 15).map(({ n, c }) => ({ key: n, label: pad2(n), value: c }))
  const bottomItems = [...sorted]
    .reverse()
    .slice(0, 15)
    .map(({ n, c }) => ({ key: n, label: pad2(n), value: c }))

  const trend = trendMatrix(draws, trendPeriods)

  // 走势图每格显示该列累计遗漏期数；开出则清零
  function missingGrid(cells) {
    const miss = new Array(BALL_MAX).fill(0)
    return cells.map((row) =>
      row.map((hit, i) => {
        if (hit) {
          miss[i] = 0
          return true
        }
        miss[i] += 1
        return miss[i]
      }),
    )
  }
  const grid = missingGrid(trend.cells)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOW_OPTIONS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${windowN === n ? 'active' : ''}`}
            onClick={() => setWindowN(n)}
          >
            近 {n} 期
          </button>
        ))}
        <span className="toolbar-sep" />
        <span className="toolbar-label">走势图期数</span>
        {[10, 15, 30].map((n) => (
          <button
            key={n}
            className={`tab-btn ${trendPeriods === n ? 'active' : ''}`}
            onClick={() => setTrendPeriods(n)}
          >
            {n} 期
          </button>
        ))}
      </div>

      <Card title="80 号冷热全景" tag={`近 ${windowN} 期 · 按频次三分位`}>
        <div className="legend">
          <span><i className="dot dot-hot" /> 热（前 1/3）</span>
          <span><i className="dot dot-warm" /> 温（中 1/3）</span>
          <span><i className="dot dot-cold" /> 冷（后 1/3）</span>
          <span>格内：出现次数 / 当前遗漏</span>
        </div>
        <div className="class-grid">
          {range(BALL_MAX).map((n) => (
            <div key={n} className={`class-cell cls-${cls[n]}`}>
              <Ball n={n} kind="red" size="sm" />
              <span className="mono">{freq[n]} 次</span>
              <span className="miss mono">遗{missing[n].current}</span>
            </div>
          ))}
        </div>
        <Note tone="warn">
          摇奖每期独立随机：历史高频不代表后续更易开出（热号谬误），长期未开也不代表「该出了」（赌徒谬误）。冷热仅是事后统计。
        </Note>
      </Card>

      <div className="grid-2">
        <Card title={`近 ${windowN} 期出现次数 TOP15`} tag="频次榜">
          <BarList items={topItems} max={maxFreq} color="red" />
        </Card>
        <Card title={`近 ${windowN} 期出现次数 BOTTOM15`} tag="频次榜">
          <BarList items={bottomItems} max={maxFreq} color="blue" />
        </Card>
      </div>

      <Card title="80 号遗漏走势图" tag={`最近 ${trendPeriods} 期 · 格内数字为遗漏期数`}>
        <div className="trend-scroll">
          <table className="trend-table trend-kl8">
            <thead>
              <tr>
                <th className="trend-id">期号</th>
                {range(BALL_MAX).map((n) => (
                  <th key={n} className="mono">{pad2(n)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.draws.map((d, r) => (
                <tr key={d.id}>
                  <td className="trend-id mono">{String(d.id).slice(-3)}</td>
                  {grid[r].map((cell, c) => (
                    <td key={c} className={`trend-cell ${cell === true ? 'hit' : ''}`}>
                      {cell === true ? pad2(c + 1) : <span className="miss-num">{cell}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          横向每列是一个号码，纵向是期次；红点表示该期开出，数字表示截至该期的连续遗漏。
        </Note>
      </Card>
    </div>
  )
}
