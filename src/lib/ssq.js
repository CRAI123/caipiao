// ============================================================
// 双色球 数据抓取 —— 通过本站 /api/ssq-proxy 转发开奖数据
// 每期：6 个红球（01-33）+ 1 个蓝球（01-16）
// ============================================================

import { isTauri } from './tauri.js'

const WEB_BASE = 'https://cai.rayzo.cn' // 桌面端没有本地 /api，走线上代理

/** 校验并规范化一期开奖 */
function normalize(d) {
  const red = Array.isArray(d?.red) ? d.red.map(Number) : []
  const blue = Number(d?.blue)
  const id = Number(d?.id)
  if (red.length !== 6) return null
  if (!red.every((n) => Number.isInteger(n) && n >= 1 && n <= 33)) return null
  if (!Number.isInteger(blue) || blue < 1 || blue > 16) return null
  if (!Number.isInteger(id)) return null
  return { id, date: d.date || null, red: [...red].sort((a, b) => a - b), blue }
}

/**
 * 抓取最近 count 期双色球开奖。
 * 返回 { id, date, red: [6], blue } 数组，最新在前。
 */
export async function fetchSsqDraws(count = 100) {
  const url = `${isTauri() ? WEB_BASE : ''}/api/ssq-proxy?count=${count}`

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

  if (!res.ok) throw new Error(data?.error || `双色球接口返回 HTTP ${res.status}`)

  const list = Array.isArray(data?.draws) ? data.draws : []
  const draws = list.map(normalize).filter(Boolean).sort((a, b) => b.id - a.id)

  if (!draws.length) throw new Error('未解析到有效开奖数据（双色球每期应为 6 红 + 1 蓝）')
  return draws
}
