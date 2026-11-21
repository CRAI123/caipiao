// ============================================================
// 快乐8 概率与奖金（严格组合数学）
//
// 选 k 个号，20 个开奖号中命中 m 个的概率服从超几何分布：
//   P(m) = C(k,m) × C(80−k, 20−m) / C(80,20)
// 这一层与选号方法无关，可直接用于期望值、复式/胆拖注数计算。
// ============================================================

const LOG_FACT = [0]
function logFact(n) {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i)
  return LOG_FACT[n]
}

/** log C(n,k) */
export function logC(n, k) {
  if (k < 0 || k > n) return -Infinity
  return logFact(n) - logFact(k) - logFact(n - k)
}

/** C(n,k)，超过 1e15 时用近似值 */
export function comb(n, k) {
  if (k < 0 || k > n) return 0
  return Math.exp(logC(n, k))
}

/** 超几何概率：从 80 个号中选 k 个，命中 m 个 */
export function kl8Prob(k, m) {
  if (m < 0 || m > k || m > 20) return 0
  return Math.exp(logC(k, m) + logC(80 - k, 20 - m) - logC(80, 20))
}

// 中国福彩快乐8 奖金表（元/注，2 元一注）
// 键 = 命中个数，未列出的命中数不中奖
export const KL8_PRIZES = {
  1: { 1: 4.6 },
  2: { 2: 19 },
  3: { 3: 53, 2: 3 },
  4: { 4: 100, 3: 5, 2: 3 },
  5: { 5: 1000, 4: 21, 3: 3 },
  6: { 6: 3000, 5: 30, 4: 5, 3: 3 },
  7: { 7: 10000, 6: 288, 5: 28, 4: 4, 0: 2 },
  8: { 8: 50000, 7: 800, 6: 88, 5: 10, 4: 3, 0: 2 },
  9: { 9: 300000, 8: 2000, 7: 200, 6: 20, 5: 5, 4: 3, 0: 2 },
  10: { 10: 5000000, 9: 8000, 8: 800, 7: 80, 6: 5, 5: 3, 0: 2 },
}

/** 快乐8 站内默认玩法：选六（推荐页、每日推送、复盘共用同一口径） */
export const KL8_PLAY = 6

export const KL8_PLAY_LABEL = {
  1: '选一',
  2: '选二',
  3: '选三',
  4: '选四',
  5: '选五',
  6: '选六',
  7: '选七',
  8: '选八',
  9: '选九',
  10: '选十',
}

/** 单注玩法统计：分布、中奖概率、单注期望回报、返还率 */
export function kl8PlayStats(k) {
  const table = KL8_PRIZES[k] || {}
  const dist = []
  let anyWin = 0
  let ev = 0
  for (let m = 0; m <= k; m++) {
    const p = kl8Prob(k, m)
    const prize = table[m] || 0
    dist.push({ m, p, prize })
    if (prize > 0) anyWin += p
    ev += p * prize
  }
  return {
    k,
    label: KL8_PLAY_LABEL[k],
    dist,
    anyWin,
    ev,
    returnRate: ev / 2,
    minHit: Math.min(...dist.filter((d) => d.prize > 0).map((d) => d.m)),
  }
}

/** 选 k 的复式：选 n 个号，注数 C(n,k) */
export function kl8Fushi(k, n) {
  const tickets = Math.round(comb(n, k))
  return { tickets, cost: tickets * 2 }
}

/** 选 k 的胆拖：d 个胆码 + t 个拖码，注数 C(t, k−d) */
export function kl8Dantuo(k, d, t) {
  if (d > k) return { tickets: 0, cost: 0, invalid: '胆码不能超过选号个数' }
  const need = k - d
  if (need > t) return { tickets: 0, cost: 0, invalid: '拖码不足，无法组满一注' }
  const tickets = Math.round(comb(t, need))
  return { tickets, cost: tickets * 2 }
}

/** 复式投注的中奖概率（至少中最低奖） */
export function kl8FushiWinRate(k, n) {
  // 复式 n 个号覆盖 k 注，命中数与单注同分布口径：
  // 每注由 n 个号中的 k 个组成，命中数分布按逐注计算过于复杂，
  // 这里给出“n 个号中命中 j 个”的概率，供参考。
  const out = []
  for (let j = 0; j <= Math.min(n, 20); j++) out.push({ j, p: kl8Prob(n, j) })
  return out
}

export function fmtMoney(v) {
  if (!Number.isFinite(v)) return '—'
  if (v >= 10000) return `${(v / 10000).toFixed(2)} 万`
  return v.toFixed(2)
}

export function fmtPct(v, digits = 2) {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** 大数注数显示 */
export function fmtTickets(v) {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e12) return v.toExponential(3)
  return Math.round(v).toLocaleString('zh-CN')
}
