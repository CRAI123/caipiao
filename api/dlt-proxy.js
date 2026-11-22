// 大乐透数据接口（浏览器无法跨域直连开奖站点）
// GET  /api/dlt-proxy?count=100                       开奖数据
// GET  /api/dlt-proxy?crowding=1                     避挤：官方购买偏好模型 + 最近几期实际被买倍数
// POST /api/dlt-proxy?crowding=1 { action:'backfill' } 回补官方销售/中奖注数并重拟合（幂等）
//
// 避挤数据只说明“中了之后有多少人跟你分”，开奖概率与购买量无关。
import { fetchDltDraws } from './_lib/dlt.js'
import { applyCors } from './_lib/http.js'
import { getSql, ensureTables } from './_lib/neon.js'
import {
  syncOfficialDlt,
  fitCrowdModel,
  loadCrowdModel,
  recentWithRatios,
} from './_lib/dltOfficial.js'

export const config = { maxDuration: 60 }

async function handleCrowding(req, res) {
  try {
    const sql = getSql()
    await ensureTables(sql)

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'backfill')
      if (action === 'backfill') {
        const out = await syncOfficialDlt(sql)
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
      SELECT draw_id, date, front, back, sales, first_prize, second_prize
      FROM dlt_draw_stats ORDER BY draw_id DESC LIMIT 10`.catch(() => [])
    const recent = recentWithRatios(rows)

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ ok: true, model, recent })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  if (req.query?.crowding === '1' || req.method === 'POST') return handleCrowding(req, res)

  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await fetchDltDraws(count)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error('[dlt-proxy]', e)
    return res.status(502).json({ error: e.message || '大乐透开奖数据获取失败' })
  }
}
