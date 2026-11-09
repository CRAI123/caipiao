// 福彩3D 预测引擎 —— 基于术语的多维度评分
// 分析维度：热冷号、跨度、和值、奇偶、大中小、质合、形态、遗漏

const PRIMES = new Set([1, 2, 3, 5, 7])
const SMALL = new Set([0, 1, 2])
const MID = new Set([3, 4, 5, 6])
const BIG = new Set([7, 8, 9])

/** 计算单注号码的各项指标 */
export function analyzeDraw(num) {
  const [a, b, c] = num
  const sum = a + b + c
  const span = Math.max(a, b, c) - Math.min(a, b, c)
  const sumTail = sum % 10
  const oddCount = [a, b, c].filter((d) => d % 2 === 1).length
  const oddPattern = [a, b, c].map((d) => (d % 2 === 1 ? '奇' : '偶')).join('')
  const smallCount = [a, b, c].filter((d) => SMALL.has(d)).length
  const midCount = [a, b, c].filter((d) => MID.has(d)).length
  const bigCount = [a, b, c].filter((d) => BIG.has(d)).length
  const primeCount = [a, b, c].filter((d) => PRIMES.has(d)).length
  // 形态
  const unique = new Set([a, b, c]).size
  let form = '组六'
  if (unique === 1) form = '豹子'
  else if (unique === 2) form = '组三'
  else if (unique === 3) {
    const sorted = [...num].sort((x, y) => x - y)
    if (sorted[2] - sorted[0] === 2 && sorted[1] - sorted[0] === 1) form = '顺子'
  }
  return { sum, span, sumTail, oddCount, oddPattern, smallCount, midCount, bigCount, primeCount, form }
}

/** 频率统计：每个数字 0-9 出现次数 */
function digitFrequency(draws) {
  const freq = Array(10).fill(0)
  draws.forEach((d) => d.num.forEach((n) => freq[n]++))
  return freq
}

/** 遗漏统计：每个数字距上次出现的期数（draws 最新在前） */
function omission(draws) {
  const omit = Array(10).fill(0)
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < draws.length; j++) {
      // 从最新（index 0）往旧扫描，遇到即停
      if (draws[j].num.includes(i)) break
      omit[i]++
    }
  }
  return omit
}

/** 取近期 N 期（draws 最新在前 → 取前 N 个） */
function recent(draws, n) {
  return draws.slice(0, n)
}

