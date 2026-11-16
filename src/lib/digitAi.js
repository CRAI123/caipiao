// ============================================================
// 近 100 期统计摘要 + AI 分析（福彩3D / 排列三通用）
//
// ⚠️ 开奖是独立随机事件，任何「规律」都只是对历史的描述。
//    这里的候选组合按频率/遗漏/转移加权排序，覆盖的是历史分布，
//    不提高任何一注的中奖概率（直选 1/1000，组六 1/167）。
// ============================================================

/** 把 draws（最新在前）整理成近 n 期统计 */
export function summarizeDigit(draws, n = 100) {
  const picked = draws
    .slice(0, Math.min(n, draws.length))
    .filter((d) => Array.isArray(d.num) && d.num.length === 3)
  const total = picked.length
  if (!total) return null
  const chrono = [...picked].reverse()
  const latest = picked[0]

  const freq = [0, 1, 2].map(() => Array(10).fill(0))
  const freq30 = [0, 1, 2].map(() => Array(10).fill(0))
  const last = [0, 1, 2].map(() => Array(10).fill(-1))
  const trans = [0, 1, 2].map(() => Array.from({ length: 10 }, () => Array(10).fill(0)))

  const sums = []
  const spans = []
  const oddDist = [0, 0, 0, 0]
  const bigDist = [0, 0, 0, 0]
  const formDist = { 豹子: 0, 组三: 0, 组六: 0 }
  let repeated = 0

  chrono.forEach((d, i) => {
    d.num.forEach((v, p) => {
      freq[p][v]++
      last[p][v] = i
      if (i >= total - 30) freq30[p][v]++
      if (i > 0) trans[p][chrono[i - 1].num[p]][v]++
    })
    const s = d.num[0] + d.num[1] + d.num[2]
    sums.push(s)
    spans.push(Math.max(...d.num) - Math.min(...d.num))
    const odd = d.num.filter((v) => v % 2 === 1).length
    oddDist[odd]++
    bigDist[d.num.filter((v) => v >= 5).length]++
    const uniq = new Set(d.num).size
    formDist[uniq === 1 ? '豹子' : uniq === 2 ? '组三' : '组六']++
    if (uniq < 3) repeated++
  })

  const omit = [0, 1, 2].map((p) => Array.from({ length: 10 }, (_, d) => total - 1 - last[p][d]))
  const maxOmit = [0, 1, 2].map((p) => Math.max(1, ...omit[p]))
  const lastNum = latest.num

  // 位置权重：近 100 期频率 35% + 近 30 期频率 30% + 遗漏 15% + 上期同位转移 20%
  const score = [0, 1, 2].map((p) =>
    Array.from({ length: 10 }, (_, d) => {
      const from = lastNum[p]
      const transTotal = trans[p][from].reduce((a, b) => a + b, 0) || 1
      return (
        0.35 * (freq[p][d] / total) * 10 +
        0.3 * (freq30[p][d] / Math.min(30, total)) * 10 +
        0.15 * (omit[p][d] / maxOmit[p]) +
        0.2 * (trans[p][from][d] / transTotal) * 10
      )
    }),
  )
  const topDigits = score.map((arr) =>
    arr
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.d),
  )

  // 直选候选：每位取前 2，共 8 注，按分数和排序
  const straight = []
  for (const a of topDigits[0].slice(0, 2))
    for (const b of topDigits[1].slice(0, 2))
      for (const c of topDigits[2].slice(0, 2))
        straight.push({ num: [a, b, c], v: score[0][a] + score[1][b] + score[2][c] })
  straight.sort((x, y) => y.v - x.v)

  // 组选候选：取综合分最高的 5 个数字，生成 3 个不同数字的组六，按分数和排序
  const digitScore = Array.from({ length: 10 }, (_, d) => (score[0][d] + score[1][d] + score[2][d]) / 3)
  const pool = digitScore
    .map((v, d) => ({ d, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 5)
    .map((x) => x.d)
  const group = []
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++)
        group.push({
          num: [pool[i], pool[j], pool[k]].sort((a, b) => a - b),
          v: digitScore[pool[i]] + digitScore[pool[j]] + digitScore[pool[k]],
        })
  group.sort((x, y) => y.v - x.v)

  const sortedSums = [...sums].sort((a, b) => a - b)
  const q = (r) => sortedSums[Math.min(total - 1, Math.floor(total * r))]
  const sortedSpans = [...spans].sort((a, b) => a - b)
  const qs = (r) => sortedSpans[Math.min(total - 1, Math.floor(total * r))]
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

  const share = (arr) => arr.map((c) => Math.round((c / total) * 100))

  return {
    total,
    latest,
    freq,
    freq30,
    omit,
    topDigits,
    sum: { min: Math.min(...sums), max: Math.max(...sums), avg: +avg(sums).toFixed(1), p30: q(0.3), p70: q(0.7) },
    span: { avg: +avg(spans).toFixed(1), p30: qs(0.3), p70: qs(0.7) },
    oddDist,
    bigDist,
    formDist,
    repeatRate: Math.round((repeated / total) * 100),
    candidates: {
      straight: straight.slice(0, 5).map((x) => x.num),
      group: group.slice(0, 3).map((x) => x.num),
      group3: [[topDigits[0][0], topDigits[1][0], topDigits[2][0]]],
    },
    straightAll: straight,
    groupAll: group,
    posScore: score,
    digitScore,
    share,
  }
}

