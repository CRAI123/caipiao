// ============================================================
// 融合推荐 —— 跨算法版本加权合并「定位候选」
//
// 可融合判定（按实际输出结构，不改引擎、只调用）：
//   - 版本推算结果带 posTop（每个位置的 Top 候选）直接参与；
//   - v1 经典综合评分无定位输出，但有全局胆码 dan（Top2）→ 适配为「各位相同候选」参与；
//   - v2 / Pro 有 posTop → 直接参与；v4 是技术指标区间参考，按产品约定不参与融合。
//
// 定权方式：walk-forward 近 30 期逐期回算，统计各版本「直选按位命中均值」
//   （每位实际号码是否落在该版本该位 Top2 内，命中位数 / 位数），
//   weights = softmax(平均命中 × 温度 10)；样本不足时退化为等权。
//
// 诚实口径：融合不提高中奖概率，只是把「选版本」的不确定性摊平；
//   长期命中仍收敛随机期望（按位 Top2 候选的随机期望 = 2/10 = 0.2）。
// ============================================================

/** Top1/Top2 候选对版本权重的承接比例（版本权重按 6:4 分给该位的两个候选） */
export const RANK_SPLIT = [0.6, 0.4]
/** softmax 温度：命中差 0.01 时权重比 ≈ e^0.1 ≈ 1.1，温和放大差异 */
export const FUSION_TEMPERATURE = 10
/** 定权用的 walk-forward 期数 */
export const FUSION_WALK_PERIODS = 30
/** 低于该样本量退化为等权 */
export const FUSION_MIN_SAMPLES = 10

/** softmax(values × temperature)，返回归一权重（和为 1） */
export function softmax(values, temperature = FUSION_TEMPERATURE) {
  const xs = values.map((v) => v * temperature)
  const m = Math.max(...xs)
  const exps = xs.map((x) => Math.exp(x - m))
  const s = exps.reduce((a, b) => a + b, 0) || 1
  return exps.map((e) => e / s)
}

/** 结构判定：该版本输出是否带「定位候选」 */
export function hasPosTop(pred) {
  return (
    !!pred &&
    Array.isArray(pred.posTop) &&
    pred.posTop.length > 0 &&
    pred.posTop.every(
      (p) => Array.isArray(p) && p.length > 0 && p.every((d) => Number.isInteger(d) && d >= 0 && d <= 9),
    )
  )
}

/** v1 结构适配：无 posTop 但有全局胆码 dan（Top2）→ 复制到各位作为定位候选；其余原样返回 */
export function adaptPosTop(pred) {
  if (hasPosTop(pred)) return pred
  if (pred && Array.isArray(pred.dan) && pred.dan.length >= 1) {
    const npos = pred.lastDraw?.num?.length || 3
    return { ...pred, posTop: Array.from({ length: npos }, () => pred.dan) }
  }
  return pred
}

/** 按位命中的随机期望 = 平均每位置候选数 / 10（Top2 候选 → 0.2） */
export function posExpectation(pred) {
  const lens = pred.posTop.map((p) => p.length)
  return lens.reduce((a, b) => a + b, 0) / lens.length / 10
}

/** 单期直选按位命中均值：实际号码落在各位置候选内的位数 / 位数；无定位输出返回 null */
export function posHitRate(pred, actualNum) {
  if (!hasPosTop(pred)) return null
  let hit = 0
  for (let p = 0; p < pred.posTop.length; p++) {
    if (pred.posTop[p].includes(actualNum[p])) hit++
  }
  return hit / pred.posTop.length
}

/**
 * walk-forward 逐期回算各版本按位命中（与 FC3DAudit 相同的调用方式：
 * 第 i 期只用 draws.slice(i+1) 训练）。
 * predictOf: key → 引擎函数名。
 * 返回 { [key]: { status: 'ok'|'no-pos'|'missing'|'empty', n, rates, avgHit, expected } }
 */
export function walkForwardStats(
  engine,
  keys,
  predictOf,
  draws,
  { periods = FUSION_WALK_PERIODS, minTrain = 40 } = {},
) {
  const n = Math.max(0, Math.min(periods, draws.length - minTrain))
  const out = {}
  for (const key of keys) {
    const fn = engine[predictOf(key)]
    if (typeof fn !== 'function') {
      out[key] = { status: 'missing', n: 0 }
      continue
    }
    if (n <= 0) {
      out[key] = { status: 'empty', n: 0 }
      continue
    }
    const rates = []
    let expected = 0
    let noPos = false
    for (let i = 0; i < n; i++) {
      const pred = adaptPosTop(fn(draws.slice(i + 1), { cover: 6, coverRate: 0.8 }))
      if (!pred) continue
      if (!hasPosTop(pred)) {
        noPos = true // 无定位输出 → 该版本不参与，探一次即止
        break
      }
      rates.push(posHitRate(pred, draws[i].num))
      expected += posExpectation(pred)
    }
    if (noPos) {
      out[key] = { status: 'no-pos', n: 0 }
      continue
    }
    if (!rates.length) {
      out[key] = { status: 'empty', n: 0 }
      continue
    }
    expected /= rates.length
    out[key] = {
      status: 'ok',
      n: rates.length,
      rates,
      avgHit: rates.reduce((a, b) => a + b, 0) / rates.length,
      expected,
    }
  }
  return out
}

