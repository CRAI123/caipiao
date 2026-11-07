// 深度数据挖掘：检验快乐8历史开奖是否存在任何可利用的统计结构
// 全部检验的零假设都是「各期独立、80个号码等概率」
import { readFileSync } from 'node:fs'

const draws = JSON.parse(readFileSync('src/data/kl8_history.json', 'utf8')) // 最新在前
const N = draws.length
const BALL_MAX = 80
const PER_DRAW = 20
const range = (n) => Array.from({ length: n }, (_, i) => i + 1)
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
const sd = (a) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)))
}
const chrono = draws.slice().reverse() // 旧→新
const sets = chrono.map((d) => new Set(d.nums))

// 标准正态上侧概率（Abramowitz-Stegun 近似）
const normSf = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = Math.exp(-z * z / 2) * poly
  return z >= 0 ? p : 1 - p
}
// 卡方 p 值近似（Wilson-Hilferty 变换到正态）
const chi2p = (x, df) => {
  const z = (Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df))
  return normSf(z)
}

console.log(`样本：${N} 期（${draws[N - 1].id} → ${draws[0].id}），每期 ${PER_DRAW} 个号\n`)

// ============================================================
// 检验 1：马尔可夫依赖 —— 上期开出某个号，下期各个号的概率会变吗？
// 构建 80×80 共现表，与独立性模型比较
// ============================================================
{
  const M = Array.from({ length: BALL_MAX + 1 }, () => new Array(BALL_MAX + 1).fill(0))
  const rowSum = new Array(BALL_MAX + 1).fill(0)
  const colSum = new Array(BALL_MAX + 1).fill(0)
  for (let t = 1; t < N; t++) {
    const prev = sets[t - 1],
      cur = sets[t]
    for (const a of prev)
      for (const b of cur) {
        M[a][b]++
        rowSum[a]++
        colSum[b]++
      }
  }
  const total = rowSum.reduce((s, v) => s + v, 0)
  let chi2 = 0,
    cells = 0
  let maxCell = { z: 0, a: 0, b: 0, o: 0, e: 0 }
  for (let a = 1; a <= BALL_MAX; a++) {
    for (let b = 1; b <= BALL_MAX; b++) {
      const e = (rowSum[a] * colSum[b]) / total
      if (e < 1) continue
      chi2 += (M[a][b] - e) ** 2 / e
      cells++
      const z = (M[a][b] - e) / Math.sqrt(e)
      if (Math.abs(z) > Math.abs(maxCell.z)) maxCell = { z, a, b, o: M[a][b], e }
    }
  }
  const df = cells - (80 + 80) + 1
  console.log('=== 检验1：期与期之间的依赖（马尔可夫共现表） ===')
  console.log(`卡方 = ${chi2.toFixed(0)}，自由度 ≈ ${df}（独立时卡方≈自由度）`)
  console.log(`p 值 ≈ ${chi2p(chi2, df).toFixed(3)}  → ${chi2 < df * 1.1 ? '无任何依赖，完全独立' : '存在依赖！'}`)
  console.log(
    `最极端格子：${maxCell.a} 之后开 ${maxCell.b}，实测 ${maxCell.o} 次 / 期望 ${maxCell.e.toFixed(1)} 次（z=${maxCell.z.toFixed(2)}）\n`,
  )
}

// ============================================================
// 检验 2：每个号码的滞后自相关（某号上期出，本期出的概率变吗）
// ============================================================
{
  const acs = []
  for (const n of range(BALL_MAX)) {
    const x = sets.map((s) => (s.has(n) ? 1 : 0))
    const m = mean(x)
    const cov = mean(x.slice(0, -1).map((v, i) => (v - m) * (x[i + 1] - m)))
    const v = mean(x.map((t) => (t - m) ** 2))
    acs.push(v ? cov / v : 0)
  }
  const mAc = mean(acs),
    sAc = sd(acs)
  console.log('=== 检验2：80 个号码各自的「上期出→本期出」自相关 ===')
  console.log(`平均自相关 = ${mAc.toFixed(4)}，标准差 = ${sAc.toFixed(3)}`)
  console.log(`80 个号码平均值的标准误 ≈ ${(sAc / Math.sqrt(80)).toFixed(4)}`)
  console.log(
    `偏离 0 达 ${(mAc / (sAc / Math.sqrt(80))).toFixed(2)} 个标准差 → ${
      Math.abs(mAc / (sAc / Math.sqrt(80))) > 2 ? '存在记忆效应！' : '无记忆效应，每期重新洗牌'
    }\n`,
  )
}

