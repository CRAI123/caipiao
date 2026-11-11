// 双色球 重号 / 邻号 / 孤号 + 新旧码 + 5 期重号池 + 二码同出
import React, { useState } from 'react'
import { Card, StatCard, Note, Ball } from './common.jsx'
import {
  repeatNeighbor,
  newOldRatio,
  recent5Pool,
  pairStats,
  redStats,
} from '../lib/ssqPredict.js'

const WINDOWS = [20, 30, 50, 100]

export default function SSQRepeats({ draws }) {
  const [windowN, setWindowN] = useState(30)
  const recent = draws.slice(0, 15)

  // 逐对统计重号 / 邻号 / 孤号
  const pairs = []
  for (let i = 0; i < recent.length - 1; i++) {
    const curr = recent[i]
    const prev = recent[i + 1]
    const rn = repeatNeighbor(prev, curr)
    pairs.push({ curr, prev, rn })
  }

  const sample = draws.slice(0, Math.min(windowN, draws.length))
  const dist = [0, 1, 2, 3, 4, 5, 6].map(() => 0)
  for (let i = 0; i < sample.length - 1; i++) {
    const rn = repeatNeighbor(sample[i + 1], sample[i])
    if (rn) dist[rn.repeat.length]++
  }
  const pairCount = Math.max(sample.length - 1, 1)
  const avgRepeat = +(dist.reduce((s, c, k) => s + c * k, 0) / pairCount).toFixed(2)
  const avgNeighbor = (() => {
    let total = 0
    let n = 0
    for (let i = 0; i < sample.length - 1; i++) {
      const rn = repeatNeighbor(sample[i + 1], sample[i])
      if (rn) {
        total += rn.neighbor.length
        n++
      }
    }
    return n ? +(total / n).toFixed(2) : 0
  })()

  const no = newOldRatio(draws)
  const pool = recent5Pool(draws)
  const pairTop = pairStats(draws, 50).slice(0, 12)
  const stats = redStats(draws)
  const hotPool = new Set(stats.filter((s) => s.level === '热').map((s) => s.n))

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
      </div>

      <div className="stat-grid">
        <StatCard label="平均重号个数" value={avgRepeat} note={`${pairCount} 对相邻期`} />
        <StatCard label="平均邻号个数" value={avgNeighbor} tone="blue" note="与上期号码相差 1" />
        <StatCard
          label="0 个重号占比"
          value={`${((dist[0] / pairCount) * 100).toFixed(0)}%`}
          tone="amber"
          note="最常见的情况"
        />
        <StatCard
          label="2 个及以上重号"
          value={`${(((dist[2] + dist[3] + dist[4] + dist[5] + dist[6]) / pairCount) * 100).toFixed(0)}%`}
          tone="green"
          note="重号偏多的期数"
        />
      </div>

      <Card title="重号分布" tag={`近 ${Math.min(windowN, draws.length)} 期`}>
        <div className="ssq-dist-bars">
          {dist.map((c, k) => (
            <div key={k} className="ssq-dist-item">
              <div className="ssq-dist-bar-wrap">
                <div
                  className="ssq-dist-bar"
                  style={{ height: `${(c / Math.max(...dist, 1)) * 100}%` }}
                />
              </div>
              <div className="ssq-dist-label">{k} 个</div>
              <div className="ssq-dist-val mono">{c}</div>
            </div>
          ))}
        </div>
        <Note>
          相邻两期的重号个数近似二项分布；单号重复概率恒为 6/33≈18.2%，
          与它上期是否开出无关。
        </Note>
      </Card>

      <Card title="近期重邻孤明细" tag="最近 15 期">
        <div className="ssq-repeat-list">
          {pairs.map(({ curr, prev, rn }) => (
            <div key={curr.id} className="ssq-repeat-row">
              <span className="mono muted">{String(prev.id).slice(-5)}</span>
              <span className="ssq-repeat-nums">
                {prev.red.map((n) => (
                  <Ball key={`p${n}`} n={n} kind="red" size="xs" dim />
                ))}
              </span>
              <span className="ssq-repeat-arrow">→</span>
              <span className="mono muted">{String(curr.id).slice(-5)}</span>
              <span className="ssq-repeat-nums">
                {curr.red.map((n) => (
                  <Ball
                    key={`c${n}`}
                    n={n}
                    kind="red"
                    size="xs"
                    className={
                      rn.repeat.includes(n) ? 'ball-rep' : rn.neighbor.includes(n) ? 'ball-nb' : ''
                    }
                  />
                ))}
              </span>
              <span className="ssq-repeat-tag">重 {rn.repeat.length} · 邻 {rn.neighbor.length} · 孤 {rn.orphan.length}</span>
            </div>
          ))}
        </div>
        <Note>
          金圈标记为重号（与上期相同），蓝圈标记为邻号（与上期号码相差 1），其余为孤号。
        </Note>
      </Card>

      <div className="two-col">
        <Card title="新旧码配比" tag="三层法">
          {no ? (
            <>
              <div className="ssq-two-metric">
                <div>
                  <b>{no.old}</b>
                  <span>旧码</span>
                  <small>近 5 期出过</small>
                </div>
                <div>
                  <b>{no.new}</b>
                  <span>新码</span>
                  <small>近 5 期未出</small>
                </div>
              </div>
              <Note>旧码池 {no.poolSize} 个，上期 6 红中旧码 {no.old} 个。</Note>
            </>
          ) : (
            <Note>数据不足</Note>
          )}
        </Card>
        <Card title="5 期重号池" tag={`${pool.count} 个 · ${pool.strong ? '偏强' : '一般'}`}>
          <div className="ssq-ball-row">
            {pool.nums.map((n) => (
              <Ball key={n} n={n} kind="red" size="xs" />
            ))}
          </div>
          <Note>
            近 5 期出现过的红球共 {pool.count} 个（理论期望约 5×6×(1−…)≈25 个），
            ≥20 个视为重号偏强。
          </Note>
        </Card>
      </div>

      <Card title="二码同出 Top12" tag="近 50 期">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>号码对</th>
                <th>同出次数</th>
                <th>当前遗漏</th>
                <th>平均间隔</th>
              </tr>
            </thead>
            <tbody>
              {pairTop.map((r) => (
                <tr key={r.key}>
                  <td>
                    <span className="ssq-pair">
                      <Ball n={r.a} kind="red" size="xs" />
                      <Ball n={r.b} kind="red" size="xs" />
                    </span>
                  </td>
                  <td className="mono">{r.count}</td>
                  <td className="mono">{r.omit}</td>
                  <td className="mono muted">{r.avgOmit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          任一两码同出的理论概率约 C(31,4)/C(33,6) ≈ 2.9%，50 期里出现 1–2 次属正常。
        </Note>
      </Card>

      <Card title="热号池" tag="近 200 期三层法热号">
        <div className="ssq-ball-row">
          {[...hotPool].sort((a, b) => a - b).map((n) => (
            <Ball key={n} n={n} kind="red" size="sm" />
          ))}
        </div>
        <Note>热号池只是统计结果，不代表下期更容易被抽到。</Note>
      </Card>
    </div>
  )
}
