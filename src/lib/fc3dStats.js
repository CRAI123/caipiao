// ============================================================
// 福彩3D 统计引擎
// draws 约定：数组按【最新在前】排序，draw = { id, date, num: [百, 十, 个] }
// ⚠️ 摇奖为独立随机事件，所有指标仅为对历史数据的描述性统计。
// ============================================================

export const PRIMES = new Set([1, 2, 3, 5, 7])
export const SMALL = new Set([0, 1, 2])
export const MID = new Set([3, 4, 5, 6])
export const BIG = new Set([7, 8, 9])
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
export const POSITIONS = ['百', '十', '个']

export function takeLatest(draws, n) {
  return draws.slice(0, Math.min(n, draws.length))
}

/** 单注号码的形态分析 */
export function analyzeDraw(num) {
  const [a, b, c] = num
  const sum = a + b + c
  const span = Math.max(a, b, c) - Math.min(a, b, c)
  const sumTail = sum % 10
  const oddCount = [a, b, c].filter((d) => d % 2 === 1).length
  const oddPattern = [a, b, c].map((d) => (d % 2 === 1 ? '奇' : '偶')).join('')
  const smallCount = [a, b, c].filter((d) => SMALL.has(d)).length
  const midCount = [a, b, c].filter((d) => MID.has(d)).length
  const bigCount = [a, b, c].filter((d) => BIG.has(d)).length
  const primeCount = [a, b, c].filter((d) => PRIMES.has(d)).length
  const unique = new Set([a, b, c]).size
  let form = '组六'
  if (unique === 1) form = '豹子'
  else if (unique === 2) form = '组三'
  else {
    const sorted = [...num].sort((x, y) => x - y)
    if (sorted[2] - sorted[0] === 2 && sorted[1] - sorted[0] === 1) form = '顺子'
  }
  return { sum, span, sumTail, oddCount, oddPattern, smallCount, midCount, bigCount, primeCount, form }
}

// ---------- 频次 ----------

/** 每个数字 0-9 在指定位置（0百/1十/2个）的出现次数 */
export function digitFrequencyByPos(draws, pos, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const d of window) freq[d.num[pos]]++
  return freq
}

/** 每个数字 0-9 的总出现次数（不分位置） */
export function digitFrequency(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(DIGITS.map((d) => [d, 0]))
  for (const d of window) for (const digit of d.num) freq[digit]++
  return freq
}

/** 位置频次矩阵：[百频次, 十频次, 个频次] */
export function positionFrequencyMatrix(draws, n = draws.length) {
  return [0, 1, 2].map((pos) => digitFrequencyByPos(draws, pos, n))
}

// ---------- 遗漏 ----------

/** 每个数字在指定位置的当前遗漏期数 */
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

/** 每个数字的总遗漏（任一位出现即算命中） */
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

/** 跨度分布 */
export function spanDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(10).fill(0)
  let sum = 0
  for (const d of window) {
    const s = analyzeDraw(d.num).span
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / window.length).toFixed(1), count: window.length }
}

/** 和值分布 */
export function sumDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = Array(28).fill(0) // 和值 0-27
  let sum = 0
  for (const d of window) {
    const s = analyzeDraw(d.num).sum
    dist[s]++
    sum += s
  }
  return { dist, avg: +(sum / window.length).toFixed(1), count: window.length }
}

/** 奇偶形态分布（8种） */
export function oddEvenDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const p = analyzeDraw(d.num).oddPattern
    dist[p] = (dist[p] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 形态分布（豹子/顺子/组三/组六） */
export function formDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const dist = {}
  for (const d of window) {
    const f = analyzeDraw(d.num).form
    dist[f] = (dist[f] || 0) + 1
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

/** 大中小分布 */
export function sizeDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let small = 0, mid = 0, big = 0
  for (const d of window) {
    const a = analyzeDraw(d.num)
    small += a.smallCount
    mid += a.midCount
    big += a.bigCount
  }
  const total = small + mid + big || 1
  return {
    small, mid, big,
    smallPct: +(small / total * 100).toFixed(1),
    midPct: +(mid / total * 100).toFixed(1),
    bigPct: +(big / total * 100).toFixed(1),
  }
}

/** 质合分布 */
export function primeDistribution(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  let prime = 0, composite = 0
  for (const d of window) {
    prime += analyzeDraw(d.num).primeCount
    composite += 3 - analyzeDraw(d.num).primeCount
  }
  const total = prime + composite || 1
  return {
    prime, composite,
    primePct: +(prime / total * 100).toFixed(1),
    compositePct: +(composite / total * 100).toFixed(1),
  }
}

// ---------- 重号 ----------

/** 相邻两期重号统计 */
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

/** 位置走势矩阵：rows 为最近 M 期（旧→新），每格是该位的数字 */
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
