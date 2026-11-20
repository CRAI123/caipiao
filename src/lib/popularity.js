// ============================================================
// 组合热度与分摊风险模型（双色球）
//
// 为什么做这个：
// 双色球头奖是浮动奖（奖池制），多人同时中奖要分摊。
// 选号无法改变中奖概率，但避开别人扎堆买的组合，能提高「中奖时的期望奖金」。
// 这是唯一数学上站得住的优化方向，依据是 Cook & Clotfelter (1993)
// 对彩票号码选择行为的实证：投注者对小号码（≤31，尤其 ≤12）严重超配，
// 因为生日、纪念日等心理偏好。
//
// 重要前提：
// - 本模型的输出只估算「奖金分摊」，不改变任何一注的中奖概率。
// - 下列权重是经验模型，来自公开行为研究的定性结论，不是精确购彩数据。
// - 组合热度高只说明「可能有很多人也选了」，不代表更容易或更难开出。
// ============================================================

/** 固定 LCG 种子：保证每次渲染、每次调用的抽样结果一致，避免 UI 数字跳动 */
export const LCG_SEED = 20261120

/** 中文语境里的吉利数（6/8/9 及其常见组合） */
const LUCKY_NUMS = new Set([6, 8, 9, 18, 28])

/** 简易线性同余伪随机，返回 [0, 1)；用 Math.imul 保证 32 位乘法精确、跨运行一致 */
function makeLcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/** 从 1..maxNum 中抽 6 个不重复号码（可带 lock 胆码，胆码必定包含） */
function drawCombo(rnd, maxNum, lock = []) {
  const used = new Set(lock)
  const pool = []
  for (let n = 1; n <= maxNum; n++) if (!used.has(n)) pool.push(n)
  const need = 6 - lock.length
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rnd() * (pool.length - i))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  return [...lock, ...pool.slice(0, need)].sort((a, b) => a - b)
}

/**
 * 单个号码的「被选倾向」评分。
 * 权重为经验模型，非精确购彩数据：
 *   - 01–12：最高（生日月份 + 日期），基础 2.2
 *   - 13–31：较高（生日日期），基础 1.6
 *   - 32–33：最低（超出日期范围），基础 0.8
 *   - 吉利数 6/8/9/18/28：额外 +0.4
 *   - 号码 4：-0.2（谐音不吉，被回避）
 */
export function digitPopularity(num, { maxNum = 33 } = {}) {
  if (!Number.isInteger(num) || num < 1 || num > maxNum) return 0
  const monthCut = Math.min(12, maxNum)
  const birthdayCut = Math.min(31, maxNum)
  let w = 0.8
  if (num <= monthCut) w = 2.2
  else if (num <= birthdayCut) w = 1.6
  if (LUCKY_NUMS.has(num)) w += 0.4
  if (num === 4) w -= 0.2
  return +w.toFixed(2)
}

/** 是否含等差数列：排序后相邻号段里出现「公差相同且长度 ≥3」的一段（如 03,07,11） */
function hasArithmeticRun(nums) {
  for (let i = 2; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] === nums[i - 1] - nums[i - 2]) return true
  }
  return false
}

/**
 * 组合热度 = Σ 单号倾向 × 结构惩罚系数。
 * @param {number[]} nums 6 个红球
 * @param {{maxNum?: number, prevNums?: number[]}} opts
 *        prevNums = 上期开奖红球（用于「照抄上期」加成）
 * @returns {{score: number, base: number, factors: {name: string, mult: number}[]}}
 */
