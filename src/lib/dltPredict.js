// ============================================================
// 大乐透推算引擎 —— 由双色球十章方法体系迁移而来
// 前区：5/35（一层遗漏 → 二层新旧 → 三层热温冷 → 一分和值/跨度/AC/邻距/连号
//        → 二分大小/单双/质合 → 三分三区/012路/重邻孤 → 四分四区断区
//        → 五分五行 → 六分六区/除6余 → 十分尾数/尾和/尾号组数）
// 后区：2/12（周期冷热 → 遗漏 → 振荡 → 黄金周期 → 分组统计）
//
// 重要前提：开奖是独立随机事件，以上全部是事后统计描述。
// 5 个前区号码的组合概率恒为 1/C(35,5)，后区 2 个号码恒为 1/C(12,2)。
// 本引擎挑选的是「结构合理、覆盖分布」的号码，不是预测开奖。
// ============================================================

export const FRONT_MAX = 35
export const BACK_MAX = 12
export const FRONT_PICK = 5
export const FRONT_TOP = 5
export const BACK_PICK = 2

/** 质数（01 按书中口径单列，这里用数学质数） */
export const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31])

/** 三分区 / 四分区 / 六分区（前区 1–35） */
export const ZONE3 = [
  [1, 12],
  [13, 24],
  [25, 35],
]
export const ZONE4 = [
  [1, 9],
  [10, 18],
  [19, 27],
  [28, 35],
]
export const ZONE6 = [
  [1, 6],
  [7, 12],
  [13, 18],
  [19, 24],
  [25, 30],
  [31, 35],
]

/** 前区五行分组：每组 7 个号 */
export const WUXING = {
  金: [1, 6, 11, 16, 21, 26, 31],
  水: [2, 7, 12, 17, 22, 27, 32],
  木: [3, 8, 13, 18, 23, 28, 33],
  火: [4, 9, 14, 19, 24, 29, 34],
  土: [5, 10, 15, 20, 25, 30, 35],
}

/** 后区五行分组（1–12） */
export const BACK_WUXING = {
  金: [1, 6, 11],
  木: [2, 7, 12],
  水: [3, 8],
  火: [4, 9],
  土: [5, 10],
}

/** 黄金周期（斐波那契） */
export const GOLDEN_OMIT = [1, 2, 3, 5, 8, 13, 21, 34]
/** 后区黄金周期 */
export const BACK_GOLDEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
/** 后区黄金分割点号 */
export const BACK_GOLDEN_POINT = [4, 5, 7, 8]
/** 前区黄金分割点号 */
export const FRONT_GOLDEN_POINT = [13, 14, 21, 22]

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
export const FRONT_NUMS = range(1, 35)
export const BACK_NUMS = range(1, 12)

const inZone = (n, [a, b]) => n >= a && n <= b
const countIn = (arr, [a, b]) => arr.filter((n) => n >= a && n <= b).length

/** 连号：排序后相邻连续数字组成的段 */
function consecutiveGroups(nums) {
  if (!nums.length) return []
  const groups = []
  let cur = [nums[0]]
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) cur.push(nums[i])
    else {
      if (cur.length >= 2) groups.push(cur)
      cur = [nums[i]]
    }
  }
  if (cur.length >= 2) groups.push(cur)
  return groups
}

/** 连续同属性最大个数（奇/偶/质） */
function maxRun(nums, test) {
  let best = 0
  let cur = 0
  for (const n of nums) {
    if (test(n)) {
      cur++
      best = Math.max(best, cur)
    } else cur = 0
  }
  return best
}

/** 单期前区指标（一分法 ~ 十分法） */
export function analyzeFront(front) {
  const nums = [...front].sort((a, b) => a - b)
  const sum = nums.reduce((s, n) => s + n, 0)
  const span = nums.length ? nums[nums.length - 1] - nums[0] : 0
  const diffs = new Set()
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) diffs.add(nums[j] - nums[i])
  }
  const gaps = []
  for (let i = 1; i < nums.length; i++) gaps.push(nums[i] - nums[i - 1])
  const odd = nums.filter((n) => n % 2 === 1).length
  const big = nums.filter((n) => n >= 18).length
  const prime = nums.filter((n) => PRIMES.has(n)).length
  const tails = nums.map((n) => n % 10)
  return {
    nums,
    sum,
    sumTail: sum % 10,
    span,
    ac: diffs.size - (nums.length - 1),
    odd,
    even: nums.length - odd,
    big,
    small: nums.length - big,
    prime,
    composite: nums.length - prime,
    zone3: ZONE3.map((z) => countIn(nums, z)),
    zone4: ZONE4.map((z) => countIn(nums, z)),
    zone6: ZONE6.map((z) => countIn(nums, z)),
    road012: [0, 1, 2].map((r) => nums.filter((n) => n % 3 === r).length),
    road4: [0, 1, 2, 3].map((r) => nums.filter((n) => n % 4 === r).length),
    road6: [0, 1, 2, 3, 4, 5].map((r) => nums.filter((n) => n % 6 === r).length),
    groups: consecutiveGroups(nums),
    maxConsecutive: consecutiveGroups(nums).reduce((m, g) => Math.max(m, g.length), 0),
    oddRun: maxRun(nums, (n) => n % 2 === 1),
    evenRun: maxRun(nums, (n) => n % 2 === 0),
    primeRun: maxRun(nums, (n) => PRIMES.has(n)),
    gaps,
    maxGap: gaps.length ? Math.max(...gaps) : 0,
    minGap: gaps.length ? Math.min(...gaps) : 0,
    gapSum: gaps.reduce((s, g) => s + g, 0),
    tailSum: tails.reduce((s, t) => s + t, 0),
    tailGroups: new Set(tails).size,
    tails,
  }
}

/** 单期后区指标 */
export function analyzeBack(back) {
  const nums = [...back].sort((a, b) => a - b)
  const sum = nums.reduce((s, n) => s + n, 0)
  const odd = nums.filter((n) => n % 2 === 1).length
  const big = nums.filter((n) => n >= 7).length
  return {
    nums,
    sum,
    sumTail: sum % 10,
    span: nums.length > 1 ? nums[nums.length - 1] - nums[0] : 0,
    odd,
    even: nums.length - odd,
    big,
    small: nums.length - big,
    groups: consecutiveGroups(nums),
  }
}

