// ============================================================
// 双色球推算引擎 —— 依据《吴明揭秘双色球》十章方法体系
// 红球：一层法(遗漏/冷热) → 二层法(新旧码) → 三层法(热温冷)
//      → 一分法(和值/和尾/AC/跨度/邻距/连号) → 二分法(大小/单双/质合)
//      → 三分法(三区/012路/重邻孤) → 四分法(四区/断区) → 五分法(五行)
//      → 六分法(六区/除6余) → 十分法(尾数/尾和/尾号组数)
// 蓝球：周期冷热 → 遗漏 → 振荡(常规/循环) → 黄金周期 → 二分/三分/四分/五分
//
// 重要前提（原书末章也写明）：开奖是独立随机事件，以上全部是事后统计描述。
// 6 个红球的组合概率恒为 1/C(33,6)，任何筛选都不改变单注概率。
// 本引擎的作用是把「结构合理、覆盖分布」的号码挑出来，而不是预测开奖。
// ============================================================

export const RED_MAX = 33
export const BLUE_MAX = 16
export const RED_PICK = 6
export const RED_TOP = 6
export const BLUE_TOP = 1

/** 质数（原书口径把 01 计入质数，这里同时给出数学质数与书中口径） */
export const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31])

/** 三分区 / 四分区 / 六分区 */
export const ZONE3 = [
  [1, 11],
  [12, 22],
  [23, 33],
]
export const ZONE4 = [
  [1, 8],
  [9, 16],
  [17, 24],
  [25, 33],
]
export const ZONE6 = [
  [1, 5],
  [6, 11],
  [12, 16],
  [17, 22],
  [23, 27],
  [28, 33],
]

/** 红球五行分组（原书第 9 章） */
export const WUXING = {
  金: [1, 12, 13, 24, 25],
  水: [3, 4, 15, 16, 27, 28],
  木: [5, 6, 17, 18, 29, 30],
  火: [7, 8, 19, 20, 31, 32],
  土: [9, 10, 21, 22, 33],
}

/** 蓝球五行分组（原书第 16 章） */
export const BLUE_WUXING = {
  金: [9, 10],
  木: [3, 4, 15, 16],
  水: [1, 12, 13],
  火: [6, 7],
  土: [2, 5, 8, 11, 14],
}

/** 黄金周期（斐波那契） */
export const GOLDEN_OMIT = [1, 2, 3, 5, 8, 13, 21, 34]
/** 蓝球黄金周期（多 55、89） */
export const BLUE_GOLDEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
/** 蓝球黄金分割点号 */
export const BLUE_GOLDEN_POINT = [3, 6, 8, 10, 13]
/** 红球黄金分割点号 */
export const RED_GOLDEN_POINT = [6, 13, 16, 17, 20, 27]

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
export const RED_NUMS = range(1, 33)
export const BLUE_NUMS = range(1, 16)

const inZone = (n, [a, b]) => n >= a && n <= b
const countIn = (arr, [a, b]) => arr.filter((n) => n >= a && n <= b).length

/** 连号：排序后相邻连续数字组成的段 */
function consecutiveGroups(nums) {
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

/** 单期红球指标（一分法 ~ 十分法） */
export function analyzeRed(red) {
  const nums = [...red].sort((a, b) => a - b)
  const sum = nums.reduce((s, n) => s + n, 0)
  const span = nums[nums.length - 1] - nums[0]
  const diffs = new Set()
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) diffs.add(nums[j] - nums[i])
  }
  const gaps = []
  for (let i = 1; i < nums.length; i++) gaps.push(nums[i] - nums[i - 1])
  const odd = nums.filter((n) => n % 2 === 1).length
  const big = nums.filter((n) => n >= 17).length
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

