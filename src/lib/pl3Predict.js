// ============================================================
// 体彩排列三 专用推算引擎（v3 · 多专家集成 + 精确预测分布）
//
// 思路（只作用于排列三，福彩3D / 快乐8 的一行代码都不动）：
//   1. 四个「专家」各自给出每个位置 0-9 的概率：
//      短窗频率(20) / 中窗频率(60) / 长窗频率(200) / 一阶马尔可夫转移
//   2. 四个专家按权重合成每个位置的概率，且都做 Laplace 平滑，避免 0 概率
//   3. 用合成后的位置概率**穷举 1000 种结果**，得到精确的预测分布：
//      - 每个数字至少出现一次的概率 → 取 Top6 作推荐码
//      - 和值 / 跨度分布 → 取「最短且覆盖 80% 概率」的区间（比均值±1σ 更贴合偏态）
//      - 奇偶形态分布 → 取概率最高的 6 个形态（理论覆盖 ~75%，旧版只有 37.5%）
//      - 组三/组六/豹子概率 → 取 Top2
//   4. 位置概率 Top2 → 直选复式推荐
//
// 说明：模型能提高的是「推荐区的覆盖效率」，单注中奖概率由彩票规则决定，
//       任何算法都无法改变 6 码覆盖 3 个开奖号的期望命中 1.8。
// ============================================================

import {
  analyzeDraw,
  buildOddEven,
  build012,
  buildRepeatNeighbor,
  predictFC3D,
  backtestFC3D,
  walkForwardAuditFC3D,
} from './fc3dPredict.js'
import { predictFC3Dv2 as basePredictV2 } from './fc3dPredict.js'

export { analyzeDraw, buildOddEven, build012, buildRepeatNeighbor }
export { predictFC3D, backtestFC3D, walkForwardAuditFC3D }

/** 合成参数（在排列三 1000 期上做 800 期滚动回测挑选，未对单期做特调） */
const CFG = {
  windows: [20, 60, 200],
  // 长窗权重更高：短窗噪声大，长窗对真实频率偏移更稳
  weights: { w20: 0.15, w60: 0.3, w200: 0.35, wMarkov: 0.2 },
  smooth: 1,
  coverSum: 0.8,
  coverSpan: 0.8,
  oddTop: 6,
}

/** Laplace 平滑的位置频率（最新在前） */
function posFreq(draws, pos, N) {
  const arr = Array(10).fill(CFG.smooth)
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n; i++) arr[draws[i].num[pos]]++
  const total = arr.reduce((a, b) => a + b, 0)
  return arr.map((v) => v / total)
}

/** 一阶转移（平滑到该位置的长期频率） */
function posMarkov(draws, pos, N) {
  const freq = posFreq(draws, pos, N)
  const M = Array.from({ length: 10 }, () => Array(10).fill(0))
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n - 1; i++) M[draws[i + 1].num[pos]][draws[i].num[pos]]++
  return M.map((row) => {
    const s = row.reduce((a, b) => a + b, 0)
    return row.map((v, j) => (v + 2 * freq[j]) / (s + 2))
  })
}

/** 四个专家在某个位置上的概率分布 */
function expertProbs(draws, pos) {
  const [n1, n2, n3] = CFG.windows
  const f1 = posFreq(draws, pos, n1)
  const f2 = posFreq(draws, pos, n2)
  const f3 = posFreq(draws, pos, n3)
  const mk = posMarkov(draws, pos, n2)
  const last = draws[0].num[pos]
  const w = CFG.weights
  return f1.map(
    (v, d) => w.w20 * v + w.w60 * f2[d] + w.w200 * f3[d] + w.wMarkov * mk[last][d],
  )
}

/** 穷举 1000 种结果，得到和值 / 跨度 / 形态 / 奇偶的精确预测分布 */
function enumerateDistributions(probs) {
  const sumDist = Array(28).fill(0)
  const spanDist = Array(10).fill(0)
  const formDist = { 豹子: 0, 组三: 0, 组六: 0 }
  const oddDist = {}
  const isOdd = (d) => d % 2 === 1

  for (let a = 0; a < 10; a++) {
    const pa = probs[0][a]
    if (!pa) continue
    for (let b = 0; b < 10; b++) {
      const pab = pa * probs[1][b]
      if (!pab) continue
      for (let c = 0; c < 10; c++) {
        const p = pab * probs[2][c]
        if (!p) continue
        const sum = a + b + c
        const span = Math.max(a, b, c) - Math.min(a, b, c)
        sumDist[sum] += p
        spanDist[span] += p
        const uniq = new Set([a, b, c]).size
        formDist[uniq === 1 ? '豹子' : uniq === 2 ? '组三' : '组六'] += p
        const pat = `${isOdd(a) ? '奇' : '偶'}${isOdd(b) ? '奇' : '偶'}${isOdd(c) ? '奇' : '偶'}`
        oddDist[pat] = (oddDist[pat] || 0) + p
      }
    }
  }
  return { sumDist, spanDist, formDist, oddDist }
}

