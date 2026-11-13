// 通用 SVG K 线图：蜡烛 + MA5/MA10 + 布林带 + MACD 副图
// 纯手写 SVG，无图表库依赖；所有数据由调用方按时间正序传入
import React, { useMemo } from 'react'
import { computeIndicators, divergences, DEFAULT_PRESET } from '../lib/kline.js'

const UP = '#c23a2b'
const DOWN = '#1d6f3e'
const MA5_COLOR = '#b7791f'
const MA10_COLOR = '#24558f'
const BOLL_COLOR = 'rgba(36, 85, 143, 0.55)'
const BOLL_FILL = 'rgba(36, 85, 143, 0.07)'

const COL = 12 // 每根蜡烛占宽
const BODY = 7.5 // 实体宽

function linePath(values, x, y) {
  let d = ''
  let started = false
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      started = false
      return
    }
    d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    started = true
  })
  return d.trim()
}

function LegendDot({ color }) {
  return <i className="kline-dot" style={{ background: color }} />
}

export default function KlineChart({
  candles,
  showBoll = true,
  preset = DEFAULT_PRESET,
  height = 200,
  macdHeight = 84,
  fmt = (v) => v,
}) {
  const view = useMemo(() => {
    const n = candles.length
    const values = candles.map((c) => c.close)
    const ind = computeIndicators(values, preset)
    const divs = divergences(values, ind.macd.dif)

    const lowerEdge = (arr) => arr.reduce((m, v) => (v == null ? m : Math.min(m, v)), Infinity)
    const upperEdge = (arr) => arr.reduce((m, v) => (v == null ? m : Math.max(m, v)), -Infinity)

    const lows = candles.reduce((m, c) => Math.min(m, c.low), Infinity)
    const highs = candles.reduce((m, c) => Math.max(m, c.high), -Infinity)
    const lo = Math.min(lows, showBoll ? lowerEdge(ind.band.map((b) => b.lower)) : Infinity)
    const hi = Math.max(highs, showBoll ? upperEdge(ind.band.map((b) => b.upper)) : -Infinity)
    const padY = (hi - lo) * 0.08 || 1
    const yMin = lo - padY
    const yMax = hi + padY

    const gap = 12
    const padL = 38
    const padR = 14
    const width = Math.max(padL + n * COL + padR, 320)
    const totalH = height + gap + macdHeight
    const plotTop = 12
    const plotBottom = height - 6
    const macdTop = height + gap + 6
    const macdBottom = totalH - 18

    const x = (i) => padL + i * COL + COL / 2
    const y = (v) => plotTop + (1 - (v - yMin) / (yMax - yMin || 1)) * (plotBottom - plotTop)

    const maxAbs =
      Math.max(
        0.0001,
        ...ind.macd.dif.map((v) => Math.abs(v)),
        ...ind.macd.dea.map((v) => Math.abs(v)),
        ...ind.macd.hist.map((v) => Math.abs(v)),
      ) * 1.15
    const mZero = (macdTop + macdBottom) / 2
    const mY = (v) => mZero - (v / maxAbs) * ((macdBottom - macdTop) / 2)

    // 布林带填充区域
    let bandArea = ''
    if (showBoll) {
      const first = ind.band.findIndex((b) => b.upper != null)
      if (first >= 0) {
        const top = ind.band.map((b, i) => (i >= first ? `${x(i).toFixed(1)},${y(b.upper).toFixed(1)}` : null))
        const bottom = ind.band
          .map((b, i) => (i >= first ? `${x(i).toFixed(1)},${y(b.lower).toFixed(1)}` : null))
          .filter(Boolean)
          .reverse()
        bandArea = `M${top[first]} L${top.slice(first + 1).join(' L')} L${bottom.join(' L')} Z`
      }
    }

    const gridCount = 4
    const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / gridCount
      return { v, y: y(v) }
    })

    const tickStep = Math.max(1, Math.ceil(n / 9))
    const ticks = candles
      .map((c, i) => ({ i, id: c.id, date: c.date }))
      .filter((t) => (n - 1 - t.i) % tickStep === 0 || t.i === n - 1)

    return {
      n,
      ind,
      divs,
      width,
      totalH,
      x,
      y,
      mY,
      mZero,
      macdTop,
      macdBottom,
      bandArea,
      grid,
      ticks,
      last: candles[n - 1],
    }
  }, [candles, showBoll, preset, height, macdHeight, fmt])

  if (!candles.length) return null
  const { n, ind, divs, width, totalH, x, y, mY, mZero, macdTop, macdBottom, bandArea, grid, ticks, last } = view

  return (
    <div className="kline-chart">
      <div className="kline-legend">
        <span className="kline-legend-item">
          <LegendDot color={UP} />上涨
        </span>
        <span className="kline-legend-item">
          <LegendDot color={DOWN} />下跌
        </span>
        <span className="kline-legend-item">
          <LegendDot color={MA5_COLOR} />MA5
        </span>
        <span className="kline-legend-item">
          <LegendDot color={MA10_COLOR} />MA10
        </span>
        {showBoll && (
          <span className="kline-legend-item">
            <LegendDot color={BOLL_COLOR} />BOLL({preset.boll},2)
          </span>
        )}
        <span className="kline-legend-item kline-legend-macd">
          <LegendDot color={UP} />MACD 柱 · DIF <LegendDot color={MA10_COLOR} />DEA
        </span>
      </div>

      <div className="kline-chart-scroll">
        <svg
          viewBox={`0 0 ${width} ${totalH}`}
          width={width}
          height={totalH}
          role="img"
          aria-label="K 线图"
        >
          {/* 主图网格 */}
          {grid.map((g) => (
            <g key={`g${g.v}`}>
              <line x1={38} x2={width - 14} y1={g.y} y2={g.y} stroke="var(--ink-08)" />
              <text x={4} y={g.y + 3} className="chart-tick">
                {fmt(g.v)}
              </text>
            </g>
          ))}

          {/* 布林带 */}
          {showBoll && bandArea && <path d={bandArea} fill={BOLL_FILL} stroke="none" />}
          {showBoll && (
            <>
              <path
                d={linePath(ind.band.map((b) => b.mid), x, y)}
                fill="none"
                stroke="var(--ink-40)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <path
                d={linePath(ind.band.map((b) => b.upper), x, y)}
                fill="none"
                stroke={BOLL_COLOR}
                strokeWidth="1"
              />
              <path
                d={linePath(ind.band.map((b) => b.lower), x, y)}
                fill="none"
                stroke={BOLL_COLOR}
                strokeWidth="1"
              />
            </>
          )}

          {/* 蜡烛 */}
          {candles.map((c, i) => {
            const up = c.close >= c.open
            const color = up ? UP : DOWN
            const bodyTop = Math.min(y(c.open), y(c.close))
            const bodyH = Math.max(1.2, Math.abs(y(c.open) - y(c.close)))
            return (
              <g key={`c${c.id}-${i}`}>
                <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1" />
                <rect
                  x={x(i) - BODY / 2}
                  y={bodyTop}
                  width={BODY}
                  height={bodyH}
                  fill={up ? color : 'var(--card)'}
                  stroke={color}
                  strokeWidth="1"
                />
                <title>
                  {`${c.date || ''} 第 ${c.id} 期 · 开 ${fmt(c.open)} 收 ${fmt(c.close)} 高 ${fmt(
                    Math.round(c.high * 10) / 10,
                  )} 低 ${fmt(Math.round(c.low * 10) / 10)}`}
                </title>
              </g>
            )
          })}

          {/* 均线 */}
          <path d={linePath(ind.ma5, x, y)} fill="none" stroke={MA5_COLOR} strokeWidth="1.3" />
          <path d={linePath(ind.ma10, x, y)} fill="none" stroke={MA10_COLOR} strokeWidth="1.3" />

          {/* MACD 顶 / 底背离 */}
          {divs.map((dv) => {
            const top = dv.type === 'top'
            const y2 = y(candles[dv.i].close)
            const y1 = y(candles[dv.prev].close)
            return (
              <g key={`dv${dv.i}`}>
                <title>
                  {`第 ${candles[dv.i].id} 期 · ${top ? '价格新高但 DIF 未新高（顶背离）' : '价格新低但 DIF 未新低（底背离）'}`}
                </title>
                <line
                  x1={x(dv.prev)}
                  y1={y1}
                  x2={x(dv.i)}
                  y2={y2}
                  stroke={top ? UP : DOWN}
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                  opacity="0.75"
                />
                <text
                  x={x(dv.i)}
                  y={top ? y2 - 6 : y2 + 12}
                  textAnchor="middle"
                  className="chart-val"
                  fill={top ? UP : DOWN}
                >
                  {top ? '顶' : '底'}
                </text>
              </g>
            )
          })}

          {/* 最新收盘参考线 */}
          <line
            x1={38}
            x2={width - 14}
            y1={y(last.close)}
            y2={y(last.close)}
            stroke={last.close >= last.open ? UP : DOWN}
            strokeWidth="0.8"
            strokeDasharray="2 4"
            opacity="0.7"
          />
          <text x={40} y={y(last.close) - 4} className="chart-val">
            最新 {fmt(last.close)}
          </text>

          {/* MACD 副图 */}
          <line x1={38} x2={width - 14} y1={macdTop} y2={macdTop} stroke="var(--ink-20)" />
          <text x={4} y={macdTop + 9} className="chart-tick">
            MACD
          </text>
          <line x1={38} x2={width - 14} y1={mZero} y2={mZero} stroke="var(--ink-20)" strokeDasharray="3 3" />
          {ind.macd.hist.map((v, i) => {
            if (v == null) return null
            const top = Math.min(mY(v), mY(0))
            const h = Math.max(0.8, Math.abs(mY(v) - mY(0)))
            return (
              <rect
                key={`h${i}`}
                x={x(i) - BODY / 2}
                y={top}
                width={BODY}
                height={h}
                fill={v >= 0 ? 'rgba(194, 58, 43, 0.55)' : 'rgba(29, 111, 62, 0.55)'}
              />
            )
          })}
          <path d={linePath(ind.macd.dif, x, mY)} fill="none" stroke={UP} strokeWidth="1.1" />
          <path d={linePath(ind.macd.dea, x, mY)} fill="none" stroke={MA10_COLOR} strokeWidth="1.1" />
          <text x={4} y={mZero + 3} className="chart-tick">
            0
          </text>
          <text x={4} y={macdBottom} className="chart-tick">
            {fmt(Math.round(view.ind.macd.hist[n - 1] * 100) / 100)}
          </text>

          {/* 期号刻度 */}
          {ticks.map((t) => (
            <text key={`t${t.i}`} x={x(t.i)} y={totalH - 4} textAnchor="middle" className="chart-tick">
              {String(t.id).slice(-4)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
