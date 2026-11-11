// 服务端抓取双色球开奖数据（Vercel Serverless 用）
// 数据源 1：500.com 开奖 XML（境外可访问，最稳定）
// 数据源 2：中国福彩网公开接口（海外 IP 常被 403，作备用）
import { parse500Rows, UA_500 } from './xml.js'

const XML_SSQ = 'https://kaijiang.500.com/static/info/kaijiang/xml/ssq/list.xml'
const CWL_API = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'

/** "03,09,16,20,25,30|05" → { red: [3,9,16,20,25,30], blue: 5 } */
export function parseSsqCode(raw) {
  const [r, b] = String(raw || '').split('|')
  const red = String(r || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const blue = Number(String(b || '').trim())
  if (red.length !== 6 || !red.every((n) => Number.isInteger(n) && n >= 1 && n <= 33)) return null
  if (!Number.isInteger(blue) || blue < 1 || blue > 16) return null
  return { red: [...red].sort((x, y) => x - y), blue }
}

async function from500(count) {
  const res = await fetch(XML_SSQ, {
    headers: { 'User-Agent': UA_500, Accept: 'text/xml,application/xml,*/*' },
  })
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`)
  const rows = parse500Rows(await res.text())
  const draws = rows
    .map((r) => {
      const parsed = parseSsqCode(r.code)
      return parsed ? { id: r.issue, date: r.date, ...parsed } : null
    })
    .filter(Boolean)
  if (!draws.length) throw new Error('500.com 未取到双色球开奖数据')
  return draws.slice(0, count)
}

async function fromCwl(count) {
  const url =
    `${CWL_API}?name=ssq&issueCount=${count}&issueStart=&issueEnd=&dayStart=&dayEnd=` +
    `&pageNo=1&pageSize=${count}&week=&systemType=PC`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA_500,
      Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/',
      Accept: 'application/json, text/plain, */*',
    },
  })
  if (!res.ok) throw new Error(`福彩官网 HTTP ${res.status}`)
  const data = await res.json()
  const list = data?.result
  if (!Array.isArray(list) || !list.length) throw new Error('福彩官网接口返回异常')
  return list
    .map((r) => {
      const red = String(r.red || '')
        .split(',')
        .filter(Boolean)
        .map(Number)
      const blue = Number(r.blue)
      if (red.length !== 6 || !Number.isInteger(blue)) return null
      return {
        id: Number(r.code),
        date: String(r.date || '').slice(0, 10) || null,
        red: [...red].sort((x, y) => x - y),
        blue,
      }
    })
    .filter((d) => d && Number.isInteger(d.id))
    .sort((a, b) => b.id - a.id)
}

/**
 * 抓取最近 count 期双色球开奖。
 * 返回 { draws: [{ id, date, red: [6], blue }], source: '500' | 'cwl' }，最新在前。
 */
export async function fetchSsqDraws(count = 100) {
  try {
    const draws = await from500(count)
    return { draws, source: '500' }
  } catch (e) {
    const draws = await fromCwl(count)
    console.warn(`[ssq] 500.com 不可用（${e.message}），已改用福彩官网`)
    return { draws, source: 'cwl' }
  }
}
