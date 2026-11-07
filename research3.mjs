// 验证用户提出的「四层研究框架」中尚未检验的部分
// 已测过不重复：重号/斜连/隔期号策略、四区均匀策略、频次/遗漏打分（research.mjs）
// 本轮新增：① 用户的多尺度评分模型（25/30/30/15）② 冷热反差（长短期排名背离）
//           ③ 号码对共现的时间稳定性（前半程 vs 后半程）
import { readFileSync } from 'node:fs'
import { pickBalanced } from './src/lib/stats.js'

const draws = JSON.parse(readFileSync('src/data/kl8_history.json', 'utf8'))
const N = draws.length
const range = (n) => Array.from({ length: n }, (_, i) => i + 1)
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
const chrono = draws.slice().reverse() // 旧→新
const sets = chrono.map((d) => new Set(d.nums))
const PLAY = 10
const MIN_TRAIN = 30
const PERIODS = N - MIN_TRAIN // 70

// ============================================================
// 0. 用户举例的三个号码：实测数据
// ============================================================
{
  const cnt = (w) => {
    const win = chrono.slice(-w)
    const c = Object.fromEntries(range(80).map((n) => [n, 0]))
    for (const d of win) for (const x of d.nums) c[x]++
    return c
  }
  const c100 = cnt(100)
  const c20 = cnt(20)
  const order100 = range(80).sort((a, b) => c100[b] - c100[a])
  const order20 = range(80).sort((a, b) => c20[b] - c20[a])
  const rank100 = {}
  const rank20 = {}
  order100.forEach((n, i) => (rank100[n] = i + 1))
  order20.forEach((n, i) => (rank20[n] = i + 1))
  const miss = {}
  for (const n of range(80)) {
    let c = 0
    for (const d of draws) {
      if (d.nums.includes(n)) break
      c++
    }
    miss[n] = c
  }
  console.log('=== 0. 用户举例号码实测（100 期；理论：每号百期期望 25 次、近 20 期期望 5 次） ===')
  for (const n of [51, 75, 20]) {
    console.log(
      `  ${n}: 百期 ${c100[n]} 次（排名 ${rank100[n]}/80） · 近20期 ${c20[n]} 次（排名 ${rank20[n]}/80） · 当前遗漏 ${miss[n]} 期`,
    )
  }
  console.log('')
}

// ============================================================
// 1. 用户评分模型：长期25% + 近50期30% + 近20期30% + 近10期15%
// ============================================================
function userPicks(train, balanced) {
  const wins = [Math.min(train.length, 100), 50, 20, 10]
  const ws = [0.25, 0.3, 0.3, 0.15]
  const score = Object.fromEntries(range(80).map((n) => [n, 0]))
  wins.forEach((w, k) => {
    const win = train.slice(-Math.min(w, train.length))
    const c = Object.fromEntries(range(80).map((n) => [n, 0]))
    for (const d of win) for (const x of d.nums) c[x]++
    const mx = Math.max(...Object.values(c)) / win.length || 1
    for (const n of range(80)) score[n] += ws[k] * (c[n] / win.length / mx)
  })
  const ranked = range(80)
    .map((n) => ({ n, s: score[n] }))
    .sort((a, b) => b.s - a.s)
  return balanced ? pickBalanced(ranked, PLAY).map((x) => x.n) : ranked.slice(0, PLAY).map((x) => x.n)
}

