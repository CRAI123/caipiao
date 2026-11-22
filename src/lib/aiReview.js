// ============================================================
// 上期复盘：把「上期 AI 号码」与「实际开奖」逐项对照，
// 生成一段可注入 AI 提示的复盘结论，用于本期选号思路修正。
//
// ⚠️ 开奖是独立随机事件。复盘只修正结构参考（和值/跨度/奇偶/区间），
//    不改变任何号码的理论概率，也不承诺下次更准。
// ============================================================

const pad2 = (n) => String(n).padStart(2, '0')

const rangeText = (arr) => (arr.length ? `${Math.min(...arr)}–${Math.max(...arr)}` : '—')

const digitStat = (s) => {
  let ds
  if (Array.isArray(s)) ds = s.map(Number)
  else {
    const t = String(s).trim()
    ds = /[\s,，]/.test(t) ? t.split(/[\s,，]+/).map(Number) : [...t].map(Number)
  }
  return {
    sum: ds.reduce((a, b) => a + b, 0),
    span: Math.max(...ds) - Math.min(...ds),
    odd: ds.filter((d) => d % 2 === 1).length,
  }
}

/**
 * 数字彩（福彩3D / 排列三 / 排列五）上期复盘
 * @param {Array} runs auditDigitAi 返回的历史记录 [{ drawId, picks }]
 * @param {Array} draws 开奖数据（最新在前，数字彩用 num 数组）
 * @param {number} digitCount 3 或 5
 */
export function buildDigitReview(runs, draws, digitCount = 3) {
  if (!Array.isArray(runs) || !Array.isArray(draws) || !draws.length) return null
  const latest = draws[0]
  const latestId = Number(latest.id)
  const digits = (latest.num || latest.nums || []).map(Number)
  if (digits.length !== digitCount) return null

  // digit_ai_runs.draw_id = 生成时最新期号，目标期 = draw_id + 1
  const run = runs.find((r) => Number(r.drawId) === latestId - 1 && r.picks)
  if (!run) return null
  const p = run.picks
  const straight = p.straight || []
  const group = digitCount === 3 ? p.group || [] : []
  const group3 = digitCount === 3 ? p.group3 || [] : []
  const all = [...straight, ...group, ...group3]
  if (!all.length) return null

  const actual = digitCount === 7 ? digits.join(' ') : digits.join('')
  const key = [...digits].sort((a, b) => a - b).join('')
  const uniq = new Set(digits).size
  const straightHit = straight.includes(actual)
  const groupHit = digitCount === 3 && uniq === 3 && group.some((x) => [...x].sort().join('') === key)
  const group3Hit = digitCount === 3 && uniq === 2 && group3.some((x) => [...x].sort().join('') === key)

  const a = digitStat(actual)
  const stats = all.map(digitStat)
  const sums = stats.map((x) => x.sum)
  const spans = stats.map((x) => x.span)
  const sumLo = Math.min(...sums)
  const sumHi = Math.max(...sums)
  const spanLo = Math.min(...spans)
  const spanHi = Math.max(...spans)
  const oddCount = {}
  stats.forEach((x) => (oddCount[x.odd] = (oddCount[x.odd] || 0) + 1))
  const oddMode = Number(Object.entries(oddCount).sort((x, y) => y[1] - x[1])[0][0])

  const dev = [
    `和值 ${a.sum}（上期预测 ${rangeText(sums)}${
      a.sum < sumLo - 3 ? '，实际偏低' : a.sum > sumHi + 3 ? '，实际偏高' : '，在预测区间内'
    }）`,
    `跨度 ${a.span}（预测 ${rangeText(spans)}${
      a.span < spanLo - 1 ? '，实际偏小' : a.span > spanHi + 1 ? '，实际偏大' : '，在预测区间内'
    }）`,
    `奇数 ${a.odd} 个（预测多为 ${oddMode} 个${a.odd > oddMode ? '，实际偏多' : a.odd < oddMode ? '，实际偏少' : '，一致'}）`,
  ]
  if (digitCount === 3) dev.push(`形态 ${uniq === 3 ? '组六' : uniq === 2 ? '组三' : '豹子'}`)

  const fixes = []
  if (a.sum < sumLo - 3 || a.sum > sumHi + 3)
    fixes.push(`和值参考从上次的 ${rangeText(sums)} 修正到实际开出的 ${a.sum} 附近`)
  if (a.span < spanLo - 1 || a.span > spanHi + 1) fixes.push(`跨度参考修正到 ${a.span} 附近`)
  if (a.odd !== oddMode) fixes.push(`奇偶配比按 ${a.odd} 个奇数重新平衡`)
  if (!fixes.length) fixes.push('上期结构区间已覆盖实际开奖，本期沿用同样的结构约束，不因单期未命中而放大投入')

  const headline =
    `上期（第 ${latestId} 期）开奖 ${digits.join(' ')}：` +
    (digitCount === 3
      ? `直选${straightHit ? '命中' : '未中'}（${straight.length} 注）、组六${groupHit ? '命中' : '未中'}（${group.length} 组）、组三${group3Hit ? '命中' : '未中'}（${group3.length} 组）`
      : `直选${straightHit ? '命中' : '未中'}（${straight.length} 注）`)

  const text = [
    headline,
    `结构对照：${dev.join('；')}。`,
    `本期修正：${fixes.join('；')}。`,
    '复盘只用于修正本期选号思路，开奖仍是独立随机事件，任何组合的理论概率不变。',
  ].join('\n')

  return { drawId: latestId, actual, headline, text, hits: { straight: straightHit, group: groupHit, group3: group3Hit } }
}

/**
 * 快乐8 上期复盘：AI 终选码 vs 实际开出 20 球
 * @param {Array} runs auditKl8Ai 返回的历史记录 [{ drawId, final, algo }]
 * @param {Array} draws 开奖数据 [{ id, nums }]
 */
