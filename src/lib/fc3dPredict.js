// 福彩3D 预测引擎 —— 基于术语的多维度评分
// 分析维度：热冷号、跨度、和值、奇偶、大中小、质合、形态、遗漏

import { projectNext, kdj, macd, omissionSeries } from './kline.js'

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

// ============================================================
// 奇偶专项模型
// 常见 3D 奇偶玩法：形态遗漏回补、位置奇偶节奏（连出变盘）、
// 两奇一偶/两偶一奇高概率形态追踪。理论概率：全奇/全偶各 12.5%，
// 两奇一偶/两偶一奇各 37.5%（对应理论周期 8 期 / 2.67 期）。
// ============================================================
const ODD_DIGITS = new Set([1, 3, 5, 7, 9])
const MACRO_PROB = { 全奇: 0.125, 全偶: 0.125, 两奇一偶: 0.375, 两偶一奇: 0.375 }
const MACRO_PATTERN_COUNT = { 全奇: 1, 全偶: 1, 两奇一偶: 3, 两偶一奇: 3 }

function bitsOfNum(num) {
  return num.map((d) => (ODD_DIGITS.has(d) ? 1 : 0))
}
function patternOfBits(bits) {
  return bits.map((b) => (b ? '奇' : '偶')).join('')
}
function macroOfBits(bits) {
  const k = bits[0] + bits[1] + bits[2]
  return k === 3 ? '全奇' : k === 0 ? '全偶' : k === 2 ? '两奇一偶' : '两偶一奇'
}

// 8 种精确奇偶形态（百十个顺序）
const ALL_OE = []
for (let m = 0; m < 8; m++) {
  const bits = [(m >> 2) & 1, (m >> 1) & 1, m & 1]
  ALL_OE.push({ bits, pattern: patternOfBits(bits), macro: macroOfBits(bits) })
}

/**
 * 奇偶评测：对下期给出
 * - perPos：每个位置的奇偶倾向（连出变盘 / 近期多数）与理由
 * - ranked：8 种精确形态综合评分（频率 25 + 遗漏回补 40 + 位置匹配 25 - 连出抑制）
 * - macro：4 种宏观形态的计数、理论概率、遗漏
 * - recommendedPatterns / recommendedMacro：推荐结论
 */