export function comboPopularity(nums, { maxNum = 33, prevNums = [] } = {}) {
  const arr = [...nums].sort((a, b) => a - b)
  if (
    arr.length !== 6 ||
    new Set(arr).size !== 6 ||
    arr.some((n) => !Number.isInteger(n) || n < 1 || n > maxNum)
  ) {
    return { score: 0, base: 0, factors: [] }
  }

  let base = 0
  for (const n of arr) base += digitPopularity(n, { maxNum })

  const factors = []

  // 1. 全为连续号（如 01,02,03,04,05,06）——手选票的招牌形态
  const allConsecutive = arr.every((n, i) => i === 0 || n === arr[i - 1] + 1)
  if (allConsecutive) {
    factors.push({ name: '全为连续号（如 01–06）', mult: 1.9 })
  } else if (hasArithmeticRun(arr)) {
    // 2. 含等差数列（公差相同且长度 ≥3）
    factors.push({ name: '含等差数列（公差相同且长度 ≥3）', mult: 1.5 })
  }

  // 3. 全部 ≤31：生日选号的典型范围
  if (maxNum > 31 && arr.every((n) => n <= 31)) {
    factors.push({ name: '全部号码 ≤31（生日偏好）', mult: 1.25 })
  }

  // 4. 与上期重合 ≥3 个：不少人直接照抄上期
  const prevSet = new Set(prevNums)
  const overlap = arr.filter((n) => prevSet.has(n)).length
  if (overlap >= 3) {
    factors.push({ name: `与上期重合 ${overlap} 个（照抄上期）`, mult: 1.35 })
  }

  // 5. 和值 100–140：大众偏好「看起来均衡」的组合
  const sum = arr.reduce((s, n) => s + n, 0)
  if (sum >= 100 && sum <= 140) {
    factors.push({ name: `和值 ${sum} 落在 100–140（大众偏爱均衡）`, mult: 1.15 })
  }

  const score = base * factors.reduce((s, f) => s * f.mult, 1)
  return { score: +score.toFixed(3), base: +base.toFixed(3), factors }
}

// 百分位抽样表按「号码上限 + 样本数 + 上期开奖」缓存，避免每个组合都重抽样
const pctCache = new Map()

function percentileTable(maxNum, samples, prevNums) {
  const prevKey = prevNums.length ? [...prevNums].sort((a, b) => a - b).join(',') : '-'
  const key = `${maxNum}|${samples}|${prevKey}`
  const hit = pctCache.get(key)
  if (hit) return hit

  const rnd = makeLcg(LCG_SEED)
  const scores = new Array(samples)
  for (let i = 0; i < samples; i++) {
    scores[i] = comboPopularity(drawCombo(rnd, maxNum), { maxNum, prevNums }).score
  }
  scores.sort((a, b) => a - b)
  pctCache.set(key, scores)
  return scores
}

/**
 * 用蒙特卡洛抽样估算某个热度分数的百分位（0–100）。
 * 固定种子 LCG，同一分数多次调用结果完全一致。
 * @param {number} score comboPopularity 的分数
 * @param {{maxNum?: number, samples?: number, prevNums?: number[]}} opts
 */
export function popularityPercentile(score, { maxNum = 33, samples = 3000, prevNums = [] } = {}) {
  const table = percentileTable(maxNum, samples, prevNums)
  if (!table.length) return 0
  // 二分：统计「分数 ≤ 目标」的样本占比
  let lo = 0
  let hi = table.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (table[mid] <= score) lo = mid + 1
    else hi = mid
  }
  return +((lo / table.length) * 100).toFixed(1)
}

/**
 * 分摊指数：把百分位映射为「预计分摊人数 / 平均水平」的倍数。
 * 中位数（50）≈ 1.00×，最低约 0.15×，最高约 3.50×。
 * 百分位越高 = 越热门 = 中奖时分得越少。
 */
export function splitIndex(percentile) {
  const p = Math.max(0, Math.min(100, Number(percentile) || 0))
  const v = p <= 50 ? 0.15 + (p / 50) * 0.85 : 1 + ((p - 50) / 50) * 2.5
  return +v.toFixed(2)
}

/**
 * 冷门组合推荐：在固定种子下采样 N 个候选，按热度升序取前 top 个。
 * lock 为 0–3 个胆码，采样时直接排除胆码以外的号码来构造组合，保证必含。
 * 注意：这只是「少人买」，中奖概率与任何其他组合完全相同。
 */
export function recommendColdCombos({
  lock = [],
  maxNum = 33,
  samples = 8000,
  prevNums = [],
  top = 5,
} = {}) {
  const locks = [...new Set(lock)]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxNum)
    .sort((a, b) => a - b)
    .slice(0, 3)
  if (locks.length >= 6) return []

  const rnd = makeLcg(LCG_SEED)
  const seen = new Set()
  const rows = []
  for (let i = 0; i < samples; i++) {
    const nums = drawCombo(rnd, maxNum, locks)
    const key = nums.join('-')
    if (seen.has(key)) continue
    seen.add(key)
    const { score, factors } = comboPopularity(nums, { maxNum, prevNums })
    rows.push({ nums, score, factors })
  }
  rows.sort((a, b) => a.score - b.score)
  return rows.slice(0, top)
}