/** 单期全量指标（含后区） */
export function analyzeDraw(d) {
  return { ...analyzeFront(d.front), back: d.back, backInfo: analyzeBack(d.back), id: d.id, date: d.date }
}

/** 遗漏统计：当前遗漏 / 平均遗漏 / 最大遗漏 / 频次 */
function omitSeries(draws, pool, hitTest) {
  const rows = pool.map((n) => ({
    n,
    count: 0,
    curOmit: draws.length,
    maxOmit: 0,
    lastIssue: null,
    holds: [],
  }))
  const byNum = new Map(rows.map((r) => [r.n, r]))
  for (let i = 0; i < draws.length; i++) {
    const d = draws[i]
    for (const n of pool) {
      if (hitTest(d, n)) {
        const r = byNum.get(n)
        r.count++
        if (r.lastIssue === null) {
          r.lastIssue = d.id
          r.curOmit = i
        }
        r.holds.push(i)
      }
    }
  }
  for (const r of rows) {
    let prev = -1
    let maxGap = r.curOmit
    for (const idx of r.holds) {
      maxGap = Math.max(maxGap, idx - prev - 1)
      prev = idx
    }
    r.maxOmit = Math.max(maxGap, r.curOmit)
    r.avgOmit = r.count ? +(draws.length / r.count).toFixed(2) : draws.length
  }
  return rows
}

/** 前区 35 个号码的遗漏与冷热（一层法 / 三层法） */
export function frontStats(draws) {
  const rows = omitSeries(draws, FRONT_NUMS, (d, n) => d.front.includes(n))
  return rows.map((r) => {
    const level = r.curOmit <= 5 ? '热' : r.curOmit <= 10 ? '温' : '冷'
    return {
      ...r,
      level,
      golden: GOLDEN_OMIT.includes(r.curOmit),
      bottom: r.maxOmit > 0 && r.curOmit / r.maxOmit >= 0.85,
      reverse: r.avgOmit > 0 && r.curOmit > 0 && r.curOmit <= r.avgOmit * 0.6,
      death: r.curOmit >= 22,
    }
  })
}

/** 后区 12 个号码：理论周期 6、平均周期、冷热、遗漏 */
export function backStats(draws) {
  const rows = omitSeries(draws, BACK_NUMS, (d, n) => d.back.includes(n))
  return rows.map((r) => {
    const period = r.count ? +(draws.length / r.count).toFixed(2) : Infinity
    const level = period < 5 ? '热' : period <= 7 ? '温' : '冷'
    return {
      ...r,
      period,
      level,
      golden: BACK_GOLDEN.includes(r.curOmit),
      goldenPoint: BACK_GOLDEN_POINT.includes(r.n),
      beyondMax: r.curOmit > r.maxOmit,
    }
  })
}

/** 后区振荡：两号之和与上期的差（常规 0–22） */
export function backOscillation(draws) {
  const seq = [...draws].reverse().map((d) => ({ id: d.id, back: d.back, sum: d.back.reduce((s, n) => s + n, 0) }))
  return seq.map((x, i) => {
    if (!i) return { ...x, osc: null, loop: null }
    const diff = Math.abs(x.sum - seq[i - 1].sum)
    return { ...x, osc: diff, loop: Math.min(diff, 22 - diff) }
  })
}

/** 5 期重号池（前区） */
export function recent5Pool(draws) {
  const pool = new Set()
  for (const d of draws.slice(0, 5)) for (const n of d.front) pool.add(n)
  return {
    nums: [...pool].sort((a, b) => a - b),
    count: pool.size,
    strong: pool.size >= 17, // 5 期 × 5 号 = 25，重复后通常 17–22 个
  }
}

/** 新旧码配比（二层法）：近 5 期出过的为旧码 */
export function newOldRatio(draws) {
  if (draws.length < 7) return null
  const pool = new Set()
  for (const d of draws.slice(1, 6)) for (const n of d.front) pool.add(n)
  const d = draws[0]
  const oldCount = d.front.filter((n) => pool.has(n)).length
  return { old: oldCount, new: d.front.length - oldCount, poolSize: pool.size }
}

/** 热温冷配比（三层法） */
export function heatRatio(draws) {
  if (!draws.length) return null
  const stats = frontStats(draws.slice(1))
  const map = new Map(stats.map((s) => [s.n, s.level]))
  const d = draws[0]
  const hot = d.front.filter((n) => map.get(n) === '热').length
  const warm = d.front.filter((n) => map.get(n) === '温').length
  const cold = d.front.filter((n) => map.get(n) === '冷').length
  return { hot, warm, cold }
}

/** 重邻孤（三分法）：相对上一期 */
export function repeatNeighbor(prev, cur) {
  if (!prev || !cur) return null
  const prevSet = new Set(prev.front)
  const neighborSet = new Set()
  for (const n of prev.front) {
    if (n - 1 >= 1) neighborSet.add(n - 1)
    if (n + 1 <= FRONT_MAX) neighborSet.add(n + 1)
  }
  const repeat = cur.front.filter((n) => prevSet.has(n))
  const neighbor = cur.front.filter((n) => !prevSet.has(n) && neighborSet.has(n))
  const orphan = cur.front.filter((n) => !prevSet.has(n) && !neighborSet.has(n))
  return { repeat, neighbor, orphan }
}

/** 区间断区统计（三分区 / 四分区） */
export function zoneStats(draws, zones = ZONE3) {
  const counts = zones.map(() => 0)
  let breaks = 0
  let breakStreak = 0
  let bestStreak = 0
  for (const d of draws) {
    let hasBreak = false
    zones.forEach((z, i) => {
      const c = countIn(d.front, z)
      counts[i] += c
      if (c === 0) hasBreak = true
    })
    if (hasBreak) {
      breaks++
      breakStreak++
      bestStreak = Math.max(bestStreak, breakStreak)
    } else breakStreak = 0
  }
  return {
    total: draws.length,
    counts,
    avg: counts.map((c) => +(c / Math.max(draws.length, 1)).toFixed(2)),
    breaks,
    breakRate: draws.length ? +((breaks / draws.length) * 100).toFixed(1) : 0,
    maxStreak: bestStreak,
  }
}