/** 由 walk-forward 统计得出各版本权重；样本不足或单版本时等权 */
export function fusionWeights(stats, keys) {
  const enough =
    keys.length >= 2 &&
    keys.every((k) => stats[k]?.status === 'ok' && stats[k].n >= FUSION_MIN_SAMPLES)
  if (!enough) {
    return {
      weights: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])),
      equalized: true,
    }
  }
  const w = softmax(keys.map((k) => stats[k].avgHit), FUSION_TEMPERATURE)
  return { weights: Object.fromEntries(keys.map((k, i) => [k, w[i]])), equalized: false }
}

/** 各版本当前定位候选按权重合并 → 每位归一化分布 + 来源版本标注 */
export function fusePositions(preds, weights, keys) {
  const npos = keys.reduce((m, k) => Math.max(m, preds[k]?.posTop?.length || 0), 0)
  const posDist = []
  for (let p = 0; p < npos; p++) {
    const arr = Array(10).fill(0)
    const src = Array.from({ length: 10 }, () => [])
    for (const k of keys) {
      const cand = preds[k]?.posTop?.[p]
      if (!cand) continue
      cand.forEach((d, i) => {
        arr[d] += weights[k] * (RANK_SPLIT[i] ?? RANK_SPLIT[RANK_SPLIT.length - 1])
        if (!src[d].includes(k)) src[d].push(k)
      })
    }
    const t = arr.reduce((a, b) => a + b, 0) || 1
    posDist.push({ prob: arr.map((v) => v / t), sources: src })
  }
  return posDist
}

function formOf(num) {
  const u = new Set(num).size
  return u === 1 ? '豹子' : u === 2 ? '组三' : '组六'
}

/** 最短的、累计概率 ≥ target 的连续区间（与引擎同款算法，独立实现） */
function shortestInterval(dist, target) {
  const hi = dist.length - 1
  let best = null
  for (let a = 0; a <= hi; a++) {
    let acc = 0
    for (let b = a; b <= hi; b++) {
      acc += dist[b]
      if (acc >= target) {
        if (!best || b - a < best[1] - best[0]) best = [a, b]
        break
      }
    }
  }
  return best || [0, hi]
}

/** 合并分布的支撑集（候选笛卡尔积）→ 直选组合 Top N + 和值/跨度参考分布 */
export function fuseCombos(posDist, { topN = 8 } = {}) {
  const cands = posDist.map((pd) => pd.prob.map((v, d) => ({ d, v })).filter((x) => x.v > 0))
  let rows = [{ num: [], p: 1 }]
  for (const list of cands) {
    const next = []
    for (const r of rows) for (const c of list) next.push({ num: [...r.num, c.d], p: r.p * c.v })
    rows = next
  }
  rows.sort((a, b) => b.p - a.p)
  const combos = rows.slice(0, topN).map((r, i) => ({
    rank: i + 1,
    num: r.num,
    prob: +(r.p * 100).toFixed(2),
    sum: r.num.reduce((a, b) => a + b, 0),
    span: Math.max(...r.num) - Math.min(...r.num),
    form: formOf(r.num),
  }))
  const npos = cands.length
  const sumDist = Array(9 * npos + 1).fill(0)
  const spanDist = Array(10).fill(0)
  for (const r of rows) {
    sumDist[r.num.reduce((a, b) => a + b, 0)] += r.p
    spanDist[Math.max(...r.num) - Math.min(...r.num)] += r.p
  }
  return { combos, sumDist, spanDist }
}

/** 融合视图一次性产出：当前各版本预测 + 合并定位分布 + Top 组合 + 和值/跨度参考 */
export function fuseView(engine, keys, predictOf, draws, weights, { coverRate = 0.8 } = {}) {
  const preds = {}
  for (const k of keys) preds[k] = adaptPosTop(engine[predictOf(k)](draws, { cover: 6, coverRate }))
  const posDist = fusePositions(preds, weights, keys)
  const { combos, sumDist, spanDist } = fuseCombos(posDist)
  return {
    preds,
    posDist,
    combos,
    sumRange: shortestInterval(sumDist, coverRate),
    spanRange: shortestInterval(spanDist, coverRate),
  }
}

/**
 * 方法体检「版本对比 · 近 100 期」：逐期按位命中统计。
 * 返回行数组：status 'ok' 带 avgHit/expected/beatRate/longestMiss/conclusion；
 * 'no-pos' 无定位输出；'indicator' 由调用方标记（v4 不跑引擎）；'missing'/'empty' 数据或函数缺失。
 */
export function auditVersionCompare(
  engine,
  keys,
  predictOf,
  draws,
  { periods = 100, minTrain = 40 } = {},
) {
  const stats = walkForwardStats(engine, keys, predictOf, draws, { periods, minTrain })
  return keys.map((key) => {
    const s = stats[key]
    if (!s || s.status !== 'ok') return { key, status: s?.status || 'missing', n: 0 }
    const beatRate = s.rates.filter((r) => r > s.expected).length / s.n
    let run = 0
    let longestMiss = 0
    for (const r of s.rates) {
      if (r === 0) {
        run++
        if (run > longestMiss) longestMiss = run
      } else run = 0
    }
    const diff = s.avgHit - s.expected
    const conclusion =
      Math.abs(diff) <= 0.05
        ? '与随机期望持平（符合预期）'
        : diff > 0
          ? '近期波动占优（不保证持续）'
          : '近期波动落后'
    return {
      key,
      status: 'ok',
      n: s.n,
      avgHit: +s.avgHit.toFixed(3),
      expected: +s.expected.toFixed(3),
      beatRate: +(beatRate * 100).toFixed(0),
      longestMiss,
      conclusion,
    }
  })
}
