// ============================================================
// 七星彩统计引擎（与 fc3dStats 同接口）
// draws 约定：数组按【最新在前】排序，draw = { id, date, num: [一,二,三,四,五,六,后] }
// 前 6 位取值 0–9，后区取值 0–14。
// ⚠️ 摇奖为独立随机事件，所有指标仅为对历史数据的描述性统计。
// ============================================================

import { analyzeDrawQXC, QXC_POS, QXC_VALUES } from './qxcPredict.js'

export const PRIMES = new Set([2, 3, 5, 7, 11, 13])
export const SMALL = new Set([0, 1, 2])
export const MID = new Set([3, 4, 5, 6])
export const BIG = new Set([7, 8, 9])
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
export const POSITIONS = QXC_POS
export const POS_VALUES = QXC_VALUES
export const POS_COUNT = 7
export { analyzeDrawQXC as analyzeDraw }

export function takeLatest(draws, n) {
  return draws.slice(0, Math.min(n, draws.length))
}

const positions = () => [0, 1, 2, 3, 4, 5, 6]

/** 某位置的全部可能取值 */
export function valuesOf(pos) {
  return POS_VALUES[pos] || DIGITS
}

// ---------- 频次 ----------

export function digitFrequencyByPos(draws, pos, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(valuesOf(pos).map((d) => [d, 0]))
  for (const d of window) {
    const v = d.num[pos]
    if (v in freq) freq[v]++
  }
  return freq
}

/** 总体频次：前区 0–9 + 后区 0–14 一起统计 */
export function digitFrequency(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries([...Array(15).keys()].map((d) => [d, 0]))
  for (const d of window) {
    for (let pos = 0; pos < 7; pos++) {
      const v = d.num[pos]
      if (v >= 0 && v <= 14) freq[v]++
    }
  }
  return freq
}

export function positionFrequencyMatrix(draws, n = draws.length) {
  return positions().map((pos) => digitFrequencyByPos(draws, pos, n))
}

// ---------- 遗漏 ----------

export function digitMissingByPos(draws, pos, n = draws.length) {
  const window = takeLatest(draws, n)
  const omit = Object.fromEntries(valuesOf(pos).map((d) => [d, 0]))
  for (const digit of valuesOf(pos)) {
    for (const d of window) {
      if (d.num[pos] === digit) break
      omit[digit]++
    }
  }
  return omit
}

export function digitMissing(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const omit = Object.fromEntries([...Array(15).keys()].map((d) => [d, 0]))
  for (const digit of Object.keys(omit).map(Number)) {
    for (const d of window) {
      if (d.num.includes(digit)) break
      omit[digit]++
    }
  }
  return omit
}

// ---------- 形态统计 ----------

/** 跨度分布（0–14） */
export function spanDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(15).fill(0)
  let sum = 0
  for (const d of window) {
    const s = analyzeDrawQXC(d.num).span
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / (window.length || 1)).toFixed(1), count: window.length }
}

/** 和值分布（0–68） */
export function sumDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(69).fill(0)
  let sum = 0
  for (const d of window) {
    const s = analyzeDrawQXC(d.num).sum
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / (window.length || 1)).toFixed(1), count: window.length }
}

/** 奇偶形态分布（2^7 = 128 种） */
export function oddEvenDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const p = analyzeDrawQXC(d.num).oddPattern
    dist[p] = (dist[p] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 形态分布（按不同数字个数：全同 / 2种数字 / … / 全不同） */
export function formDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const f = analyzeDrawQXC(d.num).form
    dist[f] = (dist[f] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 大中小分布（后区 10–14 归入大号） */
export function sizeDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let small = 0
  let mid = 0
  let big = 0
  for (const d of window) {
    for (const v of d.num) {
      if (SMALL.has(v)) small++
      else if (MID.has(v)) mid++
      else big++
    }
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

/** 质合分布（质数：2,3,5,7,11,13） */
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

/** 冷热门禁三分（默认只对 0–9 前区数字排序） */
export function hotColdClass(freq, values = DIGITS) {
  const sorted = values.map((d) => [d, freq[d] || 0]).sort((a, b) => b[1] - a[1])
  const hot = sorted.slice(0, 3).map(([d]) => d)
  const cold = sorted.slice(-3).map(([d]) => d)
  return { hot, cold, sorted }
}
