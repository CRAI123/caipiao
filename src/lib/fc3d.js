// ============================================================
// 福彩3D 数据抓取 —— 复用福彩官网开奖公告接口
// 接口特点：name=3d，每期 result.red 返回 3 个数字（逗号分隔或连续）
// ============================================================

import { isTauri, invoke } from './tauri.js'

const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const REFERER_3D = 'https://www.cwl.gov.cn/ygkj/wqkjgg/3d/'

/**
 * 抓取最近 count 期福彩3D开奖。
 * 返回 { id, date, num: [百, 十, 个] } 数组，最新在前。
 */
export async function fetchFc3dDraws(count = 100) {
  const query =
    `name=3d&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`

  let data
  if (isTauri()) {
    try {
      data = await invoke('fetch_cwl', {
        path: `${API_PATH}?${query}`,
        referer: REFERER_3D,
      })
    } catch (e) {
      throw new Error(`桌面端抓取失败：${e?.message || e}`)
    }
  } else {
    const url = `/api/cwl-proxy?path=${encodeURIComponent(
      `${API_PATH}?${query}`,
    )}&referer=${encodeURIComponent(REFERER_3D)}`
    let res
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch {
      throw new Error('网络请求失败：请确认网络连接正常。')
    }
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? '代理未生效（404）'
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
    .map((r) => {
      // red 可能是 "1,2,3" 或 "123"
      const raw = String(r.red || '').replace(/\s/g, '')
      let digits
      if (raw.includes(',')) {
        digits = raw.split(',').map(Number)
      } else if (raw.length === 3) {
        digits = raw.split('').map(Number)
      } else {
        digits = []
      }
      return {
        id: Number(r.code),
        date: (r.date || '').replace(/\(.*\)$/, '') || null,
        num: digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
      }
    })
    .filter((d) => Number.isInteger(d.id) && d.num.length === 3)
    .sort((a, b) => b.id - a.id)

  if (!draws.length) throw new Error('未解析到有效开奖数据（福彩3D 每期应为 3 个号码）')
  return draws
}