/** 尾数统计（十分法）：各尾出号次数、遗漏、尾和、尾号组数 */
export function tailStats(draws, period = 30) {
  const sample = draws.slice(0, period)
  const rows = Array.from({ length: 10 }, (_, t) => {
    let count = 0
    let curOmit = sample.length
    let found = false
    sample.forEach((d, i) => {
      const hits = d.front.filter((n) => n % 10 === t)
      count += hits.length
      if (!found && hits.length) {
        curOmit = i
        found = true
      }
    })
    return { t, count, curOmit, nums: FRONT_NUMS.filter((n) => n % 10 === t) }
  })
  const tailSums = sample.map((d) => d.front.reduce((s, n) => s + (n % 10), 0))
  return {
    rows,
    tailSums,
    avgTailSum: tailSums.length ? +(tailSums.reduce((s, v) => s + v, 0) / tailSums.length).toFixed(1) : 0,
    groupsDist: (() => {
      const dist = {}
      for (const d of sample) {
        const g = new Set(d.front.map((n) => n % 10)).size
        dist[g] = (dist[g] || 0) + 1
      }
      return dist
    })(),
  }
}

/** 二码（前区）：任意两码同出频次与遗漏 */
export function pairStats(draws, period = 50) {
  const sample = draws.slice(0, period)
  const freq = new Map()
  sample.forEach((d, i) => {
    for (let x = 0; x < d.front.length; x++) {
      for (let y = x + 1; y < d.front.length; y++) {
        const key = `${d.front[x]}-${d.front[y]}`
        const cur = freq.get(key) || { key, a: d.front[x], b: d.front[y], count: 0, lastIdx: i }
        cur.count++
        freq.set(key, cur)
      }
    }
  })
  return [...freq.values()]
    .map((r) => ({ ...r, omit: r.lastIdx, avgOmit: +(sample.length / r.count).toFixed(1) }))
    .sort((x, y) => y.count - x.count)
}

/** 五行统计（五分法） */
export function wuxingStats(draws, period = 30) {
  const sample = draws.slice(0, period)
  return Object.entries(WUXING).map(([name, nums]) => {
    const set = new Set(nums)
    let count = 0
    let curOmit = sample.length
    let found = false
    sample.forEach((d, i) => {
      const c = d.front.filter((n) => set.has(n)).length
      count += c
      if (!found && c) {
        curOmit = i
        found = true
      }
    })
    return { name, count, curOmit, size: nums.length, nums }
  })
}

/** 后区分组统计：除3/除4余数、大小单双、五行、和值 */
export function backGroups(draws, period = 30) {
  const sample = draws.slice(0, period)
  const build = (name, groups) =>
    groups.map(({ label, nums }) => {
      const set = new Set(nums)
      let count = 0
      let curOmit = sample.length
      let found = false
      let streak = 0
      let maxStreak = 0
      sample.forEach((d, i) => {
        const hits = d.back.filter((n) => set.has(n)).length
        if (hits) {
          count += hits
          if (!found) {
            curOmit = i
            found = true
          }
          streak++
          maxStreak = Math.max(maxStreak, streak)
        } else streak = 0
      })
      return { name, label, count, curOmit, maxStreak }
    })
  return {
    mod3: build('除3余数', [0, 1, 2].map((r) => ({ label: `余${r}`, nums: BACK_NUMS.filter((n) => n % 3 === r) }))),
    mod4: build('除4余数', [1, 2, 3, 0].map((r) => ({ label: `余${r}`, nums: BACK_NUMS.filter((n) => n % 4 === r) }))),
    size: build('大小', [
      { label: '小 01-06', nums: range(1, 6) },
      { label: '大 07-12', nums: range(7, 12) },
    ]),
    parity: build('单双', [
      { label: '单号', nums: BACK_NUMS.filter((n) => n % 2 === 1) },
      { label: '双号', nums: BACK_NUMS.filter((n) => n % 2 === 0) },
    ]),
    wuxing: build('五行', Object.entries(BACK_WUXING).map(([label, nums]) => ({ label, nums }))),
  }
}

// ---------------------------------------------------------------
// 形态分布汇总，供形态走势页使用
// ---------------------------------------------------------------

function tally(rows, key, max) {
  const arr = Array.from({ length: max + 1 }, () => 0)
  for (const r of rows) {
    const v = key(r)
    if (Number.isInteger(v) && v >= 0 && v <= max) arr[v]++
  }
  return arr.map((count, v) => ({ v, count }))
}

