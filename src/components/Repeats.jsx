// 重号 / 斜连（邻号）/ 隔期号 —— 20 个开奖号之间逐期对比
import React, { useState } from 'react'
import { Card, StatCard, Ball, Note, pad2 } from './common.jsx'
import { repeatStats, PER_DRAW, BALL_MAX } from '../lib/stats.js'

const WINDOW_OPTIONS = [15, 30, 50]

export default function Repeats({ draws }) {
  const [windowN, setWindowN] = useState(30)
  const rep = repeatStats(draws, windowN)
  const cur = draws[0]
  const prev = draws[1]
  const overlap = prev ? cur.nums.filter((n) => prev.nums.includes(n)) : []

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
        <span className="toolbar-note">样本 {rep.periods} 期（每期与前三期对比）</span>
      </div>

      <div className="stat-grid stat-grid-4">
        <StatCard label="重号出现率" value={rep.repeatRate} unit="%" tone="red" note="含至少 1 个上期重号的期占比" />
        <StatCard label="平均重号数" value={rep.avgRepeat} note="理论期望 20×20/80 = 5 个" />
        <StatCard label="平均斜连号" value={rep.avgAdjacent} tone="amber" note="上期号码 ±1 在本期开出的个数" />
        <StatCard label="平均隔期号" value={rep.avgSkip1 + rep.avgSkip2} tone="blue" note={`隔一期 ${rep.avgSkip1} + 隔两期 ${rep.avgSkip2}`} />
      </div>

      <Card title="本期与上期对照" tag={`${cur.id} vs ${prev?.id || '—'}`}>
        <div className="compare-row">
          <span className="compare-label mono">本期</span>
          <span className="draw-balls">
            {cur.nums.map((n) => (
              <Ball key={n} n={n} size="sm" kind={overlap.includes(n) ? 'red' : 'plain'} />
            ))}
          </span>
        </div>
        {prev && (
          <div className="compare-row">
            <span className="compare-label mono">上期</span>
            <span className="draw-balls">
              {prev.nums.map((n) => (
                <Ball key={n} n={n} size="sm" kind={overlap.includes(n) ? 'red' : 'plain'} />
              ))}
            </span>
          </div>
        )}
        <div className="chip-row" style={{ marginTop: 10 }}>
          <span className="chip">
            <i>重号 {overlap.length} 个：{overlap.length ? overlap.map(pad2).join(' ') : '无'}</i>
          </span>
        </div>
        <Note>
          每期开出 20 个号码，理论上与上期重复的个数期望为 20 × 20/{BALL_MAX} = 5 个；「本期必出重号」并不是规律，只是概率较高的正常现象。
        </Note>
      </Card>

      <Card title="概念说明" className="concept-card">
        <ul className="concept-list">
          <li>
            <b>重号</b>：上期开出的号码在本期再次开出。理论期望 <b>5 个/期</b>，但具体个数每期随机波动。
          </li>
          <li>
            <b>斜连号（邻号）</b>：本期号码恰为上期某号 ±1，多期连续排布会在走势图上形成「斜线」。斜线只是视觉模式，号码之间并无因果。
          </li>
          <li>
            <b>隔期号</b>：隔一期（2 期前）或隔两期（3 期前）开出的号码本期再次出现，同样仅为频率描述。
          </li>
        </ul>
        <Note tone="warn">
          以上「规律」全部源于随机序列的正常波动。任何「上期必出重号」「斜连要延续」的说法都没有概率依据。
        </Note>
      </Card>

      <Card title="逐期对照表" tag="最近 15 期 · 与前三期对比">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>重号</th>
                <th>斜连号</th>
                <th>隔一期</th>
                <th>隔两期</th>
              </tr>
            </thead>
            <tbody>
              {rep.rows.slice(0, 15).map((r) => (
                <tr key={r.draw.id}>
                  <td className="mono">{r.draw.id}</td>
                  <td>{renderBalls(r.repeat, 'red')}</td>
                  <td>{renderBalls(r.adjacent, 'amber')}</td>
                  <td>{renderBalls(r.skip1, 'blue')}</td>
                  <td>{renderBalls(r.skip2, 'gray')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend" style={{ marginTop: 10 }}>
          <span><i className="dot dot-hot" /> 重号</span>
          <span><i className="dot dot-warm" /> 斜连</span>
          <span><i className="dot dot-cold" /> 隔一期</span>
          <span><i className="dot dot-gray" /> 隔两期</span>
        </div>
        <Note tone="warn">
          表格中的「隔期号」只统计不含重号、不含斜连的号码，与上期重复的号码不会重复计数。
        </Note>
      </Card>
    </div>
  )
}

function renderBalls(list, kind) {
  if (!list.length) return <span className="muted">—</span>
  return (
    <span className="cell-balls wrap">
      {list.map((n) => (
        <span key={n} className={`mini-ball mini-${kind}`}>{pad2(n)}</span>
      ))}
    </span>
  )
}