export function buildOddEven(draws, windowN = 50) {
  if (!draws.length) return null
  const N = Math.min(windowN, draws.length)
  const recent = draws.slice(0, N)

  // 8 形态近期计数
  const count = {}
  ALL_OE.forEach((p) => (count[p.pattern] = 0))
  recent.forEach((d) => {
    count[patternOfBits(bitsOfNum(d.num))]++
  })

  // 8 形态遗漏（从最新往旧，第一次出现的序号即遗漏期数）
  const omit = {}
  ALL_OE.forEach((p) => (omit[p.pattern] = draws.length))
  for (let i = 0; i < draws.length; i++) {
    const p = patternOfBits(bitsOfNum(draws[i].num))
    if (omit[p] === draws.length) omit[p] = i
  }

  const lastP = patternOfBits(bitsOfNum(draws[0].num))
  const prevP = draws[1] ? patternOfBits(bitsOfNum(draws[1].num)) : null

  // 位置奇偶节奏：连出 >=2 期看反转，否则取近期多数
  const perPos = [0, 1, 2].map((pos) => {
    const oddRecent = recent.filter((d) => ODD_DIGITS.has(d.num[pos])).length
    const evenRecent = N - oddRecent
    const firstOdd = ODD_DIGITS.has(draws[0].num[pos])
    let streak = 0
    for (let i = 0; i < draws.length; i++) {
      if (ODD_DIGITS.has(draws[i].num[pos]) === firstOdd) streak++
      else break
    }
    let recommendBit
    let reason
    if (firstOdd && streak >= 2) {
      recommendBit = 0
      reason = `连奇 ${streak} 期，看偶回补`
    } else if (!firstOdd && streak >= 2) {
      recommendBit = 1
      reason = `连偶 ${streak} 期，看奇回补`
    } else if (oddRecent > evenRecent) {
      recommendBit = 1
      reason = `近${N}期奇 ${oddRecent} 次偏多`
    } else if (oddRecent < evenRecent) {
      recommendBit = 0
      reason = `近${N}期偶 ${evenRecent} 次偏多`
    } else {
      recommendBit = firstOdd ? 0 : 1
      reason = '奇偶均衡，看反转'
    }
    return {
      pos,
      label: ['百', '十', '个'][pos],
      oddRecent,
      evenRecent,
      streak,
      current: firstOdd ? '奇' : '偶',
      recommendBit,
      recommend: recommendBit ? '奇' : '偶',
      reason,
    }
  })
  const recBits = perPos.map((p) => p.recommendBit)

  // 8 形态综合评分
  const ranked = ALL_OE.map((p) => {
    const cnt = count[p.pattern] || 0
    const om = omit[p.pattern]
    let score = 0
    // 1. 近期频率（相对均匀 1/8），25 分
    score += (cnt / Math.max(N, 1)) / (1 / 8) * 25
    // 2. 遗漏回补（理论周期 8 期，4 倍封顶），40 分
    score += (Math.min(om / 8, 4) / 4) * 40
    // 3. 位置奇偶节奏匹配，25 分
    let match = 0
    for (let i = 0; i < 3; i++) if (p.bits[i] === recBits[i]) match++
    score += (match / 3) * 25
    // 4. 连出抑制：刚出过则降权（变盘思路）
    if (p.pattern === lastP) score -= 18
    if (p.pattern === prevP) score -= 8
    return { ...p, count: cnt, omit: om, score: Math.round(score * 10) / 10 }
  }).sort((a, b) => b.score - a.score)

  // 4 种宏观形态
  const macroKeys = ['两奇一偶', '两偶一奇', '全奇', '全偶']
  const macroCount = {}
  macroKeys.forEach((k) => (macroCount[k] = 0))
  recent.forEach((d) => {
    macroCount[macroOfBits(bitsOfNum(d.num))]++
  })
  const macroOmit = {}
  macroKeys.forEach((k) => (macroOmit[k] = draws.length))
  for (let i = 0; i < draws.length; i++) {
    const mk = macroOfBits(bitsOfNum(draws[i].num))
    if (macroOmit[mk] === draws.length) macroOmit[mk] = i
  }
  const macroScoreSum = {}
  macroKeys.forEach((k) => (macroScoreSum[k] = 0))
  ranked.forEach((p) => (macroScoreSum[p.macro] += p.score))
  const macroRanked = macroKeys
    .map((k) => ({
      macro: k,
      count: macroCount[k],
      prob: MACRO_PROB[k],
      cycle: +(1 / MACRO_PROB[k]).toFixed(2),
      omit: macroOmit[k],
      score: Math.round((macroScoreSum[k] / MACRO_PATTERN_COUNT[k]) * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score)

  return {
    recentN: N,
    perPos,
    ranked,
    recommendedPatterns: ranked.slice(0, 3).map((p) => p.pattern),
    recommendedBits: ranked[0].bits,
    macro: macroRanked,
    recommendedMacro: macroRanked[0].macro,
    lastPattern: lastP,
  }
}

// ============================================================
// 012 路专项模型
// 012 路 = 号码除以 3 的余数：0 路(0,3,6,9)、1 路(1,4,7)、2 路(2,5,8)。
// 3D 经典第三维度：可做路比、路数遗漏、荐路 / 杀路。
// ============================================================
const ROAD_DIGITS = [
  [0, 3, 6, 9],
  [1, 4, 7],
  [2, 5, 8],
]
const ROAD_NAME = ['0路', '1路', '2路']
const roadOf = (d) => d % 3

// 27 种路数组合（百十个）
const ALL_ROAD_PATTERNS = []
for (let m = 0; m < 27; m++) {
  const roads = [Math.floor(m / 9), Math.floor(m / 3) % 3, m % 3]
  ALL_ROAD_PATTERNS.push({ roads, pattern: roads.join('') })
}

/**
 * 012 路评测：
 * - roadCount / roadOmit：三路近期出现次数与遗漏
 * - roadScore：各路综合分（频率 60 + 遗漏回补 40，理论周期 3 期）
 * - recommendedRoads / killedRoad：荐路（前二）与杀路（末位）
 * - perPosRoad：百十个各位置的路数倾向
 * - patRanked：27 种路数组合评分
 */
export function build012(draws, windowN = 50) {
  if (!draws.length) return null
  const N = Math.min(windowN, draws.length)
  const recent = draws.slice(0, N)

  const roadCount = [0, 0, 0]
  recent.forEach((d) => d.num.forEach((n) => roadCount[roadOf(n)]++))

  const roadOmit = [0, 0, 0]
  for (let r = 0; r < 3; r++) {
    let omit = draws.length
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num.some((n) => roadOf(n) === r)) {
        omit = i
        break
      }
    }
    roadOmit[r] = omit
  }

  const totalOcc = roadCount.reduce((s, v) => s + v, 0) || 1
  const roadScore = [0, 0, 0]
  for (let r = 0; r < 3; r++) {
    roadScore[r] =
      (roadCount[r] / totalOcc) * 60 + (Math.min(roadOmit[r] / 3, 4) / 4) * 40
  }
  const recommendedRoads = [0, 1, 2].sort((a, b) => roadScore[b] - roadScore[a])
  const killedRoad = recommendedRoads[recommendedRoads.length - 1]

  // 位置路数倾向
  const perPosRoad = [0, 1, 2].map((pos) => {
    const counts = [0, 0, 0]
    recent.forEach((d) => counts[roadOf(d.num[pos])]++)
    const current = roadOf(draws[0].num[pos])
    let recommend = 0
    if (counts[1] > counts[recommend]) recommend = 1
    if (counts[2] > counts[recommend]) recommend = 2
    return { pos, label: ['百', '十', '个'][pos], counts, current, recommend }
  })

  // 27 种路数组合评分
  const patCount = {}
  ALL_ROAD_PATTERNS.forEach((p) => (patCount[p.pattern] = 0))
  recent.forEach((d) => {
    const p = d.num.map(roadOf).join('')
    if (patCount[p] !== undefined) patCount[p]++
  })
  const patOmit = {}
  ALL_ROAD_PATTERNS.forEach((p) => (patOmit[p.pattern] = draws.length))
  for (let i = 0; i < draws.length; i++) {
    const p = draws[i].num.map(roadOf).join('')
    if (patOmit[p] === draws.length) patOmit[p] = i
  }
  const patRanked = ALL_ROAD_PATTERNS.map((p) => {
    const cnt = patCount[p.pattern] || 0
    const om = patOmit[p.pattern]
    const score =
      (cnt / Math.max(N, 1)) / (1 / 27) * 50 + (Math.min(om / 27, 4) / 4) * 50
    return { ...p, count: cnt, omit: om, score: Math.round(score * 10) / 10 }
  }).sort((a, b) => b.score - a.score)

  return {
    recentN: N,
    roadDigits: ROAD_DIGITS,
    roadName: ROAD_NAME,
    roadCount,
    roadOmit,
    roadScore: roadScore.map((s) => Math.round(s * 10) / 10),
    recommendedRoads,
    killedRoad,
    perPosRoad,
    patRanked,
    recommendedPatterns: patRanked.slice(0, 3).map((p) => p.pattern),
  }
}

// ============================================================
// 重号 / 邻号模型 + 杀号
// 重号：与上期重复的号码；邻号：上期号码 ±1（不含重号）。
// 杀号：综合评分垫底的号码，给出排除建议。
// ============================================================
export function buildRepeatNeighbor(draws, windowN = 50) {
  if (draws.length < 2) return null
  const last = draws[0].num
  const lastSet = new Set(last)
  const N = Math.min(windowN, draws.length - 1)

  const repeatCounts = [0, 0, 0, 0]
  let neighborHit = 0
  for (let i = 0; i < N; i++) {
    const cur = draws[i].num
    const prev = draws[i + 1].num
    const prevSet = new Set(prev)
    const repeats = cur.filter((d) => prevSet.has(d)).length
    repeatCounts[repeats]++

    const neigh = new Set()
    prev.forEach((d) => {
      if (d > 0) neigh.add(d - 1)
      if (d < 9) neigh.add(d + 1)
    })
    // 邻号不含重号
    const hasNeighbor = cur.some((d) => neigh.has(d) && !prevSet.has(d))
    if (hasNeighbor) neighborHit++
  }
  const total = repeatCounts.reduce((s, v) => s + v, 0) || 1
  const repeatDist = [0, 1, 2, 3].map((k) => ({
    k,
    count: repeatCounts[k],
    rate: +((repeatCounts[k] / total) * 100).toFixed(0),
  }))
  const avgRepeat = +(
    (repeatCounts[1] + repeatCounts[2] * 2 + repeatCounts[3] * 3) / total
  ).toFixed(2)

  // 邻号候选（上期号码 ±1，去重且排除重号）
  const neighSet = new Set()
  last.forEach((d) => {
    if (d > 0) neighSet.add(d - 1)
    if (d < 9) neighSet.add(d + 1)
  })
  const neighborNums = [...neighSet].filter((d) => !lastSet.has(d)).sort((a, b) => a - b)

  return {
    lastNums: last,
    repeatDist,
    avgRepeat,
    expectedRepeat: repeatCounts[1] >= repeatCounts[0] ? 1 : 0,
    repeatCandidates: [...last],
    neighborNums,
    neighborRate: +((neighborHit / total) * 100).toFixed(0),
  }
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

  // --- 5. 奇偶专项模型 ---
  const oddEven = buildOddEven(all, 50)

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

  // --- 推荐奇偶形态（奇偶专项模型） ---
  const recommendedOdd = oddEven.recommendedPatterns

  // --- 012 路专项 ---
  const road012 = build012(all, 50)
  // --- 重号 / 邻号专项 ---
  const repeatNeighbor = buildRepeatNeighbor(all)
  // --- 杀号 ---
  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omit[r.digit],
    reason: omit[r.digit] <= 1 ? '刚开出，短期重复概率低' : '综合评分垫底，可排除',
  }))

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
    oddEven,
    road012,
    repeatNeighbor,
    kill,
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

