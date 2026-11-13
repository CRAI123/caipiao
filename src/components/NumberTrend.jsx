// 号码走势连线图：每个号码一行、每期一列，命中画点、相邻期连线，断档即遗漏断点
import React, { useMemo } from 'react'

const ROW_H = 16
const COL_W = 22
const HEAD_H = 18
const LABEL_W = 32

export default function NumberTrend({ rows, points, colorFor, formatRow = (n) => n }) {
  const view = useMemo(() => {
    const n = points.length
    const width = Math.max(n * COL_W, 200)
    const height = HEAD_H + rows.length * ROW_H
    const rowIndex = new Map(rows.map((r, i) => [r, i]))
    const x = (c) => c * COL_W + COL_W / 2
    const y = (r) => HEAD_H + r * ROW_H + ROW_H / 2

    // 命中点
    const dots = []
    points.forEach((p, c) => {
      p.hits.forEach((num) => {
        const r = rowIndex.get(num)
        if (r == null) return
        dots.push({ id: `${c}-${num}`, c, r, num, x: x(c), y: y(r), date: p.date, draw: p.label })
      })
    })

    // 连线：只有相邻两期都命中才连，断档处就是遗漏断点
    const segs = []
    for (let c = 1; c < n; c++) {
      const prev = new Set(points[c - 1].hits)
      points[c].hits.forEach((num) => {
        const r = rowIndex.get(num)
        if (r == null || !prev.has(num)) return
        segs.push({ id: `s${c}-${num}`, x1: x(c - 1), x2: x(c), y1: y(r), y2: y(r) })
      })
    }

    const tickStep = Math.max(1, Math.ceil(n / 8))
    const ticks = points
      .map((p, c) => ({ c, label: p.label ?? p.date ?? '' }))
      .filter((t) => (n - 1 - t.c) % tickStep === 0 || t.c === n - 1)

    return { n, width, height, x, y, dots, segs, ticks }
  }, [rows, points])

  if (!points.length) return null
  const { width, height, dots, segs, ticks, x } = view

  return (
    <div className="kline-trend-body">
      <div className="kline-trend-grid">
        <div className="kline-trend-labels" style={{ width: LABEL_W }}>
          <div style={{ height: HEAD_H }} />
          {rows.map((r) => (
            <div key={r} className="kline-trend-label" style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}>
              {formatRow(r)}
            </div>
          ))}
        </div>
        <div className="kline-trend-scroll">
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="号码走势连线图">
            {/* 行参考线 */}
            {rows.map((r, i) => (
              <line
                key={`row${r}`}
                x1="0"
                x2={width}
                y1={HEAD_H + i * ROW_H + ROW_H / 2}
                y2={HEAD_H + i * ROW_H + ROW_H / 2}
                stroke="var(--ink-08)"
                strokeWidth="1"
              />
            ))}

            {/* 最新一期高亮带 */}
            <rect x={width - COL_W} y={0} width={COL_W} height={height} fill="rgba(194, 58, 43, 0.06)" />

            {/* 遗漏断点前的连线 */}
            {segs.map((s) => (
              <line
                key={s.id}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="var(--ink-40)"
                strokeWidth="1"
              />
            ))}

            {/* 命中点 */}
            {dots.map((d) => (
              <g key={d.id}>
                <circle cx={d.x} cy={d.y} r="5.2" fill={colorFor(d.num)} opacity="0.92" />
                <title>{`${d.date || ''} 第 ${d.draw} 期 · 号码 ${d.num}`}</title>
              </g>
            ))}

            {/* 期号刻度 */}
            {ticks.map((t) => (
              <text key={`t${t.c}`} x={x(t.c)} y={13} textAnchor="middle" className="chart-tick">
                {String(t.label).slice(-4)}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}
