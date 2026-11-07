// 通用小组件：号码球、印章、卡片、图例、SVG 图表
import React from 'react'

/** kind='auto' 时按号码区间着色：1-20 红 / 21-40 蓝 / 41-60 绿 / 61-80 琥珀 */
export function ballKindByRange(n) {
  return ['red', 'blue', 'green', 'amber'][Math.min(3, Math.floor((n - 1) / 20))]
}

export function Ball({ n, kind = 'red', size = 'md', dim = false, className = '' }) {
  const k = kind === 'auto' ? ballKindByRange(n) : kind
  return (
    <span
      className={`ball ball-${k} ball-${size} ${dim ? 'ball-dim' : ''} ${className}`}
      aria-label={`号码 ${String(n).padStart(2, '0')}`}
    >
      {String(n).padStart(2, '0')}
    </span>
  )
}

/** 一期快乐8开奖号（20 个号码）—— 按区间着色，便于扫读分布 */
export function DrawBalls({ draw, size = 'md', hitSet = null }) {
  return (
    <span className="draw-balls">
      {draw.nums.map((n) => (
        <Ball key={n} n={n} kind="auto" size={size} className={hitSet && hitSet.has(n) ? 'ball-hit' : ''} />
      ))}
    </span>
  )
}

/** 红色印章 —— 用于免责声明区域 */
export function Seal({ text = '仅供研究', sub = '不作依据' }) {
  return (
    <span className="seal" aria-hidden="true">
      <span className="seal-text">{text}</span>
      <span className="seal-sub">{sub}</span>
    </span>
  )
}

export function Card({ title, tag, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-head">
          <h3>{title}</h3>
          {tag && <span className="card-tag">{tag}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, unit, note, tone = 'ink' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

/** 横向条形列表（频次/分布） */
export function BarList({ items, max, color = 'red', renderLabel }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="bar-list">
      {items.map((it) => (
        <li key={it.key}>
          <span className="bar-label">{renderLabel ? renderLabel(it) : it.label}</span>
          <span className="bar-track">
            <span
              className={`bar-fill bar-${color}`}
              style={{ width: `${(it.value / top) * 100}%` }}
            />
          </span>
          <span className="bar-value">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** 折线走势图（和值/跨度），纯 SVG */
export function LineChart({ values, labels, height = 150, color = 'var(--red)', guide }) {
  const w = Math.max(values.length * 34, 320)
  const pad = { l: 30, r: 12, t: 14, b: 20 }
  const min = Math.min(...values, guide?.min ?? Infinity)
  const max = Math.max(...values, guide?.max ?? -Infinity)
  const spanY = max - min || 1
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(values.length - 1, 1)
  const y = (v) => pad.t + (1 - (v - min) / spanY) * (height - pad.t - pad.b)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const guideLine = guide
    ? [
        <line
          key="g"
          x1={pad.l}
          x2={w - pad.r}
          y1={y(guide.value)}
          y2={y(guide.value)}
          stroke="var(--ink-40)"
          strokeDasharray="4 4"
        />,
        <text key="gt" x={4} y={y(guide.value) + 3} className="chart-tick">
          {guide.value}
        </text>,
      ]
    : null
  return (
    <div className="line-chart-scroll">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width={w}
        height={height}
        role="img"
        aria-label="走势图"
      >
        {guideLine}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="2.6" fill="var(--card)" stroke={color} strokeWidth="1.4" />
            <text x={x(i)} y={y(v) - 6} textAnchor="middle" className="chart-val">
              {v}
            </text>
            {labels && (
              <text x={x(i)} y={height - 6} textAnchor="middle" className="chart-tick">
                {labels[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

export function Note({ children, tone = 'info' }) {
  return <p className={`note note-${tone}`}>{children}</p>
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 金额格式化：千分位 + 元 */
export function yuan(n) {
  return `${Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 元`
}
