// ============================================================
// 体彩排列五 数据抓取 —— 通过本站 /api/pl5-proxy 转发体彩开奖接口
// 接口特点：每期 lotteryDrawResult 返回 "0 3 2 4 3" 五位数字（万千百十个）
// ============================================================

import { isTauri } from './tauri.js'

const WEB_BASE = 'https://cai.rayzo.cn' // 桌面端没有本地 /api，走线上代理

/** 把 "0 3 2 4 3" / "0,3,2,4,3" / "03243" 统一解析成 [0,3,2,4,3] */
function parseResult(raw) {
  const s = String(raw || '').trim()
  if (!s) return []
  const parts = s.split(/[\s,]+/).filter(Boolean)
  const digits =
    parts.length === 5 ? parts.map(Number) : s.replace(/\D/g, '').split('').map(Number)
  return digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9)
}

/** 官方原始列表 → 统一结构（开发环境代理直连体彩时返回的是官方格式） */
function fromOfficialList(list) {
  return list
    .map((r) => ({
      id: Number(r.lotteryDrawNum),
      date: String(r.lotteryDrawTime || '').slice(0, 10) || null,
      num: parseResult(r.lotteryDrawResult),
    }))
    .filter((d) => Number.isInteger(d.id) && d.num.length === 5)
    .sort((a, b) => b.id - a.id)
}

/**
 * 抓取最近 count 期排列五开奖。
 * 返回 { id, date, num: [万, 千, 百, 十, 个] } 数组，最新在前。
 */
export async function fetchPl5Draws(count = 100) {
  const url = `${isTauri() ? WEB_BASE : ''}/api/pl5-proxy?count=${count}`

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

  if (!res.ok) {
    throw new Error(data?.error || `排列五接口返回 HTTP ${res.status}`)
  }

  // 线上代理返回 { draws }；开发环境经 Vite 代理直连体彩时返回官方结构
  const draws = Array.isArray(data?.draws)
    ? data.draws
        .map((d) => ({
          id: Number(d.id),
          date: d.date || null,
          num: Array.isArray(d.num) ? d.num.filter((n) => Number.isInteger(n)) : [],
        }))
        .filter((d) => Number.isInteger(d.id) && d.num.length === 5)
        .sort((a, b) => b.id - a.id)
    : fromOfficialList(data?.value?.list || [])

  if (!draws.length) throw new Error('未解析到有效开奖数据（排列五每期应为 5 个号码）')
  return draws
}
