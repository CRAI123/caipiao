// 福彩3D / 七星彩 冷热号 & 遗漏 —— 分位频次网格 + 遗漏走势
import React, { useState } from 'react'
import { Card, Note } from './common.jsx'
import * as defaultStats from '../lib/fc3dStats.js'

const WINDOWS = [10, 20, 30, 50]

export default function FC3DHotCold({ draws, positions = defaultStats.POSITIONS, stats = defaultStats }) {
  const [windowN, setWindowN] = useState(30)
  const [trendN, setTrendN] = useState(15)
  const {
    DIGITS,
    POS_VALUES,
    digitFrequencyByPos,
    digitMissingByPos,
    digitFrequency,
    digitMissing,
    hotColdClass,
    positionTrend,
  } = stats

  const posIdx = positions.map((_, i) => i)
  const valuesFor = (pos) => POS_VALUES?.[pos] || DIGITS
  const posFreq = posIdx.map((pos) => digitFrequencyByPos(draws, pos, windowN))
  const posOmit = posIdx.map((pos) => digitMissingByPos(draws, pos, windowN))
  const totalFreq = digitFrequency(draws, windowN)
  const totalOmit = digitMissing(draws, windowN)
  const { hot, cold } = hotColdClass(totalFreq)

  // 分位频次表头 + 行：3D 共用 0–9；七星彩前区 0–9、后区 0–14 分开展示
  const renderHead = (values) => (
    <div
      className="fc3d-pos-head"
      style={{ gridTemplateColumns: `50px repeat(${values.length}, minmax(32px, 1fr))` }}
    >
      <div className="fc3d-pos-corner">位置</div>
      {values.map((d) => (
        <div key={d} className="fc3d-pos-digit-head">
          {d}
        </div>
      ))}
    </div>
  )

  const posLabel = (label, pos) =>
    positions.length === 7 ? (pos === 6 ? '后区' : `${label}位`) : label
  const renderRow = (label, pos) => {
    const values = valuesFor(pos)
    const max = Math.max(...values.map((d) => posFreq[pos][d] || 0), 1)
    return (
      <div
        key={pos}
        className="fc3d-pos-row"
        style={{ gridTemplateColumns: `50px repeat(${values.length}, minmax(32px, 1fr))` }}
      >
        <div className="fc3d-pos-name">{posLabel(label, pos)}</div>
        {values.map((d) => {
          const freq = posFreq[pos][d] || 0
          const omit = posOmit[pos][d] || 0
          const pct = (freq / max) * 100
          return (
            <div
              key={d}
              className="fc3d-pos-cell"
              style={{ background: `rgba(193,39,45,${0.1 + (pct / 100) * 0.7})` }}
            >
              <span className="fc3d-pos-freq">{freq}</span>
              <span className="fc3d-pos-omit">{omit}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const frontIdx = posIdx.filter((pos) => pos < 6)

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
      {positions.length <= 5 ? (
        <Card title="分位频次" tag={`近 ${windowN} 期 · 数字下为遗漏期数`}>
          <div className="fc3d-pos-grid">
            {renderHead(DIGITS)}
            {positions.map((label, pos) => renderRow(label, pos))}
          </div>
          <Note>红色越深表示该位置出现频率越高；下方数字为当前遗漏期数。</Note>
        </Card>
      ) : (
        <>
          <Card title="前区 6 位分位频次" tag={`近 ${windowN} 期 · 数字下为遗漏期数`}>
            <div className="fc3d-pos-grid">
              {renderHead(DIGITS)}
              {frontIdx.map((pos) => renderRow(positions[pos], pos))}
            </div>
            <Note>红色越深表示该位置出现频率越高；下方数字为当前遗漏期数。</Note>
          </Card>
          <Card title="后区分位频次" tag={`近 ${windowN} 期 · 后区取值 0–14`}>
            <div className="table-scroll">
              <div className="fc3d-pos-grid" style={{ minWidth: 620 }}>
                {renderHead(valuesFor(6))}
                {renderRow(positions[6], 6)}
              </div>
            </div>
            <Note>后区独立开出 0–14，与前区 6 位的概率结构不同。</Note>
          </Card>
        </>
      )}

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
      {positions.map((label, pos) => {
        const trend = positionTrend(draws, trendN, pos)
        const values = valuesFor(pos)
        return (
          <Card key={pos} title={`${posLabel(label, pos)}遗漏走势`} tag={`最近 ${trendN} 期`}>
            <div className="table-scroll">
              <div className="fc3d-trend-grid" style={{ minWidth: 40 + values.length * 30 }}>
                <div className="fc3d-trend-head">
                  <div className="fc3d-trend-id">期号</div>
                  {values.map((d) => (
                    <div key={d} className="fc3d-trend-digit">{d}</div>
                  ))}
                </div>
                {trend.draws.map((d, i) => (
                  <div key={d.id} className="fc3d-trend-row">
                    <div className="fc3d-trend-id mono">{String(d.id).slice(-4)}</div>
                    {values.map((digit) => {
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
            </div>
          </Card>
        )
      })}
    </div>
  )
}