/** 单期全量指标（含蓝球） */
export function analyzeDraw(d) {
  return { ...analyzeRed(d.red), blue: d.blue, id: d.id, date: d.date }
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
  // draws 最新在前：从最新往回扫，第一次出现即当前遗漏
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
    // holds 是从新到旧的索引，转换成间隔
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

/** 红球 33 个号码的遗漏与冷热（一层法 / 三层法） */
export function redStats(draws) {
  const rows = omitSeries(draws, RED_NUMS, (d, n) => d.red.includes(n))
  return rows.map((r) => {
    // 三层法：5 期内=热，5~10 期=温，>10 期=冷
    const level = r.curOmit <= 5 ? '热' : r.curOmit <= 10 ? '温' : '冷'
    return {
      ...r,
      level,
      golden: GOLDEN_OMIT.includes(r.curOmit),
      // 底部信号：接近历史最大遗漏
      bottom: r.maxOmit > 0 && r.curOmit / r.maxOmit >= 0.85,
      // 反转信号：当前遗漏小于平均遗漏（由冷转热）
      reverse: r.avgOmit > 0 && r.curOmit > 0 && r.curOmit <= r.avgOmit * 0.6,
      death: r.curOmit >= 20,
    }
  })
}

/** 蓝球 16 个号码：理论周期 16、平均周期、冷热、遗漏、振荡（第 13 章） */
export function blueStats(draws) {
  const rows = omitSeries(draws, BLUE_NUMS, (d, n) => d.blue === n)
  return rows.map((r) => {
    // 平均周期 = 统计期数 ÷ 中出次数
    const period = r.count ? +(draws.length / r.count).toFixed(2) : Infinity
    const level = period < 14 ? '热' : period <= 18 ? '温' : '冷'
    return {
      ...r,
      period,
      level,
      golden: BLUE_GOLDEN.includes(r.curOmit),
      goldenPoint: BLUE_GOLDEN_POINT.includes(r.n),
      // 目前遗漏超过历史最大遗漏：开出后必须跟进（书中实例）
      beyondMax: r.curOmit > r.maxOmit,
    }
  })
}

/** 蓝球振荡序列（常规全幅 0~15 / 循环半幅 0~8） */
export function blueOscillation(draws) {
  const seq = [...draws].reverse().map((d) => d.blue)
  return seq.map((b, i) => {
    if (!i) return { id: draws[draws.length - 1].id, blue: b, osc: null, loop: null }
    const prev = seq[i - 1]
    const diff = Math.abs(b - prev)
    return {
      id: draws[draws.length - 1 - i].id,
      blue: b,
      osc: diff,
      loop: Math.min(diff, BLUE_MAX - diff),
    }
  })
}

/** 5 期重号池（第 2、3 章） */
export function recent5Pool(draws) {
  const pool = new Set()
  for (const d of draws.slice(0, 5)) for (const n of d.red) pool.add(n)
  return {
    nums: [...pool].sort((a, b) => a - b),
    count: pool.size,
    strong: pool.size >= 20, // 总量 ≥20 视为信号偏强
  }
}

/** 新旧码配比（二层法）：近 5 期出过的为旧码 */
export function newOldRatio(draws) {
  if (draws.length < 7) return null
  const pool = new Set()
  for (const d of draws.slice(1, 6)) for (const n of d.red) pool.add(n)
  const d = draws[0]
  const oldCount = d.red.filter((n) => pool.has(n)).length
  return { old: oldCount, new: d.red.length - oldCount, poolSize: pool.size }
}

/** 热温冷配比（三层法） */
export function heatRatio(draws) {
  if (!draws.length) return null
  const stats = redStats(draws.slice(1))
  const map = new Map(stats.map((s) => [s.n, s.level]))
  const d = draws[0]
  const hot = d.red.filter((n) => map.get(n) === '热').length
  const warm = d.red.filter((n) => map.get(n) === '温').length
  const cold = d.red.filter((n) => map.get(n) === '冷').length
  return { hot, warm, cold }
}

/** 重邻孤（第 7 章）：相对上一期 */
export function repeatNeighbor(prev, cur) {
  if (!prev || !cur) return null
  const prevSet = new Set(prev.red)
  const neighborSet = new Set()
  for (const n of prev.red) {
    if (n - 1 >= 1) neighborSet.add(n - 1)
    if (n + 1 <= RED_MAX) neighborSet.add(n + 1)
  }
  const repeat = cur.red.filter((n) => prevSet.has(n))
  const neighbor = cur.red.filter((n) => !prevSet.has(n) && neighborSet.has(n))
  const orphan = cur.red.filter((n) => !prevSet.has(n) && !neighborSet.has(n))
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
      const c = countIn(d.red, z)
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

/** 尾数统计（第 12 章）：各尾出号次数、遗漏、尾和、尾号组数 */
export function tailStats(draws, period = 30) {
  const sample = draws.slice(0, period)
  const rows = Array.from({ length: 10 }, (_, t) => {
    let count = 0
    let curOmit = sample.length
    let found = false
    sample.forEach((d, i) => {
      const hits = d.red.filter((n) => n % 10 === t)
      count += hits.length
      if (!found && hits.length) {
        curOmit = i
        found = true
      }
    })
    return {
      t,
      count,
      curOmit,
      nums: RED_NUMS.filter((n) => n % 10 === t),
    }
  })
  const tailSums = sample.map((d) => d.red.reduce((s, n) => s + (n % 10), 0))
  return {
    rows,
    tailSums,
    avgTailSum: tailSums.length
      ? +(tailSums.reduce((s, v) => s + v, 0) / tailSums.length).toFixed(1)
      : 0,
    groupsDist: (() => {
      const dist = {}
      for (const d of sample) {
        const g = new Set(d.red.map((n) => n % 10)).size
        dist[g] = (dist[g] || 0) + 1
      }
      return dist
    })(),
  }
}

/** 二码（第 7.4 章）：任意两码同出频次与遗漏 */
export function pairStats(draws, period = 50) {
  const sample = draws.slice(0, period)
  const freq = new Map()
  sample.forEach((d, i) => {
    for (let x = 0; x < d.red.length; x++) {
      for (let y = x + 1; y < d.red.length; y++) {
        const key = `${d.red[x]}-${d.red[y]}`
        const cur = freq.get(key) || { key, a: d.red[x], b: d.red[y], count: 0, lastIdx: i }
        cur.count++
        freq.set(key, cur)
      }
    }
  })
  const rows = [...freq.values()].map((r) => ({
    ...r,
    omit: r.lastIdx,
    avgOmit: +(sample.length / r.count).toFixed(1),
  }))
  return rows.sort((x, y) => y.count - x.count)
}

/** 五行统计（第 9 章） */
export function wuxingStats(draws, period = 30) {
  const sample = draws.slice(0, period)
  return Object.entries(WUXING).map(([name, nums]) => {
    const set = new Set(nums)
    let count = 0
    let curOmit = sample.length
    let found = false
    sample.forEach((d, i) => {
      const c = d.red.filter((n) => set.has(n)).length
      count += c
      if (!found && c) {
        curOmit = i
        found = true
      }
    })
    return { name, count, curOmit, size: nums.length, nums }
  })
}

/** 蓝球分组统计：除3/除4/除5余数、四区间、大小单双质合、五行连出 */
export function blueGroups(draws, period = 30) {
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
        const hit = set.has(d.blue)
        if (hit) {
          count++
          if (!found) {
            curOmit = i
            found = true
          }
          streak++
          maxStreak = Math.max(maxStreak, streak)
        } else streak = 0
      })
      return { name, label, count, curOmit, maxStreak, avgOmit: count ? +(sample.length / count).toFixed(2) : null }
    })
  return {
    mod3: build('除3余数', [0, 1, 2].map((r) => ({ label: `余${r}`, nums: BLUE_NUMS.filter((n) => n % 3 === r) }))),
    mod4: build('除4余数', [1, 2, 3, 0].map((r) => ({ label: `余${r}`, nums: BLUE_NUMS.filter((n) => n % 4 === r) }))),
    mod5: build('除5余数', [0, 1, 2, 3, 4].map((r) => ({ label: `余${r}`, nums: BLUE_NUMS.filter((n) => n % 5 === r) }))),
    size: build('大小', [
      { label: '小 01-08', nums: range(1, 8) },
      { label: '大 09-16', nums: range(9, 16) },
    ]),
    parity: build('单双', [
      { label: '单号', nums: BLUE_NUMS.filter((n) => n % 2 === 1) },
      { label: '双号', nums: BLUE_NUMS.filter((n) => n % 2 === 0) },
    ]),
    wuxing: build(
      '五行',
      Object.entries(BLUE_WUXING).map(([label, nums]) => ({ label, nums })),
    ),
  }
}