/** 最短的、累计概率 ≥ target 的连续区间 */
function shortestInterval(dist, lo, hi, target) {
  let best = null
  for (let a = lo; a <= hi; a++) {
    let acc = 0
    for (let b = a; b <= hi; b++) {
      acc += dist[b]
      if (acc >= target) {
        if (!best || b - a < best[1] - best[0]) best = [a, b]
        break
      }
    }
  }
  return best || [lo, hi]
}

function modeOf(arr) {
  const m = new Map()
  let best = arr[0]
  let bestN = 0
  for (const v of arr) {
    const n = (m.get(v) || 0) + 1
    m.set(v, n)
    if (n > bestN) {
      bestN = n
      best = v
    }
  }
  return best
}

/**
 * 覆盖档位：选 k 个号时，期望命中恒为 k × 30%（与选哪 k 个号无关）。
 * 这里只负责算清楚「命中多少」和「要花多少钱」，让性价比一眼可见。
 */
function buildTiers(rankedDigits) {
  return [6, 7, 8].map((k) => {
    const groupBets = (k * (k - 1) * (k - 2)) / 6 // 组选复式注数 C(k,3)
    const directBets = k * k * k // 直选复式注数 k³
    return {
      cover: k,
      codes: rankedDigits.slice(0, k).map((x) => x.digit),
      expectHits: +(k * 0.3).toFixed(1),
      fullCoverRate: +((k / 10) ** 3 * 100).toFixed(1), // 3 个开奖号全落在覆盖内的概率
      groupBets,
      groupCost: groupBets * 2,
      directBets,
      directCost: directBets * 2,
      costPerHit: +((groupBets * 2) / (k * 0.3)).toFixed(1),
    }
  })
}

/**
 * 排列三下期推算（字段与 3D v2 完全兼容，页面可直接复用）。
 * cover：覆盖码数（6/7/8），只影响推荐码的个数，不影响任何单注概率。
 */
export function predictFC3Dv2(draws, { cover = 6 } = {}) {
  const base = basePredictV2(draws)
  if (!base) return null
  if (draws.length < 10) return base

  // --- 1. 合成每个位置的概率，并穷举得到精确预测分布 ---
  const posProb = [0, 1, 2].map((pos) => expertProbs(draws, pos))
  const { sumDist, spanDist, formDist, oddDist } = enumerateDistributions(posProb)

  // --- 2. 选码：数字「至少出现一次」的概率（位置独立） ---
  const appearProb = Array.from({ length: 10 }, (_, d) =>
    1 - posProb.reduce((acc, p) => acc * (1 - p[d]), 1),
  )
  const rankedDigits = appearProb
    .map((p, d) => ({ digit: d, score: +(p * 100).toFixed(2) }))
    .sort((a, b) => b.score - a.score)
  const dan = rankedDigits.slice(0, 2).map((x) => x.digit)
  const tuo = rankedDigits.slice(2, Math.max(6, cover)).map((x) => x.digit)
  const tiers = buildTiers(rankedDigits)

  const posTop = posProb.map((p) =>
    p
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map((x) => x.d),
  )

  // 展示用综合排名：数字出现概率 + 原有热冷评分
  const baseScore = new Map(base.ranked.map((r) => [r.digit, r.score]))
  const maxBase = Math.max(...base.ranked.map((r) => r.score), 1)
  const ranked = rankedDigits
    .map((r) => ({
      digit: r.digit,
      score: +(r.score * 0.7 + (baseScore.get(r.digit) / maxBase) * 30).toFixed(2),
    }))
    .sort((a, b) => b.score - a.score)

  // --- 3. 和值 / 跨度：最短的 75% 覆盖区间 ---
  const sumRange = shortestInterval(sumDist, 0, 27, CFG.coverSum)
  const spanRange = shortestInterval(spanDist, 0, 9, CFG.coverSpan)

  const sums = draws.slice(0, 300).map((d) => analyzeDraw(d.num).sum)
  const spans = draws.slice(0, 300).map((d) => analyzeDraw(d.num).span)

  // --- 4. 奇偶：概率最高的 6 个形态 ---
  const recommendedOdd = Object.entries(oddDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CFG.oddTop)
    .map(([pat]) => pat)

  // --- 5. 形态：概率最高的 Top2 ---
  const recommendedForms = Object.entries(formDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([f]) => f)

  const hot = ranked.slice(0, 3).map((r) => r.digit)
  const cold = ranked.slice(-3).map((r) => r.digit)

  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: base.omit[r.digit],
    reason: base.omit[r.digit] <= 1 ? '刚开出，短期重复概率低' : '综合概率垫底，可排除',
  }))

  return {
    ...base,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    posTop,
    sumRange,
    spanRange,
    sumAvg: +(sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1),
    spanAvg: +(spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1),
    sumMode: modeOf(sums),
    spanMode: modeOf(spans),
    recommendedOdd,
    recommendedForms,
    oddEven: { ...buildOddEven(draws, 50), ranked: base.oddEven.ranked, recommendedPatterns: recommendedOdd },
    kill,
    cover,
    tiers,
    algorithm: 'pl3-v3',
  }
}

