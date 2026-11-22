// ============================================================
// 体彩七星彩推算引擎（前 6 位 0–9 + 后区 0–14，共 15,000,000 种）
//
// 结构与排列五 v3 Pro 同源：逐位 9 专家 + Hedge 自适应权重，再用结构模型
// （和值/跨度/不同数字个数/奇数个数/和值尾/与上期重号数）做软加权。
//
// 与排列五的区别：
//   1. 末尾位置取值范围是 0–14，不能按 10 个数字处理；
//   2. 全部组合 10^7 级，不能穷举，改为「每个位置取概率最高的 K 个值」
//      再做笛卡尔积（默认 K=4，4^7 = 16384 注）排序。
//      因此 Top 组合只在候选集内排序，不代表真实单注概率提高。
//
// ⚠️ 七星彩每注概率恒为 1/15,000,000，任何算法都无法提高单注概率。
// ============================================================

import { QXC_LEVELS } from './odds.js'

/** 位置标签：一、二、三、四、五、六、后 */
export const QXC_POS = ['一', '二', '三', '四', '五', '六', '后']

/** 每个位置的可取值：前 6 位 0–9，后区 0–14 */
export const QXC_VALUES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
]

export const PRO = {
  hedge: { lookback: 24, eta: 0.8, minWeight: 0.02 },
  gapBlend: 0.9,
  markov2Smooth: 3,
  structWindow: 120,
  structBlend: 0.2,
  structBeta: 0.45,
  topK: 4,
  topCombos: 10,
}

/** 不同数字个数 → 形态名（七星彩有 7 个位置，用「种类数」描述更直观） */
const FORM_NAMES = ['全同', '2种数字', '3种数字', '4种数字', '5种数字', '6种数字', '全不同']

const norm = (arr) => {
  const t = arr.reduce((a, b) => a + b, 0) || 1
  return arr.map((v) => v / t)
}

const valueCount = (pos) => QXC_VALUES[pos].length

/** 窗口频率（Laplace 平滑），按该位置实际取值个数建表 */
function posFreq(draws, pos, N, smooth = 1) {
  const V = valueCount(pos)
  const arr = Array(V).fill(smooth)
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n; i++) {
    const v = draws[i].num[pos]
    if (v >= 0 && v < V) arr[v]++
  }
  return norm(arr)
}

/** 一阶转移：只算当前数字这一行 */
function markov1Next(draws, pos, N) {
  const V = valueCount(pos)
  const n = Math.min(N, draws.length)
  const f = posFreq(draws, pos, N)
  const cur = draws[0].num[pos]
  const row = Array(V).fill(0)
  for (let i = 0; i < n - 1; i++) {
    if (draws[i + 1].num[pos] === cur) {
      const v = draws[i].num[pos]
      if (v >= 0 && v < V) row[v]++
    }
  }
  return norm(row.map((v, j) => v + 2 * f[j]))
}

/** 二阶转移：上下文为最近两期该位数字，样本稀疏时退回一阶 */
function markov2Next(draws, pos, N) {
  const V = valueCount(pos)
  const n = Math.min(N, draws.length)
  if (n < 6) return markov1Next(draws, pos, N)
  const m1 = markov1Next(draws, pos, N)
  const cur = draws[0].num[pos]
  const prev = draws[1].num[pos]
  const row = Array(V).fill(0)
  for (let i = 0; i < n - 2; i++) {
    if (draws[i + 1].num[pos] === cur && draws[i + 2].num[pos] === prev) {
      const v = draws[i].num[pos]
      if (v >= 0 && v < V) row[v]++
    }
  }
  const k = PRO.markov2Smooth
  return norm(row.map((v, j) => v + k * m1[j]))
}

/** 遗漏回补：当前遗漏相对该位置的几何期望做 tanh 压缩 */
function gapNext(draws, pos) {
  const V = valueCount(pos)
  const omit = Array(V).fill(draws.length)
  for (let i = 0; i < draws.length; i++) {
    const v = draws[i].num[pos]
    if (v >= 0 && v < V && omit[v] === draws.length) omit[v] = i
  }
  const f = posFreq(draws, pos, draws.length)
  return norm(f.map((v, d) => v * (1 + PRO.gapBlend * Math.tanh((omit[d] - V) / V))))
}

