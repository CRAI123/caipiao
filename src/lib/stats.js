// ============================================================
// 统计引擎 —— 福彩快乐8（80 选 20，每期开出 20 个号码）
// ⚠️ 摇奖为独立随机事件，以下所有指标仅为对历史数据的描述性统计，
//    不构成任何预测，也不能改变任何一期的中奖概率。
// draws 约定：数组按【最新在前】排序，draw = { id, date, nums: number[20] }
// ============================================================

export const BALL_MAX = 80
export const PER_DRAW = 20 // 每期开出 20 个号码
export const SMALL_MAX = 40 // 大小划分：1-40 小，41-80 大
export const PRICE = 2 // 每注 2 元

export const range = (n) => Array.from({ length: n }, (_, i) => i + 1)

export function takeLatest(draws, n) {
  return draws.slice(0, Math.min(n, draws.length))
}

// ---------- 频次 / 遗漏 ----------

/** 每个号码在最近 N 期中的出现次数 */
export function ballFrequency(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const freq = Object.fromEntries(range(BALL_MAX).map((i) => [i, 0]))
  for (const d of window) {
    for (const b of d.nums) if (freq[b] !== undefined) freq[b]++
  }
  return freq
}

/**
 * 每个号码的遗漏信息（基于最新在前数组）
 * current 当前连续遗漏期数；max 窗口内最大遗漏；avg 平均间隔；count 出现次数
 */
export function ballMissing(draws, n = draws.length) {
  const window = takeLatest(draws, n)
  const out = {}
  for (const ball of range(BALL_MAX)) {
    let current = null
    const gaps = []
    let gap = 0
    for (const d of window) {
      const hit = d.nums.includes(ball)
      if (hit) {
        if (current === null) current = gap
        gaps.push(gap)
        gap = 0
      } else {
        gap++
      }
    }
    if (current === null) current = gap // 窗口内从未出现
    const appeared = gaps.length
    out[ball] = {
      current,
      max: appeared ? Math.max(...gaps) : window.length,
      avg: appeared ? +(gaps.reduce((s, v) => s + v, 0) / appeared).toFixed(1) : null,
      count: appeared,
    }
  }
  return out
}

/** 冷热分类：按出现次数排名三分位 */
export function hotColdClass(freq) {
  const sorted = range(BALL_MAX).map((i) => [i, freq[i]]).sort((a, b) => b[1] - a[1])
  const third = Math.ceil(BALL_MAX / 3)
  const cls = {}
  sorted.forEach(([ball], rank) => {
    cls[ball] = rank < third ? 'hot' : rank < third * 2 ? 'warm' : 'cold'
  })
  return cls
}

/** 走势矩阵：rows 为最近 M 期（旧→新），每格 true/false */
export function trendMatrix(draws, periods) {
  const window = takeLatest(draws, periods).slice().reverse()
  return {
    draws: window,
    cells: window.map((d) => {
      const hit = new Set(d.nums)
      return range(BALL_MAX).map((i) => hit.has(i))
    }),
  }
}

// ---------- 形态统计 ----------

export const isOdd = (n) => n % 2 === 1
export const isBig = (n) => n > SMALL_MAX
export const road = (n) => n % 3 // 012 路

/** 单期形态（20 个开奖号） */
export function drawShapes(d) {
  const nums = d.nums
  const odd = nums.filter(isOdd).length
  const big = nums.filter(isBig).length
  const r012 = [0, 0, 0]
  nums.forEach((n) => r012[road(n)]++)
  // 连号：排序后相邻差 1 的连续段
  const runs = []
  let run = [nums[0]]
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) run.push(nums[i])
    else {
      if (run.length >= 2) runs.push(run)
      run = [nums[i]]
    }
  }
  if (run.length >= 2) runs.push(run)
  const sum = nums.reduce((s, n) => s + n, 0)
  const span = nums[nums.length - 1] - nums[0]
  return {
    odd,
    even: PER_DRAW - odd,
    big,
    small: PER_DRAW - big,
    r012,
    runs,
    hasConsecutive: runs.length > 0,
    maxRun: runs.reduce((m, r) => Math.max(m, r.length), 0),
    sum,
    span,
  }
}