// ---------------------------------------------------------------
// 形态分布汇总（一分法 ~ 十分法），供形态走势页使用
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

/** 把和值按 10 为一个区间分桶 */
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

/**
 * 一段时间内的全量形态分布。
 * 返回数组型分布统一为 [{ v, count }]，键值型为 [{ label, count }]。
 */
export function patternSummary(draws, period = 30) {
  const sample = draws.slice(0, Math.max(1, Math.min(period, draws.length)))
  const rows = sample.map((d) => ({ d, a: analyzeRed(d.red) }))
  const n = rows.length || 1
  const avg = (arr) => +(arr.reduce((s, v) => s + v, 0) / n).toFixed(1)

  const sums = rows.map((r) => r.a.sum)
  const spans = rows.map((r) => r.a.span)

  const tailCounts = Array.from({ length: 10 }, () => 0)
  const wuxingCounts = Object.fromEntries(Object.keys(WUXING).map((k) => [k, 0]))
  const wuxingIndex = Object.fromEntries(
    Object.entries(WUXING).map(([name, nums]) => [name, new Set(nums)]),
  )
  for (const r of rows) {
    for (const t of r.a.tails) tailCounts[t]++
    for (const n2 of r.a.nums) {
      for (const [name, set] of Object.entries(wuxingIndex)) {
        if (set.has(n2)) wuxingCounts[name]++
      }
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
    spanDist: tally(rows, (r) => r.a.span, 32),
    acAvg: avg(rows.map((r) => r.a.ac)),
    acDist: tally(rows, (r) => r.a.ac, 10),
    bigDist: tally(rows, (r) => r.a.big, 6),
    oddDist: tally(rows, (r) => r.a.odd, 6),
    primeDist: tally(rows, (r) => r.a.prime, 6),
    zone3Dist: tallyMap(rows, (r) => r.a.zone3.join(':')),
    zone4Dist: tallyMap(rows, (r) => r.a.zone4.join(':')),
    road012Dist: tallyMap(rows, (r) => r.a.road012.join(':')),
    consecutiveDist: tally(rows, (r) => Math.min(r.a.groups.length, 4), 4),
    tailCounts,
    tailSumAvg: avg(rows.map((r) => r.a.tailSum)),
    tailGroupDist: tally(rows, (r) => r.a.tailGroups, 6),
    wuxingCounts,
    gapAvg: avg(rows.map((r) => (r.a.gaps.length ? r.a.gapSum / r.a.gaps.length : 0))),
    zone3: zoneStats(sample, ZONE3),
    zone4: zoneStats(sample, ZONE4),
  }
}

// ---------------------------------------------------------------
// 预测：先给号码打分，再按原书十步结构约束，从候选里挑最优组合
// ---------------------------------------------------------------

const CFG = {
  // 候选池大小（组合枚举 C(12,6)=924，浏览器里也能秒算）
  candidates: 12,
}

/** 红球信号（按评分顺序）与默认权重（一层法 + 二层法 + 三分法，原 CFG 现值） */
export const SSQ_RED_SIGNALS = ['freq10', 'freq30', 'freq100', 'omit', 'recent5', 'repeat', 'neighbor']
export const SSQ_RED_WEIGHTS = [0.3, 0.25, 0.15, 0.12, 0.1, 0.06, 0.04]
/** 蓝球信号与默认权重（scoreBlue 原硬编码系数；freqPenalty 的原始分为负值） */
export const SSQ_BLUE_SIGNALS = ['period', 'omit', 'golden', 'goldenPoint', 'osc', 'loop', 'freqPenalty']
export const SSQ_BLUE_WEIGHTS = [1, 0.5, 0.35, 0.25, 0.4, 0.3, 0.08]

function freqScore(draws, n, window) {
  const sample = draws.slice(0, Math.min(window, draws.length))
  if (!sample.length) return 0
  const count = sample.filter((d) => d.red.includes(n)).length
  const expect = (sample.length * RED_PICK) / RED_MAX // 期望出现次数
  return expect > 0 ? count / expect : 0
}

/** 红球每个信号的原始分（Array(33)，下标 = 号码-1），不含权重 */
function redRawSignals(draws, stats) {
  const prev = draws[1]
  const prevSet = new Set(prev ? prev.red : [])
  const neighborSet = new Set()
  for (const n of prevSet) {
    if (n - 1 >= 1) neighborSet.add(n - 1)
    if (n + 1 <= RED_MAX) neighborSet.add(n + 1)
  }
  const pool = new Set()
  for (const d of draws.slice(0, 5)) for (const n of d.red) pool.add(n)

  const raw = Object.fromEntries(SSQ_RED_SIGNALS.map((k) => [k, Array(RED_MAX).fill(0)]))
  stats.forEach((s, idx) => {
    raw.freq10[idx] = freqScore(draws, s.n, 10)
    raw.freq30[idx] = freqScore(draws, s.n, 30)
    raw.freq100[idx] = freqScore(draws, s.n, 100)
    // 遗漏回归：当前遗漏越接近平均遗漏，说明在正常节奏内
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1
    raw.omit[idx] = 1 - Math.abs(ratio - 1) / 2
    raw.recent5[idx] = pool.has(s.n) ? 1 : 0
    raw.repeat[idx] = prevSet.has(s.n) ? 1 : 0
    raw.neighbor[idx] = neighborSet.has(s.n) ? 1 : 0
  })
  return raw
}

/** 蓝球每个信号的原始分（Array(16)，下标 = 号码-1），不含权重 */
function blueRawSignals(draws, stats) {
  const lastBlue = draws[0]?.blue
  const seq = draws.slice(0, 12).map((d) => d.blue)
  const freqMap = new Map()
  for (const b of seq) freqMap.set(b, (freqMap.get(b) || 0) + 1)

  const raw = Object.fromEntries(SSQ_BLUE_SIGNALS.map((k) => [k, Array(BLUE_MAX).fill(0)]))
  stats.forEach((s, idx) => {
    // 平均周期：小于 16 说明活跃
    raw.period[idx] = Number.isFinite(s.period) ? (16 - Math.min(s.period, 32)) / 16 : 0
    // 遗漏接近平均遗漏：正常节奏
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1
    raw.omit[idx] = 1 - Math.abs(ratio - 1) / 2
    raw.golden[idx] = s.golden ? 1 : 0
    raw.goldenPoint[idx] = s.goldenPoint ? 1 : 0
    // 振荡：与上期距离 1~3 最常见（书中振荡值判断）
    if (lastBlue) {
      const diff = Math.abs(s.n - lastBlue)
      raw.osc[idx] = diff >= 1 && diff <= 3 ? 1 : 0
      const loop = Math.min(diff, BLUE_MAX - diff)
      raw.loop[idx] = loop >= 1 && loop <= 2 ? 1 : 0
    }
    // 近 12 期已出过的略降（不追热到极端），原始分为负
    raw.freqPenalty[idx] = -(freqMap.get(s.n) || 0)
  })
  return raw
}

/** 各信号对每个号码的原始打分（供服务端学习循环按信号维度算 log-loss） */
export function ssqSignalScores(draws) {
  return {
    red: redRawSignals(draws, redStats(draws)),
    blue: blueRawSignals(draws, blueStats(draws)),
  }
}

/** 红球单号评分：Σ w_i × 原始分_i（默认权重 = 原 CFG 现值，逐位一致） */
export function scoreRed(draws, stats, weights = SSQ_RED_WEIGHTS) {
  const raw = redRawSignals(draws, stats)
  return stats.map((s, idx) => {
    const freq = weights[0] * raw.freq10[idx] + weights[1] * raw.freq30[idx] + weights[2] * raw.freq100[idx]
    const omitScore = weights[3] * raw.omit[idx]
    const recent5 = weights[4] * raw.recent5[idx]
    const repeat = weights[5] * raw.repeat[idx]
    const neighbor = weights[6] * raw.neighbor[idx]
    return {
      ...s,
      score: +(freq + omitScore + recent5 + repeat + neighbor).toFixed(4),
      parts: { freq: +freq.toFixed(3), omit: +omitScore.toFixed(3), recent5: !!raw.recent5[idx], repeat: !!raw.repeat[idx], neighbor: !!raw.neighbor[idx] },
    }
  })
}

/** 组合结构评分：等级越高越接近历史主流形态 */
function structureScore(c) {
  let s = 0
  const d = (v) => Math.abs(v)
  // 和值：围绕均值 102
  s -= d(c.sum - 102) / 25
  // 跨度：24-29 为书中高频
  if (c.span >= 24 && c.span <= 29) s += 0.8
  else s -= Math.min(d(c.span - 26.5) / 6, 1)
  // 三区：理想 2:2:2
  s -= c.zone3.reduce((acc, v) => acc + d(v - 2), 0) * 0.7
  // 大小 / 单双：3:3 主流
  s -= d(c.big - 3) * 0.55
  s -= d(c.odd - 3) * 0.55
  // 质合：主流 2质4合 / 3质3合
  if (c.prime === 2 || c.prime === 3) s += 0.5
  else s -= 0.4
  // 012 路：理想均衡，各组至少 1 个
  s -= c.road012.filter((v) => v === 0).length * 0.45
  s -= d(c.road012[0] - 2) * 0.2 + d(c.road012[1] - 2) * 0.2 + d(c.road012[2] - 2) * 0.2
  // 连号：最多 1 组
  if (c.groups.length > 1) s -= (c.groups.length - 1) * 0.6
  // 尾号组数：5 组最常见（书中 100 期统计 48%）
  s -= d(c.tailGroups - 5) * 0.35
  // 尾和：围绕中位值 27
  s -= d(c.tailSum - 27) / 20
  return s
}

/** 蓝球评分（第 13-16 章）：Σ w_i × 原始分_i（默认权重 = 原硬编码系数，逐位一致） */
export function scoreBlue(draws, stats, weights = SSQ_BLUE_WEIGHTS) {
  const raw = blueRawSignals(draws, stats)
  return stats.map((s, idx) => {
    let score = 0
    for (let i = 0; i < SSQ_BLUE_SIGNALS.length; i++) score += weights[i] * raw[SSQ_BLUE_SIGNALS[i]][idx]
    return { ...s, score: +score.toFixed(4) }
  })
}

/** 组合枚举：从候选里选 6 个，兼顾单号分与结构分 */
function bestCombination(cands) {
  const n = cands.length
  let best = null
  const idx = []
  const walk = (start) => {
    if (idx.length === RED_PICK) {
      const red = idx.map((i) => cands[i].n).sort((a, b) => a - b)
      const c = analyzeRed(red)
      const indiv = idx.reduce((s, i) => s + cands[i].score, 0)
      const total = indiv + structureScore(c)
      if (!best || total > best.total) best = { red, total, indiv, structure: c, picked: idx.map((i) => cands[i]) }
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

/**
 * 下期推荐：返回 6 个红球 + 1 个蓝球，以及候选、杀号、结构说明。
 * cover 仅用于展示「覆盖档位」（多选几码的命中与成本），不改变单注概率。
 * redWeightsOverride / blueWeightsOverride：服务端学习状态给出的信号权重
 * （长度与 SSQ_RED_SIGNALS / SSQ_BLUE_SIGNALS 一致），不传时行为与现状一致。
 */
export function predictSSQ(draws, { cover = 6, redWeightsOverride = null, blueWeightsOverride = null } = {}) {
  if (!Array.isArray(draws) || draws.length < 12) return null

  const rStats = redStats(draws)
  const scored = scoreRed(draws, rStats, redWeightsOverride || SSQ_RED_WEIGHTS).sort((a, b) => b.score - a.score)
  // 保证三个区间都有人选，避免结构分把候选压到某一区
  const cands = []
  for (const z of ZONE3) {
    const inZ = scored.filter((s) => inZone(s.n, z))
    for (const s of inZ.slice(0, 4)) if (!cands.includes(s)) cands.push(s)
  }
  for (const s of scored) {
    if (cands.length >= CFG.candidates) break
    if (!cands.includes(s)) cands.push(s)
  }
  const pool = cands.slice(0, CFG.candidates)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const combo = bestCombination(pool)
  if (!combo) return null

  const bStats = blueStats(draws)
  const blues = scoreBlue(draws, bStats, blueWeightsOverride || SSQ_BLUE_WEIGHTS).sort((a, b) => b.score - a.score)

  const ranked = scored.map((s) => ({ n: s.n, score: s.score, level: s.level, omit: s.curOmit }))
  const kill = [...ranked].sort((a, b) => a.score - b.score).slice(0, 5).map((x) => x.n)

  // 覆盖档位：选 k 个红球时的期望命中与成本（6×6/33 = 1.09）
  const tiers = [6, 7, 8, 9, 10].map((k) => {
    const bets = combinationCount(k, 6)
    return {
      cover: k,
      codes: ranked.slice(0, k).map((x) => x.n),
      expectHits: +((k * RED_PICK) / RED_MAX).toFixed(2),
      fullHitRate: +(fullHitRate(k) * 100).toFixed(2),
      bets,
      cost: bets * 2,
    }
  })

  return {
    red: combo.red,
    blue: blues[0].n,
    blueBackups: blues.slice(1, 4).map((b) => b.n),
    structure: combo.structure,
    ranked,
    candidates: scored.slice(0, 16),
    kill,
    blues: blues.slice(0, 8),
    tiers,
    cover,
    blueParts: blues[0],
    analysis: analyzeDraw(draws[0]),
  }
}

function combinationCount(n, k) {
  if (k > n) return 0
  let v = 1
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1)
  return Math.round(v)
}

/** 选 k 个红球时，6 个红球全在覆盖内的概率 */
function fullHitRate(k) {
  return combinationCount(k, 6) / combinationCount(RED_MAX, 6)
}

/** 回测：逐期滚动，每期只用之前的数据 */
export function backtestSSQ(draws, { periods = 30, minTrain = 30, predict = predictSSQ } = {}) {
  const n = Math.min(periods, Math.max(0, draws.length - minTrain))
  const rows = []
  for (let i = 0; i < n; i++) {
    const train = draws.slice(i + 1)
    const actual = draws[i]
    const pred = predict(train)
    if (!pred) continue
    const hits = actual.red.filter((r) => pred.red.includes(r)).length
    rows.push({
      draw: actual,
      prediction: pred,
      hits,
      blueHit: pred.blue === actual.blue,
    })
  }
  const count = rows.length || 1
  return {
    rows,
    periods: rows.length,
    avgRedHits: +(rows.reduce((s, r) => s + r.hits, 0) / count).toFixed(3),
    baselineRed: +((RED_PICK * RED_PICK) / RED_MAX).toFixed(3),
    blueRate: +((rows.filter((r) => r.blueHit).length / count) * 100).toFixed(1),
    baselineBlue: +((1 / BLUE_MAX) * 100).toFixed(1),
  }
}

/**
 * 威尔逊置信区间：小样本下比正态近似更可靠。
 * 用途：判断命中率是否显著偏离随机基准——区间包含基准值即说明差异在噪声范围内。
 */
export function wilsonInterval(hits, n, z = 1.96) {
  if (!n) return { low: 0, high: 0, p: 0 }
  const p = hits / n
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), p }
}

/** 方法体检：滚动回测的详细版（含中奖等级） */
export function walkForwardAuditSSQ(draws, { periods = 50, minTrain = 30 } = {}) {
  const n = Math.min(periods, Math.max(0, draws.length - minTrain))
  const rows = []
  for (let i = 0; i < n; i++) {
    const train = draws.slice(i + 1)
    const actual = draws[i]
    const pred = predictSSQ(train)
    if (!pred) continue
    const redHits = actual.red.filter((r) => pred.red.includes(r)).length
    const blueHit = pred.blue === actual.blue
    rows.push({
      draw: actual,
      prediction: pred,
      redHits,
      blueHit,
      analysis: analyzeDraw(actual),
      prize: prizeLevel(redHits, blueHit),
    })
  }
  const count = rows.length || 1
  const dist = [0, 1, 2, 3, 4, 5, 6].map((k) => ({
    k,
    count: rows.filter((r) => r.redHits === k).length,
  }))
  return {
    rows,
    periods: rows.length,
    avgRedHits: +(rows.reduce((s, r) => s + r.redHits, 0) / count).toFixed(3),
    baselineRed: +((RED_PICK * RED_PICK) / RED_MAX).toFixed(3),
    blueRate: +((rows.filter((r) => r.blueHit).length / count) * 100).toFixed(1),
    baselineBlue: +((1 / BLUE_MAX) * 100).toFixed(1),
    winCount: rows.filter((r) => r.prize).length,
    dist,
  }
}

/** 中奖等级（红球命中数 + 蓝球） */
export function prizeLevel(redHits, blueHit) {
  if (redHits === 6 && blueHit) return '一等奖'
  if (redHits === 6) return '二等奖'
  if (redHits === 5 && blueHit) return '三等奖'
  if (redHits === 5 || (redHits === 4 && blueHit)) return '四等奖'
  if (redHits === 4 || (redHits === 3 && blueHit)) return '五等奖'
  if (blueHit) return '六等奖'
  return null
}

/** 奖金表（浮动奖只给区间，固定奖精确） */
export const PRIZE_TABLE = [
  { level: '一等奖', condition: '6 红 + 1 蓝', money: '浮动（500万起）' },
  { level: '二等奖', condition: '6 红', money: '浮动' },
  { level: '三等奖', condition: '5 红 + 1 蓝', money: '3000 元' },
  { level: '四等奖', condition: '5 红 / 4 红 + 1 蓝', money: '200 元' },
  { level: '五等奖', condition: '4 红 / 3 红 + 1 蓝', money: '10 元' },
  { level: '六等奖', condition: '1 蓝（红球不限）', money: '5 元' },
]

// ---------------------------------------------------------------
// 选号拥挤度（避挤）—— 唯一有文献支撑的优化方向
// 说明：不改变中奖概率，只估算“这组号码有多少人可能也选了”，
// 从而判断中奖后需要与多少人分摊奖金。
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
  let seed = 20261111
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const vals = []
  for (let i = 0; i < 1500; i++) {
    const pool = [...RED_NUMS]
    const red = []
    while (red.length < 6) red.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
    const base = computeCrowd(red, 1 + Math.floor(rnd() * BLUE_MAX), null)
    if (base) vals.push(base.pct)
  }
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1
  CROWD_CALIB = { mean, sd }
  return CROWD_CALIB
}