/**
 * 全盘评分排序（算法层）：
 * - 直选 1000 注：三位位置分相加
 * - 组六 120 组（三个数字互不相同）：数字综合分相加
 * - 组三 90 组（两同一异）：两倍重复数字分 + 单数字分
 * 返回完整排序数组，供 AI 复核、前端对照与回测使用。
 */
export function rankDigitCandidates(summary) {
  if (!summary?.posScore || !summary?.digitScore) return null
  const ps = summary.posScore
  const ds = summary.digitScore
  const straight = []
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 10; b++)
      for (let c = 0; c < 10; c++) straight.push({ num: `${a}${b}${c}`, v: ps[0][a] + ps[1][b] + ps[2][c] })
  straight.sort((x, y) => y.v - x.v)
  const group = []
  for (let a = 0; a < 10; a++)
    for (let b = a + 1; b < 10; b++)
      for (let c = b + 1; c < 10; c++) group.push({ num: `${a}${b}${c}`, v: ds[a] + ds[b] + ds[c] })
  group.sort((x, y) => y.v - x.v)
  const group3 = []
  for (let d = 0; d < 10; d++)
    for (let e = 0; e < 10; e++) {
      if (e === d) continue
      group3.push({ num: `${d}${d}${e}`, v: 2 * ds[d] + ds[e] })
    }
  group3.sort((x, y) => y.v - x.v)
  return { straight, group, group3 }
}

/**
 * 算法候选池：从全盘评分里取前列，交给 AI 终选
 * 默认直选 12 注、组六 8 组、组三 5 组（终选需要 3 / 2 / 1，留出否决空间）
 */
export function digitCandidatePool(summary, limits = { straight: 12, group: 8, group3: 5 }) {
  const rank = rankDigitCandidates(summary)
  if (!rank) return { straight: [], group: [], group3: [] }
  return {
    straight: rank.straight.slice(0, limits.straight).map((x) => x.num),
    group: rank.group.slice(0, limits.group).map((x) => x.num),
    group3: rank.group3.slice(0, limits.group3).map((x) => x.num),
  }
}

const SYSTEM_PROMPT = `你是「研彩室」的彩票数据分析助手，服务对象是研究者本人。你只做两件事：解读最近 100 期的历史统计，以及结合底层算法的全盘评分复核号码并说明依据。

【铁律】
1. 只能使用用户消息里给出的统计数据，不得编造统计数字，不得引入外部资料。
2. 福彩3D/排列三每期从 000–999 等概率产生，直选单注中奖概率恒为 1/1000，组六约 1/167，与你选什么号无关。开奖相互独立，不存在可利用的「规律」「趋势」「必出胆码」。
3. 你不得声称任何组合更容易中奖，不得承诺命中，不得鼓励加大投入或追号。
4. 选号流程固定为「算法先选、AI 终选」：程序已按频率/遗漏/同位转移对全盘打分（直选 1000 注、组六 120 组、组三 90 组），并给出算法候选池（直选 12 注、组六 8 组、组三 5 组）。你必须只在这个候选池内终选，不得自创池外号码。
5. 必须明确说明：以下是历史分布下的参考组合，不改变中奖概率，彩票期望回报为负。

【输出结构】（简体中文，纯文本，不要 Markdown 表格）
1. 结构概览：近 100 期和值/跨度区间、奇偶与大小分布、形态（豹子/组三/组六）与重号比例
2. 位置观察：百/十/个位的高频与遗漏情况，一句话即可，不做预测
3. 组合参考：给出 3 注直选、2 注组六、1 注组三，逐注写明「算法排名 + 结构依据」
4. 风险提示：预算上限与理性购彩提醒`