/** 最近 N 期形态分布聚合 */
export function shapeStats(draws, n = 100) {
  const window = takeLatest(draws, n)
  const oddDist = {}
  const bigDist = {}
  const roadDist = [0, 0, 0]
  const sumList = []
  const spanDist = {}
  const runCountDist = {} // 每期连号组数
  let consecutiveCount = 0
  for (const d of window) {
    const s = drawShapes(d)
    const ok = `${s.odd}:${s.even}`
    oddDist[ok] = (oddDist[ok] || 0) + 1
    const bk = `${s.big}:${s.small}`
    bigDist[bk] = (bigDist[bk] || 0) + 1
    s.r012.forEach((c, i) => (roadDist[i] += c))
    sumList.push(s.sum)
    spanDist[s.span] = (spanDist[s.span] || 0) + 1
    runCountDist[s.runs.length] = (runCountDist[s.runs.length] || 0) + 1
    if (s.hasConsecutive) consecutiveCount++
  }
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)
  const shapeCache = window.map((d) => drawShapes(d))
  return {
    sample: window.length,
    oddDist: sortDist(oddDist),
    bigDist: sortDist(bigDist),
    roadDist,
    sums: sumList,
    avgSum: +avg(sumList).toFixed(1),
    spanDist: Object.entries(spanDist)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => a[0] - b[0]),
    avgSpan: +avg(shapeCache.map((s) => s.span)).toFixed(1),
    consecutiveRate: window.length
      ? +((consecutiveCount / window.length) * 100).toFixed(1)
      : 0,
    consecutiveCount,
    runCountDist: Object.entries(runCountDist)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => a[0] - b[0]),
  }
}

function sortDist(dist) {
  return Object.entries(dist).sort((a, b) => b[1] - a[1])
}

// ---------- 重号 / 斜连 / 隔期 ----------

/**
 * 逐期统计（与前三期对比）：
 * repeat 重号：与上期相同的号码
 * adjacent 斜连（邻号）：上期号码 ±1
 * skip1 / skip2 隔期号：与 2 期前 / 3 期前相同
 */
export function repeatStats(draws, n = 30) {
  const window = takeLatest(draws, Math.min(n + 3, draws.length))
  const rows = []
  let repeatDraws = 0
  let repeatTotal = 0
  let adjacentTotal = 0
  let skip1Total = 0
  let skip2Total = 0
  for (let i = window.length - 4; i >= 0; i--) {
    const cur = window[i]
    const prev1 = window[i + 1]
    const prev2 = window[i + 2]
    const prev3 = window[i + 3]
    const repeat = cur.nums.filter((x) => prev1.nums.includes(x))
    const adjacent = cur.nums.filter(
      (x) => !repeat.includes(x) && prev1.nums.some((p) => Math.abs(p - x) === 1),
    )
    const skip1 = cur.nums.filter((x) => !prev1.nums.includes(x) && prev2.nums.includes(x))
    const skip2 = cur.nums.filter(
      (x) => !prev1.nums.includes(x) && !prev2.nums.includes(x) && prev3.nums.includes(x),
    )
    repeatTotal += repeat.length
    adjacentTotal += adjacent.length
    skip1Total += skip1.length
    skip2Total += skip2.length
    if (repeat.length) repeatDraws++
    rows.push({ draw: cur, repeat, adjacent, skip1, skip2 })
  }
  rows.reverse() // 最新在前
  const periods = rows.length
  return {
    rows,
    periods,
    repeatRate: periods ? +((repeatDraws / periods) * 100).toFixed(1) : 0,
    avgRepeat: periods ? +(repeatTotal / periods).toFixed(2) : 0,
    avgAdjacent: periods ? +(adjacentTotal / periods).toFixed(2) : 0,
    avgSkip1: periods ? +(skip1Total / periods).toFixed(2) : 0,
    avgSkip2: periods ? +(skip2Total / periods).toFixed(2) : 0,
  }
}

// ---------- 组合数学 ----------

