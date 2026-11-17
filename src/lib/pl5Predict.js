// ============================================================
// 体彩排列五（00000-99999，单注 2 元，直选中奖 100,000 元，概率 1/100000）
//
// 结构与排列三 v3 Pro 同源：逐位 9 专家 + Hedge 自适应权重，再用结构模型
// （和值/跨度/重号形态/奇偶/和值尾/与上期重复个数）对全部 10 万注做软加权。
// 差别只在于「5 个位置、10 万注」——排列三穷举 1000 注，这里穷举 100000 注，
// 用 TypedArray + 两遍扫描控制耗时。
//
// ⚠️ 排列五是独立随机事件，每注概率恒为 1/100000，任何算法都无法提高单注概率。
// ============================================================

/** 位置标签：万、千、百、十、个 */
export const PL5_POS = ['万', '千', '百', '十', '个']

export const PRO = {
  hedge: { lookback: 24, eta: 0.8, minWeight: 0.02 },
  gapBlend: 0.9,
  markov2Smooth: 3,
  structWindow: 120,
  structBlend: 0.2,
  structBeta: 0.45,
  topCombos: 10,
}

/** 5 位号码的重复形态（多重集划分），索引即 form */
const FORM_NAMES = ['五同', '四同一异', '三同二同', '三同两异', '两对一异', '两同三异', '全不同']

const norm = (arr) => {
  const t = arr.reduce((a, b) => a + b, 0) || 1
  return arr.map((v) => v / t)
}

/** 窗口频率（Laplace 平滑） */
function posFreq(draws, pos, N, smooth = 1) {
  const arr = Array(10).fill(smooth)
  const n = Math.min(N, draws.length)
  for (let i = 0; i < n; i++) arr[draws[i].num[pos]]++
  return norm(arr)
}

/** 一阶转移：只算当前数字这一行 */
function markov1Next(draws, pos, N) {
  const n = Math.min(N, draws.length)
  const f = posFreq(draws, pos, N)
  const cur = draws[0].num[pos]
  const row = Array(10).fill(0)
  for (let i = 0; i < n - 1; i++) {
    if (draws[i + 1].num[pos] === cur) row[draws[i].num[pos]]++
  }
  return norm(row.map((v, j) => v + 2 * f[j]))
}

/** 二阶转移：上下文为最近两期该位数字，样本稀疏时退回一阶 */
function markov2Next(draws, pos, N) {
  const n = Math.min(N, draws.length)
  if (n < 6) return markov1Next(draws, pos, N)
  const m1 = markov1Next(draws, pos, N)
  const cur = draws[0].num[pos]
  const prev = draws[1].num[pos]
  const row = Array(10).fill(0)
  for (let i = 0; i < n - 2; i++) {
    if (draws[i + 1].num[pos] === cur && draws[i + 2].num[pos] === prev) {
      row[draws[i].num[pos]]++
    }
  }
  const k = PRO.markov2Smooth
  return norm(row.map((v, j) => v + k * m1[j]))
}

/** 遗漏回补：当前遗漏相对 10 期几何期望做 tanh 压缩 */
function gapNext(draws, pos) {
  const omit = Array(10).fill(draws.length)
  for (let i = 0; i < draws.length; i++) {
    const v = draws[i].num[pos]
    if (omit[v] === draws.length) omit[v] = i
  }
  const f = posFreq(draws, pos, draws.length)
  return norm(f.map((v, d) => v * (1 + PRO.gapBlend * Math.tanh((omit[d] - 10) / 10))))
}

/** 周期邻距：相邻两期该位环形距离分布 */
function ringNext(draws, pos) {
  const hist = Array(6).fill(1)
  for (let i = 0; i < draws.length - 1; i++) {
    const a = draws[i].num[pos]
    const b = draws[i + 1].num[pos]
    hist[Math.min(Math.abs(a - b), 10 - Math.abs(a - b))]++
  }
  const total = hist.reduce((a, b) => a + b, 0)
  const last = draws[0].num[pos]
  const dist = Array(10).fill(0)
  const ringCount = Array(6).fill(0)
  for (let d = 0; d < 10; d++) {
    const k = Math.min(Math.abs(d - last), 10 - Math.abs(d - last))
    dist[d] = k
    ringCount[k]++
  }
  return norm(dist.map((k) => hist[k] / total / ringCount[k]))
}