/** 单期回算 */
export function backtestFC3Dv2(draws) {
  if (draws.length < 11) return null
  const train = draws.slice(1)
  const actual = draws[0]
  const pred = predictFC3Dv2(train)
  if (!pred) return null
  const a = analyzeDraw(actual.num)
  const allRec = [...pred.dan, ...pred.tuo]
  const hits = actual.num.filter((d) => allRec.includes(d))
  const spanHit = a.span >= pred.spanRange[0] && a.span <= pred.spanRange[1]
  const sumHit = a.sum >= pred.sumRange[0] && a.sum <= pred.sumRange[1]
  const oddHit = pred.recommendedOdd.includes(a.oddPattern)
  const formHit = pred.recommendedForms.includes(a.form)
  return {
    actualDraw: actual,
    actualAnalysis: a,
    prediction: pred,
    danHits: pred.dan.filter((d) => actual.num.includes(d)),
    tuoHits: pred.tuo.filter((d) => actual.num.includes(d)),
    digitHits: hits,
    digitHitCount: hits.length,
    spanHit,
    sumHit,
    oddHit,
    formHit,
    score:
      (hits.length === 3 ? 40 : hits.length === 2 ? 20 : hits.length === 1 ? 8 : 0) +
      (spanHit ? 15 : 0) +
      (sumHit ? 15 : 0) +
      (oddHit ? 15 : 0) +
      (formHit ? 15 : 0),
  }
}

/** 滚动回测（方法体检页使用） */
export function walkForwardAuditFC3Dv2(draws, { periods = 50, minTrain = 20 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  if (n <= 0) {
    return {
      periods: 0,
      rows: [],
      dist: [],
      avgHits: 0,
      baseline: 0,
      spanRate: 0,
      sumRate: 0,
      oddRate: 0,
      formRate: 0,
    }
  }
  const rows = []
  for (let i = 0; i < n; i++) {
    const actual = draws[i]
    const train = draws.slice(i + 1)
    if (train.length < minTrain) break
    const pred = predictFC3Dv2(train)
    if (!pred) continue
    const a = analyzeDraw(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.filter((d) => allRec.includes(d))
    const spanHit = a.span >= pred.spanRange[0] && a.span <= pred.spanRange[1]
    const sumHit = a.sum >= pred.sumRange[0] && a.sum <= pred.sumRange[1]
    const oddHit = pred.recommendedOdd.includes(a.oddPattern)
    const formHit = pred.recommendedForms.includes(a.form)
    rows.push({
      draw: actual,
      prediction: pred,
      hits: hits.length,
      hitNums: hits,
      danHits: pred.dan.filter((d) => actual.num.includes(d)).length,
      spanHit,
      sumHit,
      oddHit,
      formHit,
      score:
        (hits.length === 3 ? 40 : hits.length === 2 ? 20 : hits.length === 1 ? 8 : 0) +
        (spanHit ? 15 : 0) +
        (sumHit ? 15 : 0) +
        (oddHit ? 15 : 0) +
        (formHit ? 15 : 0),
    })
  }
  const total = rows.length
  const dist = [0, 1, 2, 3].map((k) => ({
    k,
    count: rows.filter((r) => r.hits === k).length,
  }))
  const pct = (c) => (total ? +((c / total) * 100).toFixed(0) : 0)
  return {
    periods: total,
    rows,
    dist,
    avgHits: total ? +(rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(2) : 0,
    baseline: 1.8,
    spanRate: pct(rows.filter((r) => r.spanHit).length),
    sumRate: pct(rows.filter((r) => r.sumHit).length),
    oddRate: pct(rows.filter((r) => r.oddHit).length),
    formRate: pct(rows.filter((r) => r.formHit).length),
  }
}