/** 周期邻距：相邻两期该位在取值环上的距离分布 */
function ringNext(draws, pos) {
  const V = valueCount(pos)
  const half = Math.floor(V / 2)
  const hist = Array(half + 1).fill(1)
  for (let i = 0; i < draws.length - 1; i++) {
    const a = draws[i].num[pos]
    const b = draws[i + 1].num[pos]
    if (a < 0 || a >= V || b < 0 || b >= V) continue
    const diff = Math.abs(a - b)
    hist[Math.min(diff, V - diff)]++
  }
  const total = hist.reduce((a, b) => a + b, 0)
  const last = draws[0].num[pos]
  const dist = Array(V).fill(0)
  const ringCount = Array(half + 1).fill(0)
  for (let d = 0; d < V; d++) {
    const k = Math.min(Math.abs(d - last), V - Math.abs(d - last))
    dist[d] = k
    ringCount[k]++
  }
  return norm(dist.map((k) => hist[k] / total / ringCount[k]))
}

/** 冷热反转：近期越冷，基础概率略高 */
function contrarianNext(draws, pos) {
  const V = valueCount(pos)
  const f = posFreq(draws, pos, 60)
  const base = 1 / V
  return norm(f.map((v) => Math.max(base * 0.2, base + (base - v) * 1.5)))
}

export const PRO_EXPERTS = [
  { key: 'w20', name: '短窗频率 20', fn: (d, p) => posFreq(d, p, 20) },
  { key: 'w60', name: '中窗频率 60', fn: (d, p) => posFreq(d, p, 60) },
  { key: 'w200', name: '长窗频率 200', fn: (d, p) => posFreq(d, p, 200) },
  { key: 'w500', name: '超长窗 500', fn: (d, p) => posFreq(d, p, 500) },
  { key: 'markov1', name: '一阶转移', fn: (d, p) => markov1Next(d, p, 200) },
  { key: 'markov2', name: '二阶转移', fn: (d, p) => markov2Next(d, p, 200) },
  { key: 'gap', name: '遗漏回补', fn: (d, p) => gapNext(d, p) },
  { key: 'ring', name: '周期邻距', fn: (d, p) => ringNext(d, p) },
  { key: 'contrarian', name: '冷热反转', fn: (d, p) => contrarianNext(d, p) },
]

/** Hedge 自适应权重：按各专家最近 N 期对数损失指数加权 */
export function proHedge(draws, pos) {
  const K = PRO_EXPERTS.length
  const losses = Array(K).fill(0)
  const counts = Array(K).fill(0)
  let used = 0
  for (let t = 1; t <= PRO.hedge.lookback; t++) {
    const hist = draws.slice(t)
    if (hist.length < 20) break
    const actual = draws[t - 1].num[pos]
    for (let i = 0; i < K; i++) {
      const p = PRO_EXPERTS[i].fn(hist, pos)
      losses[i] += -Math.log(Math.min(0.999, Math.max(1e-4, p[actual] || 1e-4)))
      counts[i]++
    }
    used++
  }
  if (!used) return Array(K).fill(1 / K)
  const avg = losses.map((l, i) => (counts[i] ? l / counts[i] : Math.log(valueCount(pos))))
  const best = Math.max(...avg)
  const raw = avg.map((a) => Math.exp(-PRO.hedge.eta * (a - best)))
  const sum = raw.reduce((a, b) => a + b, 0)
  const w = raw.map((v) => Math.max(PRO.hedge.minWeight, v / sum))
  const ws = w.reduce((a, b) => a + b, 0)
  return w.map((v) => v / ws)
}

/** 逐位概率：9 专家按 Hedge 权重混合（weightsOverride 提供时替代现算权重） */
function positionProbs(draws, weightsOverride = null) {
  const positions = [0, 1, 2, 3, 4, 5, 6]
  const weights = positions.map((pos) =>
    weightsOverride && Array.isArray(weightsOverride[pos]) && weightsOverride[pos].length === PRO_EXPERTS.length
      ? weightsOverride[pos]
      : proHedge(draws, pos),
  )
  const probs = positions.map((pos) => {
    const w = weights[pos]
    const out = Array(valueCount(pos)).fill(0)
    PRO_EXPERTS.forEach((e, i) => {
      const p = e.fn(draws, pos)
      for (let d = 0; d < out.length; d++) out[d] += w[i] * p[d]
    })
    return norm(out)
  })
  return { weights, probs }
}