export function comb(n, k) {
  if (k < 0 || k > n || n < 0) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** 枚举从 arr 中选 k 个的所有组合（arr 升序） */
export function combinations(arr, k) {
  const res = []
  const cur = []
  const walk = (start) => {
    if (cur.length === k) {
      res.push([...cur])
      return
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i])
      walk(i + 1)
      cur.pop()
    }
  }
  walk(0)
  return res
}

// ---------- 玩法 / 奖级（以官方规则为准） ----------

export const PLAY_LABEL = [
  '',
  '选一',
  '选二',
  '选三',
  '选四',
  '选五',
  '选六',
  '选七',
  '选八',
  '选九',
  '选十',
]

/**
 * 各玩法中奖金额（单注 2 元）。key = 命中个数，value = 单注奖金。
 * 选七~选十 设有「中 0 个」的 2 元保底奖，是快乐8特有规则。
 */
export const PRIZES = [
  null,
  { 1: 4.5 },
  { 2: 19 },
  { 3: 52, 2: 3 },
  { 4: 93, 3: 5, 2: 3 },
  { 5: 1000, 4: 20, 3: 3 },
  { 6: 2880, 5: 30, 4: 10, 3: 3 },
  { 7: 8500, 6: 300, 5: 30, 4: 4, 0: 2 },
  { 8: 50000, 7: 800, 6: 80, 5: 10, 4: 3, 0: 2 },
  { 9: 250000, 8: 2000, 7: 225, 6: 22, 5: 5, 4: 3, 0: 2 },
  { 10: 5000000, 9: 8000, 8: 720, 7: 80, 6: 5, 5: 3, 0: 2 },
]

/** 单注奖金，未中奖返回 0 */
export function prizeFor(play, hits) {
  return (PRIZES[play] && PRIZES[play][hits]) || 0
}

/** 单式命中 k 个的近似概率（组合数之比，仅作说明用） */
export function hitProb(play, hits) {
  return comb(PER_DRAW, hits) * comb(BALL_MAX - PER_DRAW, play - hits) / comb(BALL_MAX, play)
}

/**
 * 构建一注方案。
 * mode: 'single' 单式 | 'multi' 复式 | 'dantuo' 胆拖
 * 返回 { ok, message, count 注数, cost 金额, mode, play, dans, tuos, picks, combos }
 */
export function buildBet(mode, play, dans, tuos, picks) {
  const label = PLAY_LABEL[play]
  if (mode === 'single') {
    if (picks.length !== play)
      return { ok: false, message: `${label} 单式需正好 ${play} 个号码（当前 ${picks.length} 个）` }
    return {
      ok: true,
      message: `共 1 注`,
      mode,
      play,
      count: 1,
      cost: PRICE,
      dans: [],
      tuos: [],
      picks,
      combos: [picks],
    }
  }

  if (mode === 'multi') {
    if (picks.length > 20) return { ok: false, message: '复式最多选 20 个号码' }
    if (picks.length <= play)
      return {
        ok: false,
        message: `${label} 复式需多于 ${play} 个号码（当前 ${picks.length} 个）`,
      }
    const count = comb(picks.length, play)
    return {
      ok: true,
      message: `共 ${count} 注`,
      mode,
      play,
      count,
      cost: count * PRICE,
      dans: [],
      tuos: [],
      picks,
      combos: null,
    }
  }

  // 胆拖
  if (dans.length === 0) return { ok: false, message: '请至少选择 1 个胆码' }
  if (dans.length >= play)
    return { ok: false, message: `胆码数量需少于 ${play} 个（当前 ${dans.length} 个）` }
  if (dans.some((n) => tuos.includes(n)))
    return { ok: false, message: '同一号码不能同时作为胆码与拖码' }
  if (tuos.length === 0) return { ok: false, message: '请至少选择 1 个拖码' }
  const total = dans.length + tuos.length
  if (total > 20) return { ok: false, message: `胆码 + 拖码 = ${total} 个，最多 20 个` }
  const need = play - dans.length
  if (tuos.length < need)
    return { ok: false, message: `拖码至少 ${need} 个才能凑满 ${play} 个号码` }
  const count = comb(tuos.length, need)
  return {
    ok: true,
    message: `共 ${count} 注`,
    mode,
    play,
    count,
    cost: count * PRICE,
    dans,
    tuos,
    picks: null,
    combos: count <= 4000 ? combinations(tuos, need).map((rest) => [...dans, ...rest].sort((a, b) => a - b)) : null,
  }
}

