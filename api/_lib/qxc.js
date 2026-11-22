// 服务端抓取体彩七星彩开奖数据（Vercel Serverless 用）
// 数据源：中国体彩网公开开奖接口（webapi.sporttery.cn，gameNo=04）
// 七星彩结构：前 6 位 0-9 + 后区 1 位 0-14，共 15,000,000 种组合
import { UA_500 } from './xml.js'

const SPORTTERY_API = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'

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
    // 后区可能是两位数，因此连写时要求 8 位：前 6 位 + 后 2 位
    if (compact.length !== 8) return []
    nums = compact.split('').map(Number)
    nums = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6] * 10 + nums[7]]
  }
  if (nums.length !== 7) return []
  const frontOk = nums.slice(0, 6).every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  const backOk = Number.isInteger(nums[6]) && nums[6] >= 0 && nums[6] <= 14
  return frontOk && backOk ? nums : []
}

async function fromSporttery(count) {
  const query = `?gameNo=04&provinceId=0&pageSize=${count}&isVerify=1&pageNo=1`
  const res = await fetch(`${SPORTTERY_API}${query}`, {
    headers: {
      'User-Agent': UA_500,
      Referer: 'https://static.sporttery.cn/',
      Accept: 'application/json, text/plain, */*',
    },
  })
  if (!res.ok) throw new Error(`体彩官网 HTTP ${res.status}`)
  const data = await res.json()
  const list = data?.value?.list
  if (!Array.isArray(list) || !list.length) {
    throw new Error(data?.errorMessage || '体彩官网接口返回异常')
  }
  return list
    .map((r) => ({
      id: Number(r.lotteryDrawNum),
      date: String(r.lotteryDrawTime || '').slice(0, 10) || null,
      num: parseQxcResult(r.lotteryDrawResult),
    }))
    .filter((d) => Number.isInteger(d.id) && d.num.length === 7)
    .sort((a, b) => b.id - a.id)
}

/**
 * 抓取最近 count 期七星彩开奖。
 * 返回 { draws: [{ id, date, num: [一,二,三,四,五,六,后] }], source: 'sporttery' }，最新在前。
 */
export async function fetchQxcDraws(count = 100) {
  const draws = await fromSporttery(count)
  if (!draws.length) throw new Error('体彩官网未返回有效七星彩开奖数据')
  return { draws, source: 'sporttery' }
}