export function buildKl8Review(runs, draws) {
  if (!Array.isArray(runs) || !Array.isArray(draws) || !draws.length) return null
  const latest = draws[0]
  const actual = Array.isArray(latest.nums) ? latest.nums : []
  if (actual.length !== 20) return null

  // kl8_ai_deep_runs.draw_id = 目标期号
  const run = runs.find((r) => Number(r.drawId) === Number(latest.id))
  const picks = (run?.final || []).filter((n) => Number.isInteger(n))
  if (picks.length < 3) return null

  const hitSet = new Set(actual)
  const hitNums = picks.filter((n) => hitSet.has(n))
  const expected = +((picks.length * 20) / 80).toFixed(1)
  const algo = (run.algo || []).filter((n) => Number.isInteger(n))
  const algoHits = algo.filter((n) => hitSet.has(n)).length

  const bandOf = (n) => Math.min(3, Math.floor((n - 1) / 20))
  const bandCount = (arr) => {
    const c = [0, 0, 0, 0]
    arr.forEach((n) => c[bandOf(n)]++)
    return c
  }
  const pb = bandCount(picks)
  const ab = bandCount(actual)
  const names = ['1-20', '21-40', '41-60', '61-80']
  const bandDiff = names
    .map((name, i) => ({ name, p: pb[i], a: ab[i], d: ab[i] - pb[i] }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0]
  const oddP = picks.filter((n) => n % 2 === 1).length
  const oddA = actual.filter((n) => n % 2 === 1).length

  const headline =
    `上期（第 ${latest.id} 期）AI 终选 ${picks.length} 码命中 ${hitNums.length} 个（随机期望 ${expected} 个）` +
    (algo.length ? `，纯算法 ${algo.length} 码命中 ${algoHits} 个` : '')

  const text = [
    headline,
    `命中号码：${hitNums.length ? hitNums.map(pad2).join(' ') : '无'}。`,
    `结构对照：区间分布 AI ${pb.join('/')}、实际 ${ab.join('/')}（每区期望 5 个）→ 偏差最大的是 ${bandDiff.name} 区（AI ${bandDiff.p} 个 / 实际 ${bandDiff.a} 个）；奇数 AI ${oddP} 个 / 实际 ${oddA} 个。`,
    `本期修正：终选时${
      bandDiff.d > 0
        ? `上调 ${bandDiff.name} 区的配比（上期实际开出多于 AI 给号）`
        : `下调 ${bandDiff.name} 区的配比（上期实际开出少于 AI 给号）`
    }，奇偶配比参考上期实际开出的 ${oddA} 个奇数调整；仍只在推荐池内选号。`,
    '复盘只用于修正本期选号思路，命中差异属于随机波动，每个号码 25% 的概率不变。',
  ].join('\n')

  return { drawId: latest.id, headline, text, hits: hitNums.length, expected }
}

/**
 * 大乐透上期复盘：AI 终选 5 前区 2 后区 vs 实际开奖
 * @param {Array} runs auditDigitAi({ game: 'dlt' }) 返回的历史记录
 * @param {Array} draws 大乐透开奖（最新在前，含 front / back）
 */
export function buildDltReview(runs, draws) {
  if (!Array.isArray(runs) || !Array.isArray(draws) || !draws.length) return null
  const latest = draws[0]
  const latestId = Number(latest.id)
  const run = runs.find((r) => Number(r.drawId) === latestId - 1 && r.picks)
  const p = run?.picks
  if (!p || !Array.isArray(latest.front) || !Array.isArray(p.front) || !p.front.length) return null

  const frontHit = latest.front.filter((n) => (p.front || []).includes(n))
  const backHit = (p.back || []).filter((n) => (latest.back || []).includes(n))
  const stat = (front) => {
    const nums = [...front].sort((x, y) => x - y)
    return {
      sum: nums.reduce((s, n) => s + n, 0),
      span: nums[nums.length - 1] - nums[0],
      odd: nums.filter((n) => n % 2 === 1).length,
      zone: [0, 1, 2].map((i) => nums.filter((n) => n >= i * 12 + 1 && n <= (i === 2 ? 35 : i * 12 + 12)).length),
    }
  }
  const a = stat(latest.front)
  const b = stat(p.front)

  const headline =
    `上期（第 ${latestId} 期）开奖 前区 ${latest.front.map(pad2).join(' ')} 后区 ${(latest.back || []).map(pad2).join(' ')}：` +
    `AI 上期终选前区命中 ${frontHit.length}/5、后区命中 ${backHit.length}/2` +
    (frontHit.length ? `（${frontHit.map(pad2).join(' ')}）` : '')

  const text = [
    headline,
    `结构对照：和值 ${a.sum}（上期预测 ${b.sum}，差 ${a.sum - b.sum}）；跨度 ${a.span}（预测 ${b.span}）；三区 ${a.zone.join(':')}（预测 ${b.zone.join(':')}）；奇偶 ${a.odd}:${5 - a.odd}（预测 ${b.odd}:${5 - b.odd}）。`,
    `本期修正：终选时把三区配比向 ${a.zone.join(':')} 靠拢、和值参考收窄到 ${Math.max(50, a.sum - 15)}–${Math.min(150, a.sum + 15)} 附近，奇偶按 ${a.odd}:${5 - a.odd} 平衡，后区沿用 ${(latest.back || []).length} 个号的大小搭配；仍只在候选池内选号。`,
    '复盘只用于修正本期选号思路，前区单注仍是 1/21425712，概率不变。',
  ].join('\n')

  return { drawId: latestId, headline, text, hits: frontHit.length, backHits: backHit.length }
}