/** 冷热反转：近 60 期越冷，基础概率略高 */
function contrarianNext(draws, pos) {
  const f = posFreq(draws, pos, 60)
  return norm(f.map((v) => Math.max(0.02, 0.1 + (0.1 - v) * 1.5)))
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
      losses[i] += -Math.log(Math.min(0.999, Math.max(1e-4, p[actual])))
      counts[i]++
    }
    used++
  }
  if (!used) return Array(K).fill(1 / K)
  const avg = losses.map((l, i) => (counts[i] ? l / counts[i] : Math.log(10)))
  const best = Math.max(...avg)
  const raw = avg.map((a) => Math.exp(-PRO.hedge.eta * (a - best)))
  const sum = raw.reduce((a, b) => a + b, 0)
  const w = raw.map((v) => Math.max(PRO.hedge.minWeight, v / sum))
  const ws = w.reduce((a, b) => a + b, 0)
  return w.map((v) => v / ws)
}

/** 逐位概率：9 专家按 Hedge 权重混合（weightsOverride 提供时替代现算权重） */
function positionProbs(draws, weightsOverride = null) {
  const weights = [0, 1, 2, 3, 4].map((pos) =>
    weightsOverride ? weightsOverride[pos] || proHedge(draws, pos) : proHedge(draws, pos),
  )
  const probs = [0, 1, 2, 3, 4].map((pos) => {
    const w = weights[pos]
    const out = Array(10).fill(0)
    PRO_EXPERTS.forEach((e, i) => {
      const p = e.fn(draws, pos)
      for (let d = 0; d < 10; d++) out[d] += w[i] * p[d]
    })
    return norm(out)
  })
  return { weights, probs }
}

/** 5 位号码的结构特征 */
function structOf(digits, prev) {
  let sum = 0
  let odd = 0
  let min = 9
  let max = 0
  const counts = Array(10).fill(0)
  for (let i = 0; i < 5; i++) {
    const d = digits[i]
    sum += d
    if (d % 2 === 1) odd++
    if (d < min) min = d
    if (d > max) max = d
    counts[d]++
  }
  const uniq = counts.filter((v) => v > 0).length
  const shape = counts
    .filter((v) => v > 0)
    .sort((a, b) => b - a)
  // 形态索引：把"重复结构"映射到 7 个类别
  let form = 6
  if (uniq === 1) form = 0
  else if (uniq === 2) form = shape[0] === 4 ? 1 : 2
  else if (uniq === 3) form = shape[0] === 3 ? 3 : 4
  else if (uniq === 4) form = 5
  let rep = -1
  if (prev) {
    rep = 0
    const pool = [...prev]
    for (let i = 0; i < 5; i++) {
      const idx = pool.indexOf(digits[i])
      if (idx >= 0) {
        pool.splice(idx, 1)
        rep++
      }
    }
  }
  return { sum, span: max - min, form, odd, tail: sum % 10, rep }
}

/** 结构特征的经验分布（Laplace 平滑） */
function structDist(draws, key, size) {
  const arr = Array(size).fill(1)
  let n = 0
  for (let i = 0; i < draws.length; i++) {
    const prev = draws[i + 1] ? draws[i + 1].num : null
    const s = structOf(draws[i].num, prev)
    if (s[key] < 0) continue
    arr[s[key]]++
    n++
  }
  return arr.map((v) => v / (n + size))
}