const fc3dNorm = (arr) => {
  const t = arr.reduce((a, b) => a + b, 0) || 1
  return arr.map((v) => v / t)
}

/**
 * v2 位置评分的四个成分，各自单独归一为 0-9 概率分布（与 predictFC3Dv2
 * 内部硬编码的 40/30/20/10 权重一一对应），供服务端学习循环逐成分打分调权。
 */
export const FC3D_EXPERTS = [
  {
    key: 'freq',
    name: '指数衰减频率',
    fn: (draws, pos) => fc3dNorm(weightedPosFreq(draws.slice(0, Math.min(50, draws.length)), pos, 0.03)),
  },
  {
    key: 'markov',
    name: '一阶转移',
    fn: (draws, pos) => fc3dNorm(transitionMatrix(draws, pos)[draws[0].num[pos]]),
  },
  {
    key: 'omit',
    name: '遗漏回补',
    fn: (draws, pos) => fc3dNorm(posOmission(draws, pos).map((v) => Math.min(v, 20) / 20)),
  },
  {
    key: 'lastNot',
    name: '上期未出',
    fn: (draws, pos) => {
      const last = draws[0].num[pos]
      return fc3dNorm(Array.from({ length: 10 }, (_, d) => (d === last ? 0 : 1)))
    },
  },
]