/** 综合预测：返回下期推荐（draws 约定：最新在前，draws[0] 为最新一期） */
export function predictFC3D(draws) {
  if (draws.length < 5) return null
  const all = draws
  const last = draws[0] // 最新一期
  const lastAnalysis = analyzeDraw(last.num)

  // --- 1. 热冷号（近10期 + 近30期加权） ---
  const freq10 = digitFrequency(recent(all, Math.min(10, all.length)))
  const freq30 = digitFrequency(recent(all, Math.min(30, all.length)))
  const total10 = freq10.reduce((s, v) => s + v, 0) || 1
  const total30 = freq30.reduce((s, v) => s + v, 0) || 1

  // --- 2. 遗漏 ---
  const omit = omission(all)

  // --- 3. 跨度分布（近30期） ---
  const spans = recent(all, Math.min(30, all.length)).map((d) => analyzeDraw(d.num).span)
  const spanAvg = spans.reduce((s, v) => s + v, 0) / spans.length
  const spanMode = mode(spans)

  // --- 4. 和值分布（近30期） ---
  const sums = recent(all, Math.min(30, all.length)).map((d) => analyzeDraw(d.num).sum)
  const sumAvg = sums.reduce((s, v) => s + v, 0) / sums.length
  const sumMode = mode(sums)

  // --- 5. 奇偶分布 ---
  const oddCounts = recent(all, Math.min(30, all.length)).map((d) => analyzeDraw(d.num).oddCount)
  const oddMode = mode(oddCounts) // 0,1,2,3

  // --- 6. 形态分布 ---
  const forms = recent(all, Math.min(50, all.length)).map((d) => analyzeDraw(d.num).form)
  const formFreq = {}
  forms.forEach((f) => (formFreq[f] = (formFreq[f] || 0) + 1))

  // --- 综合评分每个数字 0-9 ---
  const scores = Array(10).fill(0)
  for (let i = 0; i < 10; i++) {
    // 热号加分（近10期权重更高）
    scores[i] += (freq10[i] / total10) * 40
    scores[i] += (freq30[i] / total30) * 20
    // 遗漏加分（冷号回补）
    scores[i] += Math.min(omit[i], 15) * 1.2
    // 上期未出的号码有回补倾向
    if (!last.num.includes(i)) scores[i] += 3
  }

  // 排名
  const ranked = scores
    .map((s, i) => ({ digit: i, score: Math.round(s * 100) / 100 }))
    .sort((a, b) => b.score - a.score)

  const hot = ranked.slice(0, 3).map((r) => r.digit) // 热号 Top3
  const cold = ranked.slice(-3).map((r) => r.digit) // 冷号 Bottom3
  const dan = ranked.slice(0, 2).map((r) => r.digit) // 胆码 Top2
  const tuo = ranked.slice(2, 6).map((r) => r.digit) // 拖码 4个

  // --- 推荐跨度范围 ---
  const spanRange = [Math.max(0, Math.round(spanMode - 1)), Math.min(9, Math.round(spanMode + 1))]
  // --- 推荐和值范围 ---
  const sumRange = [Math.round(sumAvg - 3), Math.round(sumAvg + 3)]

  // --- 推荐奇偶形态 ---
  const oddLabels = ['偶偶偶', '奇奇偶', '奇偶奇', '奇偶偶', '偶奇奇', '偶奇偶', '偶偶奇', '奇奇奇']
  const recommendedOdd = oddLabels.filter((_, idx) => {
    const cnt = idx.toString(2).padStart(3, '0').split('').reduce((s, c) => s + Number(c), 0)
    return cnt === oddMode || cnt === Math.min(3, oddMode + 1) || cnt === Math.max(0, oddMode - 1)
  }).slice(0, 3)

  // --- 推荐形态 ---
  const formRanked = Object.entries(formFreq).sort((a, b) => b[1] - a[1])
  const recommendedForms = formRanked.slice(0, 2).map(([f]) => f)

  return {
    drawCount: all.length,
    lastDraw: last,
    lastAnalysis,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    spanRange,
    spanAvg: Math.round(spanAvg * 10) / 10,
    spanMode,
    sumRange,
    sumAvg: Math.round(sumAvg * 10) / 10,
    sumMode,
    recommendedOdd,
    recommendedForms,
    omit,
    freq10,
  }
}

/** 回算验证：用除最新一期外的数据预测最新一期，对比实际开奖（draws 最新在前） */
export function backtestFC3D(draws) {
  if (draws.length < 6) return null
  // 去掉最新一期（index 0），用剩余更旧的数据做预测
  const train = draws.slice(1)
  const actual = draws[0] // 最新一期
  const pred = predictFC3D(train)
  if (!pred) return null

  const actualNum = actual.num
  const actualAnalysis = analyzeDraw(actualNum)

  // 命中判定
  const danHits = pred.dan.filter((d) => actualNum.includes(d))
  const tuoHits = pred.tuo.filter((d) => actualNum.includes(d))
  const allRecommended = [...pred.dan, ...pred.tuo]
  const digitHits = actualNum.filter((d) => allRecommended.includes(d))

  // 跨度是否在预测范围内
  const spanHit = actualAnalysis.span >= pred.spanRange[0] && actualAnalysis.span <= pred.spanRange[1]
  // 和值是否在预测范围内
  const sumHit = actualAnalysis.sum >= pred.sumRange[0] && actualAnalysis.sum <= pred.sumRange[1]
  // 奇偶是否命中
  const oddHit = pred.recommendedOdd.includes(actualAnalysis.oddPattern)
  // 形态是否命中
  const formHit = pred.recommendedForms.includes(actualAnalysis.form)

  // 直选命中：3个数字都在推荐中且位置全对（概率极低，主要看组选）
  // 组选命中：3个数字都在推荐的6码中
  const groupHit = digitHits.length === 3

  return {
    actualDraw: actual,
    actualAnalysis,
    prediction: pred,
    danHits,
    tuoHits,
    digitHits,
    digitHitCount: digitHits.length,
    spanHit,
    sumHit,
    oddHit,
    formHit,
    groupHit,
    // 综合评分：各项命中 * 权重
    score:
      (digitHits.length === 3 ? 40 : digitHits.length === 2 ? 20 : digitHits.length === 1 ? 8 : 0) +
      (spanHit ? 15 : 0) +
      (sumHit ? 15 : 0) +
      (oddHit ? 15 : 0) +
      (formHit ? 15 : 0),
  }
}

