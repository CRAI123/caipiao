// 彩票概率与期望值 —— 精确组合数学，纯函数模块（不依赖任何第三方数学库）
//
// 全部概率都由组合计数直接推导，可逐项验算：
//   大乐透：前区命中数服从超几何 C(5,k)·C(30,5−k)/C(35,5)，后区独立 C(2,j)·C(10,2−j)/C(12,2)
//   数字彩：000–999 / 00000–99999 每个号码等可能，概率 = 中奖号码个数 / 号码总数
//
// 注意：选号方法只改变“你买了哪几注”，不改变任何单注的中奖概率。

// ---------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------

/**
 * 组合数 C(n, r)。
 * 先用对数累加（ln C = Σ ln 分子 − Σ ln 分母）再 exp，避免中间乘积溢出；
 * 本模块规模内结果都是整数，最后四舍五入回整数以保证 C(33,6) === 1107568。
 */
export function nCr(n, r) {
  if (!Number.isInteger(n) || !Number.isInteger(r)) return NaN
  if (n < 0 || r < 0 || r > n) return 0
  const k = Math.min(r, n - r)
  if (k === 0) return 1
  if (k === 1) return n
  let logSum = 0
  for (let i = 1; i <= k; i += 1) logSum += Math.log(n - k + i) - Math.log(i)
  return Math.round(Math.exp(logSum))
}

/** ln C(n, r) —— 给超几何概率做对数域计算用（大总体时也不溢出） */
function lnC(n, r) {
  if (r < 0 || r > n || n < 0) return -Infinity
  const k = Math.min(r, n - r)
  let logSum = 0
  for (let i = 1; i <= k; i += 1) logSum += Math.log(n - k + i) - Math.log(i)
  return logSum
}

/**
 * 超几何分布：总体 N 个球中有 K 个“目标”，不放回抽 n 个，
 * 恰好抽到 k 个目标的概率 P = C(K,k)·C(N−K,n−k) / C(N,n)。
 */
export function hypergeometric(k, K, n, N) {
  if (![k, K, n, N].every(Number.isInteger)) return NaN
  if (k < 0 || k > K || n < 0 || n > N || k > n) return 0
  const rest = n - k // 需要从非目标球里抽的个数
  if (rest < 0 || rest > N - K) return 0
  return Math.exp(lnC(K, k) + lnC(N - K, rest) - lnC(N, n))
}

/** 单注期望回报：prizes 里每项需有 prob（中奖概率）与 prize（奖金，元） */
export function expectedReturn(prizes, stake = 2) {
  const totalProb = prizes.reduce((s, p) => s + p.prob, 0)
  const ev = prizes.reduce((s, p) => s + p.prob * p.prize, 0)
  const loss = stake - ev
  return {
    totalProb, // 单注中任意奖的概率
    oneIn: totalProb > 0 ? 1 / totalProb : Infinity,
    ev, // 单注期望奖金（元）
    stake, // 单注投入（元）
    returnRate: stake > 0 ? ev / stake : NaN, // 期望回报率（返奖率）
    lossPerTicket: loss, // 单注期望亏损（元）
    lossPerYuan: stake > 0 ? loss / stake : NaN, // 每 1 元投入的期望亏损
  }
}

// ---------------------------------------------------------------
// 展示格式化（概率避免出现 0.0000）
// ---------------------------------------------------------------

/** 概率 → 科学计数法字符串，如 5.6430e-8 */
export function fmtProb(prob, digits = 4) {
  if (!(prob > 0)) return '0'
  return prob.toExponential(digits)
}

/** 概率 → 「1 / N」可读形式；N 为整数时带千分位，非整数时保留两位小数 */
export function fmtOneIn(prob) {
  if (!(prob > 0)) return '—'
  const n = 1 / prob
  if (n < 1000) return `1 / ${n.toFixed(2)}`
  const r = Math.round(n)
  const exact = Math.abs(n - r) < 1e-6
  return `${exact ? '' : '≈ '}1 / ${r.toLocaleString('zh-CN')}`
}

/** 金额格式化：小于 10^-digits 时改用科学计数法，避免显示成 0.0000 */
export function fmtAmount(n, digits = 4) {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (Math.abs(n) < Math.pow(10, -digits)) return n.toExponential(3)
  return n.toFixed(digits)
}

// ---------------------------------------------------------------
// 大乐透：5/35 前区 + 2/12 后区
// ---------------------------------------------------------------

/** 前区组合数 C(35,5) = 324,632 */
const DLT_FRONT_COMBOS = nCr(35, 5)

/** 全部单注数 = 324,632 × 66 = 21,425,712 */
export const DLT_TOTAL = DLT_FRONT_COMBOS * nCr(12, 2)

