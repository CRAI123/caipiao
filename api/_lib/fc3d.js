// 服务端抓取福彩3D开奖
// 数据源 1：福彩官网公告接口（国内可用，海外/机房 IP 常被 WAF 返回 403）
// 数据源 2：500.com 开奖 XML（备用，官网被拦时自动降级）
import { parse500Rows, UA_500 } from './xml.js'

const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const REFERER_3D = 'https://www.cwl.gov.cn/ygkj/wqkjgg/3d/'
const XML_3D = 'https://kaijiang.500.com/static/info/kaijiang/xml/sd/list.xml'

async function fromCwl(count) {
  const query =
    `name=3d&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`

  const res = await fetch(`${CWL_BASE}${API_PATH}?${query}`, {
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: REFERER_3D,
      'User-Agent': UA_500,
    },
  })
  if (!res.ok) throw new Error(`福彩官网返回 ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data?.result) || !data.result.length) {
    throw new Error('未取到福彩3D开奖数据')
  }

  return data.result
    .map((r) => {
      const raw = String(r.red || '').replace(/\s/g, '')
      let digits
      if (raw.includes(',')) digits = raw.split(',').map(Number)
      else if (raw.length === 3) digits = raw.split('').map(Number)
      else digits = []
      return {
        id: Number(r.code),
        date: (r.date || '').replace(/\(.*\)$/, '') || null,
        num: digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
      }
    })
    .filter((d) => Number.isInteger(d.id) && d.num.length === 3)
    .sort((a, b) => b.id - a.id)
}

async function from500(count) {
  const res = await fetch(XML_3D, {
    headers: { 'User-Agent': UA_500, Accept: 'text/xml,application/xml,*/*' },
  })
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`)
  const rows = parse500Rows(await res.text())
  const draws = rows
    .map((r) => ({
      id: r.issue,
      date: r.date,
      num: r.code
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
    }))
    .filter((d) => d.num.length === 3)
  if (!draws.length) throw new Error('500.com 未取到福彩3D开奖数据')
  return draws.slice(0, count)
}

export async function fetchFc3dDraws(count = 100) {
  try {
    return await fromCwl(count)
  } catch (e) {
    const draws = await from500(count)
    console.warn(`[fc3d] 官网不可用（${e.message}），已改用 500.com`)
    return draws
  }
}