// ============================================================
// 检验 3：重号在滞后 1~5 期的发生率（隔1、隔2…期号会不会跳回来）
// ============================================================
{
  console.log('=== 检验3：各滞后期重号发生率（理论值均为 5.00） ===')
  for (let lag = 1; lag <= 5; lag++) {
    let tot = 0,
      cnt = 0
    for (let t = lag; t < N; t++) {
      tot += chrono[t].nums.filter((n) => sets[t - lag].has(n)).length
      cnt++
    }
    const avg = tot / cnt
    // 每期重号数 ~ Hypergeo(80,20,20)，均值5，方差≈3.61；cnt 期均值的标准误
    const se = Math.sqrt(3.61 / cnt)
    console.log(
      `滞后 ${lag} 期：平均 ${avg.toFixed(2)} 个（z=${((avg - 5) / se).toFixed(2)}）${
        Math.abs((avg - 5) / se) > 2 ? ' ← 偏离随机' : ''
      }`,
    )
  }
  console.log('')
}

// ============================================================
// 检验 4：号码两两共现（某些号码喜欢一起出现吗）
// ============================================================
{
  let chi2 = 0,
    pairs = 0
  let maxPair = { z: 0, a: 0, b: 0, o: 0, e: 0 }
  for (let a = 1; a <= BALL_MAX; a++)
    for (let b = a + 1; b <= BALL_MAX; b++) {
      let o = 0
      for (const s of sets) if (s.has(a) && s.has(b)) o++
      const e = (N * PER_DRAW * (PER_DRAW - 1)) / (BALL_MAX * (BALL_MAX - 1))
      chi2 += (o - e) ** 2 / e
      pairs++
      const z = (o - e) / Math.sqrt(e)
      if (Math.abs(z) > Math.abs(maxPair.z)) maxPair = { z, a, b, o, e }
    }
  const df = pairs - 1
  console.log('=== 检验4：3160 个号码对的共现频率 ===')
  console.log(`卡方 = ${chi2.toFixed(0)}，自由度 = ${df}`)
  console.log(`p 值 ≈ ${chi2p(chi2, df).toFixed(3)} → ${chi2 < df * 1.1 ? '无配对偏好' : '存在配对结构！'}`)
  console.log(
    `最极端对：${maxPair.a}+${maxPair.b} 同出 ${maxPair.o} 次 / 期望 ${maxPair.e.toFixed(1)} 次（z=${maxPair.z.toFixed(2)}）\n`,
  )
}

// ============================================================
// 检验 5：形态指标的自相关（和值、奇偶、大小、尾数和）
// ============================================================
{
  const sums = chrono.map((d) => d.nums.reduce((s, v) => s + v, 0))
  const odds = chrono.map((d) => d.nums.filter((n) => n % 2 === 1).length)
  const bigs = chrono.map((d) => d.nums.filter((n) => n > 40).length)
  const ac = (arr, lag) => {
    const m = mean(arr)
    const cov = mean(arr.slice(0, -lag).map((v, i) => (v - m) * (arr[i + lag] - m)))
    const v = mean(arr.map((t) => (t - m) ** 2))
    return cov / v
  }
  console.log('=== 检验5：形态指标的自相关（ lag 1~5，理论 ≈0 ） ===')
  for (const [name, arr] of [
    ['和值', sums],
    ['奇数个数', odds],
    ['大号个数', bigs],
  ]) {
    const acs = range(5).map((l) => ac(arr, l))
    const se = 1 / Math.sqrt(N)
    console.log(
      `${name}（均值 ${mean(arr).toFixed(1)}）：` +
        acs.map((v, i) => `lag${i + 1}=${v.toFixed(3)}${Math.abs(v) > 2 * se ? '*' : ''}`).join('  '),
    )
  }
  console.log('（* 表示超过 2 个标准误；单个指标偶然超出属正常，80 个号码×5 滞后必然有偶然显著项）\n')
}