// ============================================================
// 2. 冷热反差：长期排名与近期排名的背离
//    momentum  = 长期冷 + 近期热（赌升温）
//    pullback  = 长期热 + 近期冷（赌回调）
//    gap       = 背离绝对值最大
// ============================================================
function gapPicks(train, dir) {
  const ranks = (w) => {
    const win = train.slice(-Math.min(w, train.length))
    const c = Object.fromEntries(range(80).map((n) => [n, 0]))
    for (const d of win) for (const x of d.nums) c[x]++
    const order = range(80).sort((a, b) => c[b] - c[a])
    const r = {}
    order.forEach((n, i) => (r[n] = (i + 1) / 80)) // 0=最热 1=最冷
    return r
  }
  const rl = ranks(train.length)
  const rs = ranks(20)
  const score = (n) =>
    dir === 'momentum' ? rl[n] - rs[n] : dir === 'pullback' ? rs[n] - rl[n] : Math.abs(rl[n] - rs[n])
  return range(80)
    .map((n) => ({ n, s: score(n) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, PLAY)
    .map((x) => x.n)
}

// ============================================================
// 3. walk-forward：每期只用之前的数据
// ============================================================
function walkForward(pickFn) {
  const hits = []
  for (let t = MIN_TRAIN; t < N; t++) {
    const train = chrono.slice(0, t)
    const picks = pickFn(train)
    hits.push(picks.filter((n) => sets[t].has(n)).length)
  }
  return hits
}

const strategies = {
  '用户评分模型（25/30/30/15）': (tr) => userPicks(tr, false),
  '用户模型 + 四区约束': (tr) => userPicks(tr, true),
  '冷热反差·赌升温（长冷近热）': (tr) => gapPicks(tr, 'momentum'),
  '冷热反差·赌回调（长热近冷）': (tr) => gapPicks(tr, 'pullback'),
  '冷热反差·背离最大': (tr) => gapPicks(tr, 'gap'),
}

// 机选零分布：同样的 70 期，每期随机选 10 个
const nulls = []
for (let r = 0; r < 3000; r++) {
  let s = 0
  for (let t = MIN_TRAIN; t < N; t++) {
    const idx = new Set()
    while (idx.size < PLAY) idx.add(1 + Math.floor(Math.random() * 80))
    s += [...idx].filter((n) => sets[t].has(n)).length
  }
  nulls.push(s / PERIODS)
}
nulls.sort((a, b) => a - b)
const nullMean = mean(nulls)
const pct = (v) => (nulls.filter((x) => x <= v).length / nulls.length) * 100

console.log(`=== 1+2. 五种策略 walk-forward 回测（${PERIODS} 期，选十，机选基准 2.50） ===`)
for (const [name, fn] of Object.entries(strategies)) {
  const hits = walkForward(fn)
  const avg = mean(hits)
  const se = Math.sqrt(mean(hits.map((h) => (h - avg) ** 2)) / PERIODS) // 均值的标准误
  const twoSided = Math.min(1, (2 * Math.min(nulls.filter((x) => x <= avg).length, nulls.filter((x) => x >= avg).length)) / nulls.length)
  console.log(
    `  ${name}: 平均命中 ${avg.toFixed(2)}（标准误 ±${se.toFixed(2)}，分位 ${pct(avg).toFixed(0)}%，双侧 p=${twoSided.toFixed(3)}）`,
  )
}
console.log(`  机选模拟 3000 次：均值 ${nullMean.toFixed(3)}，95% 区间 [${nulls[75].toFixed(2)}, ${nulls[2925].toFixed(2)}]\n`)

// ============================================================
// 4. 号码对共现的时间稳定性：前 50 期 vs 后 50 期
// ============================================================
{
  const h1 = chrono.slice(0, 50)
  const h2 = chrono.slice(50)
  const zs = []
  for (let a = 1; a <= 80; a++)
    for (let b = a + 1; b <= 80; b++) {
      let o1 = 0
      let o2 = 0
      for (const d of h1) if (d.nums.includes(a) && d.nums.includes(b)) o1++
      for (const d of h2) if (d.nums.includes(a) && d.nums.includes(b)) o2++
      const e = (50 * 20 * 19) / (80 * 79) // 3.006
      zs.push({ a, b, o1, o2, z1: (o1 - e) / Math.sqrt(e), z2: (o2 - e) / Math.sqrt(e) })
    }
  const corr = mean(zs.map((z) => z.z1 * z.z2))
  const se = 1 / Math.sqrt(zs.length)
  console.log('=== 3. 3160 个号码对：共现关系在前半程/后半程是否稳定 ===')
  console.log(`  两半程共现 z 分的相关系数 = ${corr.toFixed(4)}（随机时应为 0 ± ${se.toFixed(4)}）`)
  console.log(`  → ${Math.abs(corr) > 2.5 * se ? '存在跨期稳定的配对结构！' : '配对关系完全不稳定，换个时间段就重置'}`)
  const both = zs.filter((z) => Math.abs(z.z1) > 2 && Math.abs(z.z2) > 2 && Math.sign(z.z1) === Math.sign(z.z2)).length
  const expBoth = zs.length * 0.0455 * 0.0455 * 0.5
  console.log(`  两半程都同向极端（|z|>2）的对数：实测 ${both}，随机期望 ${expBoth.toFixed(1)}`)
  const top = [...zs].sort((x, y) => y.z1 + y.z2 - (x.z1 + x.z2)).slice(0, 5)
  console.log('  两半程合计最「粘」的 5 对：')
  for (const z of top)
    console.log(`    ${z.a}+${z.b}: 前50期 ${z.o1} 次 / 后50期 ${z.o2} 次（期望各 3.0，z=${z.z1.toFixed(1)}/${z.z2.toFixed(1)}）`)
  const ex = zs.filter((z) => (z.a === 51 && z.b === 44) || (z.a === 51 && z.b === 73))
  console.log('  用户举例的配对：')
  for (const z of ex)
    console.log(`    ${z.a}+${z.b}: 前50期 ${z.o1} 次 / 后50期 ${z.o2} 次（期望各 3.0，z=${z.z1.toFixed(1)}/${z.z2.toFixed(1)}）`)
}
