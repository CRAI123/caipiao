// 历史数据研究：多种选号策略在滚动回测下的表现对比
// 方法：walk-forward —— 每一期只用「该期之前」的数据计算策略，再与真实开奖对比
// 目的：检验是否存在能稳定超过机选基准的选号方法
import { readFileSync } from 'node:fs'

const draws = JSON.parse(readFileSync('src/data/kl8_history.json', 'utf8')) // 最新在前
const BALL_MAX = 80
const PER_DRAW = 20
const PLAY = 10
const MIN_TRAIN = 30

const comb = (n, k) => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}
const range = (n) => Array.from({ length: n }, (_, i) => i + 1)
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
const sd = (a) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)))
}

// ---------- 策略：输入训练数据（最新在前）+ 上期，输出 play 个号码 ----------
const weightedFreq = (train, halfLife = 20) => {
  const w = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
  const win = train.slice(0, 100).reverse() // 旧→新
  win.forEach((d, i) => {
    const wt = Math.pow(0.5, (win.length - 1 - i) / halfLife)
    for (const n of d.nums) w[n] += wt
  })
  return w
}
const missingOf = (train) => {
  const m = {}
  for (const n of range(BALL_MAX)) {
    let c = 0
    for (const d of train) {
      if (d.nums.includes(n)) break
      c++
    }
    m[n] = c
  }
  return m
}
const rankBy = (obj) => range(BALL_MAX).map((n) => [n, obj[n]]).sort((a, b) => b[1] - a[1]).map((x) => x[0])