/**
 * v2 预测引擎：
 * - 百/十/个 位置独立评分（加权频率 + 马尔可夫转移 + 遗漏回补）
 * - 综合评分选出胆码/拖码
 * - 和值/跨度用正态区间（均值±1σ）
 * weightsOverride：长度 4 的归一权重（freq/markov/omit/lastNot），提供时按
 * Σ w_i×100×成分_i[d]/max(成分_i) 评分；不传时维持原 40/30/20/10 路径，行为与现状一致。
 */
export function predictFC3Dv2(draws, { coverRate = 0.8, weightsOverride = null } = {}) {
  if (draws.length < 10) return null
  const last = draws[0]
  const lastAnalysis = analyzeDraw(last.num)
  const recentN = Math.min(50, draws.length)
  const recentDraws = draws.slice(0, recentN)

  // 总遗漏（不分位置）
  const omit = Array(10).fill(0)
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num.includes(d)) break
      omit[d]++
    }
  }

  // --- 012 路专项（影响数字评分） ---
  const road012 = build012(draws, 50)
  const topRoads = road012.recommendedRoads.slice(0, 2)
  const killRoad = road012.killedRoad

  // --- 重号 / 邻号专项 ---
  const repeatNeighbor = buildRepeatNeighbor(draws)

  // --- 每个位置的综合评分 ---
  const posScores = [] // [百, 十, 个]，每个是 Array(10) 的分数
  if (weightsOverride) {
    // 学习权重路径：Σ w_i×100×成分_i[d]/max(成分_i)，成分各自归一后按比例还原
    for (let pos = 0; pos < 3; pos++) {
      const comps = FC3D_EXPERTS.map((e) => e.fn(draws, pos))
      const scales = comps.map((c) => Math.max(...c, 1e-12))
      const scores = Array(10).fill(0)
      for (let d = 0; d < 10; d++) {
        for (let i = 0; i < comps.length; i++) {
          scores[d] += weightsOverride[i] * 100 * (comps[i][d] / scales[i])
        }
      }
      posScores.push(scores)
    }
  } else for (let pos = 0; pos < 3; pos++) {
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
    // 012 路加权：荐路 +8，杀路 -6
    const r = d % 3
    if (topRoads.includes(r)) totalScores[d] += 8
    if (r === killRoad) totalScores[d] -= 6
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

  // --- 和值/跨度：正态区间，宽度由覆盖目标决定（0.8 → ±1.28σ） ---
  const Z = { 0.7: 1.036, 0.75: 1.15, 0.8: 1.282, 0.85: 1.44, 0.9: 1.645 }
  const z = Z[coverRate] || Z[0.8]
  const sums = recentDraws.map((d) => analyzeDraw(d.num).sum)
  const spans = recentDraws.map((d) => analyzeDraw(d.num).span)
  const sumStat = meanStd(sums)
  const spanStat = meanStd(spans)
  const sumRange = [Math.max(0, Math.round(sumStat.mean - z * sumStat.std)), Math.min(27, Math.round(sumStat.mean + z * sumStat.std))]
  const spanRange = [Math.max(0, Math.round(spanStat.mean - z * spanStat.std)), Math.min(9, Math.round(spanStat.mean + z * spanStat.std))]

  // --- 奇偶专项模型：8 种形态本身等概率，按覆盖目标取前 k 个 ---
  const oddEven = buildOddEven(draws, 50)
  const oddCount = Math.min(8, Math.max(1, Math.ceil(coverRate * 8)))
  const recommendedOdd = oddEven.ranked.slice(0, oddCount).map((p) => p.pattern)

  // --- 形态推荐（近期 Top2） ---
  const formDist = {}
  recentDraws.forEach((d) => {
    const a = analyzeDraw(d.num)
    formDist[a.form] = (formDist[a.form] || 0) + 1
  })
  const recommendedForms = Object.entries(formDist).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f)

  // 杀号：综合评分垫底的两个号码
  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omit[r.digit],
    reason: omit[r.digit] <= 1 ? '刚开出，短期重复概率低' : '综合评分垫底，可排除',
  }))

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
    coverRate,
    oddCount,
    oddEven,
    road012,
    repeatNeighbor,
    kill,
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

