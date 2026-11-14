// ============================================================
// 快乐8 统计分组的严格前推校准
//
// 每一个（期，号）样本只使用它之前的数据：
//   1. 按遗漏把号码分为 刚开 / 温 / 冷 / 深冷 四档
//   2. 用「截至上一期」的各档命中率估计下一期概率（含收缩与截断）
//   3. 与恒定 25%（20/80）基线比较 log-loss
// 若动态分组没有降低 log-loss，说明这些分组不具备预测力。
// ============================================================

const BASE = 0.25
const BUCKETS = ['刚开', '温', '冷', '深冷']

function bucketOf(omission) {
  if (omission === 0) return '刚开'
  if (omission <= 3) return '温'
  if (omission <= 7) return '冷'
  return '深冷'
}

export function kl8Calibration(draws, window = 300) {
  const list = draws.filter((d) => Array.isArray(d.nums) && d.nums.length === 20).slice(0, window)
  if (list.length < 20) return null
  const chrono = [...list].reverse()

  const lastSeen = Array(81).fill(-1)
  const stat = Object.fromEntries(BUCKETS.map((b) => [b, { hit: 0, n: 0 }]))
  const hot = { hit: 0, n: 0 }

  let llDyn = 0
  let llBase = 0
  let count = 0
  let dynWins = 0

  chrono.forEach((d, i) => {
    const set = new Set(d.nums)
    // 近 10 期频次（只用已经开出的期）
    const recent = chrono.slice(Math.max(0, i - 10), i)
    const freq = new Map()
    for (const r of recent) for (const num of r.nums) freq.set(num, (freq.get(num) || 0) + 1)
    const hotPool = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([num]) => num)

    for (let num = 1; num <= 80; num++) {
      const om = lastSeen[num] < 0 ? 99 : i - 1 - lastSeen[num]
      const key = bucketOf(om)
      const hit = set.has(num) ? 1 : 0
      const prior = stat[key]
      const rawFactor = prior.n >= 20 ? prior.hit / prior.n / BASE : 1
      const factor = Math.min(1.85, Math.max(0.55, rawFactor))
      const shrink = 1 + (factor - 1) * (count / (count + 1500))
      const p = Math.min(0.98, Math.max(0.02, BASE * shrink))
      const pb = BASE

      const lDyn = -(hit ? Math.log(p) : Math.log(1 - p))
      const lBase = -(hit ? Math.log(pb) : Math.log(1 - pb))
      llDyn += lDyn
      llBase += lBase
      if (lDyn < lBase) dynWins++
      count++

      stat[key].hit += hit
      stat[key].n++
    }

    for (const num of hotPool) {
      hot.hit += set.has(num) ? 1 : 0
      hot.n++
    }

    for (const num of d.nums) lastSeen[num] = i
  })

  const buckets = BUCKETS.map((b) => ({
    name: b,
    n: stat[b].n,
    rate: stat[b].n ? stat[b].hit / stat[b].n : null,
  }))

  return {
    periods: list.length,
    samples: count,
    buckets,
    hot: { n: hot.n, rate: hot.n ? hot.hit / hot.n : null },
    logLossDyn: llDyn / count,
    logLossBase: llBase / count,
    diff: (llDyn - llBase) / count,
    dynWinRate: dynWins / count,
  }
}
