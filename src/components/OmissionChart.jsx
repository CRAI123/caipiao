// 定位号码 K 线：红绿分段柱 + 布林通道 + KDJ + MACD（口径同行情软件）
// rows 按时间正序传入，每项 { id, date, omission, hit }
// 红柱 = 当期开出该号（遗漏归零），绿柱 = 未开出的过渡期，柱高 = 当时的遗漏期数
import React, { useMemo } from 'react'
import { boll, crossSignals, divergences, kdj, macd, DEFAULT_PRESET } from '../lib/kline.js'

const HIT = '#c23a2b'
const MISS = '#1d6f3e'
const MA10_COLOR = '#24558f'
const J_COLOR = '#b7791f'
const BOLL_COLOR = 'rgba(36, 85, 143, 0.55)'
const BOLL_FILL = 'rgba(36, 85, 143, 0.07)'

const COL = 10
const BAR = 6
const PAD_L = 38
const PAD_R = 14

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

export default function OmissionChart({
  rows,
  showBoll = true,
  preset = DEFAULT_PRESET,
  mainHeight = 168,
  kdjHeight = 84,
  macdHeight = 78,
}) {
  const view = useMemo(() => {
    const n = rows.length
    const values = rows.map((r) => r.omission)
    const band = boll(values, Math.min(preset.boll, n))
    const kd = kdj(values, preset.kdj)
    const m = macd(values, preset.macd)
    const crosses = crossSignals(kd.k, kd.d)
    const divs = divergences(values, m.dif)

    const upperEdge = band.reduce((mx, b) => (b.upper == null ? mx : Math.max(mx, b.upper)), 0)
    const yMax = Math.max(1, upperEdge, ...values) + 1
    const width = Math.max(PAD_L + n * COL + PAD_R, 320)
    const gap = 10
    const mainTop = 10
    const mainBottom = mainHeight
    const kdjTop = mainHeight + gap + 6
    const kdjBottom = kdjTop + kdjHeight - 12
    const macdTop = mainHeight + gap + kdjHeight + gap + 6
    const macdBottom = macdTop + macdHeight - 14
    const totalH = macdBottom + 20

    const x = (i) => PAD_L + i * COL + COL / 2
    const y = (v) => mainBottom - (v / yMax) * (mainBottom - mainTop)
    const yK = (v) => kdjBottom - ((Math.max(-20, Math.min(120, v)) + 20) / 140) * (kdjBottom - kdjTop)

    const maxAbs =
      Math.max(
        0.0001,
        ...m.dif.map((v) => Math.abs(v)),
        ...m.dea.map((v) => Math.abs(v)),
        ...m.hist.map((v) => Math.abs(v)),
      ) * 1.15
    const mZero = (macdTop + macdBottom) / 2
    const mY = (v) => mZero - (v / maxAbs) * ((macdBottom - macdTop) / 2)

    let bandArea = ''
    const first = band.findIndex((b) => b.upper != null)
    if (first >= 0) {
      const top = band.map((b, i) => (i >= first ? `${x(i).toFixed(1)},${y(b.upper).toFixed(1)}` : null))
      const bottom = band
        .map((b, i) => (i >= first ? `${x(i).toFixed(1)},${y(b.lower).toFixed(1)}` : null))
        .filter(Boolean)
        .reverse()
      bandArea = `M${top[first]} L${top.slice(first + 1).join(' L')} L${bottom.join(' L')} Z`
    }

    const gridCount = 4
    const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
      const v = Math.round((yMax - 1) * (i / gridCount))
      return { v, y: y(v) }
    })

    const tickStep = Math.max(1, Math.ceil(n / 9))
    const ticks = rows
      .map((r, i) => ({ i, id: r.id, date: r.date }))
      .filter((t) => (n - 1 - t.i) % tickStep === 0 || t.i === n - 1)

    return {
      n,
      values,
      band,
      kd,
      m,
      crosses,
      divs,
      width,
      totalH,
      x,
      y,
      yK,
      mY,
      mZero,
      mainTop,
      mainBottom,
      kdjTop,
      kdjBottom,
      macdTop,
      macdBottom,
      bandArea,
      grid,
      ticks,
      last: rows[n - 1],
    }
  }, [rows, showBoll, preset, mainHeight, kdjHeight, macdHeight])

  if (!rows.length) return null
  const v = view

  return (
    <div className="kline-chart">
      <div className="kline-legend">
        <span className="kline-legend-item">
          <i className="kline-dot" style={{ background: HIT }} />
          当期开出
        </span>
        <span className="kline-legend-item">
          <i className="kline-dot" style={{ background: MISS }} />
          未开出（柱高=遗漏）
        </span>
        {showBoll && (
          <span className="kline-legend-item">
            <i className="kline-dot" style={{ background: BOLL_COLOR }} />
            BOLL({preset.boll},2)
          </span>
        )}
        <span className="kline-legend-item">
          <i className="kline-dot" style={{ background: HIT }} />K
          <i className="kline-dot" style={{ background: MA10_COLOR }} />D
          <i className="kline-dot" style={{ background: J_COLOR }} />J
        </span>
      </div>

      <div className="kline-chart-scroll">
        <svg viewBox={`0 0 ${v.width} ${v.totalH}`} width={v.width} height={v.totalH} role="img" aria-label="定位号码 K 线">
          {/* 主图网格 */}
          {v.grid.map((g) => (
            <g key={`mg${g.v}`}>
              <line x1={PAD_L} x2={v.width - PAD_R} y1={g.y} y2={g.y} stroke="var(--ink-08)" />
              <text x={4} y={g.y + 3} className="chart-tick">
                {g.v}
              </text>
            </g>
          ))}

          {/* 布林通道 */}
          {showBoll && v.bandArea && <path d={v.bandArea} fill={BOLL_FILL} stroke="none" />}
          {showBoll && (
            <>
              <path
                d={linePath(v.band.map((b) => b.mid), v.x, v.y)}
                fill="none"
                stroke="var(--ink-40)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <path d={linePath(v.band.map((b) => b.upper), v.x, v.y)} fill="none" stroke={BOLL_COLOR} strokeWidth="1" />
              <path d={linePath(v.band.map((b) => b.lower), v.x, v.y)} fill="none" stroke={BOLL_COLOR} strokeWidth="1" />
            </>
          )}

          {/* 红绿分段柱 */}
          {rows.map((r, i) => {
            const y0 = v.y(0)
            const top = v.y(r.omission)
            return (
              <g key={`b${r.id}-${i}`}>
                <rect
                  x={v.x(i) - BAR / 2}
                  y={top}
                  width={BAR}
                  height={Math.max(1, y0 - top)}
                  fill={r.hit ? HIT : 'rgba(29, 111, 62, 0.55)'}
                />
                <title>
                  {`第 ${r.id} 期 ${r.date || ''} · ${r.hit ? '开出' : '未开出'} · 遗漏 ${r.omission}`}
                </title>
              </g>
            )
          })}

          {/* KDJ 副图 */}
          <line x1={PAD_L} x2={v.width - PAD_R} y1={v.kdjTop} y2={v.kdjTop} stroke="var(--ink-20)" />
          <text x={4} y={v.kdjTop + 9} className="chart-tick">
            KDJ
          </text>
          {[20, 80].map((lv) => (
            <g key={`lv${lv}`}>
              <line
                x1={PAD_L}
                x2={v.width - PAD_R}
                y1={v.yK(lv)}
                y2={v.yK(lv)}
                stroke="var(--ink-20)"
                strokeDasharray="3 3"
              />
              <text x={4} y={v.yK(lv) + 3} className="chart-tick">
                {lv}
              </text>
            </g>
          ))}
          <path d={linePath(v.kd.k, v.x, v.yK)} fill="none" stroke={HIT} strokeWidth="1.1" />
          <path d={linePath(v.kd.d, v.x, v.yK)} fill="none" stroke={MA10_COLOR} strokeWidth="1.1" />
          <path d={linePath(v.kd.j, v.x, v.yK)} fill="none" stroke={J_COLOR} strokeWidth="0.9" opacity="0.85" />

          {/* KDJ 金叉 / 死叉 */}
          {v.crosses.map((c) => (
            <g key={`x${c.i}`}>
              <circle
                cx={v.x(c.i)}
                cy={v.yK(v.kd.k[c.i])}
                r={2.8}
                fill={c.type === 'gold' ? HIT : MISS}
                stroke="var(--card)"
                strokeWidth="0.8"
              />
              <title>{`第 ${rows[c.i].id} 期 · KDJ ${c.type === 'gold' ? '金叉' : '死叉'}`}</title>
            </g>
          ))}

          {/* MACD 副图 */}
          <line x1={PAD_L} x2={v.width - PAD_R} y1={v.macdTop} y2={v.macdTop} stroke="var(--ink-20)" />
          <text x={4} y={v.macdTop + 9} className="chart-tick">
            MACD
          </text>
          <line
            x1={PAD_L}
            x2={v.width - PAD_R}
            y1={v.mZero}
            y2={v.mZero}
            stroke="var(--ink-20)"
            strokeDasharray="3 3"
          />
          {v.m.hist.map((hv, i) => {
            if (!Number.isFinite(hv)) return null
            const top = Math.min(v.mY(hv), v.mY(0))
            return (
              <rect
                key={`mh${i}`}
                x={v.x(i) - BAR / 2}
                y={top}
                width={BAR}
                height={Math.max(0.8, Math.abs(v.mY(hv) - v.mY(0)))}
                fill={hv >= 0 ? 'rgba(194, 58, 43, 0.6)' : 'rgba(29, 111, 62, 0.6)'}
              />
            )
          })}
          <path d={linePath(v.m.dif, v.x, v.mY)} fill="none" stroke={HIT} strokeWidth="1.1" />
          <path d={linePath(v.m.dea, v.x, v.mY)} fill="none" stroke={MA10_COLOR} strokeWidth="1.1" />

          {/* MACD 顶 / 底背离 */}
          {v.divs.map((dv) => {
            const y2 = v.mY(v.m.dif[dv.i])
            const y1 = v.mY(v.m.dif[dv.prev])
            const top = dv.type === 'top'
            return (
              <g key={`dv${dv.i}`}>
                <title>{`第 ${rows[dv.i].id} 期 · ${top ? '价格新高但 DIF 未新高' : '价格新低但 DIF 未新低'}`}</title>
                <line
                  x1={v.x(dv.prev)}
                  y1={y1}
                  x2={v.x(dv.i)}
                  y2={y2}
                  stroke={top ? HIT : MISS}
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                  opacity="0.8"
                />
                <text
                  x={v.x(dv.i)}
                  y={top ? y2 - 4 : y2 + 9}
                  textAnchor="middle"
                  className="chart-val"
                  fill={top ? HIT : MISS}
                >
                  {top ? '顶' : '底'}
                </text>
              </g>
            )
          })}
          <text x={4} y={v.mZero + 3} className="chart-tick">
            0
          </text>

          {/* 期号刻度 */}
          {v.ticks.map((t) => (
            <text key={`t${t.i}`} x={v.x(t.i)} y={v.totalH - 4} textAnchor="middle" className="chart-tick">
              {String(t.id).slice(-4)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
