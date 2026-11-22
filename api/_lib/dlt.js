// 服务端抓取大乐透开奖数据（Vercel Serverless 用）
// 数据源：500.com 开奖 XML（境外可访问，最稳定）
import { parse500Rows, UA_500 } from './xml.js'

const XML_DLT = 'https://kaijiang.500.com/static/info/kaijiang/xml/dlt/list.xml'

/** "10,11,25,30,32|09,10" → { front: [10,11,25,30,32], back: [9,10] } */
export function parseDltCode(raw) {
  const [f, b] = String(raw || '').split('|')
  const front = String(f || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const back = String(b || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  if (front.length !== 5 || !front.every((n) => Number.isInteger(n) && n >= 1 && n <= 35)) return null
  if (back.length !== 2 || !back.every((n) => Number.isInteger(n) && n >= 1 && n <= 12)) return null
  if (new Set(front).size !== 5 || new Set(back).size !== 2) return null
  return {
    front: [...front].sort((x, y) => x - y),
    back: [...back].sort((x, y) => x - y),
  }
}

async function from500(count) {
  const res = await fetch(XML_DLT, {
    headers: { 'User-Agent': UA_500, Accept: 'text/xml,application/xml,*/*' },
  })
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`)
  const rows = parse500Rows(await res.text())
  const draws = rows
    .map((r) => {
      const parsed = parseDltCode(r.code)
      return parsed ? { id: Number(r.issue), date: r.date, ...parsed } : null
    })
    .filter(Boolean)
  if (!draws.length) throw new Error('500.com 未取到大乐透开奖数据')
  return draws.slice(0, count)
}

/**
 * 抓取最近 count 期大乐透开奖。
 * 返回 { draws: [{ id, date, front: [5], back: [2] }], source: '500' }，最新在前。
 */
export async function fetchDltDraws(count = 100) {
  const draws = await from500(count)
  return { draws, source: '500' }
}