/** 7 位号码的结构特征 */
function structOf(digits, prev) {
  let sum = 0
  let odd = 0
  let min = 14
  let max = 0
  const counts = Array(15).fill(0)
  for (let i = 0; i < 7; i++) {
    const d = digits[i]
    sum += d
    if (d % 2 === 1) odd++
    if (d < min) min = d
    if (d > max) max = d
    counts[d]++
  }
  const uniq = counts.filter((v) => v > 0).length
  let rep = 0
  if (prev) {
    const pool = [...prev]
    for (let i = 0; i < 7; i++) {
      const idx = pool.indexOf(digits[i])
      if (idx >= 0) {
        pool.splice(idx, 1)
        rep++
      }
    }
  }
  return { sum, span: max - min, form: uniq - 1, odd, tail: sum % 10, rep }
}

/** 结构特征的经验分布（Laplace 平滑） */
function structDist(draws, key, size) {
  const arr = Array(size).fill(1)
  let n = 0
  for (let i = 0; i < draws.length; i++) {
    if (key === 'rep' && !draws[i + 1]) continue
    const s = structOf(draws[i].num, draws[i + 1]?.num || null)
    if (s[key] < 0 || s[key] >= size) continue
    arr[s[key]]++
    n++
  }
  return arr.map((v) => v / (n + size))
}

/** 近期 + 长期混合的结构模型 */
function buildStructModel(draws) {
  const recent = draws.slice(0, PRO.structWindow)
  const shape = [
    ['span', 15],
    ['sum', 69],
    ['form', 7],
    ['odd', 8],
    ['tail', 10],
    ['rep', 8],
  ]
  const model = {}
  for (const [key, size] of shape) {
    const a = structDist(recent, key, size)
    const b = structDist(draws, key, size)
    model[key] = a.map((v, i) => PRO.structBlend * v + (1 - PRO.structBlend) * b[i])
  }
  return model
}

function structLogProb(s, model) {
  return (
    Math.log(model.span[s.span]) +
    Math.log(model.sum[s.sum]) +
    Math.log(model.form[s.form]) +
    Math.log(model.odd[s.odd]) +
    Math.log(model.tail[s.tail]) +
    Math.log(model.rep[s.rep])
  )
}

/** 最短区间覆盖 target 比例的分布质量 */
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

/** 单个 7 位号码的统计特征（页面展示用） */
export function analyzeDrawQXC(num) {
  const s = structOf(num, null)
  return {
    sum: s.sum,
    span: s.span,
    sumTail: s.tail,
    oddCount: s.odd,
    oddPattern: num.map((d) => (d % 2 === 1 ? '奇' : '偶')).join(''),
    form: FORM_NAMES[s.form] || '—',
    uniq: new Set(num).size,
    primeCount: num.filter((d) => [2, 3, 5, 7, 11, 13].includes(d)).length,
  }
}

/** i → 7 位候选组合 */
function comboOf(i, cand) {
  const out = Array(7)
  let t = i
  for (let k = 6; k >= 0; k--) {
    const len = cand[k].length
    out[k] = cand[k][t % len].v
    t = Math.floor(t / len)
  }
  return out
}

/**
 * 七星彩下期推算。
 * 返回字段与排列五 Pro 尽量同构；后区额外提供 backRanked / backTop。
 */