/**
 * 用某一期开奖号码检验方案，得到「命中个数 → 注数 → 奖金」分布。
 * 用组合数直接聚合，无需逐注枚举（复式/胆拖可达上万注）。
 */
export function evaluateBet(bet, hitSet) {
  const { mode, play } = bet
  const rows = []
  const push = (hits, count) => {
    if (count > 0) rows.push({ hits, count, prize: prizeFor(play, hits) * count })
  }

  if (mode === 'single') {
    push(bet.picks.filter((n) => hitSet.has(n)).length, 1)
  } else if (mode === 'multi') {
    const h = bet.picks.filter((n) => hitSet.has(n)).length
    const miss = bet.picks.length - h
    for (let j = Math.max(0, play - miss); j <= Math.min(play, h); j++) {
      push(j, comb(h, j) * comb(miss, play - j))
    }
  } else {
    const hd = bet.dans.filter((n) => hitSet.has(n)).length
    const ht = bet.tuos.filter((n) => hitSet.has(n)).length
    const miss = bet.tuos.length - ht
    const need = play - bet.dans.length
    for (let j = Math.max(0, need - miss); j <= Math.min(need, ht); j++) {
      push(hd + j, comb(ht, j) * comb(miss, need - j))
    }
  }

  rows.sort((a, b) => b.hits - a.hits)
  const totalPrize = rows.reduce((s, r) => s + r.prize, 0)
  return { rows, totalPrize: +totalPrize.toFixed(2), cost: bet.cost, profit: +(totalPrize - bet.cost).toFixed(2) }
}

// ---------- 形态扩展：尾数 / AC 值 / 三区 ----------

/** 尾数分布：0-9 尾各几个 */
export function tailCount(nums) {
  const t = new Array(10).fill(0)
  for (const n of nums) t[n % 10]++
  return t
}

/** AC 值：两两差值的不同个数 − (个数−1) */
export function acValue(nums) {
  const diffs = new Set()
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++) diffs.add(Math.abs(nums[i] - nums[j]))
  return diffs.size - (nums.length - 1)
}

/** 三区分布：1-27 / 28-54 / 55-80 */
export function zoneCount(nums) {
  const z = [0, 0, 0]
  for (const n of nums) z[Math.min(2, Math.floor((n - 1) / 27))]++
  return z
}

// ---------- 启发式打分（非概率模型） ----------

/**
 * 号码综合评分：只对历史做加权统计，不改变任何号码的真实开出概率。
 * hotMode: 'hot' 只按近期加权频次；'mix' 频次 + 少量遗漏；'cold' 以遗漏为主；
 *          'multi' 多尺度频次模型（长期25% + 近50期30% + 近20期30% + 近10期15%）。
 *          回测显示各模式与机选均无差异，'multi' 仅作评分形式对照留存。
 */
export function scoreBalls(draws, { periods = 100, halfLife = 20, hotMode = 'mix' } = {}) {
  const window = takeLatest(draws, periods).slice().reverse() // 旧→新
  const weighted = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
  window.forEach((d, i) => {
    const w = Math.pow(0.5, (window.length - 1 - i) / halfLife)
    for (const n of d.nums) weighted[n] += w
  })
  const missing = ballMissing(draws, periods)

  // 多尺度模型：四个时间窗的出现率线性加权，各窗按「每期出现率」归一
  if (hotMode === 'multi') {
    const wins = [Math.min(window.length, 100), 50, 20, 10]
    const ws = [0.25, 0.3, 0.3, 0.15]
    const scores = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
    const multiFreq = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
    wins.forEach((w, k) => {
      const win = window.slice(-Math.min(w, window.length))
      const c = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
      for (const d of win) for (const x of d.nums) c[x]++
      const mx = Math.max(...Object.values(c)) / win.length || 1
      for (const n of range(BALL_MAX)) {
        const rate = c[n] / win.length
        scores[n] += ws[k] * (rate / mx)
        multiFreq[n] += ws[k] * rate * 100 // 折算为「百期等权出现次数」，便于与其他模式同列展示
      }
    })
    return { scores, weighted: multiFreq, missing, window: window.length }
  }

  const maxW = Math.max(...Object.values(weighted), 1)
  const maxMiss = Math.max(...Object.values(missing).map((m) => m.current), 1)
  const recipe = {
    hot: { freq: 1, miss: 0 },
    mix: { freq: 1, miss: 0.35 },
    cold: { freq: 0.35, miss: 1 },
  }[hotMode]

  const scores = {}
  for (const n of range(BALL_MAX)) {
    scores[n] =
      (weighted[n] / maxW) * recipe.freq +
      (missing[n].current / maxMiss) * recipe.miss
  }
  return { scores, weighted, missing, window: window.length }
}