/** 近期 + 长期混合的结构模型 */
function buildStructModel(draws) {
  const recent = draws.slice(0, PRO.structWindow)
  const shape = [
    ['span', 10],
    ['sum', 46],
    ['form', 7],
    ['odd', 6],
    ['tail', 10],
    ['rep', 6],
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
    (s.rep >= 0 ? Math.log(model.rep[s.rep]) : 0)
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

/** 单个 5 位号码的统计特征（页面展示用） */
export function analyzeDraw5(num) {
  const s = structOf(num, null)
  return {
    sum: s.sum,
    span: s.span,
    sumTail: s.tail,
    oddCount: s.odd,
    oddPattern: num.map((d) => (d % 2 === 1 ? '奇' : '偶')).join(''),
    form: FORM_NAMES[s.form],
    uniq: new Set(num).size,
  }
}

/**
 * 排列五覆盖档位：每位选 k 个号 → k^5 注，期望命中位数 = 5 × k/10。
 * 只说明成本与覆盖，不改变 1/100000 的单注概率。
 */
function buildTiers(rankedDigits) {
  return [2, 3, 4].map((k) => {
    const directBets = k ** 5
    return {
      cover: k,
      codes: rankedDigits.slice(0, k).map((x) => x.digit),
      expectHits: +(k * 0.5).toFixed(1),
      fullCoverRate: +((k / 10) ** 5 * 100).toFixed(2),
      directBets,
      directCost: directBets * 2,
      costPerHit: +((directBets * 2) / (k * 0.5)).toFixed(1),
    }
  })
}

/**
 * 排列五下期推算。
 * 返回字段与排列三 Pro 尽量同构，方便页面复用；额外带 posLabels / directPlan。
 */
export function predictPL5(
  draws,
  { cover = 6, beta = PRO.structBeta, coverRate = 0.8, weightsOverride = null } = {},
) {
  if (!Array.isArray(draws) || draws.length < 20) return null

  // weightsOverride：服务端学习状态的逐位权重（长度 5、每项长度 9 且归一），
  // 提供时替代现算的 proHedge 结果；不传时行为与现状完全一致。
  const { weights, probs } = positionProbs(draws, weightsOverride)
  const model = buildStructModel(draws)
  const prev = draws[0]?.num || null

  // --- 穷举 10 万注：先算 p0 与结构对数似然，再标准化 ---
  const N = 100000
  const lp = new Float64Array(N)
  const p0 = new Float64Array(N)
  const sumArr = new Uint8Array(N)
  const spanArr = new Uint8Array(N)
  const formArr = new Uint8Array(N)
  const oddArr = new Uint8Array(N)
  const tailArr = new Uint8Array(N)
  const repArr = new Uint8Array(N)
  const digits = [0, 0, 0, 0, 0]

  let meanLp = 0
  for (let i = 0; i < N; i++) {
    let t = i
    digits[4] = t % 10
    t = (t - digits[4]) / 10
    digits[3] = t % 10
    t = (t - digits[3]) / 10
    digits[2] = t % 10
    t = (t - digits[2]) / 10
    digits[1] = t % 10
    digits[0] = (t - digits[1]) / 10
    p0[i] =
      probs[0][digits[0]] *
      probs[1][digits[1]] *
      probs[2][digits[2]] *
      probs[3][digits[3]] *
      probs[4][digits[4]]
    const s = structOf(digits, prev)
    sumArr[i] = s.sum
    spanArr[i] = s.span
    formArr[i] = s.form
    oddArr[i] = s.odd
    tailArr[i] = s.tail
    repArr[i] = s.rep < 0 ? 255 : s.rep
    const v = structLogProb(s, model)
    lp[i] = v
    meanLp += v
  }
  meanLp /= N
  let varLp = 0
  for (let i = 0; i < N; i++) varLp += (lp[i] - meanLp) ** 2
  const sdLp = Math.sqrt(varLp / N) || 1

  const sumDist = Array(46).fill(0)
  const spanDist = Array(10).fill(0)
  const formDist = Array(7).fill(0)
  const oddDist = {}
  const appear = Array(10).fill(0)
  const posMarg = [0, 1, 2, 3, 4].map(() => Array(10).fill(0))
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
    const ds = digitsOf(i)
    sumDist[sumArr[i]] += p
    spanDist[spanArr[i]] += p
    formDist[formArr[i]] += p
    oddDist[ds.map((d) => (d % 2 === 1 ? '奇' : '偶')).join('')] =
      (oddDist[ds.map((d) => (d % 2 === 1 ? '奇' : '偶')).join('')] || 0) + p
    for (const d of new Set(ds)) appear[d] += p
    for (let k = 0; k < 5; k++) posMarg[k][ds[k]] += p
  }

  // --- 汇总：推荐码 / 定位 / 区间 / 组合 ---
  const rankedDigits = appear
    .map((p, d) => ({ digit: d, score: +(p * 100).toFixed(2) }))
    .sort((a, b) => b.score - a.score)
  const dan = rankedDigits.slice(0, 2).map((x) => x.digit)
  const tuo = rankedDigits.slice(2, Math.max(6, cover)).map((x) => x.digit)
  const tiers = buildTiers(rankedDigits)

  const posTop = posMarg.map((p) =>
    p
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map((x) => x.d),
  )

  // 遗漏值：距离最近一次开出该数字的期数
  const omit = Array(10).fill(draws.length)
  for (let i = 0; i < draws.length; i++) {
    for (const d of draws[i].num) if (omit[d] === draws.length) omit[d] = i
  }
  const ranked = rankedDigits.map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omit[r.digit],
  }))

  const topIdx = []
  for (let i = 0; i < N; i++) {
    if (topIdx.length < PRO.topCombos) {
      topIdx.push(i)
      if (topIdx.length === PRO.topCombos) {
        topIdx.sort((a, b) => pArr[b] - pArr[a])
      }
    } else if (pArr[i] > pArr[topIdx[PRO.topCombos - 1]]) {
      topIdx[PRO.topCombos - 1] = i
      topIdx.sort((a, b) => pArr[b] - pArr[a])
    }
  }
  const topCombos = topIdx.map((i, k) => {
    const ds = digitsOf(i)
    const s = structOf(ds, prev)
    return {
      rank: k + 1,
      num: ds,
      prob: +(pArr[i] * 100).toFixed(4),
      lift: +(pArr[i] / (p0[i] || 1e-12)).toFixed(2),
      sum: s.sum,
      span: s.span,
      form: FORM_NAMES[s.form],
    }
  })

  const sumRange = shortestInterval(sumDist, 0, 45, coverRate)
  const spanRange = shortestInterval(spanDist, 0, 9, coverRate)
  const recommendedOdd = Object.entries(oddDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([pat]) => pat)
  const recommendedForms = formDist
    .map((v, i) => ({ name: FORM_NAMES[i], v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map((x) => x.name)

  const sums = draws.slice(0, 300).map((d) => analyzeDraw5(d.num).sum)
  const spans = draws.slice(0, 300).map((d) => analyzeDraw5(d.num).span)

  const hot = ranked.slice(0, 3).map((r) => r.digit)
  const cold = ranked.slice(-3).map((r) => r.digit)
  const kill = rankedDigits.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omit[r.digit],
    confidence: +Math.max(0, ((0.1 - r.score / 100) / 0.1) * 100).toFixed(0),
    reason: omit[r.digit] <= 1 ? '刚开出，短期重复概率低' : '综合概率垫底，可排除',
  }))

  const directPlan = {
    pos: posTop,
    posLabels: PL5_POS,
    bets: posTop.reduce((s, p) => s * p.length, 1),
    cost: posTop.reduce((s, p) => s * p.length, 1) * 2,
  }

  return {
    drawId: draws[0].id,
    nextId: Number(draws[0].id) + 1,
    lastDraw: draws[0],
    lastAnalysis: analyzeDraw5(draws[0].num),
    omit: Object.fromEntries(omit.map((v, d) => [d, v])),
    hot,
    cold,
    dan,
    tuo,
    ranked,
    posTop,
    posLabels: PL5_POS,
    sumRange,
    spanRange,
    sumAvg: +(sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1),
    spanAvg: +(spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1),
    sumMode: modeOf(sums),
    spanMode: modeOf(spans),
    recommendedOdd,
    recommendedForms,
    coverRate,
    oddTotal: 32,
    kill,
    cover,
    tiers,
    topCombos,
    expertWeights: PRO_EXPERTS.map((e, i) => ({
      key: e.key,
      name: e.name,
      weight: +((weights.reduce((s, w) => s + w[i], 0) / 5) * 100).toFixed(1),
    })).sort((a, b) => b.weight - a.weight),
    structBeta: beta,
    directPlan,
    algorithm: 'pl5-pro',
  }
}

