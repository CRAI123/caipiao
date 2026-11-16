// 服务端抓取体彩排列五开奖数据（Vercel Serverless 用）
// 数据源 1：中国体彩网公开开奖接口（webapi.sporttery.cn，gameNo=350133）
// 数据源 2：500.com 开奖 XML（备用，体彩接口不可用时自动降级）
import { parse500Rows, UA_500 } from './xml.js'

const SPORTTERY_API = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
const XML_PL5 = 'https://kaijiang.500.com/static/info/kaijiang/xml/plw/list.xml'

/** 把 "0 3 2 4 3" / "0,3,2,4,3" / "03243" 统一解析成 [0,3,2,4,3] */
function parseResult(raw) {
  const s = String(raw || '').trim()
  if (!s) return []
  const parts = s.split(/[\s,]+/).filter(Boolean)
  const digits = parts.length === 5 ? parts.map(Number) : s.replace(/\D/g, '').split('').map(Number)
  return digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9)
}

async function fromSporttery(count) {
  const query =
    `?gameNo=350133&provinceId=0&pageSize=${count}` +
    `&isVerify=1&pageNo=1`
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
      num: parseResult(r.lotteryDrawResult),
    }))
    .filter((d) => Number.isInteger(d.id) && d.num.length === 5)
    .sort((a, b) => b.id - a.id)
}

async function from500(count) {
  const res = await fetch(XML_PL5, {
    headers: { 'User-Agent': UA_500, Accept: 'text/xml,application/xml,*/*' },
  })
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`)
  const rows = parse500Rows(await res.text())
  const draws = rows
    .map((r) => ({
      id: r.issue,
      date: r.date,
      num: parseResult(r.code),
    }))
    .filter((d) => Number.isInteger(d.id) && d.num.length === 5)
  if (!draws.length) throw new Error('500.com 未取到排列五开奖数据')
  return draws.slice(0, count)
}

/**
 * 抓取最近 count 期排列五开奖。
 * 返回 { draws: [{ id, date, num: [万,千,百,十,个] }], source: 'sporttery' | '500' }，最新在前。
 */
export async function fetchPl5Draws(count = 100) {
  try {
    const draws = await fromSporttery(count)
    if (!draws.length) throw new Error('体彩官网未返回有效数据')
    return { draws, source: 'sporttery' }
  } catch (e) {
    const draws = await from500(count)
    console.warn(`[pl5] 体彩接口不可用（${e.message}），已改用 500.com`)
    return { draws, source: '500' }
  }
}