// ============================================================
// v4 技术指标档（独立档位，v1/v2 与默认档完全不受影响）
//
// 与 v2 的区别只在三处：
//   1. 和值 / 跨度区间不再用「近 50 期均值 ± zσ」，改为 K 线指标投影：
//      中枢 = 0.5 × 布林中轨 + 0.5 × MA5，再按 MACD 柱方向偏移，宽度 = zσ；
//   2. 数字评分叠加「和值兼容度」软约束：某个数字与两码和落在投影区间的
//      概率越高，加分越多，权重固定为 40 分制、不做单期调参；
//   3. 三个位置各自 0–9 的遗漏序列再做 KDJ(9,3,3) / MACD 读数，
//      超卖区、金叉、绿柱收敛正向加分，超买区、死叉、红柱收敛负向，权重 25 分。
//
// 诚实说明：MA / BOLL / MACD / KDJ 都是同一条序列的平滑，不含未来信息，
// 这一档只是换了描述方式，命中率不会因此提高。
// ============================================================

/** 两码和分布（每期拆 3 个两码和，Laplace 平滑到 0–18） */
function pairSumDistribution(draws, n = 120) {
  const counts = Array(19).fill(1)
  const m = Math.min(n, draws.length)
  for (let i = 0; i < m; i++) {
    const [a, b, c] = draws[i].num
    counts[a + b]++
    counts[a + c]++
    counts[b + c]++
  }
  const total = counts.reduce((s, v) => s + v, 0)
  return counts.map((v) => v / total)
}

/**
 * 某位置某数字的 KDJ / MACD 修正系数，取值 [-1, 1]：
 * 低位（K<20）与金叉、绿柱收敛记为正向，高位（K>80 或 J>80）与死叉、红柱收敛记为负向。
 * 只作为「读数归类」的温和修正，不改变任何号码的理论概率。
 */
