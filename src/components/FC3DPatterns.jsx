// 福彩3D 形态走势 —— 跨度、和值、奇偶、大中小、质合、形态分布
import React, { useState } from 'react'
import { Card, Note } from './common.jsx'
import {
  analyzeDraw,
  spanDistribution,
  sumDistribution,
  oddEvenDistribution,
  formDistribution,
  sizeDistribution,
  primeDistribution,
  takeLatest,
} from '../lib/fc3dStats.js'

const WINDOWS = [10, 20, 30, 50, 100]

function Bar({ label, value, max, color = '#c1272d' }) {
  const pct = max ? (value / max) * 100 : 0
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-value">{value}</span>
    </div>
  )
}

export default function FC3DPatterns({ draws }) {
  const [windowN, setWindowN] = useState(30)

  const spanDist = spanDistribution(draws, windowN)
  const sumDist = sumDistribution(draws, windowN)
  const oddDist = oddEvenDistribution(draws, windowN)
  const formDist = formDistribution(draws, windowN)
  const sizeDist = sizeDistribution(draws, windowN)
  const primeDist = primeDistribution(draws, windowN)

  const recent = takeLatest(draws, 20)

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

      <div className="two-col">
        <Card title="跨度分布" tag={`均值 ${spanDist.avg}`}>
          {spanDist.dist.map((c, s) => (
            <Bar key={s} label={`跨${s}`} value={c} max={Math.max(...spanDist.dist, 1)} />
          ))}
        </Card>
        <Card title="和值分布" tag={`均值 ${sumDist.avg}`}>
          <div className="fc3d-sum-bars">
            {sumDist.dist.map((c, s) => (
              c > 0 && <Bar key={s} label={`${s}`} value={c} max={Math.max(...sumDist.dist, 1)} color="#2171d4" />
            ))}
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Card title="奇偶形态" tag={`近 ${windowN} 期`}>
          {oddDist.map(([p, c]) => (
            <Bar key={p} label={p} value={c} max={Math.max(...oddDist.map(([, v]) => v), 1)} color="#c1272d" />
          ))}
        </Card>
        <Card title="开奖形态" tag={`近 ${windowN} 期`}>
          {formDist.map(([f, c]) => (
            <Bar key={f} label={f} value={c} max={Math.max(...formDist.map(([, v]) => v), 1)} color="#c1272d" />
          ))}
        </Card>
      </div>

      <div className="two-col">
        <Card title="大中小分布" tag={`近 ${windowN} 期`}>
          <div className="fc3d-size-dist">
            <div className="fc3d-size-item">
              <div className="fc3d-size-name">小号 0-2</div>
              <div className="fc3d-size-bar"><div style={{ width: `${sizeDist.smallPct}%` }} /></div>
              <div className="fc3d-size-val">{sizeDist.smallPct}%</div>
            </div>
            <div className="fc3d-size-item">
              <div className="fc3d-size-name">中号 3-6</div>
              <div className="fc3d-size-bar"><div style={{ width: `${sizeDist.midPct}%`, background: '#2171d4' }} /></div>
              <div className="fc3d-size-val">{sizeDist.midPct}%</div>
            </div>
            <div className="fc3d-size-item">
              <div className="fc3d-size-name">大号 7-9</div>
              <div className="fc3d-size-bar"><div style={{ width: `${sizeDist.bigPct}%`, background: '#1d6f3e' }} /></div>
              <div className="fc3d-size-val">{sizeDist.bigPct}%</div>
            </div>
          </div>
        </Card>
        <Card title="质合分布" tag={`近 ${windowN} 期`}>
          <div className="fc3d-size-dist">
            <div className="fc3d-size-item">
              <div className="fc3d-size-name">质数 1,2,3,5,7</div>
              <div className="fc3d-size-bar"><div style={{ width: `${primeDist.primePct}%` }} /></div>
              <div className="fc3d-size-val">{primeDist.primePct}%</div>
            </div>
            <div className="fc3d-size-item">
              <div className="fc3d-size-name">合数 0,4,6,8,9</div>
              <div className="fc3d-size-bar"><div style={{ width: `${primeDist.compositePct}%`, background: '#2171d4' }} /></div>
              <div className="fc3d-size-val">{primeDist.compositePct}%</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="近期形态走势" tag="最近 20 期">
        <div className="fc3d-pattern-list">
          {recent.map((d) => {
            const a = analyzeDraw(d.num)
            return (
              <div key={d.id} className="fc3d-pattern-row">
                <span className="mono muted">{String(d.id).slice(-4)}</span>
                <span className="fc3d-pattern-num mono">{d.num.join('')}</span>
                <span className="fc3d-tag">跨{a.span}</span>
                <span className="fc3d-tag">和{a.sum}</span>
                <span className="fc3d-tag">{a.oddPattern}</span>
                <span className="fc3d-tag">{a.form}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