const strategies = {
  '机选(随机)': (train) => {
    const pool = range(BALL_MAX)
    const out = []
    for (let i = 0; i < PLAY; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    return out
  },
  '热号 top10': (train) => rankBy(weightedFreq(train)).slice(0, PLAY),
  '冷号 top10': (train) => rankBy(missingOf(train)).slice(0, PLAY),
  '温号 top10': (train) => {
    const w = weightedFreq(train)
    const sorted = rankBy(w)
    return sorted.slice(30, 40) // 频次排名 31-40 的「中间段」
  },
  '冷热混合(现策略)': (train) => {
    const w = weightedFreq(train)
    const m = missingOf(train)
    const mw = Math.max(...Object.values(w)), mm = Math.max(...Object.values(m))
    const s = {}
    for (const n of range(BALL_MAX)) s[n] = w[n] / mw + 0.35 * (m[n] / mm)
    return rankBy(s).slice(0, PLAY)
  },
  '重号(上期开出)': (train, prev) => {
    const w = weightedFreq(train)
    return prev.nums.slice().sort((a, b) => w[b] - w[a]).slice(0, PLAY)
  },
  '斜连(上期邻号)': (train, prev) => {
    const w = weightedFreq(train)
    const set = new Set(prev.nums)
    const nb = new Set()
    for (const n of prev.nums) {
      if (n - 1 >= 1) nb.add(n - 1)
      if (n + 1 <= BALL_MAX) nb.add(n + 1)
    }
    ;[...nb].forEach((n) => set.delete(n))
    return [...nb].sort((a, b) => w[b] - w[a]).slice(0, PLAY)
  },
  '隔期号(2期前)': (train, _prev, prev2) => {
    const w = weightedFreq(train)
    const prev = train[0]
    const pool = prev2.nums.filter((n) => !prev.nums.includes(n))
    return pool.sort((a, b) => w[b] - w[a]).slice(0, PLAY)
  },
  '四区均匀+结构约束': (train) => {
    const w = weightedFreq(train)
    const ranked = rankBy(w)
    const band = (n) => Math.min(3, Math.floor((n - 1) / 20))
    const picked = [],
      used = new Set(),
      bc = [0, 0, 0, 0]
    for (let b = 0; b < 4; b++) {
      const x = ranked.find((n) => band(n) === b)
      if (x) {
        picked.push(x)
        used.add(x)
        bc[b]++
      }
    }
    let odd = picked.filter((n) => n % 2 === 1).length
    for (const n of ranked) {
      if (picked.length >= PLAY) break
      if (used.has(n)) continue
      const b = band(n)
      if (bc[b] >= 3) continue
      if (n % 2 === 1 && odd >= 6) continue
      if (n % 2 === 0 && picked.length - odd >= 6) continue
      picked.push(n)
      used.add(n)
      bc[b]++
      if (n % 2 === 1) odd++
    }
    return picked
  },
  '热5+冷5': (train) => {
    const hot = rankBy(weightedFreq(train)).slice(0, 5)
    const cold = rankBy(missingOf(train)).slice(0, 5)
    return [...hot, ...cold]
  },
}

// ---------- 滚动回测 ----------
const maxI = draws.length - MIN_TRAIN - 1

function audit(name, fn, sims = 1) {
  const reps = sims > 1 ? sims : 1
  const perRun = []
  for (let rep = 0; rep < reps; rep++) {
    const hits = []
    for (let i = 0; i <= maxI; i++) {
      const train = draws.slice(i + 1)
      const prev = draws[i + 1]
      const prev2 = draws[i + 2]
      const picks = new Set(fn(train, prev, prev2))
      hits.push(draws[i].nums.filter((n) => picks.has(n)).length)
    }
    perRun.push(hits)
  }
  // 每次模拟取一个「平均命中」样本，机选分布用模拟间的波动刻画
  const runAvg = perRun.map(mean)
  const avg = mean(runAvg)
  const flat = perRun.flat()
  const n = maxI + 1
  const base = PLAY * (PER_DRAW / BALL_MAX)
  const se = sd(runAvg) || Math.sqrt((PLAY * 0.25 * 0.75) / n)
  const z = (avg - base) / se
  const p4 = Array.from({ length: PLAY + 1 }, (_, k) =>
    (comb(PER_DRAW, k) * comb(BALL_MAX - PER_DRAW, PLAY - k)) / comb(BALL_MAX, PLAY),
  )
    .slice(4)
    .reduce((s, v) => s + v, 0)
  const ge4Rate = flat.filter((h) => h >= 4).length / flat.length
  return { name, n, avg, z, ge4Rate, p4, sd: sd(flat) }
}

const results = []
for (const [name, fn] of Object.entries(strategies)) {
  const sims = name.startsWith('机选') ? 500 : 1
  results.push(audit(name, fn, sims))
}

// ---------- 号码均匀性卡方检验 ----------
const counts = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
draws.forEach((d) => d.nums.forEach((n) => counts[n]++))
const total = draws.length * PER_DRAW
const exp = total / BALL_MAX
const chi2 = Object.values(counts).reduce((s, c) => s + (c - exp) ** 2 / exp, 0)

// ---------- 独立性检验：重号率 vs 理论 5 ----------
let repTotal = 0,
  repN = 0
for (let i = 1; i < draws.length; i++) {
  const cur = new Set(draws[i].nums)
  repTotal += draws[i - 1].nums.filter((n) => cur.has(n)).length
  repN++
}

// ---------- 和值自相关（检验「和值区间」是否可利用） ----------
const sums = draws.map((d) => d.nums.reduce((s, v) => s + v, 0))
const sm = mean(sums)
const cov = mean(sums.slice(0, -1).map((v, i) => (v - sm) * (sums[i + 1] - sm)))
const ac1 = cov / mean(sums.map((v) => (v - sm) ** 2))

// ---------- 输出 ----------
console.log('=== 样本 ===')
console.log(`期数 ${draws.length}（${draws[draws.length - 1].id} → ${draws[0].id}），每期开 ${PER_DRAW} 个号\n`)

console.log('=== 策略擂台（walk-forward，只用每期之前的数据） ===')
console.log('策略'.padEnd(22), '期数', '平均命中', '标准差', 'z值', '中≥4占比', '理论≥4占比')
results
  .sort((a, b) => b.avg - a.avg)
  .forEach((r) => {
    console.log(
      r.name.padEnd(20),
      String(r.n).padStart(4),
      r.avg.toFixed(3).padStart(8),
      r.sd.toFixed(2).padStart(7),
      r.z.toFixed(2).padStart(6),
      (r.ge4Rate * 100).toFixed(1).padStart(8) + '%',
      (r.p4 * 100).toFixed(1).padStart(10) + '%',
    )
  })
console.log(`\n理论平均命中 = ${PLAY} × 20/80 = 2.500，平均命中的标准误 ≈ ${(Math.sqrt((PLAY * 0.25 * 0.75) / results[0].n)).toFixed(3)}`)

console.log('\n=== 数据性质检验 ===')
console.log(`号码频次卡方 = ${chi2.toFixed(1)}（df=79，95% 临界值 ≈ 100.7；越小越接近均匀）`)
console.log(`重号：平均 ${(repTotal / repN).toFixed(2)} 个/期，理论期望 5.00`)
console.log(`和值一阶自相关 = ${ac1.toFixed(3)}（≈0 表示无趋势/无均值回归可利用）`)
console.log(`和值范围 ${Math.min(...sums)} - ${Math.max(...sums)}，均值 ${sm.toFixed(0)}（理论 810）`)

// ---------- 实验 2：换玩法 ----------
console.log('\n=== 实验 2：换玩法（冷热混合 vs 热号 vs 机选） ===')
console.log('玩法'.padEnd(10), '策略'.padEnd(14), '平均命中', '理论值', 'z值')
for (const play of [3, 5, 7, 10]) {
  for (const sname of ['冷热混合(现策略)', '热号 top10']) {
    const fn = (train) => strategies[sname](train).slice(0, play)
    const hits = []
    for (let i = 0; i <= maxI; i++) {
      const picks = new Set(fn(draws.slice(i + 1)))
      hits.push(draws[i].nums.filter((n) => picks.has(n)).length)
    }
    const base = play * (PER_DRAW / BALL_MAX)
    const se = Math.sqrt((play * 0.25 * 0.75) / hits.length)
    const avg = mean(hits)
    console.log(
      `选${String(play).padEnd(7)}`,
      sname.padEnd(14),
      avg.toFixed(3).padStart(8),
      base.toFixed(2).padStart(7),
      ((avg - base) / se).toFixed(2).padStart(6),
    )
  }
  const rnd = []
  for (let rep = 0; rep < 200; rep++) {
    let tot = 0
    for (let i = 0; i <= maxI; i++) {
      const pool = range(BALL_MAX)
      const out = new Set()
      for (let k = 0; k < play; k++) out.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
      tot += draws[i].nums.filter((n) => out.has(n)).length
    }
    rnd.push(tot / (maxI + 1))
  }
  console.log(
    `选${String(play).padEnd(7)}`,
    '机选(随机)'.padEnd(14),
    mean(rnd).toFixed(3).padStart(8),
    (play * 0.25).toFixed(2).padStart(7),
  )
}

// ---------- 实验 3：半衰期参数扫描 ----------
console.log('\n=== 实验 3：加权半衰期扫描（冷热混合策略） ===')
console.log('半衰期'.padEnd(8), '平均命中', 'z值')
for (const hl of [3, 5, 10, 20, 40, 80]) {
  const fn = (train) => {
    const w = weightedFreq(train, hl)
    const m = missingOf(train)
    const mw = Math.max(...Object.values(w)),
      mm = Math.max(...Object.values(m))
    const s = {}
    for (const n of range(BALL_MAX)) s[n] = w[n] / mw + 0.35 * (m[n] / mm)
    return rankBy(s).slice(0, PLAY)
  }
  const hits = []
  for (let i = 0; i <= maxI; i++) {
    const picks = new Set(fn(draws.slice(i + 1)))
    hits.push(draws[i].nums.filter((n) => picks.has(n)).length)
  }
  const base = PLAY * 0.25
  const se = Math.sqrt((PLAY * 0.25 * 0.75) / hits.length)
  console.log(String(hl).padEnd(8), mean(hits).toFixed(3).padStart(8), ((mean(hits) - base) / se).toFixed(2).padStart(6))
}

// ---------- 实验 4：策略融合（多策略投票） ----------
console.log('\n=== 实验 4：策略融合投票（各策略选出的号码按得票排序取前10） ===')
const members = ['热号 top10', '冷号 top10', '温号 top10', '重号(上期开出)', '斜连(上期邻号)', '隔期号(2期前)']
const votes = Object.fromEntries(members.map((m) => [m, 0]))
{
  const hits = []
  for (let i = 0; i <= maxI; i++) {
    const train = draws.slice(i + 1)
    const tally = {}
    for (const m of members) for (const n of strategies[m](train, draws[i + 1], draws[i + 2])) tally[n] = (tally[n] || 0) + 1
    const picks = new Set(rankBy(tally).slice(0, PLAY))
    hits.push(draws[i].nums.filter((n) => picks.has(n)).length)
  }
  const base = PLAY * 0.25
  const se = Math.sqrt((PLAY * 0.25 * 0.75) / hits.length)
  console.log('6策略投票'.padEnd(10), mean(hits).toFixed(3).padStart(8), ((mean(hits) - base) / se).toFixed(2).padStart(6))
  var voteAvg = mean(hits)
  void votes
}

// ---------- 实验 5：permutation 检验 ----------
// 零分布：2000 次「随机选10个号」在同一批真实开奖上的平均命中
// 每个策略的 p 值 = P(随机成绩 ≥ 策略成绩)
console.log('\n=== 实验 5：显著性检验（零分布 = 2000 次机选模拟） ===')
const NULL_N = 2000
const nullAvgs = []
for (let rep = 0; rep < NULL_N; rep++) {
  let tot = 0
  for (let i = 0; i <= maxI; i++) {
    const pool = range(BALL_MAX)
    const out = new Set()
    for (let k = 0; k < PLAY; k++) out.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    tot += draws[i].nums.filter((n) => out.has(n)).length
  }
  nullAvgs.push(tot / (maxI + 1))
}
nullAvgs.sort((a, b) => a - b)
const nullMean = mean(nullAvgs),
  nullSd = sd(nullAvgs)
console.log(
  `零分布：均值 ${nullMean.toFixed(3)}，标准差 ${nullSd.toFixed(3)}，` +
    `95% 区间 [${nullAvgs[Math.floor(NULL_N * 0.025)].toFixed(3)}, ${nullAvgs[Math.floor(NULL_N * 0.975)].toFixed(3)}]`,
)
console.log('策略'.padEnd(22), '平均命中', 'p值(单侧)', '结论')
const testRows = [...results.map((r) => [r.name, r.avg]), ['6策略投票', voteAvg]]
for (const [name, avg] of testRows.sort((a, b) => b[1] - a[1])) {
  const p = nullAvgs.filter((v) => v >= avg).length / NULL_N
  console.log(
    name.padEnd(20),
    avg.toFixed(3).padStart(8),
    (p < 0.001 ? '<0.001' : p.toFixed(3)).padStart(9),
    p < 0.05 ? '  ← 显著！' : '   不显著（与机选无法区分）',
  )
}
console.log('\n注：共检验 11 个策略，按 Bonferroni 校正显著性水平应为 0.05/11 ≈ 0.0045')