/** 前区恰好命中 k 个的概率（k = 0…5），超几何分布 */
const frontHit = (k) => hypergeometric(k, 5, 5, 35)
/** 后区恰好命中 j 个的概率（j = 0…2） */
const backHit = (j) => hypergeometric(j, 2, 2, 12)

/** 统一构造奖级项：补上 oneIn 与 combos，便于表格直接展示 */
function dltRow(level, condition, prob, prize, extra = {}) {
  return {
    level,
    name: level,
    condition,
    prob,
    oneIn: 1 / prob,
    combos: Math.round(prob * DLT_TOTAL),
    prize,
    ...extra,
  }
}

/**
 * 大乐透九个奖级（单注 2 元）。
 * 前区 5 中 k、后区 2 中 j 相互独立，各奖级事件互斥，概率直接相加。
 *
 * 已知核对：全部奖级概率之和 = 1,429,197 / 21,425,712 ≈ 0.06670 ≈ 1/15。
 */
export const DLT_PRIZES = [
  // 一等奖：5 前区 + 2 后区
  dltRow('一等奖', '5 前区 + 2 后区', frontHit(5) * backHit(2), 8000000, {
    prizeNote: '浮动奖，按 800 万估算',
  }),
  // 二等奖：5 前区 + 1 后区
  dltRow('二等奖', '5 前区 + 1 后区', frontHit(5) * backHit(1), 150000, {
    prizeNote: '浮动奖，按 15 万估算',
  }),
  // 三等奖：5 前区
  dltRow('三等奖', '5 前区（后区未中）', frontHit(5) * backHit(0), 10000),
  // 四等奖：4 前区 + 2 后区
  dltRow('四等奖', '4 前区 + 2 后区', frontHit(4) * backHit(2), 3000),
  // 五等奖：4 前区 + 1 后区
  dltRow('五等奖', '4 前区 + 1 后区', frontHit(4) * backHit(1), 300),
  // 六等奖：3 前区 + 2 后区
  dltRow('六等奖', '3 前区 + 2 后区', frontHit(3) * backHit(2), 200),
  // 七等奖：4 前区
  dltRow('七等奖', '4 前区（后区未中）', frontHit(4) * backHit(0), 100),
  // 八等奖：(3 前区 + 1 后区) ∪ (2 前区 + 2 后区)
  dltRow('八等奖', '3 前区 + 1 后区 / 2 前区 + 2 后区', frontHit(3) * backHit(1) + frontHit(2) * backHit(2), 15),
  // 九等奖：(3 前区) ∪ (2 前区 + 1 后区) ∪ (1 前区 + 2 后区) ∪ (2 后区)
  dltRow(
    '九等奖',
    '3 前区 / 2 前区 + 1 后区 / 1 前区 + 2 后区 / 2 后区',
    frontHit(3) * backHit(0) + frontHit(2) * backHit(1) + frontHit(1) * backHit(2) + frontHit(0) * backHit(2),
    5,
  ),
]

// ---------------------------------------------------------------
// 福彩3D / 排列三：三位 0–9，共 10³ = 1000 个等可能开奖号码
// ---------------------------------------------------------------
//
// 单注中奖概率 = 「与该注同奖的开奖号码个数」/ 1000：
//   直选：与开奖逐位相同 —— 只有 1 个开奖号码              → 1/1000
//   组选3：投注形如 AAB（两同一不同）。数字集合相同且按组选出
//          现的排列是 AAB / ABA / BAA，共 3 个              → 3/1000
//   组选6：投注形如 ABC（三位各不相同）。全排列 3! = 6 个    → 6/1000
//
// 开奖号码按形态分类（用于核对「覆盖全部开奖形态」）：
//   豹子 AAA：10 个（10×1）                                → 10/1000
//   组三 AAB：10(定 A) × 9(定 B) × 3(B 的位置) = 270 个     → 270/1000
//   组六 ABC：10×9×8 = 720 个                              → 720/1000
//   10 + 270 + 720 = 1000，正好覆盖全部开奖号码。
//
// 注意区分两件事：
//   · 单注中奖概率（1/1000、3/1000、6/1000）—— 决定期望回报率（52%）
//   · 开奖形态占比（270/1000、720/1000）—— 决定“开奖是组三/组六”的频率
//   把 270/1000 当成某注组选3 的中奖概率会把期望值放大 90 倍，是常见误用。

const DIGIT_TOTAL = 1000 // 10³