/** 众数 */
function mode(arr) {
  const freq = {}
  arr.forEach((v) => (freq[v] = (freq[v] || 0) + 1))
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
}

/**
 * 滚动回测：对最近 periods 期，每期只用「它之前」的数据做预测，再与真实开奖对比。
 * 这样预测时看不到未来，结果才是对方法本身的公平检验。
 * draws 约定：最新在前（draws[0] 为最新一期）。
 */
export function walkForwardAuditFC3D(draws, { periods = 50, minTrain = 20 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  if (n <= 0) {
    return { periods: 0, rows: [], dist: [], avgHits: 0, baseline: 0, spanRate: 0, sumRate: 0, oddRate: 0, formRate: 0 }
  }
  const rows = []
  // draws 最新在前：从最新（index 0）往旧滚动测试
  // 对第 i 期，训练集为 draws.slice(i+1)（所有更旧的期）
  for (let i = 0; i < n; i++) {
    const actual = draws[i]
    const train = draws.slice(i + 1)
    if (train.length < minTrain) break
    const pred = predictFC3D(train)
    if (!pred) continue
    const a = analyzeDraw(actual.num)
    const allRec = [...pred.dan, ...pred.tuo]
    const hits = actual.num.filter((d) => allRec.includes(d))
    const danHits = pred.dan.filter((d) => actual.num.includes(d))
    const spanHit = a.span >= pred.spanRange[0] && a.span <= pred.spanRange[1]
    const sumHit = a.sum >= pred.sumRange[0] && a.sum <= pred.sumRange[1]
    const oddHit = pred.recommendedOdd.includes(a.oddPattern)
    const formHit = pred.recommendedForms.includes(a.form)
    const score =
      (hits.length === 3 ? 40 : hits.length === 2 ? 20 : hits.length === 1 ? 8 : 0) +
      (spanHit ? 15 : 0) + (sumHit ? 15 : 0) + (oddHit ? 15 : 0) + (formHit ? 15 : 0)
    rows.push({
      draw: actual,
      prediction: pred,
      hits: hits.length,
      hitNums: hits,
      danHits: danHits.length,
      spanHit,
      sumHit,
      oddHit,
      formHit,
      score,
    })
  }
  // rows 已按最新在前顺序（i 从小到大），无需 reverse

  const total = rows.length
  const dist = [0, 1, 2, 3].map((k) => ({
    k,
    count: rows.filter((r) => r.hits === k).length,
  }))
  const avgHits = total ? +(rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(2) : 0
  const spanRate = total ? +(rows.filter((r) => r.spanHit).length / total * 100).toFixed(0) : 0
  const sumRate = total ? +(rows.filter((r) => r.sumHit).length / total * 100).toFixed(0) : 0
  const oddRate = total ? +(rows.filter((r) => r.oddHit).length / total * 100).toFixed(0) : 0
  const formRate = total ? +(rows.filter((r) => r.formHit).length / total * 100).toFixed(0) : 0
  // 机选基准：从 10 个数字中随机选 6 个，命中 3 个的概率 = C(3,3)*C(7,3)/C(10,6) = 35/210 = 1/6
  // 平均命中数 = 3 * 6/10 = 1.8
  const baseline = 1.8

  return { periods: total, rows, dist, avgHits, baseline, spanRate, sumRate, oddRate, formRate }
}

// ============================================================
// v2 精准模式：位置独立建模 + 马尔可夫转移 + 指数衰减 + 遗漏回补
// ⚠️ 开奖为独立随机事件，以下方法仅为更精细的历史描述，不改变中奖概率。
// ============================================================

/** 指数衰减权重：越近的期权重越高。half-life ≈ ln2/lambda 期 */
function decayWeights(n, lambda = 0.03) {
  const w = []
  for (let i = 0; i < n; i++) w.push(Math.exp(-lambda * i))
  const sum = w.reduce((s, v) => s + v, 0)
  return w.map((v) => v / sum)
}

/** 位置独立加权频率（draws 最新在前） */
function weightedPosFreq(draws, pos, lambda = 0.03) {
  const freq = Array(10).fill(0)
  const w = decayWeights(draws.length, lambda)
  for (let i = 0; i < draws.length; i++) {
    freq[draws[i].num[pos]] += w[i]
  }
  return freq
}

/** 一阶马尔可夫转移矩阵：P(下期该位置=j | 上期该位置=i) */
function transitionMatrix(draws, pos) {
  const M = Array.from({ length: 10 }, () => Array(10).fill(0))
  const rowSum = Array(10).fill(0)
  // draws 最新在前，相邻期对：(draws[i+1] → draws[i])，即上期→下期
  for (let i = 0; i < draws.length - 1; i++) {
    const prev = draws[i + 1].num[pos] // 上期（更旧）
    const curr = draws[i].num[pos] // 下期（更新）
    M[prev][curr]++
    rowSum[prev]++
  }
  // 转为概率，未出现的行用均匀分布兜底
  for (let i = 0; i < 10; i++) {
    if (rowSum[i] === 0) {
      for (let j = 0; j < 10; j++) M[i][j] = 0.1
    } else {
      for (let j = 0; j < 10; j++) M[i][j] /= rowSum[i]
    }
  }
  return M
}

/** 位置遗漏（draws 最新在前）：每个数字在该位置距上次出现的期数 */
function posOmission(draws, pos) {
  const omit = Array(10).fill(draws.length)
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num[pos] === d) {
        omit[d] = i
        break
      }
    }
  }
  return omit
}

