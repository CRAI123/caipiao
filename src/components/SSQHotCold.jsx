// 双色球 冷热遗漏 —— 红球 33 号遗漏表、三层法冷热、黄金周期、遗漏走势、蓝球周期
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import {
  redStats,
  blueStats,
  blueOscillation,
  ZONE3,
  GOLDEN_OMIT,
  BLUE_GOLDEN_POINT,
} from '../lib/ssqPredict.js'

const WINDOWS = [30, 50, 100, 200]

/** 号码在下拉窗口内的遗漏走势矩阵（最新在前） */
function redTrendMatrix(draws, n) {
  const sample = draws.slice(0, Math.min(n, draws.length)).slice().reverse()
  const counter = new Array(34).fill(0)
  const rows = sample.map((d) => {
    const cells = []
    for (let num = 1; num <= 33; num++) {
      const hit = d.red.includes(num)
      cells.push({ num, hit, omit: hit ? 0 : counter[num] + 1 })
    }
    for (let num = 1; num <= 33; num++) {
      counter[num] = d.red.includes(num) ? 0 : counter[num] + 1
    }
    return { id: d.id, cells }
  })
  return rows.reverse()
}

function levelClass(level) {
  return level === '热' ? 'hot' : level === '温' ? 'warm' : 'cold'
}