export const DIGIT_PRIZES = [
  {
    level: '直选',
    name: '直选',
    condition: '三位号码与开奖逐位相同',
    arrangements: 1, // 与该注一致的开奖号码个数
    prob: 1 / DIGIT_TOTAL,
    oneIn: DIGIT_TOTAL,
    prize: 1040,
    shapeShare: null, // 直选不限定开奖形态
  },
  {
    level: '组选3',
    name: '组选3',
    condition: '开奖为「两同一不同」(AAB)，数字集合与投注相同',
    arrangements: 3, // AAB / ABA / BAA
    prob: 3 / DIGIT_TOTAL,
    oneIn: DIGIT_TOTAL / 3,
    prize: 346,
    shapeShare: 270 / DIGIT_TOTAL, // 开奖为组三形态的占比
    shapeCount: 270,
  },
  {
    level: '组选6',
    name: '组选6',
    condition: '开奖为「三位各不相同」(ABC)，数字集合与投注相同',
    arrangements: 6, // 3! = 6
    prob: 6 / DIGIT_TOTAL,
    oneIn: DIGIT_TOTAL / 6,
    prize: 173,
    shapeShare: 720 / DIGIT_TOTAL, // 开奖为组六形态的占比
    shapeCount: 720,
  },
]

/** 开奖号码的形态分布（豹子 + 组三 + 组六 = 全部 1000 个号码） */
export const DIGIT_SHAPE = [
  { id: 'leopard', label: '豹子 AAA', count: 10, prob: 10 / DIGIT_TOTAL, derive: '10×1 = 10' },
  { id: 'group3', label: '组三 AAB', count: 270, prob: 270 / DIGIT_TOTAL, derive: '10×9×3 = 270' },
  { id: 'group6', label: '组六 ABC', count: 720, prob: 720 / DIGIT_TOTAL, derive: '10×9×8 = 720' },
]

// ---------------------------------------------------------------
// 排列五：五位 0–9，共 10⁵ = 100,000 个等可能开奖号码
// ---------------------------------------------------------------

const PL5_TOTAL = 100000 // 10⁵

export const PL5_PRIZES = [
  {
    level: '直选',
    name: '直选',
    condition: '五位号码与开奖逐位相同',
    arrangements: 1,
    prob: 1 / PL5_TOTAL,
    oneIn: PL5_TOTAL,
    prize: 100000,
    shapeShare: null,
  },
]

// ---------------------------------------------------------------
// 七星彩：前 6 位 0–9 + 后区 0–14，共 10⁶ × 15 = 15,000,000 个等可能号码
// ---------------------------------------------------------------
//
// 六奖级互斥，按一→六顺序判定。组合数核对：
//   一等奖 1
//   二等奖 14
//   三等奖 C(6,5)×9 = 54
//   四等奖 C(6,5)×9×14 + C(6,4)×9² = 756 + 1215 = 1971
//   五等奖 C(6,4)×9²×14 + C(6,3)×9³ = 17010 + 14580 = 31590
//   六等奖 C(6,3)×9³×14 + C(6,2)×9⁴ + C(6,1)×9⁵ + 9⁶
//          = 204120 + 98415 + 354294 + 531441 = 1188270
//   合计 1,221,900 / 15,000,000 = 8.146%

export const QXC_TOTAL = 15000000

function qxcRow(level, condition, combos, prize, floating = false, prizeNote = '') {
  const prob = combos / QXC_TOTAL
  return {
    level,
    name: level,
    condition,
    combos,
    prob,
    oneIn: 1 / prob,
    prize,
    floating,
    prizeNote: floating ? prizeNote || '浮动奖，以官方开奖公告为准' : '',
  }
}

export const QXC_PRIZES = [
  qxcRow('一等奖', '7 位号码全部相同', 1, 5000000, true, '浮动奖，按 500 万估算，以官方公告为准'),
  qxcRow('二等奖', '前 6 位全部相同（后区不同）', 14, 40000, true, '浮动奖，按 4 万估算，以官方公告为准'),
  qxcRow('三等奖', '前 6 位任意 5 位相同 + 后区相同', 54, 3000),
  qxcRow('四等奖', '前 6 位任意 5 位相同（后区不同）/ 前 6 位任意 4 位相同 + 后区相同', 1971, 500),
  qxcRow('五等奖', '前 6 位任意 4 位相同（后区不同）/ 前 6 位任意 3 位相同 + 后区相同', 31590, 30),
  qxcRow(
    '六等奖',
    '前 6 位任意 3 位相同（后区不同）/ 前 2 位相同 + 后区相同 / 前 1 位相同 + 后区相同 / 仅后区相同',
    1188270,
    5,
  ),
]

/** 判定函数按奖级顺序取用；只含固定奖金部分的返奖率由页面按需计算 */
export const QXC_LEVELS = QXC_PRIZES

/** 七星彩总中奖组合数 1,221,900，总中奖率 8.146% */
export const QXC_WIN_COMBOS = QXC_PRIZES.reduce((s, p) => s + p.combos, 0)
export const QXC_WIN_PROB = QXC_WIN_COMBOS / QXC_TOTAL
