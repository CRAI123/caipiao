// ============================================================
// 排列五统计引擎（与 fc3dStats 同接口，位置数与形态分类按 5 位实现）
// draws 约定：数组按【最新在前】排序，draw = { id, date, num: [万, 千, 百, 十, 个] }
// ⚠️ 摇奖为独立随机事件，所有指标仅为对历史数据的描述性统计。
// ============================================================

import { analyzeDraw5, PL5_POS } from './pl5Predict.js'

export const PRIMES = new Set([1, 2, 3, 5, 7])
export const SMALL = new Set([0, 1, 2])
export const MID = new Set([3, 4, 5, 6])
export const BIG = new Set([7, 8, 9])
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
export const POSITIONS = PL5_POS
export const POS_COUNT = 5
export { analyzeDraw5 as analyzeDraw }

export function takeLatest(draws, n) {
  return draws.slice(0, Math.min(n, draws.length))
}

const positions = () => [0, 1, 2, 3, 4]

// ---------- 频次 ----------

export function digitFrequencyByPos(draws, pos, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const d of window) freq[d.num[pos]]++
  return freq
}

export function digitFrequency(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const d of window) for (const digit of d.num) freq[digit]++
  return freq
}

export function positionFrequencyMatrix(draws, n = draws.length) {
  return positions().map((pos) => digitFrequencyByPos(draws, pos, n))
}

// ---------- 遗漏 ----------

export function digitMissingByPos(draws, pos, n = draws.length) {
  const window = takeLatest(draws, n)
  const omit = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const digit of DIGITS) {
    for (const d of window) {
      if (d.num[pos] === digit) break
      omit[digit]++
    }
  }
  return omit
}

export function digitMissing(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const omit = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const digit of DIGITS) {
    for (const d of window) {
      if (d.num.includes(digit)) break
      omit[digit]++
    }
  }
  return omit
}

// ---------- 形态统计 ----------

/** 跨度分布（0–9） */
export function spanDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(10).fill(0)
  let sum = 0
  for (const d of window) {
    const s = analyzeDraw5(d.num).span
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / (window.length || 1)).toFixed(1), count: window.length }
}

/** 和值分布（0–45） */
export function sumDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(46).fill(0)
  let sum = 0
  for (const d of window) {
    const s = analyzeDraw5(d.num).sum
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / (window.length || 1)).toFixed(1), count: window.length }
}

/** 奇偶形态分布（32 种） */
export function oddEvenDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const p = analyzeDraw5(d.num).oddPattern
    dist[p] = (dist[p] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 形态分布（五同/四同一异/三同二同/三同两异/两对一异/两同三异/全不同） */
export function formDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const f = analyzeDraw5(d.num).form
    dist[f] = (dist[f] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 大中小分布 */
export function sizeDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let small = 0
  let mid = 0
  let big = 0
  for (const d of window) {
    small += d.num.filter((v) => SMALL.has(v)).length
    mid += d.num.filter((v) => MID.has(v)).length
    big += d.num.filter((v) => BIG.has(v)).length
  }
  const total = small + mid + big || 1
  return {
    small,
    mid,
    big,
    smallPct: +((small / total) * 100).toFixed(1),
    midPct: +((mid / total) * 100).toFixed(1),
    bigPct: +((big / total) * 100).toFixed(1),
  }
}

/** 质合分布 */
export function primeDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let prime = 0
  let composite = 0
  for (const d of window) {
    const c = d.num.filter((v) => PRIMES.has(v)).length
    prime += c
    composite += d.num.length - c
  }
  const total = prime + composite || 1
  return {
    prime,
    composite,
    primePct: +((prime / total) * 100).toFixed(1),
    compositePct: +((composite / total) * 100).toFixed(1),
  }
}

// ---------- 重号 ----------

export function repeatStats(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let repeats = 0
  let total = 0
  const repeatCounts = {}
  for (let i = 0; i < window.length - 1; i++) {
    const curr = new Set(window[i].num)
    const prev = new Set(window[i + 1].num)
    const common = [...curr].filter((d) => prev.has(d))
    const cnt = common.length
    repeatCounts[cnt] = (repeatCounts[cnt] || 0) + 1
    repeats += cnt
    total++
  }
  return {
    avg: total ? +(repeats / total).toFixed(2) : 0,
    distribution: repeatCounts,
    totalPairs: total,
  }
}

// ---------- 走势矩阵 ----------

export function positionTrend(draws, periods, pos) {
  const window = takeLatest(draws, periods).slice().reverse()
  return {
    draws: window,
    cells: window.map((d) => d.num[pos]),
  }
}

/** 冷热门禁三分 */
export function hotColdClass(freq) {
  const sorted = DIGITS.map((d) => [d, freq[d]]).sort((a, b) => b[1] - a[1])
  const hot = sorted.slice(0, 3).map(([d]) => d)
  const cold = sorted.slice(-3).map(([d]) => d)
  return { hot, cold, sorted }
}
