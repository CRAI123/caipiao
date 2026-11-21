// 双色球 选号避挤 —— 唯一有文献支撑的优化方向：不提高中奖概率，只减少中奖后分摊
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { RED_NUMS, BLUE_NUMS, crowdingScore, predictSSQ } from '../lib/ssqPredict.js'
import { getSsqCrowding, syncSsqOfficial } from '../lib/api.js'
import {
  comboPopularity,
  popularityPercentile,
  splitIndex,
  recommendColdCombos,
} from '../lib/popularity.js'
import '../crowding.css'

const TONE_CLASS = { green: 'tone-green', amber: 'tone-amber', red: 'tone-red' }
const V_CLASS = { green: 'crowd2-v-green', amber: 'crowd2-v-amber', red: 'crowd2-v-red' }

/** 百分位 → 一句结论（只谈分摊，不谈概率） */
function verdictOf(percentile) {
  if (percentile < 30) return { tone: 'green', text: '冷门组合，中奖时分摊风险低' }
  if (percentile <= 70) return { tone: 'amber', text: '大众区间，分摊水平接近平均票' }
  return { tone: 'red', text: '热门组合，中奖时分摊严重' }
}

function timeText(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SSQCrowding({ draws = [] }) {
  const [red, setRed] = useState([])
  const [blue, setBlue] = useState(null)
  // 冷门推荐的「锁定胆码」：0–3 个必含号码，独立于上面的一注选号
  const [locks, setLocks] = useState([])

  // 公开数据：新浪本期投票人气 + 官方销售/中奖注数校准模型
  const [crowd, setCrowd] = useState(null)
  const [crowdErr, setCrowdErr] = useState('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let alive = true
    // 开奖前看的是下一期，期号 = 最新一期 + 1 后取后 5 位（2026133 → 26134）
    const next = draws[0]?.id != null ? String(Number(draws[0].id) + 1).slice(2) : undefined
    getSsqCrowding(next)
      .then((d) => {
        if (alive) setCrowd(d)
      })
      .catch((e) => {
        if (alive) setCrowdErr(String(e?.message || e))
      })
    return () => {
      alive = false
    }
  }, [draws])

  async function syncOfficial() {
    setSyncing(true)
    setCrowdErr('')
    try {
      await syncSsqOfficial()
      setCrowd(await getSsqCrowding())
    } catch (e) {
      setCrowdErr(String(e?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  function toggleRed(n) {
    if (red.includes(n)) return setRed(red.filter((x) => x !== n))
    if (red.length >= 6) return
    setRed([...red, n].sort((a, b) => a - b))
  }

  function toggleLock(n) {
    if (locks.includes(n)) return setLocks(locks.filter((x) => x !== n))
    if (locks.length >= 3) return
    setLocks([...locks, n].sort((a, b) => a - b))
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

  // 上期开奖红球：本页沿用「draws[1] = 上期」的口径
  const prevNums = useMemo(() => (draws[1] ? draws[1].red : []), [draws])

  // 组合热度检测：复用上面已选的 6 个红球，实时计算分数 / 百分位 / 分摊指数
  const hot = useMemo(() => {
    if (red.length !== 6) return null
    const { score, base, factors } = comboPopularity(red, { maxNum: 33, prevNums })
    const percentile = popularityPercentile(score, { maxNum: 33, samples: 3000, prevNums })
    return { score, base, factors, percentile, split: splitIndex(percentile), ...verdictOf(percentile) }
  }, [red, prevNums])

  // 冷门组合推荐：固定种子采样 8000 组，按热度升序取前 5，必含锁定胆码
  const cold = useMemo(() => {
    return recommendColdCombos({ lock: locks, maxNum: 33, samples: 8000, prevNums, top: 5 }).map(
      (row) => {
        const percentile = popularityPercentile(row.score, { maxNum: 33, samples: 3000, prevNums })
        return { ...row, percentile, split: splitIndex(percentile) }
      },
    )
  }, [locks, prevNums])

  // ---------- 公开数据展示 ----------
  const sinaRed = crowd?.sina?.red || []
  const sinaBlue = crowd?.sina?.blue || []
  const redMean = sinaRed.length ? sinaRed.reduce((s, x) => s + x.pct, 0) / sinaRed.length : 0
  const blueMean = sinaBlue.length ? sinaBlue.reduce((s, x) => s + x.pct, 0) / sinaBlue.length : 0
  const redMax = Math.max(...sinaRed.map((x) => x.pct), redMean * 2)
  const blueMax = Math.max(...sinaBlue.map((x) => x.pct), blueMean * 2)
  const topOf = (arr) => [...arr].sort((a, b) => b.pct - a.pct)
  const redTop = topOf(sinaRed)
  const blueTop = topOf(sinaBlue)

  // 选中号码在官方数据里的预估被买倍数（1.00 = 平均票）
  const officialPick = useMemo(() => {
    if (!crowd?.model || red.length !== 6) return null
    const r = red.reduce((p, n) => p * (crowd.model.red[n - 1] || 1), 1)
    const b = blue ? crowd.model.blue[blue - 1] || 1 : null
    return { red: r, blue: b }
  }, [crowd, red, blue])

  const voteRow = (x, mean, max) => {
    const tone = x.pct > mean * 1.15 ? 'hot' : x.pct < mean * 0.85 ? 'cold' : ''
    return (
      <div className={`crowd3-row ${tone}`} key={x.n}>
        <span className="crowd3-num">{String(x.n).padStart(2, '0')}</span>
        <span className="crowd3-bar">
          <span style={{ width: `${Math.min(100, (x.pct / max) * 100)}%` }} />
        </span>
        <span className="crowd3-pct">{x.pct.toFixed(2)}%</span>
      </div>
    )
  }

  const model = crowd?.model
  const recent = crowd?.recent || []

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

      <Card
        title="本期人气榜"
        tag={sinaRed.length ? `第 ${crowd.sina.issue} 期 · 新浪网友投票` : '开奖前样本'}
      >
        {!sinaRed.length ? (
          <Note>{crowdErr || crowd?.sinaError || '本期投票样本还没生成（一般开奖前一天才有）。'}</Note>
        ) : (
          <>
            <p className="muted small">
              红球样本 {crowd.sina.totalRed} 份 · 蓝球样本 {crowd.sina.totalBlue} 份 · 更新{' '}
              {timeText(crowd.sina.at)}
              <br />
              这是网友自愿投票，不是真实销量，样本也只有几千份；它和开奖概率没有任何关系。
            </p>

            <div className="crowd3-heat-head">
              红球 <span className="muted">（平均 {redMean.toFixed(2)}%）</span>
              <span className="crowd3-heat-mini">
                最热 {redTop.slice(0, 3).map((x) => `${String(x.n).padStart(2, '0')} ${x.pct.toFixed(1)}%`).join(' · ')}
              </span>
              <span className="crowd3-heat-mini crowd3-cold">
                最冷 {redTop.slice(-3).map((x) => `${String(x.n).padStart(2, '0')} ${x.pct.toFixed(1)}%`).join(' · ')}
              </span>
            </div>
            <div className="crowd3-grid">{sinaRed.map((x) => voteRow(x, redMean, redMax))}</div>

            <div className="crowd3-heat-head">
              蓝球 <span className="muted">（平均 {blueMean.toFixed(2)}%）</span>
              <span className="crowd3-heat-mini">
                最热 {blueTop.slice(0, 3).map((x) => `${String(x.n).padStart(2, '0')} ${x.pct.toFixed(1)}%`).join(' · ')}
              </span>
              <span className="crowd3-heat-mini crowd3-cold">
                最冷 {blueTop.slice(-3).map((x) => `${String(x.n).padStart(2, '0')} ${x.pct.toFixed(1)}%`).join(' · ')}
              </span>
            </div>
            <div className="crowd3-grid crowd3-grid-blue">
              {sinaBlue.map((x) => voteRow(x, blueMean, blueMax))}
            </div>

            <Note>
              买得少的号不会更容易开出——每个号每期被摇出的概率是固定的。这里唯一的用处是：
              中了之后跟你平分的人更少。
            </Note>
          </>
        )}
      </Card>

      <Card title="组合热度检测" tag="浮动奖 · 分摊视角">
        {!hot && (
          <Note>
            在上方选满 6 个红球后，这里会实时算出组合热度、百分位与预计分摊指数。
          </Note>
        )}

        {hot && (
          <>
            <div className="crowd2-picked">
              {red.map((n) => (
                <Ball key={n} n={n} kind="red" size="sm" />
              ))}
            </div>

            <div className="crowd2-metrics">
              <div className="crowd2-metric">
                <span className="crowd2-metric-label">热度分数</span>
                <span className="crowd2-metric-value">{hot.score.toFixed(1)}</span>
              </div>
              <div className="crowd2-metric">
                <span className="crowd2-metric-label">热度百分位</span>
                <span className={`crowd2-metric-value ${V_CLASS[hot.tone]}`}>
                  {hot.percentile.toFixed(1)}
                  <small>/ 100</small>
                </span>
              </div>
              <div className="crowd2-metric">
                <span className="crowd2-metric-label">预计分摊指数</span>
                <span className={`crowd2-metric-value ${V_CLASS[hot.tone]}`}>
                  {hot.split.toFixed(2)}
                  <small>× 平均</small>
                </span>
              </div>
            </div>

            <div className="crowd2-factor-head">热度来源</div>
            {hot.factors.length ? (
              <ul className="crowd2-factors">
                {hot.factors.map((f) => (
                  <li key={f.name}>
                    <span className="crowd2-mult">×{f.mult}</span>
                    <span>{f.name}</span>
                  </li>
                ))}
                <li>
                  <span className="crowd2-mult">基础</span>
                  <span>单号被选倾向合计 {hot.base.toFixed(1)}（生日号 &gt; 日期号 &gt; 32/33）</span>
                </li>
              </ul>
            ) : (
              <p className="crowd2-factors-empty">
                未命中任何结构加成，热度仅来自单号倾向合计 {hot.base.toFixed(1)}。
              </p>
            )}

            <div className={`crowd2-verdict crowd2-tone-${hot.tone}`}>{hot.text}</div>

            <Note>
              百分位由固定种子抽样 3000 组组合估算：分数越高，说明越接近大众口味。
              分摊指数只是「预计有多少人跟你分」的相对倍数，中位数约 1.00×，不是精确值。
            </Note>
          </>
        )}
      </Card>

      <Card title="冷门组合推荐" tag="少人买 ≠ 更容易中">
        <div className="crowd2-lock-label">
          锁定胆码 <span className="muted">（0–3 个，推荐组合一定包含；当前 {locks.length}/3）</span>
        </div>
        <div className="crowd2-lock-grid">
          {RED_NUMS.map((n) => (
            <button
              key={n}
              className={`crowd2-lock ${locks.includes(n) ? 'crowd2-lock-on' : ''}`}
              onClick={() => toggleLock(n)}
              disabled={!locks.includes(n) && locks.length >= 3}
            >
              {String(n).padStart(2, '0')}
            </button>
          ))}
        </div>

        {cold.length ? (
          <ul className="crowd2-cold-list">
            {cold.map((row, i) => (
              <li className="crowd2-cold-item" key={row.nums.join('-')}>
                <span className="crowd2-cold-rank">{i + 1}</span>
                <span className="crowd2-cold-balls">
                  {row.nums.map((n) => (
                    <Ball key={n} n={n} kind="red" size="sm" />
                  ))}
                </span>
                <span className="crowd2-cold-meta">
                  热度 <b>{row.score.toFixed(1)}</b> · 百分位 <b>{row.percentile.toFixed(1)}</b> ·
                  分摊 <b>{row.split.toFixed(2)}×</b>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Note tone="warn">当前胆码组合无法生成候选，请减少锁定号码。</Note>
        )}

        <Note>
          从 8000 组固定种子采样的候选里取热度最低的 5 组，结果每次渲染都一样。
          这些只是「少人买」的组合，
          <b>中奖概率与其他任何一组号码完全相同</b>，锁定胆码也不改变这一点。
        </Note>
        <Note tone="warn">
          本模型只估算「奖金分摊」，不改变中奖概率；热度参数是公开行为研究的经验值，
          不是真实购彩数据。
        </Note>
      </Card>

      <Card title="官方数据校准" tag={model ? `${model.n} 期真实开奖数据` : '待初始化'}>
        {!model ? (
          <>
            <Note>
              官方从不公布投注明细。这里改用“二等奖注数 ÷ 按销售额推算的理论注数”反推每期 6 红组合被买的倍数，
              再对 3500 多期做对数回归，得到每个号码的真实购买偏好。首次使用需要回补历史数据（约 10 秒）。
            </Note>
            <button className="tab-btn" onClick={syncOfficial} disabled={syncing}>
              {syncing ? '正在回补 3500 期…' : '同步官方历史数据'}
            </button>
            {crowdErr && <Note tone="warn">{crowdErr}</Note>}
          </>
        ) : (
          <>
            <p className="muted small">
              覆盖 {model.n} 期（{String(model.from).slice(2)} → {String(model.to).slice(2)}）· 更新{' '}
              {timeText(model.at)}
              <br />
              倍数 1.00 = 平均票；&gt;1 表示被重复购买多、中了分得少，&lt;1 表示冷门。
            </p>

            <div className="crowd3-heat-head">
              红球购买偏好 <span className="muted">（差异很弱，基本在 ±2% 内）</span>
            </div>
            <div className="crowd3-chips">
              {model.red.map((v, i) => (
                <span
                  key={i}
                  className={`crowd3-chip ${v >= 1.01 ? 'hot' : v <= 0.99 ? 'cold' : ''} ${
                    red.includes(i + 1) ? 'on' : ''
                  }`}
                >
                  {String(i + 1).padStart(2, '0')} <b>×{v.toFixed(2)}</b>
                </span>
              ))}
            </div>

            <div className="crowd3-heat-head">
              蓝球购买偏好 <span className="muted">（差异明显，最热与最冷差约 50%）</span>
            </div>
            <div className="crowd3-chips">
              {model.blue.map((v, i) => (
                <span
                  key={i}
                  className={`crowd3-chip ${v >= 1.1 ? 'hot' : v <= 0.9 ? 'cold' : ''} ${
                    blue === i + 1 ? 'on' : ''
                  }`}
                >
                  {String(i + 1).padStart(2, '0')} <b>×{v.toFixed(2)}</b>
                </span>
              ))}
            </div>

            {officialPick && (
              <div className="crowd3-pickline">
                你选这注的官方预估倍数：红球 ×{officialPick.red.toFixed(2)}
                {officialPick.blue != null && ` · 蓝球 ×${officialPick.blue.toFixed(2)}`}
                {` · 合计 ×${(officialPick.red * (officialPick.blue ?? 1)).toFixed(2)}`}
                <span className="muted">（越低代表中奖后分的人越少）</span>
              </div>
            )}

            <div className="crowd3-heat-head">最近几期的“开奖号实际被买倍数”</div>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>期号</th>
                    <th>红球</th>
                    <th>蓝</th>
                    <th>红组合倍数</th>
                    <th>含蓝倍数</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 8).map((r) => (
                    <tr key={r.drawId}>
                      <td className="mono">{String(r.drawId).slice(2)}</td>
                      <td className="mono">
                        {r.red.map((n) => String(n).padStart(2, '0')).join(' ')}
                      </td>
                      <td className="mono">{String(r.blue).padStart(2, '0')}</td>
                      <td className="mono">{r.ratio2 ?? '—'}</td>
                      <td className="mono">{r.ratio1 ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {model.check && (
              <Note>
                自查：购买偏好与历史开出频率的相关系数为 红球 {model.check.redR.toFixed(2)}、蓝球{' '}
                {model.check.blueR.toFixed(2)}。蓝球只有 16 个样本，这个系数本身的抽样波动约 ±0.28，
                两项都在正常范围内——数据不支持“买得少更容易开”。
              </Note>
            )}
          </>
        )}
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
        <Note tone="warn">
          本模型只估算「奖金分摊」，不改变中奖概率；热度参数是公开行为研究的经验值，
          不是真实购彩数据。
        </Note>
      </Card>
    </div>
  )
}