function kdjSignal(draws, pos, digit) {
  const rows = omissionSeries(draws, (d) => d.num[pos] === digit, 60)
  if (rows.length < 12) return 0
  const values = rows.map((r) => r.omission)
  const kd = kdj(values)
  const m = macd(values)
  const i = values.length - 1
  const K = kd.k[i]
  const J = kd.j[i]
  const hiK = kd.k[i - 1]
  const hiD = kd.d[i - 1]
  const D = kd.d[i]
  const hist = m.hist[i]
  const pHist = m.hist[i - 1]
  let s = 0
  if (K < 20) s += 0.5
  else if (K > 80 || J > 80) s -= 0.5
  if (K > D && hiK <= hiD) s += 0.3
  else if (K < D && hiK >= hiD) s -= 0.3
  if (hist < 0 && hist > pHist) s += 0.2
  else if (hist > 0 && hist < pHist) s -= 0.2
  return Math.max(-1, Math.min(1, s))
}

export function predictFC3Dv4(draws, { coverRate = 0.8 } = {}) {
  const base = predictFC3Dv2(draws, { coverRate })
  if (!base || draws.length < 10) return base

  const n = Math.min(120, draws.length)
  const chrono = draws.slice(0, n).reverse()
  const sumValues = chrono.map((d) => analyzeDraw(d.num).sum)
  const spanValues = chrono.map((d) => analyzeDraw(d.num).span)
  const sumProj = projectNext(sumValues, { coverRate, min: 0, max: 27 })
  const spanProj = projectNext(spanValues, { coverRate, min: 0, max: 9 })

  // 和值投影区间 → 每个数字的兼容度
  const pair = pairSumDistribution(draws, 120)
  const compat = Array.from({ length: 10 }, (_, d) => {
    let p = 0
    for (let s = 0; s <= 18; s++) {
      if (d + s >= sumProj.lo && d + s <= sumProj.hi) p += pair[s]
    }
    return p
  })
  const avgCompat = compat.reduce((a, b) => a + b, 0) / 10

  // 三个位置各自 0–9 的遗漏序列做 KDJ / MACD 读数，取平均作为温和修正（权重 25 分）
  const kdjBias = Array.from({ length: 10 }, (_, d) =>
    +(((kdjSignal(draws, 0, d) + kdjSignal(draws, 1, d) + kdjSignal(draws, 2, d)) / 3).toFixed(3)),
  )

  const ranked = base.ranked
    .map((r) => ({
      digit: r.digit,
      score: +(r.score + (compat[r.digit] - avgCompat) * 40 + kdjBias[r.digit] * 25).toFixed(2),
    }))
    .sort((a, b) => b.score - a.score)

  const hot = ranked.slice(0, 3).map((r) => r.digit)
  const cold = ranked.slice(-3).map((r) => r.digit)
  const dan = ranked.slice(0, 2).map((r) => r.digit)
  const tuo = ranked.slice(2, 6).map((r) => r.digit)
  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: base.omit[r.digit],
    reason: '和值兼容度垫底，指标档排除',
  }))

  const recentSums = draws.slice(0, 50).map((d) => analyzeDraw(d.num).sum)
  const recentSpans = draws.slice(0, 50).map((d) => analyzeDraw(d.num).span)

  return {
    ...base,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    kill,
    sumRange: [sumProj.lo, sumProj.hi],
    spanRange: [spanProj.lo, spanProj.hi],
    sumAvg: sumProj.center,
    spanAvg: spanProj.center,
    sumMode: mode(recentSums),
    spanMode: mode(recentSpans),
    indicator: {
      window: n,
      sumProj,
      spanProj,
      compat: compat.map((c, d) => ({ digit: d, rate: Math.round(c * 100) })),
      kdj: kdjBias.map((bias, d) => ({ digit: d, bias })),
    },
    algorithm: 'v4',
  }
}

/** v4 滚动回测（指标档，结构同 v2，便于同表对照） */
export function walkForwardAuditFC3Dv4(draws, { periods = 50, minTrain = 20 } = {}) {
  const n = Math.min(periods, draws.length - minTrain)
  if (n <= 0) {
    return { periods: 0, rows: [], dist: [], avgHits: 0, baseline: 0, spanRate: 0, sumRate: 0, oddRate: 0, formRate: 0 }
  }
  const rows = []
  for (let i = 0; i < n; i++) {
    const actual = draws[i]
    const train = draws.slice(i + 1)
    if (train.length < minTrain) break
    const pred = predictFC3Dv4(train)
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

/** v4 单期回算（指标档） */
export function backtestFC3Dv4(draws) {
  if (draws.length < 11) return null
  const train = draws.slice(1)
  const actual = draws[0]
  const pred = predictFC3Dv4(train)
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
