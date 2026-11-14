// ============================================================
// v7 选号引擎（按四层结构复刻的统计版）
//
// ① 概率层：选 k 中 m 的超几何概率与奖金期望（kl8Math.js）
// ② 统计层：100 / 50 / 30 / 20 期加权频次 + 当前遗漏
// ③ 号码池：综合评分前 30 码 = 推荐池，后 30 码 = 排除池
// ④ 融合轮动：按「下一期期号」轮换主窗口，再用遗漏分档动态概率加权抽样
//
// 权重不做历史拟合，全部参数写死在代码里；同一期号 + 同一玩法结果可复现。
// 这一层不改变任何号码 25% 的真实开出概率，只是把「偏好」落成一张具体号码。
// ============================================================

import { scoreBalls, ballMissing, range, BALL_MAX, isOdd } from './stats.js'
import { kl8PlayStats } from './kl8Math.js'
import { kl8Calibration } from './kl8Calib.js'

const WINDOWS = [100, 50, 30, 20]
const POOL_SIZE = 30
const BAND = (n) => Math.min(3, Math.floor((n - 1) / 20))

/** mulberry32 确定性随机数，保证同一期号每次点「v7 推荐」结果一致 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 窗口轮动：主窗口 55%，其余三个各 15% */
function windowWeights(nextId) {
  const primary = WINDOWS[Math.abs(nextId) % WINDOWS.length]
  return WINDOWS.map((w) => ({ w, weight: w === primary ? 0.55 : 0.15 }))
}

/** 遗漏分档动态概率：用严格前推校准得到的各档命中率，收缩到 0.9–1.1 倍 */
function bucketFactors(draws) {
  const calib = kl8Calibration(draws, 300)
  const factorOf = (om) => {
    if (!calib) return 1
    const name = om === 0 ? '刚开' : om <= 3 ? '温' : om <= 7 ? '冷' : '深冷'
    const b = calib.buckets.find((x) => x.name === name)
    if (!b || !b.rate) return 1
    return Math.min(1.1, Math.max(0.9, b.rate / 0.25))
  }
  return { calib, factorOf }
}

/** 按动态概率加权抽样，并做四区间 / 奇偶结构约束 */
function samplePicks(pool, play, rnd) {
  const sorted = [...pool].sort((a, b) => b.weight - a.weight)
  const bandLimit = Math.max(2, Math.ceil(play / 4) + 1)
  const oddLimit = Math.ceil(play / 2) + 1
  const picked = []
  const used = new Set()
  const bandCount = [0, 0, 0, 0]
  let odd = 0

  while (picked.length < play) {
    const cands = sorted.filter((x) => {
      if (used.has(x.n)) return false
      const b = BAND(x.n)
      if (bandCount[b] >= bandLimit) return false
      if (isOdd(x.n) ? odd >= oddLimit : picked.length - odd >= oddLimit) return false
      return true
    })
    // 约束太紧时放宽，只要求不重复
    const list = cands.length ? cands : sorted.filter((x) => !used.has(x.n))
    if (!list.length) break
    const total = list.reduce((s, x) => s + x.weight, 0)
    let r = rnd() * total
    let chosen = list[list.length - 1]
    for (const x of list) {
      r -= x.weight
      if (r <= 0) {
        chosen = x
        break
      }
    }
    picked.push(chosen)
    used.add(chosen.n)
    bandCount[BAND(chosen.n)]++
    if (isOdd(chosen.n)) odd++
  }

  return picked.map((x) => x.n).sort((a, b) => a - b)
}

/**
 * v7 推荐
 * @param {Array} draws 最新在前的开奖数组
 * @param {{ play?: number, nextId?: number }} opts
 */
export function v7Recommend(draws, { play = 10, nextId } = {}) {
  if (!Array.isArray(draws) || draws.length < 20) return null
  const issue = Number(nextId || draws[0].id + 1)
  const rnd = mulberry32((issue * 7919 + play * 104729) >>> 0)
  const { calib, factorOf } = bucketFactors(draws)

  // ② 多窗口加权频次打分，各窗归一后融合
  const weights = windowWeights(issue)
  const fused = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]))
  for (const { w, weight } of weights) {
    const { scores } = scoreBalls(draws, { periods: w, halfLife: 20, hotMode: 'mix' })
    const max = Math.max(...Object.values(scores), 1e-9)
    for (const n of range(BALL_MAX)) fused[n] += weight * (scores[n] / max)
  }

  const missing = ballMissing(draws, 100)
  const lastNums = new Set(draws[0]?.nums || [])

  // ③ 推荐池 / 排除池
  const all = range(BALL_MAX).map((n) => {
    const om = missing[n].current
    const factor = factorOf(om)
    return {
      n,
      score: +(fused[n] * 100).toFixed(1),
      miss: om,
      weight: (0.2 + fused[n]) * factor,
    }
  })
  const rankedDesc = [...all].sort((a, b) => b.score - a.score)
  const pool = rankedDesc.slice(0, POOL_SIZE)
  const kill = rankedDesc.slice(-POOL_SIZE).reverse()

  // ④ 动态概率加权 + 结构约束抽样
  const picks = samplePicks(pool, play, rnd)
  const pickSet = new Set(picks)
  const backup = pool
    .filter((x) => !pickSet.has(x.n))
    .slice(0, 3)
    .map((x) => x.n)

  const stats = kl8PlayStats(play)
  const primaryWindow = weights.find((x) => x.weight === 0.55)?.w || WINDOWS[0]

  return {
    nextId: issue,
    play,
    primaryWindow,
    windows: weights,
    pool,
    kill,
    picks,
    backup,
    stats,
    lastHitInPool: pool.filter((x) => lastNums.has(x.n)).length,
    lastHitInKill: kill.filter((x) => lastNums.has(x.n)).length,
    buckets: calib?.buckets || [],
  }
}