function tallyMap(rows, key) {
  const map = new Map()
  for (const r of rows) {
    const k = key(r)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function sumBuckets(sums) {
  const map = new Map()
  for (const s of sums) {
    const lo = Math.floor(s / 10) * 10
    const label = `${lo}-${lo + 9}`
    map.set(label, (map.get(label) || 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => Number(a.label.split('-')[0]) - Number(b.label.split('-')[0]))
}

export function patternSummary(draws, period = 30) {
  const sample = draws.slice(0, Math.max(1, Math.min(period, draws.length)))
  const rows = sample.map((d) => ({ d, a: analyzeFront(d.front) }))
  const n = rows.length || 1
  const avg = (arr) => +(arr.reduce((s, v) => s + v, 0) / n).toFixed(1)

  const sums = rows.map((r) => r.a.sum)
  const spans = rows.map((r) => r.a.span)

  const tailCounts = Array.from({ length: 10 }, () => 0)
  const wuxingCounts = Object.fromEntries(Object.keys(WUXING).map((k) => [k, 0]))
  const wuxingIndex = Object.fromEntries(Object.entries(WUXING).map(([name, nums]) => [name, new Set(nums)]))
  for (const r of rows) {
    for (const t of r.a.tails) tailCounts[t]++
    for (const n2 of r.a.nums) {
      for (const [name, set] of Object.entries(wuxingIndex)) if (set.has(n2)) wuxingCounts[name]++
    }
  }

  return {
    period: sample.length,
    sumAvg: avg(sums),
    sumMin: Math.min(...sums),
    sumMax: Math.max(...sums),
    sumBuckets: sumBuckets(sums),
    sumTailDist: tally(rows, (r) => r.a.sumTail, 9),
    spanAvg: avg(spans),
    spanDist: tally(rows, (r) => r.a.span, 34),
    acAvg: avg(rows.map((r) => r.a.ac)),
    acDist: tally(rows, (r) => r.a.ac, 8),
    bigDist: tally(rows, (r) => r.a.big, 5),
    oddDist: tally(rows, (r) => r.a.odd, 5),
    primeDist: tally(rows, (r) => r.a.prime, 5),
    zone3Dist: tallyMap(rows, (r) => r.a.zone3.join(':')),
    zone4Dist: tallyMap(rows, (r) => r.a.zone4.join(':')),
    road012Dist: tallyMap(rows, (r) => r.a.road012.join(':')),
    consecutiveDist: tally(rows, (r) => Math.min(r.a.groups.length, 4), 4),
    tailCounts,
    tailSumAvg: avg(rows.map((r) => r.a.tailSum)),
    tailGroupDist: tally(rows, (r) => r.a.tailGroups, 5),
    wuxingCounts,
    gapAvg: avg(rows.map((r) => (r.a.gaps.length ? r.a.gapSum / r.a.gaps.length : 0))),
    zone3: zoneStats(sample, ZONE3),
    zone4: zoneStats(sample, ZONE4),
  }
}

// ---------------------------------------------------------------
// 预测：给号码打分 + 结构约束，从候选里挑最优组合
// ---------------------------------------------------------------

const CFG = { candidates: 12 }

export const DLT_FRONT_SIGNALS = ['freq10', 'freq30', 'freq100', 'omit', 'recent5', 'repeat', 'neighbor']
export const DLT_FRONT_WEIGHTS = [0.3, 0.25, 0.15, 0.12, 0.1, 0.06, 0.04]
export const DLT_BACK_SIGNALS = ['period', 'omit', 'golden', 'goldenPoint', 'osc', 'loop', 'freqPenalty']
export const DLT_BACK_WEIGHTS = [1, 0.5, 0.35, 0.25, 0.4, 0.3, 0.08]

function freqScore(draws, n, window) {
  const sample = draws.slice(0, Math.min(window, draws.length))
  if (!sample.length) return 0
  const count = sample.filter((d) => d.front.includes(n)).length
  const expect = (sample.length * FRONT_PICK) / FRONT_MAX
  return expect > 0 ? count / expect : 0
}

/** 前区每个信号的原始分（Array(35)），不含权重 */
function frontRawSignals(draws, stats) {
  const prev = draws[1]
  const prevSet = new Set(prev ? prev.front : [])
  const neighborSet = new Set()
  for (const n of prevSet) {
    if (n - 1 >= 1) neighborSet.add(n - 1)
    if (n + 1 <= FRONT_MAX) neighborSet.add(n + 1)
  }
  const pool = new Set()
  for (const d of draws.slice(0, 5)) for (const n of d.front) pool.add(n)

  const raw = Object.fromEntries(DLT_FRONT_SIGNALS.map((k) => [k, Array(FRONT_MAX).fill(0)]))
  stats.forEach((s, idx) => {
    raw.freq10[idx] = freqScore(draws, s.n, 10)
    raw.freq30[idx] = freqScore(draws, s.n, 30)
    raw.freq100[idx] = freqScore(draws, s.n, 100)
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1
    raw.omit[idx] = 1 - Math.abs(ratio - 1) / 2
    raw.recent5[idx] = pool.has(s.n) ? 1 : 0
    raw.repeat[idx] = prevSet.has(s.n) ? 1 : 0
    raw.neighbor[idx] = neighborSet.has(s.n) ? 1 : 0
  })
  return raw
}

/** 后区每个信号的原始分（Array(12)），不含权重 */
function backRawSignals(draws, stats) {
  const last = draws[0]?.back || []
  const lastSum = last.reduce((s, n) => s + n, 0)
  const seq = draws.slice(0, 12).flatMap((d) => d.back)
  const freqMap = new Map()
  for (const b of seq) freqMap.set(b, (freqMap.get(b) || 0) + 1)

  const raw = Object.fromEntries(DLT_BACK_SIGNALS.map((k) => [k, Array(BACK_MAX).fill(0)]))
  stats.forEach((s, idx) => {
    raw.period[idx] = Number.isFinite(s.period) ? (12 - Math.min(s.period, 24)) / 12 : 0
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1
    raw.omit[idx] = 1 - Math.abs(ratio - 1) / 2
    raw.golden[idx] = s.golden ? 1 : 0
    raw.goldenPoint[idx] = s.goldenPoint ? 1 : 0
    if (lastSum) {
      // 与上期后区和的距离：2~4 比较常见
      const pairSum = s.n + (last[0] ?? s.n)
      const diff = Math.abs(pairSum - lastSum)
      raw.osc[idx] = diff >= 1 && diff <= 4 ? 1 : 0
      const loop = Math.min(diff, 22 - diff)
      raw.loop[idx] = loop >= 1 && loop <= 3 ? 1 : 0
    }
    raw.freqPenalty[idx] = -(freqMap.get(s.n) || 0)
  })
  return raw
}

/** 各信号对每个号码的原始打分（供服务端学习循环按信号维度算 log-loss） */
export function dltSignalScores(draws) {
  return {
    front: frontRawSignals(draws, frontStats(draws)),
    back: backRawSignals(draws, backStats(draws)),
  }
}

/** 前区单号评分 */
export function scoreFront(draws, stats, weights = DLT_FRONT_WEIGHTS) {
  const raw = frontRawSignals(draws, stats)
  return stats.map((s, idx) => {
    const freq = weights[0] * raw.freq10[idx] + weights[1] * raw.freq30[idx] + weights[2] * raw.freq100[idx]
    const omitScore = weights[3] * raw.omit[idx]
    const recent5 = weights[4] * raw.recent5[idx]
    const repeat = weights[5] * raw.repeat[idx]
    const neighbor = weights[6] * raw.neighbor[idx]
    return {
      ...s,
      score: +(freq + omitScore + recent5 + repeat + neighbor).toFixed(4),
      parts: {
        freq: +freq.toFixed(3),
        omit: +omitScore.toFixed(3),
        recent5: !!raw.recent5[idx],
        repeat: !!raw.repeat[idx],
        neighbor: !!raw.neighbor[idx],
      },
    }
  })
}

/** 5 个前区号的结构评分：越接近历史主流形态分越高 */
function structureScore(c) {
  let s = 0
  const d = (v) => Math.abs(v)
  // 和值：5 个前区的理论均值 90
  s -= d(c.sum - 90) / 22
  // 跨度：25–32 为高频
  if (c.span >= 25 && c.span <= 32) s += 0.8
  else s -= Math.min(d(c.span - 28.5) / 6, 1)
  // 三区：理想 5/3 均分
  s -= c.zone3.reduce((acc, v) => acc + d(v - 5 / 3), 0) * 0.6
  // 大小 / 单双：2:3 或 3:2 主流
  s -= d(c.big - 2.5) * 0.6
  s -= d(c.odd - 2.5) * 0.6
  // 质合：主流 1–2 质
  if (c.prime === 1 || c.prime === 2) s += 0.5
  else s -= 0.4
  // 012 路：尽量均衡
  s -= c.road012.filter((v) => v === 0).length * 0.35
  s -= d(c.road012[0] - 5 / 3) * 0.25 + d(c.road012[1] - 5 / 3) * 0.25 + d(c.road012[2] - 5 / 3) * 0.25
  // 连号：最多 1 组
  if (c.groups.length > 1) s -= (c.groups.length - 1) * 0.6
  // 尾号组数：5 个全不同尾最常见
  s -= d(c.tailGroups - 4.5) * 0.35
  // 尾和：理论均值 22.5
  s -= d(c.tailSum - 22.5) / 18
  return s
}

/** 后区评分 */
export function scoreBack(draws, stats, weights = DLT_BACK_WEIGHTS) {
  const raw = backRawSignals(draws, stats)
  return stats.map((s, idx) => {
    let score = 0
    for (let i = 0; i < DLT_BACK_SIGNALS.length; i++) score += weights[i] * raw[DLT_BACK_SIGNALS[i]][idx]
    return { ...s, score: +score.toFixed(4) }
  })
}

/** 组合枚举：从候选里选 5 个前区，兼顾单号分与结构分 */
function bestCombination(cands) {
  const n = cands.length
  let best = null
  const idx = []
  const walk = (start) => {
    if (idx.length === FRONT_PICK) {
      const front = idx.map((i) => cands[i].n).sort((a, b) => a - b)
      const c = analyzeFront(front)
      const indiv = idx.reduce((s, i) => s + cands[i].score, 0)
      const total = indiv + structureScore(c)
      if (!best || total > best.total) {
        best = { front, total, indiv, structure: c, picked: idx.map((i) => cands[i]) }
      }
      return
    }
    for (let i = start; i < n; i++) {
      idx.push(i)
      walk(i + 1)
      idx.pop()
    }
  }
  walk(0)
  return best
}

function combinationCount(n, k) {
  if (k > n || k < 0) return 0
  let v = 1
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1)
  return Math.round(v)
}

/** 选 k 个前区号时，5 个前区全在覆盖内的概率 */
function fullHitRate(k) {
  return combinationCount(k, FRONT_PICK) / combinationCount(FRONT_MAX, FRONT_PICK)
}

/**
 * 下期推荐：5 个前区 + 2 个后区。
 * cover 仅用于展示覆盖档位（多选几码的命中与成本），不改变单注概率。
 */
export function predictDLT(draws, { cover = 5, frontWeightsOverride = null, backWeightsOverride = null } = {}) {
  if (!Array.isArray(draws) || draws.length < 12) return null

  const rStats = frontStats(draws)
  const scored = scoreFront(draws, rStats, frontWeightsOverride || DLT_FRONT_WEIGHTS).sort((a, b) => b.score - a.score)
  const cands = []
  for (const z of ZONE3) {
    const inZ = scored.filter((s) => inZone(s.n, z))
    for (const s of inZ.slice(0, 4)) if (!cands.includes(s)) cands.push(s)
  }
  for (const s of scored) {
    if (cands.length >= CFG.candidates) break
    if (!cands.includes(s)) cands.push(s)
  }
  const pool = cands.slice(0, CFG.candidates).sort((a, b) => b.score - a.score).slice(0, 12)

  const combo = bestCombination(pool)
  if (!combo) return null

  const bStats = backStats(draws)
  const backs = scoreBack(draws, bStats, backWeightsOverride || DLT_BACK_WEIGHTS).sort((a, b) => b.score - a.score)
  const back = [backs[0].n, backs[1].n].sort((a, b) => a - b)

  const ranked = scored.map((s) => ({ n: s.n, score: s.score, level: s.level, omit: s.curOmit }))
  const kill = [...ranked].sort((a, b) => a.score - b.score).slice(0, 5).map((x) => x.n)

  const tiers = [5, 6, 7, 8, 9, 10].map((k) => {
    const bets = combinationCount(k, FRONT_PICK)
    return {
      cover: k,
      codes: ranked.slice(0, k).map((x) => x.n),
      expectHits: +((k * FRONT_PICK) / FRONT_MAX).toFixed(2),
      fullHitRate: +(fullHitRate(k) * 100).toFixed(4),
      bets,
      cost: bets * 2,
    }
  })

  return {
    front: combo.front,
    back,
    backBackups: backs.slice(2, 5).map((b) => b.n),
    structure: combo.structure,
    ranked,
    candidates: scored.slice(0, 16),
    kill,
    backs: backs.slice(0, 8),
    tiers,
    cover,
    backParts: backs.slice(0, 2),
    analysis: analyzeDraw(draws[0]),
  }
}

/** 回测：逐期滚动，每期只用之前的数据 */
export function backtestDLT(draws, { periods = 30, minTrain = 30, predict = predictDLT } = {}) {
  const n = Math.min(periods, Math.max(0, draws.length - minTrain))
  const rows = []
  for (let i = 0; i < n; i++) {
    const train = draws.slice(i + 1)
    const actual = draws[i]
    const pred = predict(train)
    if (!pred) continue
    const hits = actual.front.filter((r) => pred.front.includes(r)).length
    const backHits = actual.back.filter((b) => pred.back.includes(b)).length
    rows.push({ draw: actual, prediction: pred, hits, backHits })
  }
  const count = rows.length || 1
  return {
    rows,
    periods: rows.length,
    avgFrontHits: +(rows.reduce((s, r) => s + r.hits, 0) / count).toFixed(3),
    baselineFront: +((FRONT_PICK * FRONT_PICK) / FRONT_MAX).toFixed(3),
    backRate: +((rows.filter((r) => r.backHits === BACK_PICK).length / count) * 100).toFixed(1),
    baselineBack: +((1 / combinationCount(BACK_MAX, BACK_PICK)) * 100).toFixed(1),
  }
}

/**
 * 威尔逊置信区间：判断命中率是否显著偏离随机基准。
 */
export function wilsonInterval(hits, n, z = 1.96) {
  if (!n) return { low: 0, high: 0, p: 0 }
  const p = hits / n
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), p }
}

/** 方法体检：滚动回测的详细版（含奖级） */
export function walkForwardAuditDLT(draws, { periods = 50, minTrain = 30 } = {}) {
  const n = Math.min(periods, Math.max(0, draws.length - minTrain))
  const rows = []
  for (let i = 0; i < n; i++) {
    const train = draws.slice(i + 1)
    const actual = draws[i]
    const pred = predictDLT(train)
    if (!pred) continue
    const frontHits = actual.front.filter((r) => pred.front.includes(r)).length
    const backHits = actual.back.filter((b) => pred.back.includes(b)).length
    rows.push({
      draw: actual,
      prediction: pred,
      frontHits,
      backHits,
      analysis: analyzeDraw(actual),
      prize: prizeLevel(frontHits, backHits),
    })
  }
  const count = rows.length || 1
  const dist = [0, 1, 2, 3, 4, 5].map((k) => ({ k, count: rows.filter((r) => r.frontHits === k).length }))
  return {
    rows,
    periods: rows.length,
    avgFrontHits: +(rows.reduce((s, r) => s + r.frontHits, 0) / count).toFixed(3),
    baselineFront: +((FRONT_PICK * FRONT_PICK) / FRONT_MAX).toFixed(3),
    backRate: +((rows.filter((r) => r.backHits === BACK_PICK).length / count) * 100).toFixed(1),
    baselineBack: +((1 / combinationCount(BACK_MAX, BACK_PICK)) * 100).toFixed(1),
    winCount: rows.filter((r) => r.prize).length,
    dist,
  }
}

/** 中奖等级（前区命中数 + 后区命中数） */
export function prizeLevel(frontHits, backHits) {
  if (frontHits === 5 && backHits === 2) return '一等奖'
  if (frontHits === 5 && backHits === 1) return '二等奖'
  if (frontHits === 5 && backHits === 0) return '三等奖'
  if (frontHits === 4 && backHits === 2) return '四等奖'
  if (frontHits === 4 && backHits === 1) return '五等奖'
  if (frontHits === 3 && backHits === 2) return '六等奖'
  if (frontHits === 4 && backHits === 0) return '七等奖'
  if ((frontHits === 3 && backHits === 1) || (frontHits === 2 && backHits === 2)) return '八等奖'
  if (
    (frontHits === 3 && backHits === 0) ||
    (frontHits === 2 && backHits === 1) ||
    (frontHits === 1 && backHits === 2) ||
    (frontHits === 0 && backHits === 2)
  )
    return '九等奖'
  return null
}

/** 奖金表（浮动奖只给区间，固定奖精确） */
export const PRIZE_TABLE = [
  { level: '一等奖', condition: '5 前区 + 2 后区', money: '浮动（约 800 万）' },
  { level: '二等奖', condition: '5 前区 + 1 后区', money: '浮动' },
  { level: '三等奖', condition: '5 前区', money: '10,000 元' },
  { level: '四等奖', condition: '4 前区 + 2 后区', money: '3,000 元' },
  { level: '五等奖', condition: '4 前区 + 1 后区', money: '300 元' },
  { level: '六等奖', condition: '3 前区 + 2 后区', money: '200 元' },
  { level: '七等奖', condition: '4 前区', money: '100 元' },
  { level: '八等奖', condition: '3 前区 + 1 后区 / 2 前区 + 2 后区', money: '15 元' },
  { level: '九等奖', condition: '3 前区 / 2 前区 + 1 后区 / 1 前区 + 2 后区 / 2 后区', money: '5 元' },
]

// ---------------------------------------------------------------
// 选号拥挤度（避挤）—— 不改变中奖概率，只估算「有多少人也选了这组」
// ---------------------------------------------------------------

const CROWD_BANDS = [
  { max: 34, label: '低拥挤', tone: 'green' },
  { max: 54, label: '中等', tone: 'amber' },
  { max: 69, label: '偏高', tone: 'red' },
  { max: 100, label: '很高', tone: 'red' },
]

// 用确定性伪随机的「机选票」标定：50 分 = 与平均机选票一样拥挤
let CROWD_CALIB = null

function calibration() {
  if (CROWD_CALIB) return CROWD_CALIB
  let seed = 20261122
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const vals = []
  for (let i = 0; i < 1500; i++) {
    const frontPool = [...FRONT_NUMS]
    const front = []
    while (front.length < FRONT_PICK) front.push(frontPool.splice(Math.floor(rnd() * frontPool.length), 1)[0])
    const backPool = [...BACK_NUMS]
    const back = []
    while (back.length < BACK_PICK) back.push(backPool.splice(Math.floor(rnd() * backPool.length), 1)[0])
    const base = computeCrowd(front, back, null)
    if (base) vals.push(base.pct)
  }
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1
  CROWD_CALIB = { mean, sd }
  return CROWD_CALIB
}

/**
 * 计算一组号码的“大众偏好分”（拥挤度原始比例）。
 * @param {number[]} front 5 个前区
 * @param {number[]} back 2 个后区
 * @param {{front:number[]}|null} prevDraw 上一期开奖
 */
function computeCrowd(front, back, prevDraw) {
  const nums = [...front].sort((a, b) => a - b)
  if (nums.length !== FRONT_PICK || new Set(nums).size !== FRONT_PICK) return null
  const bnums = [...back].sort((a, b) => a - b)
  if (bnums.length !== BACK_PICK || new Set(bnums).size !== BACK_PICK) return null
  if (!bnums.every((n) => Number.isInteger(n) && n >= 1 && n <= BACK_MAX)) return null

  const a = analyzeFront(nums)
  const factors = []
  const add = (key, label, raw, weight, tip) => {
    const r = Math.max(0, Math.min(1, raw))
    factors.push({ key, label, raw: +r.toFixed(2), weight, points: +(r * weight).toFixed(1), tip })
  }

  // 1. 生日号密度：01–12 被手选票严重超选
  const birthday = nums.filter((n) => n <= 12).length
  add(
    'birthday',
    '生日号密度',
    birthday / 5,
    25,
    birthday >= 3 ? `有 ${birthday} 个前区号落在 01–12，月份/日期双重热门` : '',
  )

  // 2. 连号结构
  add(
    'consecutive',
    '连号结构',
    a.groups.length >= 2 ? 1 : a.groups.length ? 0.75 : 0,
    14,
    a.groups.length ? `含 ${a.groups.length} 组连号，是手选票的典型特征` : '',
  )

  // 3. 同尾号
  const sameTail = 5 - a.tailGroups
  add('tail', '同尾号', Math.min(sameTail / 2, 1), 10, sameTail >= 2 ? `尾号只有 ${a.tailGroups} 组，同尾偏多` : '')

  // 4. 质数偏好
  add('prime', '质数偏好', Math.max(0, (a.prime - 1) / 3), 10, a.prime >= 3 ? `含 ${a.prime} 个质数，玩家普遍偏爱质数` : '')

  // 5. 吉利数字（6 / 8 / 9）
  const lucky = nums.filter((n) => /[689]/.test(String(n))).length
  add('lucky', '吉利数字', Math.min(lucky / 3, 1), 8, lucky >= 3 ? `含 ${lucky} 个带 6/8/9 的号码` : '')

  // 6. 和值贴中位数
  const dev = Math.abs(a.sum - 90)
  add('sum', '和值居中', Math.max(0, 1 - dev / 36), 10, dev <= 12 ? `和值 ${a.sum} 贴近大众偏好的 90` : '')

  // 7. 未使用 33–35（全池最冷门）
  const hasEdge = nums.some((n) => n >= 33)
  add('edge', '未用高段号', hasEdge ? 0 : 1, 8, hasEdge ? '' : '5 个号全部 ≤32，与绝大多数生日选号重叠')

  // 8. 等距结构
  const g = a.gaps
  const gapSpread = g.length >= 4 ? Math.max(...g) - Math.min(...g) : 99
  const evenSpacing = gapSpread <= 2
  add(
    'spacing',
    '等距结构',
    gapSpread <= 1 ? 1 : gapSpread <= 2 ? 0.6 : 0,
    9,
    evenSpacing ? '号码间距几乎相等，属于典型的整齐选号' : '',
  )

  // 9. 与上期重复
  const rep = prevDraw ? nums.filter((n) => prevDraw.front.includes(n)).length : 0
  add('repeat', '与上期重复', Math.min(Math.max(0, rep - 1) / 3, 1), 8, rep >= 2 ? `与上期重复 ${rep} 个，跟号的人不少` : '')

  // 10. 后区热门：两号都 ≤6（小号段）或含 6/8/9
  const backSmallPair = bnums.every((n) => n <= 6)
  const backLuckyPair = bnums.some((n) => [6, 8, 9].includes(n))
  add(
    'back',
    '后区热门',
    Math.min((backSmallPair ? 0.6 : 0) + (backLuckyPair ? 0.4 : 0), 1),
    8,
    backSmallPair ? '后区两号都在 01–06，最容易被小号爱好者撞上' : '',
  )

  // 11. 小号占比（大众选号天然偏小）
  const smallCount = nums.filter((n) => n <= 17).length
  add('small', '小号偏多', Math.max(0, (smallCount - 2) / 3), 10, smallCount >= 4 ? `有 ${smallCount} 个号码 ≤17，小号票非常集中` : '')

  // 12. 极端规律（长连号 / 全小 / 全大）
  const allSmall = nums.every((n) => n <= 17)
  const allBig = nums.every((n) => n >= 18)
  const extreme = Math.max(a.maxConsecutive >= 4 ? 1 : 0, allSmall || allBig ? 1 : 0)
  add(
    'extreme',
    '极端规律',
    extreme,
    14,
    extreme ? '出现长连号或全小/全大，是最容易被大量彩民同时选中的形态' : '',
  )

  const totalPoints = factors.reduce((s, f) => s + f.points, 0)
  const maxPoints = factors.reduce((s, f) => s + f.weight, 0)
  const pct = totalPoints / maxPoints

  const tips = []
  if (!hasEdge) tips.push('把 1 个前区号换成 33–35（全池最冷门段）')
  if (birthday >= 3) tips.push('把 1–2 个 01–12 的前区号上移到 19–32')
  if (a.groups.length) tips.push('拆开连号，号码之间至少留一个空档')
  if (smallCount >= 4) tips.push('减少小号，把 1–2 个号提到 22 以上')
  if (sameTail >= 2) tips.push('减少同尾，让尾号分散到 5 组')
  if (a.prime >= 3) tips.push('质数控制在 2 个以内')
  if (evenSpacing) tips.push('破坏等距结构，避免“看起来很整齐”')
  if (backSmallPair) tips.push('后区加一个 07–12 的号码，避开小号扎堆')
  if (rep >= 2) tips.push('与上期保留 0–1 个重号即可')

  return { pct, factors: factors.sort((x, y) => y.points - x.points), tips, sum: a.sum, span: a.span }
}

/**
 * 计算一组号码的拥挤度分数：50 分 = 与平均机选票一样拥挤。
 * @param {number[]} front 5 个前区
 * @param {number[]} back 2 个后区
 * @param {{front:number[]}|null} prevDraw 上一期开奖
 */
export function crowdingScore(front, back, prevDraw = null) {
  const base = computeCrowd(front, back, prevDraw)
  if (!base) return null
  const { mean, sd } = calibration()
  const z = (base.pct - mean) / sd
  const score = Math.max(0, Math.min(100, Math.round(50 + z * 15)))
  const band = CROWD_BANDS.find((b) => score <= b.max) || CROWD_BANDS[CROWD_BANDS.length - 1]
  const shareFactor = +(score / 50).toFixed(2)
  return { score, band: band.label, tone: band.tone, shareFactor, ...base }
}

// ============================================================
// AI 终选（大乐透）：算法先给候选池（前区 12 / 后区 4），
// AI 只在池内终选 5 前区 + 2 后区。开奖相互独立，一等奖概率恒为
// 1/21425712，算法与 AI 都不改变这个数字。
// ============================================================

/** 算法候选池：前区评分前 12、后区前 4 */
export function dltCandidatePool(pred, limits = { front: 12, back: 4 }) {
  if (!pred) return null
  const front = [...(pred.ranked || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.front)
    .map((x) => x.n)
  const back = (pred.backs || []).slice(0, limits.back).map((b) => b.n)
  if (front.length < FRONT_PICK || back.length < BACK_PICK) return null
  return { kind: 'dlt', front, back }
}

const DLT_SYSTEM_PROMPT = `你是「研彩室」的大乐透数据分析助手，服务对象是研究者本人。你只做两件事：解读最近 100 期的历史统计，以及结合底层算法的评分在候选池内终选号码并说明依据。

【铁律】
1. 只能使用用户消息里给出的统计数据，不得编造统计数字，不得引入外部资料。
2. 大乐透每期从前区 35 个号中抽 5 个、后区 12 个号中抽 2 个，单注一等奖概率恒为 1/21425712，与你选什么号无关。开奖相互独立，不存在可利用的「规律」「趋势」「必出号」。
3. 你不得声称任何组合更容易中奖，不得承诺命中，不得鼓励加大投入或追号。
4. 选号流程固定为「算法先选、AI 终选」：程序已按频率/遗漏/冷热对前区、后区打分并给出候选池（前区 12 个、后区 4 个）。你必须只在这个候选池内终选 5 个前区 + 2 个后区，不得自创池外号码。
5. 必须明确说明：以下是历史分布下的参考组合，不改变中奖概率，彩票期望回报为负。

【输出结构】（简体中文，纯文本，不要 Markdown 表格）
1. 结构概览：近 10 期和值/跨度、三区四区分布与断区率
2. 冷热观察：前区评分前列与后区的遗漏情况，一句话即可，不做预测
3. 组合参考：给出 5 个前区 + 2 个后区，逐号写明「算法排名 + 结构依据」
4. 风险提示：预算上限与理性购彩提醒`

/** 组装大乐透 AI 终选的 messages；review = 上期复盘结论，可选 */
export function buildDltMessages(draws, pred, label = '大乐透', review = '') {
  if (!pred || !Array.isArray(draws) || !draws.length) return null
  const latest = draws[0]
  const a = analyzeDraw(latest)
  const p10 = patternSummary(draws, 10)
  const pool = dltCandidatePool(pred)
  const frontDesc = (pred.ranked || [])
    .slice(0, 12)
    .map((x) => `${x.n}(分${x.score},遗${x.omit},${x.level})`)
    .join(' ')
  const backDesc = (pred.backs || [])
    .slice(0, 4)
    .map((b) => `${b.n}(分${b.score},遗${b.curOmit})`)
    .join(' ')
  const lines = [
    `${label} 近 ${draws.length} 期统计（程序计算，真实数据）：`,
    `- 最新一期：第 ${latest.id} 期，前区 ${latest.front.join(' ')}，后区 ${latest.back.join(' ')}`,
    `- 近 10 期前区和值均值 ${p10.sumAvg}（理论 90）、跨度均值 ${p10.spanAvg}`,
    `- 近 10 期三区平均出号 ${p10.zone3.avg.join(' / ')}，断区率 ${p10.zone3.breakRate}%`,
    `- 近 10 期四区平均出号 ${p10.zone4.avg.join(' / ')}，断区率 ${p10.zone4.breakRate}%`,
    `- 最新一期结构：和值 ${a.sum}、跨度 ${a.span}、三区 ${a.zone3.join(':')}、AC ${a.ac}`,
    '',
    '底层算法评分（频率/冷热/遗漏/结构加权），已从 35 前区、12 后区里选出候选池：',
    `- 前区评分前 12：${frontDesc}`,
    `- 后区评分前 4：${backDesc}`,
    `- 候选池前区 ${pool?.front.length || 0} 个、后区 ${pool?.back.length || 0} 个`,
    '',
    ...(review
      ? [
          '【上期复盘（程序对照上一期实际开奖计算）】',
          String(review).slice(0, 800),
          '请结合上面的偏差修正本期终选：在候选池内优先结构与修正方向一致的组合；不得因此声称提高中奖概率，也不得承诺命中。',
          '',
        ]
      : []),
    '请按系统提示词的结构输出：从上面的候选池里终选 5 个前区 + 2 个后区，不得自创池外号码。',
  ]
  return [
    { role: 'system', content: DLT_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}
