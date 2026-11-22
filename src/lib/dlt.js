// ============================================================
// 大乐透 数据抓取 —— 通过本站 /api/dlt-proxy 转发开奖数据
// 每期：5 个前区号（01-35）+ 2 个后区号（01-12）
// ============================================================

import { apiBase } from './api.js'

/** 校验并规范化一期开奖 */
function normalize(d) {
  const front = Array.isArray(d?.front) ? d.front.map(Number) : []
  const back = Array.isArray(d?.back) ? d.back.map(Number) : []
  const id = Number(d?.id)
  if (front.length !== 5 || new Set(front).size !== 5) return null
  if (!front.every((n) => Number.isInteger(n) && n >= 1 && n <= 35)) return null
  if (back.length !== 2 || new Set(back).size !== 2) return null
  if (!back.every((n) => Number.isInteger(n) && n >= 1 && n <= 12)) return null
  if (!Number.isInteger(id)) return null
  return {
    id,
    date: d.date || null,
    front: [...front].sort((a, b) => a - b),
    back: [...back].sort((a, b) => a - b),
  }
}

/**
 * 抓取最近 count 期大乐透开奖。
 * 返回 { id, date, front: [5], back: [2] } 数组，最新在前。
 */
export async function fetchDltDraws(count = 100) {
  const url = `${apiBase()}/api/dlt-proxy?count=${count}`

  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('网络请求失败：请确认网络连接正常。')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    throw new Error('接口返回内容无法解析，请稍后重试。')
  }

  if (!res.ok) throw new Error(data?.error || `大乐透接口返回 HTTP ${res.status}`)

  const list = Array.isArray(data?.draws) ? data.draws : []
  const draws = list.map(normalize).filter(Boolean).sort((a, b) => b.id - a.id)

  if (!draws.length) throw new Error('未解析到有效开奖数据（大乐透每期应为 5 前区 + 2 后区）')
  return draws
}