export function predictQXC(
  draws,
  { cover = 6, beta = PRO.structBeta, coverRate = 0.8, weightsOverride = null, topK = PRO.topK } = {},
) {
  if (!Array.isArray(draws) || draws.length < 20) return null

  const { weights, probs } = positionProbs(draws, weightsOverride)
  const model = buildStructModel(draws)
  const prev = draws[0]?.num || null

  // --- 逐位取 Top-K，笛卡尔积枚举 ---
  const k = Math.max(2, Math.min(6, topK))
  const cand = probs.map((p) => {
    const items = p.map((v, idx) => ({ v: idx, p: v }))
    items.sort((a, b) => b.p - a.p)
    return items.slice(0, Math.min(k, items.length))
  })
  const N = cand.reduce((s, c) => s * c.length, 1)
  const p0 = new Float64Array(N)
  const lp = new Float64Array(N)

  let meanLp = 0
  for (let i = 0; i < N; i++) {
    const ds = comboOf(i, cand)
    let prob = 1
    for (let pos = 0; pos < 7; pos++) {
      const hit = cand[pos].find((x) => x.v === ds[pos])
      prob *= hit ? hit.p : 0
    }
    p0[i] = prob
    const s = structOf(ds, prev)
    lp[i] = structLogProb(s, model)
    meanLp += lp[i]
  }
  meanLp /= N
  let varLp = 0
  for (let i = 0; i < N; i++) varLp += (lp[i] - meanLp) ** 2
  const sdLp = Math.sqrt(varLp / N) || 1

  const sumDist = Array(69).fill(0)
  const spanDist = Array(15).fill(0)
  const formDist = Array(7).fill(0)
  const oddDist = {}
  const posMarg = probs.map((p) => Array(p.length).fill(0))
  const pArr = new Float64Array(N)
  let total = 0
  for (let i = 0; i < N; i++) {
    const z = Math.max(-3, Math.min(3, (lp[i] - meanLp) / sdLp))
    const w = p0[i] * Math.exp(beta * z)
    pArr[i] = w
    total += w
  }
  total = total || 1
  for (let i = 0; i < N; i++) {
    const p = pArr[i] / total
    pArr[i] = p
    const ds = comboOf(i, cand)
    const s = structOf(ds, prev)
    sumDist[s.sum] += p
    spanDist[s.span] += p
    formDist[s.form] += p
    const pat = ds.map((d) => (d % 2 === 1 ? '奇' : '偶')).join('')
    oddDist[pat] = (oddDist[pat] || 0) + p
    for (let pos = 0; pos < 7; pos++) posMarg[pos][ds[pos]] += p
  }

  // --- 前区排名 / 后区排名 ---
  const frontAppear = Array(10).fill(0)
  for (let pos = 0; pos < 6; pos++) {
    for (let d = 0; d < 10; d++) frontAppear[d] += posMarg[pos][d]
  }
  const rankedDigits = frontAppear
    .map((p, d) => ({ digit: d, score: +(p * 100).toFixed(2) }))
    .sort((a, b) => b.score - a.score)
  const dan = rankedDigits.slice(0, 2).map((x) => x.digit)
  const tuo = rankedDigits.slice(2, Math.max(6, cover)).map((x) => x.digit)

  const backRanked = posMarg[6]
    .map((p, d) => ({ digit: d, score: +(p * 100).toFixed(2) }))
    .sort((a, b) => b.score - a.score)
  const backTop = backRanked.slice(0, 3).map((x) => x.digit)

  const posTop = posMarg.map((p, pos) =>
    p
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, pos === 6 ? 3 : 2)
      .map((x) => x.d),
  )

  // 遗漏值：前区数字与后区号码分别统计
  const omitFront = Array(10).fill(draws.length)
  for (let i = 0; i < draws.length; i++) {
    for (let pos = 0; pos < 6; pos++) {
      const v = draws[i].num[pos]
      if (v >= 0 && v <= 9 && omitFront[v] === draws.length) omitFront[v] = i
    }
  }
  const omitBack = Array(15).fill(draws.length)
  for (let i = 0; i < draws.length; i++) {
    const v = draws[i].num[6]
    if (v >= 0 && v <= 14 && omitBack[v] === draws.length) omitBack[v] = i
  }
  const ranked = rankedDigits.map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omitFront[r.digit],
  }))
  const backRankedWithOmit = backRanked.map((r) => ({ ...r, omit: omitBack[r.digit] }))

  const topIdx = []
  for (let i = 0; i < N; i++) {
    if (topIdx.length < PRO.topCombos) {
      topIdx.push(i)
      if (topIdx.length === PRO.topCombos) topIdx.sort((a, b) => pArr[b] - pArr[a])
    } else if (pArr[i] > pArr[topIdx[PRO.topCombos - 1]]) {
      topIdx[PRO.topCombos - 1] = i
      topIdx.sort((a, b) => pArr[b] - pArr[a])
    }
  }
  const topCombos = topIdx.map((i, idx) => {
    const ds = comboOf(i, cand)
    const s = structOf(ds, prev)
    return {
      rank: idx + 1,
      num: ds,
      prob: +(pArr[i] * 100).toFixed(4),
      lift: +(pArr[i] / (p0[i] || 1e-12)).toFixed(2),
      sum: s.sum,
      span: s.span,
      form: FORM_NAMES[s.form] || '—',
    }
  })

  const sumRange = shortestInterval(sumDist, 0, 68, coverRate)
  const spanRange = shortestInterval(spanDist, 0, 14, coverRate)
  const recommendedOdd = Object.entries(oddDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([pat]) => pat)
  const recommendedForms = formDist
    .map((v, i) => ({ name: FORM_NAMES[i], v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map((x) => x.name)

  const sums = draws.slice(0, 300).map((d) => analyzeDrawQXC(d.num).sum)
  const spans = draws.slice(0, 300).map((d) => analyzeDrawQXC(d.num).span)

  const hot = ranked.slice(0, 3).map((r) => r.digit)
  const cold = ranked.slice(-3).map((r) => r.digit)
  const kill = rankedDigits.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omitFront[r.digit],
    confidence: +Math.max(0, ((10 - r.score) / 10) * 100).toFixed(0),
    reason: omitFront[r.digit] <= 1 ? '刚开出，短期重复概率低' : '综合概率垫底，可排除',
  }))

  const directPlan = {
    pos: posTop,
    posLabels: QXC_POS,
    bets: posTop.reduce((s, p) => s * p.length, 1),
    cost: posTop.reduce((s, p) => s * p.length, 1) * 2,
  }

  return {
    drawId: draws[0].id,
    nextId: Number(draws[0].id) + 1,
    lastDraw: draws[0],
    lastAnalysis: analyzeDrawQXC(draws[0].num),
    omit: Object.fromEntries(omitFront.map((v, d) => [d, v])),
    omitBack: Object.fromEntries(omitBack.map((v, d) => [d, v])),
    hot,
    cold,
    dan,
    tuo,
    ranked,
    posTop,
    posLabels: QXC_POS,
    backRanked: backRankedWithOmit,
    backTop,
    sumRange,
    spanRange,
    sumAvg: +(sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1),
    spanAvg: +(spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1),
    sumMode: modeOf(sums),
    spanMode: modeOf(spans),
    recommendedOdd,
    recommendedForms,
    coverRate,
    oddTotal: 128,
    kill,
    cover,
    topCombos,
    candidateCount: N,
    expertWeights: PRO_EXPERTS.map((e, i) => ({
      key: e.key,
      name: e.name,
      weight: +((weights.reduce((s, w) => s + w[i], 0) / 7) * 100).toFixed(1),
    })).sort((a, b) => b.weight - a.weight),
    structBeta: beta,
    directPlan,
    algorithm: 'qxc-pro',
  }
}

