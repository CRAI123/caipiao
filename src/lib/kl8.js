// ============================================================
// 在线抓取：中国福彩官网开奖公告接口（快乐8）
// - 浏览器模式：走 /cwl-api 代理（Vite dev/preview 或 Vercel vercel.json 反代）
// - Tauri 桌面模式：直接调用 Rust 命令 fetch_cwl 由服务端请求官网，绕开跨域
// 接口特点：name=kl8，每期 result.red 返回 20 个逗号分隔号码，无 blue。
// ============================================================

import { isTauri, invoke } from './tauri.js'

const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'

/**
 * 抓取最近 count 期快乐8开奖。
 * 返回 { id, date, nums: number[20] } 数组，最新在前；失败时抛错。
 */
export async function fetchKl8Draws(count = 100) {
  const query =
    `name=kl8&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`

  let data
  if (isTauri()) {
    // 桌面端：由 Rust 端请求官网，自动带 Referer，无跨域问题
    try {
      data = await invoke('fetch_cwl', { path: `${API_PATH}?${query}` })
    } catch (e) {
      throw new Error(`桌面端抓取失败：${e?.message || e}`)
    }
  } else {
    const url = `/cwl-api${API_PATH}?${query}`
    let res
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch {
      throw new Error('网络请求失败：请确认本站通过 npm run dev / npm run preview 启动，并检查网络。')
    }
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? '代理未生效（404）：请用 npm run dev / npm run preview 启动，静态托管模式下无法跨域抓取。'
          : `福彩官网接口返回 HTTP ${res.status}`,
      )
    }
    try {
      data = await res.json()
    } catch {
      throw new Error('接口返回内容无法解析，可能被官网限流，请稍后重试。')
    }
  }

  if (data.state !== 0 || !Array.isArray(data.result)) {
    throw new Error(data.message || '福彩官网接口返回异常')
  }

  const draws = data.result
    .map((r) => ({
      id: Number(r.code),
      date: (r.date || '').replace(/\(.*\)$/, '') || null,
      nums: String(r.red || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
        .sort((a, b) => a - b),
    }))
    .filter((d) => Number.isInteger(d.id) && d.nums.length === 20)
    .sort((a, b) => b.id - a.id)

  if (!draws.length) throw new Error('未解析到有效开奖数据（快乐8 每期应为 20 个号码）')
  return draws
}