/** 均值与标准差 */
function meanStd(arr) {
  const m = arr.reduce((s, v) => s + v, 0) / arr.length
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
  return { mean: +m.toFixed(1), std: +Math.sqrt(v).toFixed(1) }
}

/**
 * v2 预测引擎：
 * - 百/十/个 位置独立评分（加权频率 + 马尔可夫转移 + 遗漏回补）
 * - 综合评分选出胆码/拖码
 * - 和值/跨度用正态区间（均值±1σ）
 */
export function predictFC3Dv2(draws) {
  if (draws.length < 10) return null
  const last = draws[0]
  const lastAnalysis = analyzeDraw(last.num)
  const recentN = Math.min(50, draws.length)
  const recentDraws = draws.slice(0, recentN)

  // --- 每个位置的综合评分 ---
  const posScores = [] // [百, 十, 个]，每个是 Array(10) 的分数
  for (let pos = 0; pos < 3; pos++) {
    const freq = weightedPosFreq(recentDraws, pos, 0.03)
    const M = transitionMatrix(draws, pos)
    const omit = posOmission(draws, pos)
    const lastDigit = last.num[pos]

    // 归一化频率到 [0,1]
    const maxFreq = Math.max(...freq, 0.001)
    const scores = Array(10).fill(0)
    for (let d = 0; d < 10; d++) {
      // 1. 加权频率分（40%）
      scores[d] += (freq[d] / maxFreq) * 40
      // 2. 马尔可夫转移分（30%）：基于上期该位置号码的转移概率
      const transProb = M[lastDigit][d]
      const maxTrans = Math.max(...M[lastDigit], 0.001)
      scores[d] += (transProb / maxTrans) * 30
      // 3. 遗漏回补分（20%）：遗漏越久回补倾向越强（几何分布近似）
      const omitBonus = Math.min(omit[d], 20) / 20
      scores[d] += omitBonus * 20
      // 4. 上期未出回补（10%）
      if (lastDigit !== d) scores[d] += 10
    }
    posScores.push(scores)
  }

  // --- 综合 0-9 评分（取三个位置的平均） ---
  const totalScores = Array(10).fill(0)
  for (let d = 0; d < 10; d++) {
    totalScores[d] = (posScores[0][d] + posScores[1][d] + posScores[2][d]) / 3
  }
  const ranked = totalScores
    .map((s, i) => ({ digit: i, score: Math.round(s * 100) / 100 }))
    .sort((a, b) => b.score - a.score)

  const hot = ranked.slice(0, 3).map((r) => r.digit)
  const cold = ranked.slice(-3).map((r) => r.digit)
  const dan = ranked.slice(0, 2).map((r) => r.digit)
  const tuo = ranked.slice(2, 6).map((r) => r.digit)

  // --- 各位置推荐号码（Top2） ---
  const posTop = posScores.map((s) =>
    s.map((v, d) => ({ d, v })).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.d),
  )

  // --- 和值/跨度：正态区间（均值±1σ） ---
  const sums = recentDraws.map((d) => analyzeDraw(d.num).sum)
  const spans = recentDraws.map((d) => analyzeDraw(d.num).span)
  const sumStat = meanStd(sums)
  const spanStat = meanStd(spans)
  const sumRange = [Math.max(0, Math.round(sumStat.mean - sumStat.std)), Math.min(27, Math.round(sumStat.mean + sumStat.std))]
  const spanRange = [Math.max(0, Math.round(spanStat.mean - spanStat.std)), Math.min(9, Math.round(spanStat.mean + spanStat.std))]

  // --- 奇偶/形态推荐（近期 Top2） ---
  const oddDist = {}
  const formDist = {}
  recentDraws.forEach((d) => {
    const a = analyzeDraw(d.num)
    oddDist[a.oddPattern] = (oddDist[a.oddPattern] || 0) + 1
    formDist[a.form] = (formDist[a.form] || 0) + 1
  })
  const recommendedOdd = Object.entries(oddDist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p)
  const recommendedForms = Object.entries(formDist).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f)

  // 总遗漏（不分位置）
  const omit = Array(10).fill(0)
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num.includes(d)) break
      omit[d]++
    }
  }

  return {
    drawCount: draws.length,
    lastDraw: last,
    lastAnalysis,
    hot, cold, dan, tuo, ranked,
    spanRange,
    spanAvg: spanStat.mean,
    sumRange,
    sumAvg: sumStat.mean,
    recommendedOdd,
    recommendedForms,
    omit,
    posTop,
    algorithm: 'v2',
  }
}

