// AI 等待期「彩票冷知识」：全部从传入的真实开奖数据现算。
// 算不出（样本不足 / 数据缺字段 / 结果为空）就跳过该类，绝不编造统计。
// draws 约定最新在前：
//   kl8  { id, date, nums: [20 个 1-80] }
//   dlt  { id, date, front: [5 个 1-35], back: [2 个 1-12] }
//   fc3d / pl3 / qxc  { id, date, num: [3 或 7 个 0-9] }

const pad2 = (n) => String(n).padStart(2, '0')

const isDigitGame = (game) => game === 'fc3d' || game === 'pl3' || game === 'qxc'
const fmtN = (game, n) => (isDigitGame(game) ? String(n) : pad2(n))

function numsOf(game, d) {
  if (!d) return null
  const a = game === 'kl8' ? d.nums : game === 'dlt' ? d.front : d.num
  if (!Array.isArray(a) || !a.length) return null
  if (!a.every((n) => Number.isFinite(n))) return null
  return a
}

function backsOf(draws) {
  const out = []
  for (const d of Array.isArray(draws) ? draws : []) {
    if (Array.isArray(d?.back)) for (const b of d.back) if (Number.isFinite(b)) out.push(b)
  }
  return out
}

const sum = (a) => a.reduce((s, n) => s + n, 0)
const clampText = (t) => (t.length <= 40 ? t : `${t.slice(0, 39)}…`)

/**
 * 按彩种从真实数据现算趣闻卡
 * @param {'kl8'|'fc3d'|'pl3'|'dlt'} game
 * @param {Array} draws 最新在前的开奖数组
 * @returns {{title:string, text:string}[]} 最多 10 条，不足有多少给多少
 */
