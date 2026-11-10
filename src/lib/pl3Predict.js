// ============================================================
// 体彩排列三 专用推算引擎（v3）
//
// 与福彩3D的 v2 相比，只改「决策层」，不改动 3D / 快乐8 的任何逻辑：
//   1. 选码：先估计每个数字「至少出现一次」的概率
//      p(d) = 1 - Π位置 (1 - p位置(d))，再取 Top6
//      每个位置的概率用 短窗频率 / 长窗频率 / 一阶转移 三者混合（Laplace 平滑）
//   2. 和值、跨度：用近 300 期的经验分布取中央 70% 分位区间
//      （原来用均值±1σ，遇到偏态分布会漏掉高频段）
//   3. 奇偶：按「理论概率 + 近期频率」排序取 Top6 形态，覆盖约 72%~75%
//      （原来只取 3 个形态，理论覆盖上限只有 37.5%）
//   4. 形态：近 300 期出现最多的 Top2（组六 + 组三）
//
// 说明：任何模型都不能改变单注中奖概率，这里优化的是「推荐区的覆盖效率」。
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

/** 调和参数（用排列三 1000 期滚动回测挑选） */
const CFG = {
  nShort: 30,
  nLong: 100,
  wShort: 0.55,
  wLong: 0.35,
  wTrans: 0.1,
  smooth: 1,
  sumWindow: 300,
  spanWindow: 300,
  quantile: 0.15, // 两侧各去掉 15% → 中央 70%
  oddTop: 6,
  formWindow: 300,
}

/** Laplace 平滑的位置频率（最新在前） */
function posFreq(draws, pos, N) {
  const arr = Array(10).fill(CFG.smooth)
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n; i++) arr[draws[i].num[pos]]++
  const total = arr.reduce((a, b) => a + b, 0)
  return arr.map((v) => v / total)
}

/** 一阶转移概率（平滑到该位置的频率分布） */
function posTransition(draws, pos, N) {
  const freq = posFreq(draws, pos, N)
  const M = Array.from({ length: 10 }, () => Array(10).fill(0))
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n - 1; i++) {
    M[draws[i + 1].num[pos]][draws[i].num[pos]]++
  }
  return M.map((row) => {
    const s = row.reduce((a, b) => a + b, 0)
    return row.map((v, j) => (v + 2 * freq[j]) / (s + 2))
  })
}

/** 某位置下期各数字的概率（短窗 + 长窗 + 转移混合） */
function mixPosProb(draws, pos) {
  const fs = posFreq(draws, pos, CFG.nShort)
  const fl = posFreq(draws, pos, CFG.nLong)
  const M = posTransition(draws, pos, CFG.nLong)
  const last = draws[0].num[pos]
  return fs.map(
    (v, d) => CFG.wShort * v + CFG.wLong * fl[d] + CFG.wTrans * M[last][d],
  )
}

/** 中央分位区间（去掉两端各 q，保留中间概率密度最高的部分） */
function quantileInterval(values, q = CFG.quantile) {
  if (!values.length) return [0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  const lo = sorted[Math.floor(sorted.length * q)]
  const hi = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * (1 - q)) - 1)]
  return [lo, Math.max(lo, hi)]
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
 * 排列三下期推算（字段与 3D v2 完全兼容，页面可直接复用）。
 */
export function predictFC3Dv2(draws) {
  const base = basePredictV2(draws)
  if (!base) return null
  if (draws.length < 10) return base

  const recentAll = draws.slice(0, CFG.formWindow)

  // --- 选码：数字「至少出现一次」的概率 ---
  const posProb = [0, 1, 2].map((pos) => mixPosProb(draws, pos))
  const appearProb = Array.from({ length: 10 }, (_, d) =>
    1 - posProb.reduce((acc, p) => acc * (1 - p[d]), 1),
  )
  const rankedDigits = appearProb
    .map((p, d) => ({ digit: d, score: +(p * 100).toFixed(2) }))
    .sort((a, b) => b.score - a.score)
  const dan = rankedDigits.slice(0, 2).map((x) => x.digit)
  const tuo = rankedDigits.slice(2, 6).map((x) => x.digit)

  const posTop = posProb.map((p) =>
    p
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map((x) => x.d),
  )

  // 展示用的综合排名：把「至少出现一次」概率与原有热冷评分融合
  const baseScore = new Map(base.ranked.map((r) => [r.digit, r.score]))
  const maxBase = Math.max(...base.ranked.map((r) => r.score), 1)
  const ranked = rankedDigits
    .map((r) => ({
      digit: r.digit,
      score: +(r.score * 0.7 + (baseScore.get(r.digit) / maxBase) * 30).toFixed(2),
    }))
    .sort((a, b) => b.score - a.score)

  // --- 和值 / 跨度：经验分布中央 70% ---
  const sums = recentAll.map((d) => analyzeDraw(d.num).sum)
  const spans = recentAll.map((d) => analyzeDraw(d.num).span)
  const sumRange = quantileInterval(sums)
  const spanRange = quantileInterval(spans)

  // --- 奇偶：Top6 形态 ---
  const oddEven = buildOddEven(draws, 50)
  const recommendedOdd = oddEven.ranked.slice(0, CFG.oddTop).map((p) => p.pattern)

  // --- 形态：近 300 期 Top2 ---
  const formDist = {}
  recentAll.forEach((d) => {
    const f = analyzeDraw(d.num).form
    formDist[f] = (formDist[f] || 0) + 1
  })
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
    oddEven: { ...oddEven, recommendedPatterns: recommendedOdd },
    kill,
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