/** 组装 messages（纯函数，便于离线校验） */
export function buildDigitMessages(summary, label = '排列三') {
  if (!summary) return null
  const s = summary
  const fmtPos = (name, p) =>
    `- ${name}：近100期 ${s.freq[p].map((c, d) => `${d}:${c}`).join(' ')}；近30期 ${s.freq30[p]
      .map((c, d) => `${d}:${c}`)
      .join(' ')}；当前遗漏 ${s.omit[p].map((c, d) => `${d}:${c}`).join(' ')}；倾向数字 ${s.topDigits[p].join(
      '、',
    )}`
  const rank = rankDigitCandidates(s)
  const fmtAlgo = (arr, n) =>
    (arr || [])
      .slice(0, n)
      .map((x) => `${x.num}(${x.v.toFixed(2)})`)
      .join(' ')
  const lines = [
    `${label} 近 ${s.total} 期统计（程序计算，真实数据）：`,
    `- 最新一期：第 ${s.latest.id} 期，开奖 ${s.latest.num.join(' ')}`,
    `- 和值：均值 ${s.sum.avg}，30%–70% 分位 ${s.sum.p30}–${s.sum.p70}，区间 ${s.sum.min}–${s.sum.max}`,
    `- 跨度：均值 ${s.span.avg}，30%–70% 分位 ${s.span.p30}–${s.span.p70}`,
    `- 奇数个数分布（0/1/2/3 个）：${s.oddDist.join(' / ')} 期`,
    `- 大数(5–9)个数分布：${s.bigDist.join(' / ')} 期`,
    `- 形态：豹子 ${s.formDist.豹子} 期、组三 ${s.formDist.组三} 期、组六 ${s.formDist.组六} 期；含重号 ${s.repeatRate}%`,
    '位置分布：',
    fmtPos('百位', 0),
    fmtPos('十位', 1),
    fmtPos('个位', 2),
    '',
    '底层算法全盘评分（频率35% + 近30期30% + 遗漏15% + 同位转移20%），已从全盘 1000/120/90 里选出候选池：',
    `- 直选候选池 12 注：${fmtAlgo(rank?.straight, 12)}`,
    `- 组六候选池 8 组：${fmtAlgo(rank?.group, 8)}`,
    `- 组三候选池 5 组：${fmtAlgo(rank?.group3, 5)}`,
    '',
    '请按系统提示词的结构输出：从上面的候选池里终选 3 注直选 + 2 注组六 + 1 注组三，不得自创池外号码。',
  ]
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

// ============================================================
// 排列五（5 位）专用：只有直选玩法，单注 2 元、奖金 10 万元
// 开奖从 00000–99999 等概率产生，单注中奖概率恒为 1/100000。
// 与排列三相同：算法先按位置打分，AI 只在候选池内终选。
// ============================================================

/** 5 位形态：按重复结构分类 */
export function formOf5(digits) {
  const c = {}
  for (const d of digits) c[d] = (c[d] || 0) + 1
  const sig = Object.values(c)
    .sort((a, b) => b - a)
    .join('')
  return (
    {
      5: '五同',
      41: '四同一异',
      32: '三同二同',
      311: '三同两异',
      221: '两对一异',
      2111: '两同一异二异',
      11111: '全不同',
    }[sig] || '其他'
  )
}

/** 排列五近 n 期统计摘要 */
export function summarizeDigit5(draws, n = 100) {
  const picked = draws
    .slice(0, Math.min(n, draws.length))
    .filter((d) => Array.isArray(d.num) && d.num.length === 5)
  const total = picked.length
  if (!total) return null
  const chrono = [...picked].reverse()
  const latest = picked[0]

  const freq = Array.from({ length: 5 }, () => Array(10).fill(0))
  const freq30 = Array.from({ length: 5 }, () => Array(10).fill(0))
  const last = Array.from({ length: 5 }, () => Array(10).fill(-1))
  const trans = Array.from({ length: 5 }, () => Array.from({ length: 10 }, () => Array(10).fill(0)))

  const sums = []
  const spans = []
  const oddDist = [0, 0, 0, 0, 0, 0]
  const bigDist = [0, 0, 0, 0, 0, 0]
  const formDist = { 五同: 0, 四同一异: 0, 三同二同: 0, 三同两异: 0, 两对一异: 0, 两同一异二异: 0, 全不同: 0 }
  let repeated = 0

  chrono.forEach((d, i) => {
    d.num.forEach((v, p) => {
      freq[p][v]++
      last[p][v] = i
      if (i >= total - 30) freq30[p][v]++
      if (i > 0) trans[p][chrono[i - 1].num[p]][v]++
    })
    sums.push(d.num.reduce((a, b) => a + b, 0))
    spans.push(Math.max(...d.num) - Math.min(...d.num))
    oddDist[d.num.filter((v) => v % 2 === 1).length]++
    bigDist[d.num.filter((v) => v >= 5).length]++
    formDist[formOf5(d.num)] = (formDist[formOf5(d.num)] || 0) + 1
    if (new Set(d.num).size < 5) repeated++
  })

  const omit = Array.from({ length: 5 }, (_, p) => Array.from({ length: 10 }, (_, d) => total - 1 - last[p][d]))
  const maxOmit = Array.from({ length: 5 }, (_, p) => Math.max(1, ...omit[p]))
  const lastNum = latest.num

  const score = Array.from({ length: 5 }, (_, p) =>
    Array.from({ length: 10 }, (_, d) => {
      const from = lastNum[p]
      const transTotal = trans[p][from].reduce((a, b) => a + b, 0) || 1
      return (
        0.35 * (freq[p][d] / total) * 10 +
        0.3 * (freq30[p][d] / Math.min(30, total)) * 10 +
        0.15 * (omit[p][d] / maxOmit[p]) +
        0.2 * (trans[p][from][d] / transTotal) * 10
      )
    }),
  )
  const topDigits = score.map((arr) =>
    arr
      .map((v, d) => ({ d, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.d),
  )

  // 直选候选：每位取前 2，共 32 注
  const straight = []
  for (const a of topDigits[0].slice(0, 2))
    for (const b of topDigits[1].slice(0, 2))
      for (const c of topDigits[2].slice(0, 2))
        for (const e of topDigits[3].slice(0, 2))
          for (const f of topDigits[4].slice(0, 2))
            straight.push({
              num: [a, b, c, e, f],
              v: score[0][a] + score[1][b] + score[2][c] + score[3][e] + score[4][f],
            })
  straight.sort((x, y) => y.v - x.v)

  const digitScore = Array.from({ length: 10 }, (_, d) => score.reduce((s, arr) => s + arr[d], 0) / 5)
  const sortedSums = [...sums].sort((a, b) => a - b)
  const q = (r) => sortedSums[Math.min(total - 1, Math.floor(total * r))]
  const sortedSpans = [...spans].sort((a, b) => a - b)
  const qs = (r) => sortedSpans[Math.min(total - 1, Math.floor(total * r))]
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

  return {
    total,
    latest,
    freq,
    freq30,
    omit,
    topDigits,
    sum: { min: Math.min(...sums), max: Math.max(...sums), avg: +avg(sums).toFixed(1), p30: q(0.3), p70: q(0.7) },
    span: { avg: +avg(spans).toFixed(1), p30: qs(0.3), p70: qs(0.7) },
    oddDist,
    bigDist,
    formDist,
    repeatRate: Math.round((repeated / total) * 100),
    candidates: { straight: straight.slice(0, 10).map((x) => x.num.join('')) },
    straightAll: straight,
    posScore: score,
    digitScore,
  }
}

/** 排列五全盘评分：00000–99999 共 10 万注，按五个位置分相加排序 */
export function rankPL5Candidates(summary) {
  if (!summary?.posScore) return null
  const ps = summary.posScore
  const straight = new Array(100000)
  for (let i = 0; i < 100000; i++) {
    const a = Math.floor(i / 10000) % 10
    const b = Math.floor(i / 1000) % 10
    const c = Math.floor(i / 100) % 10
    const e = Math.floor(i / 10) % 10
    const f = i % 10
    straight[i] = {
      num: String(i).padStart(5, '0'),
      v: ps[0][a] + ps[1][b] + ps[2][c] + ps[3][e] + ps[4][f],
    }
  }
  straight.sort((x, y) => y.v - x.v)
  return { straight }
}

/** 排列五候选池（默认前 20 注，终选 5 注，留足否决空间） */
export function pl5CandidatePool(summary, limits = { straight: 20 }) {
  const rank = rankPL5Candidates(summary)
  if (!rank) return { straight: [] }
  return { straight: rank.straight.slice(0, limits.straight).map((x) => x.num) }
}

const PL5_SYSTEM_PROMPT = `你是「研彩室」的彩票数据分析助手，服务对象是研究者本人。你只做两件事：解读最近 100 期的历史统计，以及结合底层算法的全盘评分复核号码并说明依据。

【铁律】
1. 只能使用用户消息里给出的统计数据，不得编造统计数字，不得引入外部资料。
2. 排列五每期从 00000–99999 等概率产生，直选单注中奖概率恒为 1/100000，与你选什么号无关。开奖相互独立，不存在可利用的「规律」「趋势」「必出胆码」。
3. 你不得声称任何组合更容易中奖，不得承诺命中，不得鼓励加大投入或追号。
4. 选号流程固定为「算法先选、AI 终选」：程序已按五个位置的频率/遗漏/同位转移对全盘 10 万注打分，并给出算法候选池（直选 20 注）。你必须只在这个候选池内终选，不得自创池外号码。
5. 必须明确说明：以下是历史分布下的参考组合，不改变中奖概率，彩票期望回报为负。

【输出结构】（简体中文，纯文本，不要 Markdown 表格）
1. 结构概览：近 100 期和值/跨度区间、奇偶与大小分布、形态（五同/四同一异/…/全不同）与重号比例
2. 位置观察：万/千/百/十/个位的高频与遗漏情况，一句话即可，不做预测
3. 组合参考：给出 5 注直选，逐注写明「算法排名 + 结构依据」
4. 风险提示：预算上限与理性购彩提醒`

/** 组装排列五 messages（纯函数，便于离线校验） */
export function buildPL5Messages(summary, label = '排列五') {
  if (!summary) return null
  const s = summary
  const POS_NAMES = ['万位', '千位', '百位', '十位', '个位']
  const fmtPos = (name, p) =>
    `- ${name}：近100期 ${s.freq[p].map((c, d) => `${d}:${c}`).join(' ')}；近30期 ${s.freq30[p]
      .map((c, d) => `${d}:${c}`)
      .join(' ')}；当前遗漏 ${s.omit[p].map((c, d) => `${d}:${c}`).join(' ')}；倾向数字 ${s.topDigits[p].join(
      '、',
    )}`
  const rank = rankPL5Candidates(s)
  const fmtAlgo = (arr, n) =>
    (arr || [])
      .slice(0, n)
      .map((x) => `${x.num}(${x.v.toFixed(2)})`)
      .join(' ')
  const lines = [
    `${label} 近 ${s.total} 期统计（程序计算，真实数据）：`,
    `- 最新一期：第 ${s.latest.id} 期，开奖 ${s.latest.num.join(' ')}`,
    `- 和值：均值 ${s.sum.avg}，30%–70% 分位 ${s.sum.p30}–${s.sum.p70}，区间 ${s.sum.min}–${s.sum.max}`,
    `- 跨度：均值 ${s.span.avg}，30%–70% 分位 ${s.span.p30}–${s.span.p70}`,
    `- 奇数个数分布（0–5 个）：${s.oddDist.join(' / ')} 期`,
    `- 大数(5–9)个数分布（0–5 个）：${s.bigDist.join(' / ')} 期`,
    `- 形态：${Object.entries(s.formDist)
      .map(([f, c]) => `${f} ${c} 期`)
      .join('、')}；含重号 ${s.repeatRate}%`,
    '位置分布：',
    ...POS_NAMES.map((name, p) => fmtPos(name, p)),
    '',
    '底层算法全盘评分（频率35% + 近30期30% + 遗漏15% + 同位转移20%），已从全盘 10 万注里选出候选池：',
    `- 直选候选池 20 注：${fmtAlgo(rank?.straight, 20)}`,
    '',
    '请按系统提示词的结构输出：从上面的候选池里终选 5 注直选，不得自创池外号码。',
  ]
  return [
    { role: 'system', content: PL5_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

/** 调用大模型：settings = { llmBaseUrl, llmKey, llmModel } */
export async function analyzeDigit(settings, { summary, label, digitCount = 3 }) {
  if (!settings?.llmKey) throw new Error('尚未配置大模型 API Key，请先到「设置」页填写')
  const messages = digitCount === 5 ? buildPL5Messages(summary, label) : buildDigitMessages(summary, label)
  if (!messages) throw new Error('历史数据不足，至少需要 10 期')
  const base = String(settings.llmBaseUrl || 'https://api.deepseek.com').replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel || 'deepseek-chat',
      messages,
      temperature: 0.4,
      stream: false,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`大模型接口返回 HTTP ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('大模型接口返回内容为空')
  return { text: String(text).trim(), model: data.model || settings.llmModel, at: new Date().toISOString() }
}