export function buildFunFacts(game, draws) {
  if (!['kl8', 'fc3d', 'pl3', 'qxc', 'dlt'].includes(game)) return []
  const list = (Array.isArray(draws) ? draws : []).filter((d) => numsOf(game, d))
  if (list.length < 5) return []
  const win = list.slice(0, 100)
  const lists = win.map((d) => numsOf(game, d))
  const pool =
    game === 'kl8'
      ? Array.from({ length: 80 }, (_, i) => i + 1)
      : game === 'dlt'
        ? Array.from({ length: 35 }, (_, i) => i + 1)
        : Array.from({ length: 10 }, (_, i) => i)
  const facts = []

  // 1. 近 30 期最热号码
  {
    const recent = lists.slice(0, Math.min(30, lists.length))
    const cnt = new Map()
    recent.forEach((l) => l.forEach((n) => cnt.set(n, (cnt.get(n) || 0) + 1)))
    let best = null
    cnt.forEach((c, n) => {
      if (!best || c > best.c || (c === best.c && n < best.n)) best = { n, c }
    })
    if (best && best.c > 0) {
      facts.push({
        title: '近 30 期最热',
        text: clampText(`近 ${recent.length} 期 ${fmtN(game, best.n)} 最热，开出 ${best.c} 次`),
      })
    }
  }

  // 2. 当前最大遗漏号码（样本内出现过、但离上期最久没露面）
  {
    const omit = lists.map(() => -1)
    lists.forEach((l, i) => l.forEach((n) => {
      const k = pool.indexOf(n)
      if (k >= 0 && omit[k] < 0) omit[k] = i
    }))
    let best = null
    omit.forEach((i, k) => {
      if (i > 0 && (!best || i > best.i)) best = { n: pool[k], i }
    })
    if (best) {
      facts.push({
        title: '最大遗漏',
        text: clampText(`号码 ${fmtN(game, best.n)} 已 ${best.i} 期未露面，样本内遗漏最大`),
      })
    }
  }

  // 3. 上期和值 vs 历史均值
  {
    const hist = lists.slice(1, 101).map(sum)
    if (hist.length >= 10) {
      const last = sum(lists[0])
      const avg = sum(hist) / hist.length
      const diff = Math.round(Math.abs(last - avg))
      facts.push({
        title: '和值对照',
        text: clampText(
          diff === 0
            ? `上期和值 ${last}，与近 ${hist.length} 期均值持平`
            : `上期和值 ${last}，比近 ${hist.length} 期均值${last >= avg ? '高' : '低'} ${diff}`,
        ),
      })
    }
  }

  // 4. 上期奇偶比 vs 样本最常见
  {
    const ratio = (l) => {
      const o = l.filter((n) => n % 2 === 1).length
      return `${o}:${l.length - o}`
    }
    const cnt = new Map()
    lists.forEach((l) => {
      const r = ratio(l)
      cnt.set(r, (cnt.get(r) || 0) + 1)
    })
    let best = null
    cnt.forEach((c, r) => {
      if (!best || c > best.c) best = { r, c }
    })
    const lastR = ratio(lists[0])
    if (best && lastR !== best.r) {
      facts.push({
        title: '奇偶比',
        text: clampText(`上期奇偶 ${lastR}，样本内最常见 ${best.r}（占 ${Math.round((best.c / lists.length) * 100)}%）`),
      })
    }
  }

  // 5. 上期大小比 vs 样本最常见（快乐8 以 41-80 为大，大乐透以 18-35 为大，数字彩以 5-9 为大）
  {
    const bigOf = game === 'kl8' ? (n) => n > 40 : game === 'dlt' ? (n) => n >= 18 : (n) => n >= 5
    const ratio = (l) => {
      const b = l.filter(bigOf).length
      return `${b}:${l.length - b}`
    }
    const cnt = new Map()
    lists.forEach((l) => {
      const r = ratio(l)
      cnt.set(r, (cnt.get(r) || 0) + 1)
    })
    let best = null
    cnt.forEach((c, r) => {
      if (!best || c > best.c) best = { r, c }
    })
    const lastR = ratio(lists[0])
    if (best && lastR !== best.r) {
      facts.push({
        title: '大小比',
        text: clampText(`上期大小 ${lastR}，样本内最常见 ${best.r}（占 ${Math.round((best.c / lists.length) * 100)}%）`),
      })
    }
  }

  // 6. 连庄：上期与再上期重复的号码个数
  if (lists.length >= 2) {
    const prev = new Set(lists[1])
    const k = lists[0].filter((n) => prev.has(n)).length
    facts.push({
      title: '连庄',
      text: clampText(k > 0 ? `上期有 ${k} 个号与再上期重复` : '上期号码与再上期一个都没重复'),
    })
  }

  // 7. 样本内从未开出的号码（若 > 0）
  {
    const seen = new Set()
    lists.forEach((l) => l.forEach((n) => seen.add(n)))
    const never = pool.filter((n) => !seen.has(n))
    if (never.length > 0) {
      facts.push({
        title: '未露面号码',
        text: clampText(`${lists.length} 期样本里 ${never.length} 个号从未开出（如 ${fmtN(game, never[0])}）`),
      })
    }
  }

  // 8. 同月同日历史期号（数据覆盖不到时跳过）
  {
    const d0 = win[0]?.date
    const md = typeof d0 === 'string' && d0.length >= 10 ? d0.slice(5) : null
    if (md) {
      const same = win.slice(1).filter((d) => typeof d.date === 'string' && d.date.slice(5) === md)
      if (same.length > 0) {
        const id = same[0].id ?? same[0].drawId ?? ''
        facts.push({
          title: '同月同日',
          text: clampText(`${md} 样本内还有 ${same.length} 期（如第 ${id} 期）`),
        })
      }
    }
  }

  // 9. 大乐透专属：上期前区三区分布
  if (game === 'dlt') {
    const front = lists[0]
    const z = [0, 0, 0]
    front.forEach((n) => {
      z[n <= 12 ? 0 : n <= 24 ? 1 : 2]++
    })
    const maxI = z.indexOf(Math.max(...z))
    facts.push({
      title: '前区区间',
      text: clampText(`上期前区三区 ${z.join(':')}，第 ${maxI + 1} 区最厚`),
    })

    // 10. 大乐透专属：后区最大遗漏
    const backs = backsOf(win)
    if (backs.length >= 10) {
      let best = null
      for (let b = 1; b <= 12; b++) {
        const i = backs.indexOf(b)
        if (i > 0 && (!best || i > best.i)) best = { b, i }
      }
      if (best) {
        facts.push({
          title: '后区遗漏',
          text: clampText(`后区 ${pad2(best.b)} 已 ${best.i} 个开奖号未出，12 码中遗漏最大`),
        })
      }
    }
  }

  return facts.slice(0, 10)
}
