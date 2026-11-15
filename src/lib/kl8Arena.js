// ============================================================
// 快乐8 策略竞技场（严格前推）
//
// 每一期只用「该期之前」的数据生成号码，再与真实开奖比对命中数。
// 对比 4 种策略 + 1 个理论基准，给出平均命中、差值、z 值：
//   z = (均值 − 理论均值) / (理论标准差 / √期数)
// |z| < 1.96 说明与随机没有显著差异（95% 置信度）。
// ============================================================

import { v7Recommend } from './kl8V7.js'

const BALLS = 80

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickRandom(k, seed) {
  const rnd = mulberry32(seed)
  const pool = Array.from({ length: BALLS }, (_, i) => i + 1)
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (BALLS - i))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  return pool.slice(0, k)
}

/** 近 periods 期出现频次最高的 k 个号 */
function pickHot(history, k, periods = 100) {
  const count = new Array(BALLS + 1).fill(0)
  history.slice(0, periods).forEach((d) => d.nums.forEach((n) => (count[n] += 1)))
  return Array.from({ length: BALLS }, (_, i) => i + 1)
    .sort((a, b) => count[b] - count[a] || a - b)
    .slice(0, k)
}

/** 当前遗漏最大的 k 个号 */
function pickCold(history, k) {
  const last = new Array(BALLS + 1).fill(-1)
  for (let i = 0; i < history.length; i++) {
    for (const n of history[i].nums) if (last[n] < 0) last[n] = i
  }
  return Array.from({ length: BALLS }, (_, i) => i + 1)
    .map((n) => ({ n, om: last[n] < 0 ? history.length : last[n] }))
    .sort((a, b) => b.om - a.om || a.n - b.n)
    .slice(0, k)
    .map((x) => x.n)
}

/** 上期开奖号码里随机取 k 个（重号策略） */
function pickRepeat(history, k, seed) {
  const rnd = mulberry32(seed)
  const nums = [...(history[0]?.nums || [])]
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (nums.length - i))
    const t = nums[i]
    nums[i] = nums[j]
    nums[j] = t
  }
  return nums.slice(0, k)
}

const hitCount = (picks, actual) => {
  const set = new Set(actual)
  return picks.reduce((acc, n) => acc + (set.has(n) ? 1 : 0), 0)
}

/**
 * @param {Array} draws 开奖数据（最新在前）
 * @param {number} play 玩法
 * @param {number} periods 前推期数
 */
export function kl8Arena(draws, play = 10, periods = 200) {
  const k = Math.min(10, Math.max(1, Number(play) || 10))
  if (!Array.isArray(draws) || draws.length < 60) return null
  const n = Math.min(Number(periods) || 200, draws.length - 60)
  if (n < 20) return null

  const strategies = [
    { name: 'v7 综合评分', fn: (history, issue) => v7Recommend(history, { play: k, nextId: issue })?.picks || [] },
    { name: '纯随机', fn: (history, issue) => pickRandom(k, (issue * 7919 + k * 104729) >>> 0) },
    { name: '热号（近100期）', fn: (history) => pickHot(history, k) },
    { name: '冷号（最大遗漏）', fn: (history) => pickCold(history, k) },
    { name: '上期重号', fn: (history, issue) => pickRepeat(history, k, (issue * 65537 + 17) >>> 0) },
  ]

  const results = strategies.map((s) => ({ name: s.name, hits: [] }))

  for (let i = 0; i < n; i++) {
    const actual = draws[i]
    const history = draws.slice(i + 1)
    if (history.length < 60) break
    strategies.forEach((s, idx) => {
      try {
        const picks = s.fn(history, actual.id)
        if (picks.length === k) results[idx].hits.push(hitCount(picks, actual.nums))
      } catch {
        /* 单个策略失败不影响整体 */
      }
    })
  }

  const expected = (k * 20) / 80
  const sd = Math.sqrt(k * 0.25 * 0.75 * ((80 - k) / 79))
  const rows = results
    .map((r) => {
      const m = r.hits.length
      if (!m) return null
      const mean = r.hits.reduce((a, b) => a + b, 0) / m
      const z = (mean - expected) / (sd / Math.sqrt(m))
      return {
        name: r.name,
        n: m,
        mean,
        diff: mean - expected,
        z,
        significant: Math.abs(z) >= 1.96,
        best: Math.max(...r.hits),
        worst: Math.min(...r.hits),
      }
    })
    .filter(Boolean)

  const anySignificant = rows.some((r) => r.significant)
  return {
    play: k,
    periods: rows[0]?.n || 0,
    expected,
    sd,
    rows,
    verdict: anySignificant
      ? '存在超过 95% 显著性的策略，需要扩大样本再验证（可能是多重比较导致的假阳性）'
      : '全部策略与随机无显著差异（|z| < 1.96），没有任何策略优于纯随机',
  }
}