/** i → [万,千,百,十,个] */
function digitsOf(i) {
  const out = [0, 0, 0, 0, 0]
  let t = i
  out[4] = t % 10
  t = (t - out[4]) / 10
  out[3] = t % 10
  t = (t - out[3]) / 10
  out[2] = t % 10
  t = (t - out[2]) / 10
  out[1] = t % 10
  out[0] = (t - out[1]) / 10
  return out
}

/** 与 3D/排列三引擎同名，方便页面按统一字段复用 */
export { analyzeDraw5 as analyzeDraw }

/** 单期回算 */
export function backtestPL5(draws) {
  if (!Array.isArray(draws) || draws.length < 21) return null
  const pred = predictPL5(draws.slice(1))
  if (!pred) return null
  const actual = draws[0]
  const a = analyzeDraw5(actual.num)
  const allRec = [...pred.dan, ...pred.tuo]
  const hits = actual.num.filter((d) => allRec.includes(d))
  const posHit = actual.num.filter((d, i) => pred.posTop[i]?.includes(d)).length
  const inTop = pred.topCombos.some((c) => c.num.join('') === actual.num.join(''))
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
    posHitCount: posHit,
    inTopCombos: inTop,
    spanHit,
    sumHit,
    oddHit,
    formHit,
    score:
      (hits.length >= 2 ? hits.length * 10 : 0) +
      (spanHit ? 15 : 0) +
      (sumHit ? 15 : 0) +
      (oddHit ? 15 : 0) +
      (formHit ? 15 : 0),
  }
}