/**
 * 单注七星彩中奖判定（按一→六顺序）。
 * bet / draw 均为 7 位数组；返回 level=0 表示未中奖。
 */
export function judgeQXC(bet, draw) {
  if (!Array.isArray(bet) || !Array.isArray(draw) || bet.length !== 7 || draw.length !== 7) {
    return { level: 0, name: '无效号码', prize: 0, floating: false, frontHits: 0, backHit: false }
  }
  let frontHits = 0
  for (let i = 0; i < 6; i++) if (bet[i] === draw[i]) frontHits++
  const backHit = bet[6] === draw[6]
  const base = { frontHits, backHit }
  const pick = (idx) => {
    const row = QXC_LEVELS[idx]
    return {
      ...base,
      level: idx + 1,
      name: row.level,
      prize: row.prize,
      floating: !!row.floating,
      prizeNote: row.prizeNote || '',
    }
  }
  if (frontHits === 6 && backHit) return pick(0)
  if (frontHits === 6) return pick(1)
  if (frontHits === 5 && backHit) return pick(2)
  if ((frontHits === 5 && !backHit) || (frontHits === 4 && backHit)) return pick(3)
  if ((frontHits === 4 && !backHit) || (frontHits === 3 && backHit)) return pick(4)
  if ((frontHits === 3 && !backHit) || (frontHits <= 2 && backHit)) return pick(5)
  return { ...base, level: 0, name: '未中奖', prize: 0, floating: false, prizeNote: '' }
}

