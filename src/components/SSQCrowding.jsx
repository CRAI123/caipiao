// 双色球 选号避挤 —— 唯一有文献支撑的优化方向：不提高中奖概率，只减少中奖后分摊
import React, { useMemo, useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { RED_NUMS, BLUE_NUMS, crowdingScore, predictSSQ } from '../lib/ssqPredict.js'

const TONE_CLASS = { green: 'tone-green', amber: 'tone-amber', red: 'tone-red' }

export default function SSQCrowding({ draws = [] }) {
  const [red, setRed] = useState([])
  const [blue, setBlue] = useState(null)

  function toggleRed(n) {
    if (red.includes(n)) return setRed(red.filter((x) => x !== n))
    if (red.length >= 6) return
    setRed([...red, n].sort((a, b) => a - b))
  }

  function fillPredict() {
    const p = predictSSQ(draws)
    if (!p) return
    setRed(p.red)
    setBlue(p.blue)
  }

  function randomPick() {
    const pool = [...RED_NUMS]
    const picked = []
    while (picked.length < 6) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    }
    setRed(picked.sort((a, b) => a - b))
    setBlue(BLUE_NUMS[Math.floor(Math.random() * BLUE_NUMS.length)])
  }

  const result = useMemo(() => {
    if (red.length !== 6 || !blue) return null
    return crowdingScore(red, blue, draws[1] || null)
  }, [red, blue, draws])

  const maxPoints = result ? Math.max(...result.factors.map((f) => f.weight), 1) : 1

  return (
    <div className="page">
      <Card title="选号拥挤度检测" tag="不提高中奖概率 · 只减少奖金分摊">
        <p className="muted small">
          学术界（英国国家彩票、以色列彩票、2026 年《Primes Do Not Pay》）反复验证：
          彩民系统性地偏爱生日号、质数、吉利数字和整齐的组合，导致这些号码一旦开出，
          会有更多人同时中奖、平分奖金。
          <b>号码被摇出的概率完全不变</b>，但“中了能拿多少”会被选号偏好显著影响。
        </p>

        <div className="crowd-pick">
          <div className="fc3d-dt-label">
            红球 <span className="muted">（选 6 个，当前 {red.length}/6）</span>
          </div>
          <div className="ssq-pick-grid">
            {RED_NUMS.map((n) => (
              <button
                key={n}
                className={`ssq-pick ball-red ${red.includes(n) ? 'pick-tuo' : ''}`}
                onClick={() => toggleRed(n)}
                disabled={!red.includes(n) && red.length >= 6}
              >
                {String(n).padStart(2, '0')}
              </button>
            ))}
          </div>

          <div className="fc3d-dt-label">
            蓝球 <span className="muted">（选 1 个）</span>
          </div>
          <div className="ssq-pick-grid ssq-pick-blue">
            {BLUE_NUMS.map((n) => (
              <button
                key={n}
                className={`ssq-pick ball-blue ${blue === n ? 'pick-blue' : ''}`}
                onClick={() => setBlue(n)}
              >
                {String(n).padStart(2, '0')}
              </button>
            ))}
          </div>

          <div className="row-actions">
            <button className="tab-btn" onClick={() => { setRed([]); setBlue(null) }}>
              清空
            </button>
            <button className="tab-btn" onClick={randomPick}>
              机选一注
            </button>
            <button className="tab-btn" onClick={fillPredict} disabled={!draws.length}>
              用推荐填入
            </button>
          </div>
        </div>
      </Card>

      {!result && (
        <Note>选满 6 个红球和 1 个蓝球后，这里会显示拥挤度评分与改进建议。</Note>
      )}

      {result && (
        <>
          <Card title="拥挤度评分" tag={`${result.band}`}>
            <div className="crowd-hero">
              <div className={`crowd-score ${TONE_CLASS[result.tone]}`}>
                <span className="crowd-score-num">{result.score}</span>
                <span className="crowd-score-unit">/ 100</span>
              </div>
              <div className="crowd-hero-info">
                <div className="crowd-balls">
                  {red.map((n) => (
                    <Ball key={n} n={n} kind="red" size="sm" />
                  ))}
                  <span className="ssq-divider" aria-hidden="true" />
                  <Ball n={blue} kind="blue" size="sm" />
                </div>
                <div className={`crowd-band crowd-band-${result.tone}`}>{result.band}</div>
                <div className="muted small">
                  和值 {result.sum} · 跨度 {result.span} · 估算分摊倍数 ≈ {result.shareFactor}×
                  （中位选号为 1.00×）
                </div>
              </div>
            </div>

            <div className="crowd-scale">
              <div className="crowd-scale-track">
                <span className="crowd-scale-zone zone-green" />
                <span className="crowd-scale-zone zone-amber" />
                <span className="crowd-scale-zone zone-red" />
                <span className="crowd-scale-mark" style={{ left: `${result.score}%` }} />
              </div>
              <div className="crowd-scale-labels mono">
                <span>0 冷门</span>
                <span>40</span>
                <span>60</span>
                <span>75</span>
                <span>100 拥挤</span>
              </div>
            </div>
            <Note>
              “分摊倍数”是粗略估算：分数越高，说明这组号码越接近大众口味，
              中大奖时越可能与更多人平分。它不是精确值，也不影响中奖概率。
            </Note>
          </Card>

          <Card title="拥挤因素拆解" tag="按贡献从高到低">
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>因素</th>
                    <th>命中程度</th>
                    <th>权重</th>
                    <th>得分</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {result.factors.map((f) => (
                    <tr key={f.key}>
                      <td>{f.label}</td>
                      <td>
                        <span className="crowd-bar">
                          <span
                            className="crowd-bar-fill"
                            style={{ width: `${(f.raw * 100).toFixed(0)}%` }}
                          />
                        </span>
                      </td>
                      <td className="mono muted">{f.weight}</td>
                      <td className="mono">{f.points}</td>
                      <td className="muted small">{f.tip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mono small muted" style={{ marginTop: 8 }}>
              总权重 {result.factors.reduce((s, f) => s + f.weight, 0)} · 归一化后得分 {result.score}
            </div>
          </Card>

          <Card title="低拥挤改号建议" tag={`${result.tips.length} 条`}>
            {result.tips.length ? (
              <ol className="crowd-tips">
                {result.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            ) : (
              <Note tone="info">这组号码已经比较冷门，改号空间不大。</Note>
            )}
            <Note tone="warn">
              改号只有一个作用：万一中大奖，少分给几个人。它让中奖概率保持完全不变，
              也绝不会让亏损变成盈利——双色球整体返奖率仍约 50%。
            </Note>
          </Card>
        </>
      )}

      <Card title="这条建议的边界" tag="务必读完">
        <div className="ssq-base-grid">
          <div>能做的：避开生日号 / 连号 / 同尾 / 均匀结构，减少分摊。</div>
          <div>不能做的：提高 1/17,721,088 的中奖概率。</div>
          <div>国内现实：红球 1–31 占 31 个号，避挤空间比欧美小得多。</div>
          <div>另一条路：只在奖池累计较高时投注，期望值优于平时。</div>
        </div>
      </Card>
    </div>
  )
}
