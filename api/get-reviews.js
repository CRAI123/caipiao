// GET /api/get-reviews?limit=30
// 拉取每日 AI 复盘记录，供前端展示
import { getSql, ensureTables } from './_lib/neon.js'
import { applyCors } from './_lib/http.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  // GET /api/get-reviews?learning=1&game=kl8 —— 学习中心数据（状态/近60期打分/笔记）
  if (req.query?.learning) {
    if (!process.env.DATABASE_URL) return res.status(200).json({ error: 'no_db' })
    try {
      const game = String(req.query.game || 'kl8')
      const sql = getSql()
      await ensureTables(sql)
      const [state, runs, notes, history] = await Promise.all([
        sql`SELECT param_key, value FROM learning_state WHERE game = ${game} ORDER BY param_key`,
        sql`
          SELECT draw_id, source, picks, meta, scored, updated_at
          FROM learning_predictions
          WHERE game = ${game} AND scored = true
          ORDER BY draw_id DESC
          LIMIT 60`,
        sql`
          SELECT id, game, content, meta, created_at
          FROM ai_experience_notes
          WHERE game IN (${game}, 'all') AND active = true
          ORDER BY created_at DESC
          LIMIT 12`,
        sql`
          SELECT param_key, day, value FROM learning_history
          WHERE game = ${game} AND day >= CURRENT_DATE - INTERVAL '60 days'
          ORDER BY day`,
      ])
      const parseMaybe = (v) => {
        if (typeof v !== 'string') return v
        try {
          return JSON.parse(v)
        } catch {
          return v
        }
      }
      return res.status(200).json({
        ok: true,
        game,
        state: state.map((r) => ({ paramKey: r.param_key, value: r.value })),
        runs: runs.map((r) => ({
          drawId: r.draw_id,
          source: r.source,
          picks: r.picks,
          meta: r.meta,
          updatedAt: r.updated_at,
        })),
        notes: notes.map((r) => ({ id: r.id, game: r.game, content: r.content, meta: r.meta, createdAt: r.created_at })),
        history: history.map((r) => ({
          paramKey: r.param_key,
          day: String(r.day).slice(0, 10),
          value: parseMaybe(r.value),
        })),
      })
    } catch (e) {
      console.error('get-reviews learning error:', e)
      return res.status(500).json({ error: e.message })
    }
  }
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
