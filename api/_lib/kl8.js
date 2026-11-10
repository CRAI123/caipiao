// 服务端抓取福彩官网开奖数据（Vercel Serverless Functions）
// 数据源 1：福彩官网 cwl.gov.cn（国内可用，海外/机房 IP 常被 WAF 返回 403）
// 数据源 2：500.com 开奖 XML（作为备用，官网被拦时自动降级）

import { parse500Rows, UA_500 } from './xml.js'

const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const XML_KL8 = 'https://kaijiang.500.com/static/info/kaijiang/xml/kl8/list.xml'

async function fromCwl(count) {
  const query =
    `name=kl8&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`
  const url = `${CWL_BASE}${API_PATH}?${query}`
  const res = await fetch(url, {
    headers: {
      Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/kl8/',
      Accept: 'application/json',
      'User-Agent': UA_500,
    },
  })
  if (!res.ok) throw new Error(`福彩官网 HTTP ${res.status}`)
  const data = await res.json()
  if (data.state !== 0 || !Array.isArray(data.result)) {
    throw new Error(data.message || '福彩官网接口返回异常')
  }
  return data.result
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
}

async function from500(count) {
  const res = await fetch(XML_KL8, {
    headers: { 'User-Agent': UA_500, Accept: 'text/xml,application/xml,*/*' },
  })
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`)
  const rows = parse500Rows(await res.text())
  const draws = rows
    .map((r) => ({
      id: r.issue,
      date: r.date,
      nums: r.code
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
        .sort((a, b) => a - b),
    }))
    .filter((d) => d.nums.length === 20)
  if (!draws.length) throw new Error('500.com 未取到快乐8开奖数据')
  return draws.slice(0, count)
}

/**
 * 抓取最近 count 期快乐8开奖。
 * 返回 { id, date, nums: number[20] } 数组，最新在前；失败时抛错。
 */
export async function fetchKl8Draws(count = 10) {
  try {
    return await fromCwl(count)
  } catch (e) {
    const draws = await from500(count)
    console.warn(`[kl8] 官网不可用（${e.message}），已改用 500.com`)
    return draws
  }
}