export default function SSQHotCold({ draws }) {
  const [windowN, setWindowN] = useState(200)
  const [trendN, setTrendN] = useState(20)

  const sample = draws.slice(0, Math.min(windowN, draws.length))
  const rStats = redStats(sample)
  const bStats = blueStats(draws)
  const trend = redTrendMatrix(draws, trendN)
  const osc = blueOscillation(draws).slice(-20)

  const hot = rStats.filter((r) => r.level === '热')
  const warm = rStats.filter((r) => r.level === '温')
  const cold = rStats.filter((r) => r.level === '冷')
  const death = rStats.filter((r) => r.death)
  const bottom = rStats.filter((r) => r.bottom)
  const reverse = rStats.filter((r) => r.reverse)
  const golden = rStats.filter((r) => r.golden)

  const maxCount = Math.max(...rStats.map((r) => r.count), 1)
  const zoneOf = (n) => ZONE3.findIndex(([a, b]) => n >= a && n <= b)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOWS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${windowN === n ? 'active' : ''}`}
            onClick={() => setWindowN(n)}
            disabled={n > draws.length}
          >
            近 {n} 期
          </button>
        ))}
        <span className="toolbar-sep" />
        <span className="toolbar-label">走势期数</span>
        {[10, 20, 30].map((n) => (
          <button
            key={n}
            className={`tab-btn ${trendN === n ? 'active' : ''}`}
            onClick={() => setTrendN(n)}
          >
            {n} 期
          </button>
        ))}
      </div>

      <Card title="红球遗漏总表" tag={`近 ${Math.min(windowN, draws.length)} 期 · 33 个号码`}>
        <div className="legend">
          <span>
            <i className="dot dot-hot" />
            热（遗漏 ≤5）
          </span>
          <span>
            <i className="dot dot-warm" />
            温（6–10）
          </span>
          <span>
            <i className="dot dot-cold" />
            冷（&gt;10）
          </span>
          <span className="muted">底色深浅 = 出现次数</span>
        </div>
        <div className="table-scroll">
          <table className="ledger-table ssq-omit-table">
            <thead>
              <tr>
                <th>号码</th>
                <th>区</th>
                <th>出现</th>
                <th>当前遗漏</th>
                <th>平均遗漏</th>
                <th>最大遗漏</th>
                <th>状态</th>
                <th>信号</th>
              </tr>
            </thead>
            <tbody>
              {rStats.map((r) => (
                <tr key={r.n}>
                  <td>
                    <Ball n={r.n} kind="red" size="xs" />
                  </td>
                  <td className="mono muted">{zoneOf(r.n) + 1} 区</td>
                  <td
                    className="mono"
                    style={{ background: `rgba(194,58,43,${0.04 + (r.count / maxCount) * 0.22})` }}
                  >
                    {r.count}
                  </td>
                  <td className={`mono ssq-omit-${levelClass(r.level)}`}>{r.curOmit}</td>
                  <td className="mono muted">{r.avgOmit}</td>
                  <td className="mono muted">{r.maxOmit}</td>
                  <td>
                    <span className={`ssq-level ssq-level-${levelClass(r.level)}`}>{r.level}</span>
                  </td>
                  <td className="ssq-signals">
                    {r.golden && <span className="ssq-chip chip-gold">黄金周期</span>}
                    {r.bottom && <span className="ssq-chip chip-blue">底部</span>}
                    {r.reverse && <span className="ssq-chip chip-green">反转</span>}
                    {r.death && <span className="ssq-chip chip-red">死亡号</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          遗漏 = 距上次开出的期数。黄金周期为斐波那契数列（{GOLDEN_OMIT.join(' / ')}）；
          底部信号指当前遗漏已达历史最大遗漏的 85%；反转信号指遗漏明显短于平均水平；死亡号指遗漏 ≥20 期。
          这些都是对过去的描述，不改变下一期概率。
        </Note>
      </Card>

      <div className="stat-grid">
        <div className="stat-card tone-red">
          <div className="stat-label">热号</div>
          <div className="stat-value">
            {hot.length}
            <small>个</small>
          </div>
          <div className="stat-note">近来活跃</div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-label">温号</div>
          <div className="stat-value">
            {warm.length}
            <small>个</small>
          </div>
          <div className="stat-note">节奏正常</div>
        </div>
        <div className="stat-card tone-blue">
          <div className="stat-label">冷号</div>
          <div className="stat-value">
            {cold.length}
            <small>个</small>
          </div>
          <div className="stat-note">长期未出</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-label">死亡号</div>
          <div className="stat-value">
            {death.length}
            <small>个</small>
          </div>
          <div className="stat-note">遗漏 ≥20 期</div>
        </div>
      </div>

      <div className="two-col">
        <Card title="底部信号" tag="遗漏 ≥ 历史最大 85%">
          <div className="ssq-ball-row">
            {bottom.length ? (
              bottom.map((r) => (
                <span key={r.n} className="ssq-hot-item">
                  <Ball n={r.n} kind="red" size="sm" />
                  <em>
                    {r.curOmit}/{r.maxOmit}
                  </em>
                </span>
              ))
            ) : (
              <span className="muted small">暂无</span>
            )}
          </div>
        </Card>
        <Card title="黄金周期号" tag="遗漏落在斐波那契数">
          <div className="ssq-ball-row">
            {golden.length ? (
              golden.map((r) => (
                <span key={r.n} className="ssq-hot-item">
                  <Ball n={r.n} kind="red" size="sm" />
                  <em>漏{r.curOmit}</em>
                </span>
              ))
            ) : (
              <span className="muted small">暂无</span>
            )}
          </div>
        </Card>
      </div>

      <Card title="红球遗漏走势" tag={`最近 ${trendN} 期 · 灰字为遗漏期数`}>
        <div className="ssq-trend-wrap">
          <table className="ssq-trend-table">
            <thead>
              <tr>
                <th className="ssq-trend-id">期号</th>
                {Array.from({ length: 33 }, (_, i) => (
                  <th key={i}>{String(i + 1).padStart(2, '0')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={row.id}>
                  <td className="ssq-trend-id mono">{String(row.id).slice(-5)}</td>
                  {row.cells.map((c) => (
                    <td key={c.num} className={c.hit ? 'ssq-trend-hit' : 'ssq-trend-miss'}>
                      {c.hit ? <span className="ssq-trend-ball">{String(c.num).padStart(2, '0')}</span> : c.omit}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="蓝球遗漏与周期" tag="第 13–14 章 · 理论周期 16">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>蓝球</th>
                <th>出现</th>
                <th>当前遗漏</th>
                <th>最大遗漏</th>
                <th>平均周期</th>
                <th>冷热</th>
                <th>标记</th>
              </tr>
            </thead>
            <tbody>
              {bStats.map((b) => (
                <tr key={b.n}>
                  <td>
                    <Ball n={b.n} kind="blue" size="xs" />
                  </td>
                  <td className="mono">{b.count}</td>
                  <td className="mono">{b.curOmit}</td>
                  <td className="mono muted">{b.maxOmit}</td>
                  <td className="mono">{b.period === Infinity ? '—' : b.period}</td>
                  <td>
                    <span
                      className={`ssq-level ${
                        b.level === '热' ? 'ssq-level-hot' : b.level === '温' ? 'ssq-level-warm' : 'ssq-level-cold'
                      }`}
                    >
                      {b.level}
                    </span>
                  </td>
                  <td className="ssq-signals">
                    {b.golden && <span className="ssq-chip chip-gold">黄金周期</span>}
                    {BLUE_GOLDEN_POINT.includes(b.n) && (
                      <span className="ssq-chip chip-blue">黄金分割点</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          冷热按平均周期划分：&lt;14 期 = 热，14–18 期 = 温，&gt;18 期 = 冷。
          蓝球黄金周期为 1/2/3/5/8/13/21/34/55/89，黄金分割点号为 03/06/08/10/13。
        </Note>
      </Card>

      <Card title="蓝球振荡" tag="最近 20 期 · 与上期蓝球的距离">
        <div className="ssq-osc-list">
          {osc.map((o) => (
            <div key={o.id} className="ssq-osc-item">
              <span className="mono muted">{String(o.id).slice(-5)}</span>
              <Ball n={o.blue} kind="blue" size="xs" />
              <span className="ssq-osc-val">
                {o.osc === null ? '—' : `常规 ${o.osc}`}
              </span>
              <span className="ssq-osc-val muted">
                {o.loop === null ? '—' : `循环 ${o.loop}`}
              </span>
            </div>
          ))}
        </div>
        <Note>
          常规振荡 = |本期 − 上期|（0–15）；循环振荡取最小环绕距离（0–8），把 01 与 16 视作相邻。
        </Note>
      </Card>
    </div>
  )
}
