// ============================================================
// 保底缩水器 —— 覆盖设计（covering design / lottery wheel）
//
// 缩水的本质不是「预测」，而是覆盖设计：
// 给定号码池 P（|P| = n），每注选 k 个号，要选出尽量少的注数，使得
// 「若开奖的 k 个号全部落在池内，则至少有一注命中 ≥ t 个」。
// 对应的数学问题就是覆盖数 C(n, k, t) 的构造。
//
// 胆码等价性（重要）：
// 设胆码集合 D（|D| = d）在每注中固定出现，拖码池 T 中每注再补选 k-d 个。
// 若开奖的 k 个号全部落在 D∪T 内、且 D 全部开出，则开奖的「拖码部分」
// 就是从 T 中取出的 k-d 个号。任一注与开奖的交集为
//     d + |该注拖码部分 ∩ 开奖拖码部分|
// 因此「整注交集 ≥ t」⟺「拖码部分交集 ≥ t-d」。
// 可见对 (T, k-d, t-d) 做覆盖设计，与对 (D∪T, k, t) 做覆盖设计在
// 「胆码必出」的前提下完全等价；枚举规模也从 C(d+|T|, k) 降到 C(|T|, k-d)，
// 这正是胆拖缩水可行的原因。本模块的校验/分布函数因此只接收拖码池。
//
// ⚠️ 诚实前提：覆盖设计只提供「条件保证」，不改变中奖概率。
// ============================================================

/** 允许枚举的最大组合数（超过则拒绝计算，避免卡死浏览器） */
export const MAX_COMBOS = 200000

/** 组合数 C(n, k)；参数越界返回 0 */
export function combinationCount(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return 0
  let v = 1
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1)
  return Math.round(v)
}

/** 小工具：按组合数大小格式化成中文可读文本 */
function fmt(n) {
  return Number(n).toLocaleString('zh-CN')
}

/** 组合数 C(n,k) 的逐项版本（内部用，n 很小，避免频繁建表） */
function choose(n, k) {
  return combinationCount(n, k)
}

/** 枚举 n 个下标中所有 k 组合，返回二维数组（内部用） */
function allIndexCombos(n, k) {
  const out = []
  const cur = new Array(k)
  const rec = (start, depth) => {
    if (depth === k) {
      out.push(cur.slice())
      return
    }
    for (let i = start; i <= n - (k - depth); i++) {
      cur[depth] = i
      rec(i + 1, depth + 1)
    }
  }
  rec(0, 0)
  return out
}

/** 枚举数组 arr 中所有 k 组合，返回元素本身（内部用） */
function combosOfArray(arr, k) {
  const out = []
  const cur = new Array(k)
  const rec = (start, depth) => {
    if (depth === k) {
      out.push(cur.map((i) => arr[i]))
      return
    }
    for (let i = start; i <= arr.length - (k - depth); i++) {
      cur[depth] = i
      rec(i + 1, depth + 1)
    }
  }
  rec(0, 0)
  return out
}

/** 组合数位序（combinadic）：把递增下标组合映射到 0..C(n,t)-1 的唯一序号 */
function rankOf(indices) {
  let r = 0
  for (let i = 0; i < indices.length; i++) r += choose(indices[i], i + 1)
  return r
}