/**
 * 计算一组号码的“大众偏好分”（拥挤度）。
 * @param {number[]} red 6 个红球
 * @param {number} blue 蓝球
 * @param {{red:number[]}|null} prevDraw 上一期开奖（用于重号判断）
 */
function computeCrowd(red, blue, prevDraw) {
  const nums = [...red].sort((a, b) => a - b)
  if (nums.length !== 6 || new Set(nums).size !== 6) return null
  if (!Number.isInteger(blue) || blue < 1 || blue > BLUE_MAX) return null

  const a = analyzeRed(nums)
  const factors = []
  const add = (key, label, raw, weight, tip) => {
    const r = Math.max(0, Math.min(1, raw))
    factors.push({ key, label, raw: +r.toFixed(2), weight, points: +(r * weight).toFixed(1), tip })
  }

  // 1. 生日号密度：01–12 既是月份又是日期，被选概率最高
  const birthday = nums.filter((n) => n <= 12).length
  add(
    'birthday',
    '生日号密度',
    birthday / 6,
    25,
    birthday >= 3 ? `有 ${birthday} 个号码落在 01–12，月份/日期双重热门` : '',
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
  const sameTail = 6 - a.tailGroups
  add(
    'tail',
    '同尾号',
    Math.min(sameTail / 2, 1),
    10,
    sameTail >= 2 ? `尾号只有 ${a.tailGroups} 组，同尾偏多` : '',
  )

  // 4. 质数偏好（文献证实玩家系统性偏爱质数）
  add(
    'prime',
    '质数偏好',
    Math.max(0, (a.prime - 2) / 3),
    10,
    a.prime >= 3 ? `含 ${a.prime} 个质数，玩家普遍偏爱质数` : '',
  )

  // 5. 吉利数字（6 / 8 / 9）
  const lucky = nums.filter((n) => /[689]/.test(String(n))).length
  add('lucky', '吉利数字', Math.min(lucky / 4, 1), 8, lucky >= 3 ? `含 ${lucky} 个带 6/8/9 的号码` : '')

  // 6. 和值贴中位数（大众审美偏向“看起来均衡”）
  const dev = Math.abs(a.sum - 102)
  add('sum', '和值居中', Math.max(0, 1 - dev / 40), 10, dev <= 15 ? `和值 ${a.sum} 贴近大众偏好的 102` : '')

  // 7. 未使用 32 / 33（全池最冷门的两号）
  const hasEdge = nums.some((n) => n >= 32)
  add('edge', '未用高段号', hasEdge ? 0 : 1, 8, hasEdge ? '' : '6 个号全部 ≤31，与绝大多数生日选号重叠')

  // 8. 等距结构（肉眼像“手画的整齐图形”）
  const g = a.gaps
  const gapSpread = g.length >= 5 ? Math.max(...g) - Math.min(...g) : 99
  const evenSpacing = gapSpread <= 2
  add(
    'spacing',
    '等距结构',
    gapSpread <= 1 ? 1 : gapSpread <= 2 ? 0.6 : 0,
    9,
    evenSpacing ? '号码间距几乎相等，属于典型的整齐选号' : '',
  )

  // 9. 与上期重复
  const rep = prevDraw ? nums.filter((n) => prevDraw.red.includes(n)).length : 0
  add(
    'repeat',
    '与上期重复',
    Math.min(Math.max(0, rep - 2) / 4, 1),
    8,
    rep >= 3 ? `与上期重复 ${rep} 个，跟号的人不少` : '',
  )

  // 10. 蓝球热门度：01–12 是月份号，6/8/9/16 是吉利号
  const blueRaw = blue <= 12 ? 0.7 : 0
  const blueLucky = [6, 8, 9, 16].includes(blue) ? 0.3 : 0
  add(
    'blue',
    '蓝球热门',
    Math.min(blueRaw + blueLucky, 1),
    8,
    blue <= 12 ? `蓝球 ${String(blue).padStart(2, '0')} 落在 01–12，最容易被月份号撞上` : '',
  )

  // 11. 小号占比（大众选号天然偏小）
  const smallCount = nums.filter((n) => n <= 16).length
  add(
    'small',
    '小号偏多',
    Math.max(0, (smallCount - 3) / 3),
    10,
    smallCount >= 4 ? `有 ${smallCount} 个号码 ≤16，小号票非常集中` : '',
  )

  // 12. 极端规律（长连号 / 全小 / 全大）
  const allSmall = nums.every((n) => n <= 16)
  const allBig = nums.every((n) => n >= 17)
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
  if (!hasEdge) tips.push('把 1 个 01–16 的号码换成 32 或 33（全池最冷门）')
  if (birthday >= 3) tips.push(`把 1–2 个 01–12 的号码上移到 17–31`)
  if (a.groups.length) tips.push('拆开连号，号码之间至少留一个空档')
  if (smallCount >= 4) tips.push('减少小号，把 1–2 个号提到 20 以上')
  if (sameTail >= 2) tips.push('减少同尾，让尾号分散到 5 组左右')
  if (a.prime >= 3) tips.push('质数控制在 2 个以内')
  if (evenSpacing) tips.push('破坏等距结构，避免“看起来很整齐”')
  if (blue <= 12) tips.push('蓝球改选 13–16，避开月份号')
  if (rep >= 3) tips.push('与上期保留 0–2 个重号即可')

  return {
    pct,
    factors: factors.sort((x, y) => y.points - x.points),
    tips,
    sum: a.sum,
    span: a.span,
  }
}

/**
 * 计算一组号码的“大众偏好分”（拥挤度）。
 * 50 分 = 与平均机选票一样拥挤，分数越高越大众化。
 * @param {number[]} red 6 个红球
 * @param {number} blue 蓝球
 * @param {{red:number[]}|null} prevDraw 上一期开奖（用于重号判断）
 */
export function crowdingScore(red, blue, prevDraw = null) {
  const base = computeCrowd(red, blue, prevDraw)
  if (!base) return null
  const { mean, sd } = calibration()
  const z = (base.pct - mean) / sd
  const score = Math.max(0, Math.min(100, Math.round(50 + z * 15)))
  const band = CROWD_BANDS.find((b) => score <= b.max) || CROWD_BANDS[CROWD_BANDS.length - 1]
  // 粗略分摊倍数：50 分 = 1.00×（平均机选票）
  const shareFactor = +(score / 50).toFixed(2)
  return { score, band: band.label, tone: band.tone, shareFactor, ...base }
}

// ============================================================
// AI 终选（双色球）：算法先给出候选池（红球 12 / 蓝球 4），
// AI 只在池内终选 6 红 + 1 蓝。开奖相互独立，一等奖概率恒为
// 1/17721088，算法与 AI 都不改变这个数字。
// ============================================================

/** 算法候选池：红球评分前 12（按分数降序，服务端补号时优先取前面的）、蓝球前 4 */
export function ssqCandidatePool(pred, limits = { red: 12, blue: 4 }) {
  if (!pred) return null
  const red = [...(pred.ranked || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.red)
    .map((x) => x.n)
  const blue = (pred.blues || []).slice(0, limits.blue).map((b) => b.n)
  if (red.length < RED_PICK || !blue.length) return null
  return { kind: 'ssq', red, blue }
}

const SSQ_SYSTEM_PROMPT = `你是「研彩室」的双色球数据分析助手，服务对象是研究者本人。你只做两件事：解读最近 100 期的历史统计，以及结合底层算法的评分在候选池内终选号码并说明依据。

【铁律】
1. 只能使用用户消息里给出的统计数据，不得编造统计数字，不得引入外部资料。
2. 双色球每期从 33 个红球中抽 6 个、16 个蓝球中抽 1 个，单注一等奖概率恒为 1/17721088，与你选什么号无关。开奖相互独立，不存在可利用的「规律」「趋势」「必出号」。
3. 你不得声称任何组合更容易中奖，不得承诺命中，不得鼓励加大投入或追号。
4. 选号流程固定为「算法先选、AI 终选」：程序已按频率/遗漏/冷热对红球、蓝球打分并给出候选池（红球 12 个、蓝球 4 个）。你必须只在这个候选池内终选 6 个红球 + 1 个蓝球，不得自创池外号码。
5. 必须明确说明：以下是历史分布下的参考组合，不改变中奖概率，彩票期望回报为负。

【输出结构】（简体中文，纯文本，不要 Markdown 表格）
1. 结构概览：近 10 期和值/跨度、三区四区分布与断区率
2. 冷热观察：红球评分前列与蓝球的遗漏情况，一句话即可，不做预测
3. 组合参考：给出 6 个红球 + 1 个蓝球，逐号写明「算法排名 + 结构依据」
4. 风险提示：预算上限与理性购彩提醒`

/** 组装双色球 AI 终选的 messages（纯函数，便于离线校验）；review = 上期复盘结论，可选 */
export function buildSsqMessages(draws, pred, label = '双色球', review = '') {
  if (!pred || !Array.isArray(draws) || !draws.length) return null
  const latest = draws[0]
  const a = analyzeDraw(latest)
  const p10 = patternSummary(draws, 10)
  const pool = ssqCandidatePool(pred)
  const redDesc = (pred.ranked || [])
    .slice(0, 12)
    .map((x) => `${x.n}(分${x.score},遗${x.omit},${x.level})`)
    .join(' ')
  const blueDesc = (pred.blues || [])
    .slice(0, 4)
    .map((b) => `${b.n}(分${b.score},遗${b.curOmit})`)
    .join(' ')
  const lines = [
    `${label} 近 ${draws.length} 期统计（程序计算，真实数据）：`,
    `- 最新一期：第 ${latest.id} 期，红球 ${latest.red.join(' ')}，蓝球 ${latest.blue}`,
    `- 近 10 期红球和值均值 ${p10.sumAvg}（理论 102）、跨度均值 ${p10.spanAvg}`,
    `- 近 10 期三区平均出号 ${p10.zone3.avg.join(' / ')}，断区率 ${p10.zone3.breakRate}%`,
    `- 近 10 期四区平均出号 ${p10.zone4.avg.join(' / ')}，断区率 ${p10.zone4.breakRate}%`,
    `- 最新一期结构：和值 ${a.sum}、跨度 ${a.span}、三区 ${a.zone3.join(':')}、AC ${a.ac}`,
    '',
    '底层算法评分（频率/冷热/遗漏/结构加权），已从 33 红、16 蓝里选出候选池：',
    `- 红球评分前 12：${redDesc}`,
    `- 蓝球评分前 4：${blueDesc}`,
    `- 候选池红球 ${pool?.red.length || 0} 个、蓝球 ${pool?.blue.length || 0} 个`,
    '',
    ...(review
      ? [
          '【上期复盘（程序对照上一期实际开奖计算）】',
          String(review).slice(0, 800),
          '请结合上面的偏差修正本期终选：在候选池内优先结构与修正方向一致的组合；不得因此声称提高中奖概率，也不得承诺命中。',
          '',
        ]
      : []),
    '请按系统提示词的结构输出：从上面的候选池里终选 6 个红球 + 1 个蓝球，不得自创池外号码。',
  ]
  return [
    { role: 'system', content: SSQ_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}
