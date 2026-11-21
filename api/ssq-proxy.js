// 双色球数据接口（浏览器无法跨域直连开奖站点）
// GET  /api/ssq-proxy?count=100                      开奖数据
// GET  /api/ssq-proxy?crowding=1[&issue=26134]       避挤：本期网友投票人气 + 官方购买偏好模型
// POST /api/ssq-proxy?crowding=1 { action:'backfill' } 回补官方销售/中奖注数并重拟合（幂等）
//
// 避挤数据只说明“中了之后有多少人跟你分”，开奖概率与购买量无关。
import { fetchSsqDraws } from './_lib/ssq.js'
import { applyCors } from './_lib/http.js'
import { getSql, ensureTables } from './_lib/neon.js'
import {
  syncOfficialSsq,
  fitCrowdModel,
  loadCrowdModel,
  recentWithRatios,
  toIssue5,
} from './_lib/ssqOfficial.js'

export const config = { maxDuration: 60 }

const VOTE_URL = 'https://view.lottery.sina.com.cn/lottery_index/ssq/voteResult?dpc=1&issueNo='
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const CACHE_TTL = 10 * 60 * 1000

let cache = { issue: '', at: 0, data: null }

/** 解析新浪投票页（自愿投票样本，不是真实销量） */
export function parseVote(html) {
  const iRed = html.indexOf('选择红球总数')
  const iBlue = html.indexOf('选择蓝球总数')
  if (iRed < 0 || iBlue < 0) return { totalRed: 0, totalBlue: 0, red: [], blue: [] }
  const firstNum = (from) => Number((/(\d+)/.exec(html.slice(from, from + 40)) || [])[1] || 0)
  const totalRed = firstNum(iRed)
  const totalBlue = firstNum(iBlue)
  const list = (seg, total) => {
    const out = []
    const seen = new Set()
    const re =
      /<font color=#[0-9a-fA-F]{6}>\s*(\d{1,2})\s*<\/font>[\s\S]{0,400}?([\d.]+)%<\/font>[\s\S]{0,400}?<font color=#[0-9a-fA-F]{6}>\s*(\d+)\s*<\/font>/g
    for (const m of seg.matchAll(re)) {
      const n = Number(m[1])
      const pct = Number(m[2])
      const votes = Number(m[3])
      if (!n || seen.has(n)) continue
      // 票数占比与页面百分比对不上说明跨条目误匹配，丢弃
      if (total > 0 && Math.abs((votes / total) * 100 - pct) > 0.6) continue
      seen.add(n)
      out.push({ n, pct, votes })
    }
    return out.sort((a, b) => a.n - b.n)
  }
  return {
    totalRed,
    totalBlue,
    red: list(html.slice(iRed, iBlue), totalRed),
    blue: list(html.slice(iBlue), totalBlue),
  }
}

async function fetchVote(issue5) {
  const now = Date.now()
  if (cache.data && cache.issue === issue5 && now - cache.at < CACHE_TTL) return cache.data
  const load = async (iss) => {
    const res = await fetch(VOTE_URL + iss, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`新浪投票 HTTP ${res.status}`)
    const parsed = parseVote(await res.text())
    return { issue: iss, ...parsed, at: new Date().toISOString() }
  }
  let data = await load(issue5)
  // 年末期号回卷：第 152 期之后是下一年第 001 期
  if (!data.totalRed && Number(issue5.slice(2)) > 145) {
    const alt = `${String(Number(issue5.slice(0, 2)) + 1).padStart(2, '0')}001`
    const retry = await load(alt).catch(() => null)
    if (retry?.totalRed) data = retry
  }
  cache = { issue: data.issue, at: now, data }
  return data
}

async function handleCrowding(req, res) {
  try {
    const sql = getSql()
    await ensureTables(sql)

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'backfill')
      if (action === 'backfill') {
        const out = await syncOfficialSsq(sql)
        return res.status(200).json({ ok: true, upserted: out.upserted, model: out.model })
      }
      if (action === 'fit') {
        const model = await fitCrowdModel(sql)
        return res.status(200).json({ ok: true, model })
      }
      return res.status(400).json({ error: '未知 action' })
    }

    const model = await loadCrowdModel(sql).catch(() => null)
    const rows = await sql`
      SELECT draw_id, date, red, blue, sales, first_prize, second_prize
      FROM ssq_draw_stats ORDER BY draw_id DESC LIMIT 10`.catch(() => [])
    const recent = recentWithRatios(rows)

    let issue5 = req.query?.issue ? String(req.query.issue) : null
    if (!issue5 && rows[0]?.draw_id) {
      issue5 = String(Number(toIssue5(rows[0].draw_id)) + 1).padStart(5, '0')
    }
    let sina = null
    let sinaError = ''
    if (issue5) {
      try {
        sina = await fetchVote(issue5)
      } catch (e) {
        sinaError = String(e?.message || e)
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ ok: true, sina, sinaError, model, recent })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  if (req.query?.crowding === '1' || req.method === 'POST') return handleCrowding(req, res)

  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await fetchSsqDraws(count)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error('[ssq-proxy]', e)
    return res.status(502).json({ error: e.message || '双色球开奖数据获取失败' })
  }
}