/** v2 回算验证 */
export function backtestFC3Dv2(draws) {
  if (draws.length < 11) return null
  const train = draws.slice(1)
  const actual = draws[0]
  const pred = predictFC3Dv2(train)
  if (!pred) return null
  const a = analyzeDraw(actual.num)
  const danHits = pred.dan.filter((d) => actual.num.includes(d))
  const tuoHits = pred.tuo.filter((d) => actual.num.includes(d))
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
    danHits,
    tuoHits,
    digitHits: hits,
    digitHitCount: hits.length,
    spanHit, sumHit, oddHit, formHit,
    score:
      (hits.length === 3 ? 40 : hits.length === 2 ? 20 : hits.length === 1 ? 8 : 0) +
      (spanHit ? 15 : 0) + (sumHit ? 15 : 0) + (oddHit ? 15 : 0) + (formHit ? 15 : 0),
  }
}

/** v2 滚动回测 */
export function walkForwardAuditFC3Dv2(draws, { periods = 50, minTrain = 20 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  if (n <= 0) {
    return { periods: 0, rows: [], dist: [], avgHits: 0, baseline: 0, spanRate: 0, sumRate: 0, oddRate: 0, formRate: 0 }
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
    const danHits = pred.dan.filter((d) => actual.num.includes(d))
    const spanHit = a.span >= pred.spanRange[0] && a.span <= pred.spanRange[1]
    const sumHit = a.sum >= pred.sumRange[0] && a.sum <= pred.sumRange[1]
    const oddHit = pred.recommendedOdd.includes(a.oddPattern)
    const formHit = pred.recommendedForms.includes(a.form)
    const score =
      (hits.length === 3 ? 40 : hits.length === 2 ? 20 : hits.length === 1 ? 8 : 0) +
      (spanHit ? 15 : 0) + (sumHit ? 15 : 0) + (oddHit ? 15 : 0) + (formHit ? 15 : 0)
    rows.push({
      draw: actual, prediction: pred, hits: hits.length, hitNums: hits,
      danHits: danHits.length, spanHit, sumHit, oddHit, formHit, score,
    })
  }
  const total = rows.length
  const dist = [0, 1, 2, 3].map((k) => ({ k, count: rows.filter((r) => r.hits === k).length }))
  const avgHits = total ? +(rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(2) : 0
  const spanRate = total ? +(rows.filter((r) => r.spanHit).length / total * 100).toFixed(0) : 0
  const sumRate = total ? +(rows.filter((r) => r.sumHit).length / total * 100).toFixed(0) : 0
  const oddRate = total ? +(rows.filter((r) => r.oddHit).length / total * 100).toFixed(0) : 0
  const formRate = total ? +(rows.filter((r) => r.formHit).length / total * 100).toFixed(0) : 0
  return { periods: total, rows, dist, avgHits, baseline: 1.8, spanRate, sumRate, oddRate, formRate }
}