// ============================================================
// 检验 6：遗漏极值 —— 冷号真的「冷得异常」吗（模拟对照）
// ============================================================
{
  const maxMiss = []
  for (const n of range(BALL_MAX)) {
    let c = 0,
      mx = 0
    for (const s of sets) {
      if (s.has(n)) {
        mx = Math.max(mx, c)
        c = 0
      } else c++
    }
    mx = Math.max(mx, c)
    maxMiss.push(mx)
  }
  // 模拟：100 期、每期从 80 个里随机 20 个，跑 2000 次，取每次 80 个号的最大遗漏的均值分布
  const sims = []
  for (let r = 0; r < 2000; r++) {
    const pool = range(BALL_MAX)
    let worst = 0
    for (const n of range(BALL_MAX)) {
      let c = 0,
      mx = 0
      for (let t = 0; t < N; t++) {
        // 每期独立随机 20 个
        const idx = new Set()
        while (idx.size < PER_DRAW) idx.add(1 + Math.floor(Math.random() * BALL_MAX))
        if (idx.has(n)) {
          mx = Math.max(mx, c)
          c = 0
        } else c++
      }
      worst = Math.max(worst, Math.max(mx, c))
    }
    sims.push(worst)
  }
  sims.sort((a, b) => a - b)
  const obsMax = Math.max(...maxMiss)
  const obsAvgMax = mean(maxMiss)
  console.log('=== 检验6：最大遗漏期数（真实 vs 2000 次随机模拟） ===')
  console.log(`真实：最长遗漏 ${obsMax} 期，80 个号平均最长遗漏 ${obsAvgMax.toFixed(1)} 期`)
  console.log(
    `随机模拟：最长遗漏的 95% 区间 [${sims[Math.floor(2000 * 0.025)]}, ${sims[Math.floor(2000 * 0.975)]}]，` +
      `平均 ${mean(sims).toFixed(1)} 期`,
  )
  console.log(
    obsMax > sims[Math.floor(2000 * 0.975)]
      ? '→ 真实遗漏超过随机上限，可能存在「机器偏冷」'
      : '→ 真实遗漏完全落在随机范围内，没有「异常冷」的号\n',
  )
}

// ============================================================
// 检验 7：区间分布（每期四个 20 号区各出几个）
// ============================================================
{
  const zoneCounts = []
  for (const s of sets) {
    const z = [0, 0, 0, 0]
    for (const n of s) z[Math.min(3, Math.floor((n - 1) / 20))]++
    zoneCounts.push(z)
  }
  let chi2 = 0
  const obsMean = [0, 0, 0, 0]
  zoneCounts.forEach((z) => z.forEach((v, i) => (obsMean[i] += v)))
  obsMean.forEach((v, i) => (obsMean[i] = v / N))
  // 每区个数 ~ Hypergeo(80,20,20) 均值 5，方差 = 20*(20/80)*(60/80)*(60/79) ≈ 2.848
  const eVar = 2.848
  for (let i = 0; i < 4; i++) {
    const vs = zoneCounts.map((z) => z[i])
    const v = mean(vs.map((x) => (x - obsMean[i]) ** 2))
    chi2 += (v / eVar) * N
  }
  console.log('=== 检验7：四个 20 号区的每期出号个数 ===')
  console.log(`各区平均个数：${obsMean.map((v) => v.toFixed(2)).join(' / ')}（理论 5.00 / 5.00 / 5.00 / 5.00）`)
  console.log(`各区方差之和的卡方 ≈ ${chi2.toFixed(0)}（df≈400，独立时≈400）`)
  console.log(chi2 > 400 * 1.2 ? '→ 区间个数波动大于随机' : chi2 < 400 * 0.8 ? '→ 区间个数比随机更均匀（机器均衡良好）' : '→ 与随机一致')

  // 连续号对数
  let adjObs = 0
  for (const s of sets)
    for (let i = 1; i < BALL_MAX; i++) if (s.has(i) && s.has(i + 1)) adjObs++
  const adjExp = (N * 79 * (PER_DRAW / BALL_MAX) * ((PER_DRAW - 1) / (BALL_MAX - 1)))
  console.log(
    `\n连号对数：实测 ${adjObs} 对 / 期望 ${adjExp.toFixed(1)} 对（z=${((adjObs - adjExp) / Math.sqrt(adjExp)).toFixed(2)}）`,
  )
}
