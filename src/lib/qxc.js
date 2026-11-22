// ============================================================
// 体彩七星彩 数据抓取 —— 通过本站 /api/pl3-proxy?game=qxc 转发体彩开奖接口
// 结构：前 6 位 0-9 + 后区 1 位 0-14，共 7 位
// ============================================================

import { apiBase } from './api.js'

/** 把 "7 2 4 7 6 3 14" / "7,2,4,7,6,3,14" / "72476314" 统一解析成 7 位号码 */
export function parseQxcResult(raw) {
  const s = String(raw || '').trim()
  if (!s) return []
  const parts = s.split(/[\s,，]+/).filter(Boolean)
  let nums
  if (parts.length === 7) {
    nums = parts.map(Number)
  } else {
    const compact = s.replace(/\D/g, '')
    if (compact.length !== 8) return []
    nums = compact.split('').map(Number)
    nums = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6] * 10 + nums[7]]
  }
  if (nums.length !== 7) return []
  const frontOk = nums.slice(0, 6).every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  const backOk = Number.isInteger(nums[6]) && nums[6] >= 0 && nums[6] <= 14
  return frontOk && backOk ? nums : []
}

/** 官方原始列表 → 统一结构（开发环境代理直连体彩时返回的是官方格式） */
function fromOfficialList(list) {
  return list
    .map((r) => ({
      id: Number(r.lotteryDrawNum),
      date: String(r.lotteryDrawTime || '').slice(0, 10) || null,
      num: parseQxcResult(r.lotteryDrawResult),
    }))
    .filter((d) => Number.isInteger(d.id) && d.num.length === 7)
    .sort((a, b) => b.id - a.id)
}

/** 经本站代理抓取（线上 /api/pl3-proxy?game=qxc；开发环境可能被 Vite 代理直连体彩） */
async function fromProxy(count) {
  const url = `${apiBase()}/api/pl3-proxy?game=qxc&count=${count}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  let data = null
  try {
    data = await res.json()
  } catch {
    throw new Error('接口返回内容无法解析，请稍后重试。')
  }
  if (!res.ok) throw new Error(data?.error || `七星彩接口返回 HTTP ${res.status}`)

  // 线上代理返回 { draws }；开发环境经 Vite 代理直连体彩时返回官方结构
  return Array.isArray(data?.draws)
    ? data.draws
        .map((d) => ({
          id: Number(d.id),
          date: d.date || null,
          num: Array.isArray(d.num) ? d.num.map(Number) : [],
        }))
        .filter(
          (d) =>
            Number.isInteger(d.id) &&
            d.num.length === 7 &&
            d.num.slice(0, 6).every((n) => Number.isInteger(n) && n >= 0 && n <= 9) &&
            Number.isInteger(d.num[6]) &&
            d.num[6] >= 0 &&
            d.num[6] <= 14,
        )
        .sort((a, b) => b.id - a.id)
    : fromOfficialList(data?.value?.list || [])
}

/** 浏览器直连体彩官方接口（该接口允许跨域），代理未就绪时兜底 */
async function fromOfficialApi(count) {
  const n = Math.min(100, count)
  const url =
    'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry' +
    `?gameNo=04&provinceId=0&pageSize=${n}&isVerify=1&pageNo=1`
  const res = await fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } })
  if (!res.ok) throw new Error(`体彩官网 HTTP ${res.status}`)
  const data = await res.json()
  const list = data?.value?.list
  if (!Array.isArray(list) || !list.length) throw new Error(data?.errorMessage || '体彩官网接口返回异常')
  return fromOfficialList(list)
}

/**
 * 抓取最近 count 期七星彩开奖。
 * 返回 { id, date, num: [一, 二, 三, 四, 五, 六, 后] } 数组，最新在前。
 */
export async function fetchQxcDraws(count = 100) {
  let proxyErr = null
  try {
    const draws = await fromProxy(count)
    if (draws.length) return draws
  } catch (e) {
    proxyErr = e
  }
  // 代理不可用 / 返回空（例如线上后端尚未更新到支持 game=qxc）时，直接请求体彩官网
  try {
    const draws = await fromOfficialApi(count)
    if (draws.length) return draws
  } catch {
    /* 走统一错误提示 */
  }
  if (proxyErr && !/未解析到有效开奖数据/.test(proxyErr.message)) {
    throw proxyErr
  }
  throw new Error('未解析到有效开奖数据（七星彩每期应为 6 个前区号 + 1 个后区号）')
}
