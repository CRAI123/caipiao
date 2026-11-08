// GET /api/get-reviews?limit=30
// 拉取每日 AI 复盘记录，供前端展示
import { getSql, ensureTables } from './lib/neon.js'

export default async function handler(req, res) {
  try {
    const limit = Math.min(Number(req.query?.limit) || 30, 100)
    const sql = getSql()
    await ensureTables(sql)
    const rows = await sql`
      SELECT date, draw_id, predicted, actual, hits, won, prize, ai_summary, created_at
      FROM kl8_daily_reviews
      ORDER BY date DESC
      LIMIT ${limit}`
    const reviews = rows.map((r) => ({
      date: r.date,
      drawId: r.draw_id,
      predicted: typeof r.predicted === 'string' ? JSON.parse(r.predicted) : r.predicted,
      actual: typeof r.actual === 'string' ? JSON.parse(r.actual) : r.actual,
      hits: r.hits,
      won: r.won,
      prize: Number(r.prize),
      aiSummary: r.ai_summary,
      createdAt: r.created_at,
    }))
    return res.status(200).json({ ok: true, reviews })
  } catch (e) {
    console.error('get-reviews error:', e)
    return res.status(500).json({ error: e.message })
  }
}