/** 按评分排序并做轻量结构约束选号（区间≤3、奇偶≤6），不改变概率 */
export function pickBalanced(ranked, count = 10) {
  const band = (n) => Math.min(3, Math.floor((n - 1) / 20))
  const picked = []
  const used = new Set()
  for (let b = 0; b < 4; b++) {
    const x = ranked.find((r) => band(r.n) === b)
    if (x) {
      picked.push(x)
      used.add(x.n)
    }
  }
  const bandCount = [0, 0, 0, 0]
  picked.forEach((x) => bandCount[band(x.n)]++)
  let odd = picked.filter((x) => isOdd(x.n)).length
  for (const x of ranked) {
    if (picked.length >= count) break
    if (used.has(x.n)) continue
    const b = band(x.n)
    if (bandCount[b] >= 3) continue
    if (isOdd(x.n) && odd >= Math.ceil(count / 2) + 1) continue
    if (!isOdd(x.n) && picked.length - odd >= Math.ceil(count / 2) + 1) continue
    picked.push(x)
    used.add(x.n)
    bandCount[b]++
    if (isOdd(x.n)) odd++
  }
  return picked.slice(0, count)
}

/** 随机选 play 个号的命中 k 个的超几何概率（机选基准） */
export function hyperHits(play) {
  const total = comb(BALL_MAX, play)
  return Array.from({ length: play + 1 }, (_, k) => k).map((k) => ({
    k,
    p: (comb(PER_DRAW, k) * comb(BALL_MAX - PER_DRAW, play - k)) / total,
  }))
}

/**
 * 滚动回测（walk-forward）：对每个历史期，仅用它之前 minTrain 期数据评分选号，
 * 再与该期真实开奖比较命中数。用于「方法体检」，与机选基准对照。
 */
export function walkForwardAudit(draws, { play = 10, minTrain = 30, trainWindow = 100, halfLife = 20, hotMode = 'mix' } = {}) {
  const out = []
  const maxI = draws.length - minTrain - 1
  for (let i = 0; i <= maxI; i++) {
    const train = draws.slice(i + 1, i + 1 + trainWindow)
    const { scores } = scoreBalls(train, { periods: trainWindow, halfLife, hotMode })
    const ranked = range(BALL_MAX)
      .map((n) => ({ n, s: scores[n] }))
      .sort((a, b) => b.s - a.s)
    const picks = pickBalanced(ranked, play).map((x) => x.n)
    const hitSet = new Set(draws[i].nums)
    const hitNums = picks.filter((n) => hitSet.has(n))
    out.push({ draw: draws[i], hits: hitNums.length, hitNums, picks })
  }
  const dist = {}
  out.forEach((r) => (dist[r.hits] = (dist[r.hits] || 0) + 1))
  const avg = out.length ? +(out.reduce((s, r) => s + r.hits, 0) / out.length).toFixed(2) : 0
  return {
    rows: out,
    periods: out.length,
    avgHits: avg,
    baseline: +(play * (PER_DRAW / BALL_MAX)).toFixed(2),
    dist: Array.from({ length: play + 1 }, (_, k) => k)
      .map((k) => ({ k, count: dist[k] || 0 }))
      .sort((a, b) => b.k - a.k),
  }
}
