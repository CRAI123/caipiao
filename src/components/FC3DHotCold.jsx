// 福彩3D 冷热号 & 遗漏 —— 分位（百/十/个）频次网格 + 遗漏走势
import React, { useState } from 'react'
import { Card, Note } from './common.jsx'
import {
  DIGITS,
  POSITIONS,
  digitFrequencyByPos,
  digitMissingByPos,
  digitFrequency,
  digitMissing,
  hotColdClass,
  positionTrend,
  takeLatest,
} from '../lib/fc3dStats.js'

const WINDOWS = [10, 20, 30, 50]

export default function FC3DHotCold({ draws }) {
  const [windowN, setWindowN] = useState(30)
  const [trendN, setTrendN] = useState(15)

  const posFreq = [0, 1, 2].map((pos) => digitFrequencyByPos(draws, pos, windowN))
  const posOmit = [0, 1, 2].map((pos) => digitMissingByPos(draws, pos, windowN))
  const totalFreq = digitFrequency(draws, windowN)
  const totalOmit = digitMissing(draws, windowN)
  const { hot, cold } = hotColdClass(totalFreq)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOWS.map((n) => (
          <button key={n} className={`tab-btn ${windowN === n ? 'active' : ''}`} onClick={() => setWindowN(n)}>
            近 {n} 期
          </button>
        ))}
        <span className="toolbar-sep" />
        <span className="toolbar-label">走势图期数</span>
        {[10, 15, 30].map((n) => (
          <button key={n} className={`tab-btn ${trendN === n ? 'active' : ''}`} onClick={() => setTrendN(n)}>
            {n} 期
          </button>
        ))}
      </div>

      {/* 分位频次网格 */}
      <Card title="分位频次" tag={`近 ${windowN} 期 · 数字下为遗漏期数`}>
        <div className="fc3d-pos-grid">
          <div className="fc3d-pos-head">
            <div className="fc3d-pos-corner">位置</div>
            {DIGITS.map((d) => (
              <div key={d} className="fc3d-pos-digit-head">{d}</div>
            ))}
          </div>
          {POSITIONS.map((label, pos) => (
            <div key={pos} className="fc3d-pos-row">
              <div className="fc3d-pos-name">{label}</div>
              {DIGITS.map((d) => {
                const freq = posFreq[pos][d]
                const omit = posOmit[pos][d]
                const max = Math.max(...Object.values(posFreq[pos]), 1)
                const pct = (freq / max) * 100
                return (
                  <div key={d} className="fc3d-pos-cell" style={{ background: `rgba(193,39,45,${0.1 + pct / 100 * 0.7})` }}>
                    <span className="fc3d-pos-freq">{freq}</span>
                    <span className="fc3d-pos-omit">{omit}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <Note>红色越深表示该位置出现频率越高；下方数字为当前遗漏期数。</Note>
      </Card>

      {/* 总体冷热 */}
      <div className="two-col">
        <Card title="热号 Top3" tag={`近 ${windowN} 期`}>
          <div className="fc3d-digits">
            {hot.map((d) => (
              <span key={d} className="digit-ball hot">{d}<em>{totalOmit[d]}</em></span>
            ))}
          </div>
        </Card>
        <Card title="冷号 Top3" tag={`近 ${windowN} 期`}>
          <div className="fc3d-digits">
            {cold.map((d) => (
              <span key={d} className="digit-ball cold">{d}<em>{totalOmit[d]}</em></span>
            ))}
          </div>
        </Card>
      </div>

      {/* 分位遗漏走势 */}
      {POSITIONS.map((label, pos) => {
        const trend = positionTrend(draws, trendN, pos)
        return (
          <Card key={pos} title={`${label}位遗漏走势`} tag={`最近 ${trendN} 期`}>
            <div className="fc3d-trend-grid">
              <div className="fc3d-trend-head">
                <div className="fc3d-trend-id">期号</div>
                {DIGITS.map((d) => (
                  <div key={d} className="fc3d-trend-digit">{d}</div>
                ))}
              </div>
              {trend.draws.map((d, i) => (
                <div key={d.id} className="fc3d-trend-row">
                  <div className="fc3d-trend-id mono">{String(d.id).slice(-4)}</div>
                  {DIGITS.map((digit) => {
                    const hit = trend.cells[i] === digit
                    return (
                      <div key={digit} className={`fc3d-trend-cell ${hit ? 'hit' : ''}`}>
                        {hit ? '●' : ''}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
