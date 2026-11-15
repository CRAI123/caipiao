// ============================================================
// 快乐8 组合优化器（蒙特卡洛）
//
// 目标：在给定预算内（每注 2 元），从候选票面里挑出一组号码，
// 使「至少中一次（任意奖级）」的概率最大。
//
// 做法：
// 1. 按超几何分布模拟 N 期开奖（种子固定，结果可复现）；
// 2. 预先算好每张候选票在每期模拟中的命中数；
// 3. 贪心：每次挑「对尚未中奖的模拟期贡献最大」的那一注；
// 4. 与同样注数的随机选号对比，给出提升幅度。
//
// 注意：这只提高「中任意奖」的概率，不改变期望回报（仍是 57.5%），
// 因为每一注的期望值恒定，注数越多成本同步上升。
// ============================================================

import { KL8_PRIZES, kl8PlayStats } from './kl8Math.js'

const BALLS = 80
const DRAW = 20

/** mulberry32：确定性随机数，保证同参数下结果一致 */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 模拟一期开奖：返回 81 长度的标记数组，命中判定 O(1) */
function simulateDraw(rnd) {
  const pool = new Uint8Array(BALLS)
  for (let i = 0; i < BALLS; i++) pool[i] = i + 1
  for (let i = 0; i < DRAW; i++) {
    const j = i + Math.floor(rnd() * (BALLS - i))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  const mark = new Uint8Array(BALLS + 1)
  for (let i = 0; i < DRAW; i++) mark[pool[i]] = 1
  return mark
}

/** 随机一张票（升序号码数组） */
function randomTicket(rnd, k) {
  const pool = Array.from({ length: BALLS }, (_, i) => i + 1)
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (BALLS - i))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  return pool.slice(0, k).sort((a, b) => a - b)
}

const keyOf = (t) => t.join(',')

/**
 * @param {object} opt
 * @param {number} opt.play    玩法 1–10
 * @param {number} opt.budget  预算（元）
 * @param {number} opt.sims    模拟期数
 * @param {Array}  opt.poolNums 可选的偏好号池（一般为 v7 推荐池）
 */
export function optimizePortfolio({ play = 10, budget = 20, sims = 4000, poolNums = [] } = {}) {
  const k = Math.min(10, Math.max(1, Number(play) || 10))
  const tickets = Math.max(1, Math.min(25, Math.floor(Number(budget) / 2) || 1))
  const prize = KL8_PRIZES[k] || {}
  const stats = kl8PlayStats(k)

  const rnd = mulberry32((k * 7919 + tickets * 104729 + sims * 15485863) >>> 0)

  // ---- 候选票面：40 张纯随机 + 40 张取自偏好池 ----
  const cand = []
  const seen = new Set()
  const pushTicket = (t) => {
    const key = keyOf(t)
    if (seen.has(key)) return
    seen.add(key)
    cand.push(t)
  }
  for (let i = 0; i < 40; i++) pushTicket(randomTicket(rnd, k))
  if (Array.isArray(poolNums) && poolNums.length >= k) {
    const pool = [...new Set(poolNums)]
    for (let i = 0; i < 40; i++) {
      const bag = [...pool]
      for (let j = 0; j < k; j++) {
        const idx = j + Math.floor(rnd() * (bag.length - j))
        const t = bag[j]
        bag[j] = bag[idx]
        bag[idx] = t
      }
      pushTicket(bag.slice(0, k).sort((a, b) => a - b))
    }
  }

  // ---- 模拟开奖 ----
  const draws = Array.from({ length: sims }, () => simulateDraw(rnd))

  // ---- 每张候选票在每期模拟中的命中数 ----
  const hits = cand.map((t) => {
    const arr = new Uint8Array(sims)
    for (let s = 0; s < sims; s++) {
      const mark = draws[s]
      let h = 0
      for (let i = 0; i < t.length; i++) if (mark[t[i]]) h++
      arr[s] = h
    }
    return arr
  })
  const wins = hits.map((arr) => {
    const arr2 = new Uint8Array(sims)
    for (let s = 0; s < sims; s++) arr2[s] = prize[arr[s]] > 0 ? 1 : 0
    return arr2
  })

  // ---- 贪心挑选：最大化已中奖模拟期的覆盖 ----
  const covered = new Uint8Array(sims)
  let coveredCount = 0
  const chosen = []
  const gains = []
  const used = new Set()
  for (let step = 0; step < tickets; step++) {
    let best = -1
    let bestGain = 0
    for (let c = 0; c < cand.length; c++) {
      if (used.has(c)) continue
      const w = wins[c]
      let gain = 0
      for (let s = 0; s < sims; s++) if (!covered[s] && w[s]) gain++
      if (gain > bestGain) {
        bestGain = gain
        best = c
      }
    }
    if (best < 0) break
    used.add(best)
    chosen.push(cand[best])
    gains.push(bestGain / sims)
    const w = wins[best]
    for (let s = 0; s < sims; s++) if (w[s] && !covered[s]) { covered[s] = 1; coveredCount++ }
    if (coveredCount >= sims) break
  }

  // ---- 同样注数的随机组合做基准 ----
  const baseWins = Array.from({ length: chosen.length }, () => randomTicket(rnd, k)).map((t) => {
    const w = new Uint8Array(sims)
    for (let s = 0; s < sims; s++) {
      const mark = draws[s]
      let h = 0
      for (let i = 0; i < t.length; i++) if (mark[t[i]]) h++
      w[s] = prize[h] > 0 ? 1 : 0
    }
    return w
  })
  let baseCovered = 0
  for (let s = 0; s < sims; s++) if (baseWins.some((w) => w[s])) baseCovered++

  const pAny = coveredCount / sims
  const pBase = baseCovered / sims
  // 二项分布标准误，用于说明蒙特卡洛误差
  const se = Math.sqrt(Math.max(pAny * (1 - pAny), 1e-9) / sims)

  return {
    play: k,
    budget: Number(budget) || 0,
    tickets: chosen.length,
    cost: chosen.length * 2,
    sims,
    pAny,
    pBase,
    se,
    uplift: pAny - pBase,
    independentEstimate: 1 - Math.pow(1 - stats.anyWin, chosen.length),
    perTicketAny: stats.anyWin,
    ev: chosen.length * stats.ev,
    returnRate: stats.returnRate,
    picks: chosen,
    gains,
  }
}