/** 单期回算 */
export function backtestQXC(draws) {
  if (!Array.isArray(draws) || draws.length < 21) return null
  const pred = predictQXC(draws.slice(1))
  if (!pred) return null
  const actual = draws[0]
  const a = analyzeDrawQXC(actual.num)
  const allRec = [...pred.dan, ...pred.tuo]
  const frontHits = actual.num.slice(0, 6).filter((d) => allRec.includes(d)).length
  const backHitRec = pred.backTop.includes(actual.num[6])
  const posHit = actual.num.filter((d, i) => pred.posTop[i]?.includes(d)).length
  const inTop = pred.topCombos.some((c) => c.num.join('|') === actual.num.join('|'))
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
    digitHits: actual.num.slice(0, 6).filter((d) => allRec.includes(d)),
    digitHitCount: frontHits + (backHitRec ? 1 : 0),
    posHitCount: posHit,
    inTopCombos: inTop,
    spanHit,
    sumHit,
    oddHit,
    formHit,
    score:
      frontHits * 10 +
      (backHitRec ? 10 : 0) +
      (spanHit ? 15 : 0) +
      (sumHit ? 15 : 0) +
      (oddHit ? 10 : 0) +
      (formHit ? 10 : 0),
  }
}

/** 滚动回测（方法体检页使用），字段与排列五对齐 */
export function walkForwardAuditQXC(draws, { periods = 30, minTrain = 40 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  const empty = {
    periods: 0,
    rows: [],
    dist: [],
    avgHits: 0,
    baseline: 3.8,
    spanRate: 0,
    sumRate: 0,
    oddRate: 0,
    formRate: 0,
    posRate: 0,
    posAvg: 0,
    topRate: 0,
  }
  if (n <= 0) return empty
  const rows = []
  for (let i = 0; i < n; i++) {
    const actual = draws[i]
    const train = draws.slice(i + 1)
    if (train.length < minTrain) break
    const pred = predictQXC(train)
    if (!pred) continue
    const a = analyzeDrawQXC(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.slice(0, 6).filter((d) => allRec.includes(d)).length
    rows.push({
      draw: actual,
      prediction: pred,
      hits: hits + (pred.backTop.includes(actual.num[6]) ? 1 : 0),
      hitNums: actual.num.slice(0, 6).filter((d) => allRec.includes(d)),
      danHits: pred.dan.filter((d) => actual.num.includes(d)).length,
      posHit: actual.num.filter((d, k) => pred.posTop[k]?.includes(d)).length,
      inTop: pred.topCombos.some((c) => c.num.join('|') === actual.num.join('|')),
      spanHit: a.span >= pred.spanRange[0] && a.span <= pred.spanRange[1],
      sumHit: a.sum >= pred.sumRange[0] && a.sum <= pred.sumRange[1],
      oddHit: pred.recommendedOdd.includes(a.oddPattern),
      formHit: pred.recommendedForms.includes(a.form),
    })
  }
  const total = rows.length
  if (!total) return empty
  const pct = (c) => +((c / total) * 100).toFixed(0)
  return {
    periods: total,
    rows,
    dist: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ k, count: rows.filter((r) => r.hits === k).length })),
    avgHits: +(rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(2),
    // 覆盖 6 个前区码 + 3 个后区码：随机期望 6×0.6 + 3/15 = 3.8 位
    baseline: 3.8,
    posRate: pct(rows.filter((r) => r.posHit >= 1).length),
    posAvg: +(rows.reduce((s, r) => s + r.posHit, 0) / total).toFixed(2),
    topRate: pct(rows.filter((r) => r.inTop).length),
    spanRate: pct(rows.filter((r) => r.spanHit).length),
    sumRate: pct(rows.filter((r) => r.sumHit).length),
    oddRate: pct(rows.filter((r) => r.oddHit).length),
    formRate: pct(rows.filter((r) => r.formHit).length),
  }
}

/** 与 3D/排列三引擎同名，方便页面按统一字段复用 */
export { analyzeDrawQXC as analyzeDraw }