/** popcount（仅用于 n ≤ 30 的位掩码快速求交） */
function popcount(x) {
  x = x - ((x >> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
  x = (x + (x >> 4)) & 0x0f0f0f0f
  return ((x * 0x01010101) >> 24) & 0xff
}

/**
 * 枚举数组 arr 的所有 k 组合。
 * C(n,k) 超过 20 万时抛错，提示缩小号码池（这是 UI 防卡死的最后一道闸）。
 */
export function enumCombos(arr, k) {
  const n = arr.length
  if (!Number.isInteger(k) || k < 0 || k > n) {
    throw new Error(`无法从 ${n} 个号码中选 ${k} 个`)
  }
  const total = combinationCount(n, k)
  if (total > MAX_COMBOS) {
    throw new Error(
      `组合数 C(${n},${k}) = ${fmt(total)} 超过 ${fmt(MAX_COMBOS)}，请缩小号码池或降低每注号码数`,
    )
  }
  return combosOfArray(arr, k)
}

/**
 * 贪心覆盖构造。
 *
 * @param {number|number[]} poolOrN 号码池；传数字 n 表示使用 1..n（双色球风格），
 *                                  传数组则直接使用数组里的号码（数字彩 0..9 用得到）
 * @param {number} k 每注号码个数
 * @param {number} t 目标保证（若开奖 k 个号全在池内，至少一注命中 ≥ t 个）
 * @param {{ maxTickets?: number }} [opts] 最大注数上限（到上限即停，可能未覆盖完）
 * @returns {{ tickets: number[][], coveredAll: boolean, uncovered: number, lowerBound: number, candidateCount: number }}
 *
 * 每轮挑选「能覆盖最多尚未被覆盖的 t-子集」的 k-组合，直到全部覆盖或达到上限。
 * tickets 返回号码本身（已升序），不是下标。
 */
export function greedyCover(poolOrN, k, t, { maxTickets = 300 } = {}) {
  const pool = Array.isArray(poolOrN)
    ? poolOrN.slice()
    : Array.from({ length: Math.max(0, Number(poolOrN) || 0) }, (_, i) => i + 1)
  const n = pool.length

  if (!Number.isInteger(k) || k < 1 || k > n) {
    throw new Error(`每注号码个数 k=${k} 不合法（池内共 ${n} 个号码）`)
  }
  if (!Number.isInteger(t) || t < 1 || t > k) {
    throw new Error(`目标保证 t=${t} 不合法（需满足 1 ≤ t ≤ k=${k}）`)
  }

  const candidateCount = combinationCount(n, k)
  if (candidateCount > MAX_COMBOS) {
    throw new Error(
      `候选注数 C(${n},${k}) = ${fmt(candidateCount)} 超过 ${fmt(MAX_COMBOS)}，请缩小号码池或降低每注号码数`,
    )
  }

  const tCount = combinationCount(n, t)
  const perTicket = combinationCount(k, t)
  const lowerBound = perTicket > 0 ? Math.ceil(tCount / perTicket) : 0

  const candidates = allIndexCombos(n, k)
  // 每一注包含的 t-子集序号
  const contained = candidates.map((cand) => combosOfArray(cand, t).map(rankOf))

  // 反向索引：每个 t-子集被哪些候选注包含（用于贪心选注后的增量更新）
  const tToCands = Array.from({ length: tCount }, () => [])
  contained.forEach((ranks, cid) => {
    for (const r of ranks) tToCands[r].push(cid)
  })

  const gains = Int32Array.from(contained.map((a) => a.length))
  const covered = new Uint8Array(tCount)
  const chosen = []
  let remaining = tCount
  const limit = Math.max(1, Math.floor(maxTickets) || 1)

  while (remaining > 0 && chosen.length < limit) {
    let best = -1
    let bestGain = 0
    for (let i = 0; i < gains.length; i++) {
      if (gains[i] > bestGain) {
        bestGain = gains[i]
        best = i
      }
    }
    if (best < 0) break
    chosen.push(best)
    gains[best] = -1
    remaining -= bestGain
    for (const r of contained[best]) {
      if (covered[r]) continue
      covered[r] = 1
      for (const cid of tToCands[r]) {
        if (gains[cid] > 0) gains[cid] -= 1
      }
    }
  }

  const tickets = chosen.map((cid) => candidates[cid].map((i) => pool[i]).sort((a, b) => a - b))
  return {
    tickets,
    coveredAll: remaining <= 0,
    uncovered: Math.max(0, remaining),
    lowerBound,
    candidateCount,
  }
}

/**
 * 内部：扫描池内所有 k-子集（模拟所有可能开奖），统计「与所有注的最大命中数」分布。
 * 采用位掩码（n ≤ 30）或 Set 求交；不物化全部开奖组合，避免大内存。
 */
function scanDraws(pool, tickets, k, targetT = null) {
  const n = pool.length
  const total = combinationCount(n, k)
  const indexOf = new Map()
  pool.forEach((v, i) => indexOf.set(v, i))

  // 注里的号码可能包含池外的胆码，这里只统计池内部分
  const ticketMasks = []
  const ticketSets = []
  for (const tk of tickets) {
    const idxs = []
    for (const v of tk) {
      const i = indexOf.get(v)
      if (i !== undefined && !idxs.includes(i)) idxs.push(i)
    }
    ticketMasks.push(idxs.reduce((m, i) => m | (1 << i), 0))
    ticketSets.push(new Set(idxs))
  }

  const useMask = n <= 30
  const dist = new Int32Array(k + 1)
  const fails = []
  let failsTotal = 0
  let sum = 0
  const cur = new Array(k)

  const visit = (mask) => {
    let best = 0
    if (useMask) {
      for (let ti = 0; ti < ticketMasks.length; ti++) {
        const h = popcount(ticketMasks[ti] & mask)
        if (h > best) best = h
      }
    } else {
      for (let ti = 0; ti < ticketSets.length; ti++) {
        const s = ticketSets[ti]
        let h = 0
        for (let j = 0; j < k; j++) if (s.has(cur[j])) h += 1
        if (h > best) best = h
      }
    }
    dist[best] += 1
    sum += best
    if (targetT != null && best < targetT) {
      failsTotal += 1
      if (fails.length < 20) {
        fails.push({ draw: cur.map((i) => pool[i]).sort((a, b) => a - b), hits: best })
      }
    }
  }

  const rec = (start, depth, mask) => {
    if (depth === k) {
      visit(mask)
      return
    }
    for (let i = start; i <= n - (k - depth); i++) {
      cur[depth] = i
      rec(i + 1, depth + 1, mask | (1 << i))
    }
  }
  rec(0, 0, 0)

  return { total, dist, sum, failsTotal, fails, ticketCount: tickets.length }
}

/** 把分布数组转成 [{hits,count,rate}]，只保留出现过的命中数 */
function toRows(dist, total) {
  const rows = []
  for (let h = 0; h < dist.length; h++) {
    if (dist[h] > 0) rows.push({ hits: h, count: dist[h], rate: total ? dist[h] / total : 0 })
  }
  return rows
}

/**
 * 穷举校验：对池内所有 k-子集（模拟所有可能开奖），检查是否至少有一注与它交集 ≥ t。
 *
 * 传入的 pool 应是需要覆盖的号码池（胆拖场景下就是拖码池，见文件头等价性说明），
 * k、t 也应是扣除胆码后的「拖码部分」口径。返回：
 *   { ok, total, worstCase: [{hits,count,rate}], fails: [{draw,hits}], failsTotal, minHits, avgHits }
 * C(n,k) 超过 20 万时返回 { skipped: true, reason, total }。
 */
export function verifyCover(pool, tickets, k, t) {
  const n = pool.length
  const total = combinationCount(n, k)
  if (total > MAX_COMBOS) {
    return {
      skipped: true,
      reason: `C(${n},${k}) = ${fmt(total)} 超过 ${fmt(MAX_COMBOS)}，已跳过穷举校验`,
      total,
    }
  }
  if (!Number.isInteger(k) || k < 1 || !Number.isInteger(t) || t < 1) {
    return { skipped: true, reason: '参数不合法，未执行校验', total: 0 }
  }

  const scanned = scanDraws(pool, tickets, k, t)
  const worstCase = toRows(scanned.dist, scanned.total)
  let minHits = k
  let hasAny = false
  for (let h = 0; h < scanned.dist.length; h++) {
    if (scanned.dist[h] > 0) {
      if (!hasAny) {
        minHits = h
        hasAny = true
      }
    }
  }
  return {
    ok: scanned.failsTotal === 0,
    total: scanned.total,
    worstCase,
    fails: scanned.fails,
    failsTotal: scanned.failsTotal,
    minHits: hasAny ? minHits : 0,
    avgHits: scanned.total ? scanned.sum / scanned.total : 0,
    ticketCount: tickets.length,
  }
}

/**
 * 命中分布：对池内每个 k-子集计算「与所有注的最大命中数」，返回
 * [{ hits, count, rate }]（按 hits 升序，只含出现过的命中数）。
 * 总数（count 求和）应等于 C(n,k)。C(n,k) 超过 20 万时返回 []（调用方应先估算）。
 */
export function hitDistribution(pool, tickets, k) {
  const n = pool.length
  const total = combinationCount(n, k)
  if (total > MAX_COMBOS || !Number.isInteger(k) || k < 1) return []
  const scanned = scanDraws(pool, tickets, k)
  return toRows(scanned.dist, scanned.total)
}