/** 滚动回测（方法体检页使用），字段与排列三对齐 */
export function walkForwardAuditPL5(draws, { periods = 30, minTrain = 40 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  const empty = {
    periods: 0,
    rows: [],
    dist: [],
    avgHits: 0,
    baseline: 3,
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
    const pred = predictPL5(train)
    if (!pred) continue
    const a = analyzeDraw5(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.filter((d) => allRec.includes(d))
    rows.push({
      draw: actual,
      prediction: pred,
      hits: hits.length,
      hitNums: hits,
      danHits: pred.dan.filter((d) => actual.num.includes(d)).length,
      posHit: actual.num.filter((d, k) => pred.posTop[k]?.includes(d)).length,
      inTop: pred.topCombos.some((c) => c.num.join('') === actual.num.join('')),
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
    dist: [0, 1, 2, 3, 4, 5].map((k) => ({ k, count: rows.filter((r) => r.hits === k).length })),
    avgHits: +(rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(2),
    // 覆盖 6 码时，随机期望命中 5 × 0.6 = 3 个
    baseline: 3,
    posRate: pct(rows.filter((r) => r.posHit >= 1).length),
    posAvg: +(rows.reduce((s, r) => s + r.posHit, 0) / total).toFixed(2),
    topRate: pct(rows.filter((r) => r.inTop).length),
    spanRate: pct(rows.filter((r) => r.spanHit).length),
    sumRate: pct(rows.filter((r) => r.sumHit).length),
    oddRate: pct(rows.filter((r) => r.oddHit).length),
    formRate: pct(rows.filter((r) => r.formHit).length),
  }
}
