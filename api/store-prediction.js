// POST /api/store-prediction
// 存储一期预测号码，供每日 cron 与实际开奖对比
// body: { drawId, play, mode, picks: number[], dans: number[], tuos: number[], aiPicks: number[] }
import { getSql, ensureTables } from './_lib/neon.js'
import { applyCors } from './_lib/http.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { drawId, play = KL8_PLAY, mode = 'mix', picks = [], dans = [], tuos = [], aiPicks = [] } = req.body || {}
    if (!Number.isInteger(drawId)) {
      return res.status(400).json({ error: '缺少 drawId' })
    }
    if (!Array.isArray(picks) || picks.length === 0) {
      return res.status(400).json({ error: 'picks 不能为空' })
    }
    const sql = getSql()
    await ensureTables(sql)
    await sql`
      INSERT INTO kl8_predictions (draw_id, play, mode, picks, dans, tuos, ai_picks)
      VALUES (${drawId}, ${play}, ${mode}, ${JSON.stringify(picks)}::jsonb,
              ${JSON.stringify(dans)}::jsonb, ${JSON.stringify(tuos)}::jsonb,
              ${JSON.stringify(aiPicks)}::jsonb)
      ON CONFLICT (draw_id) DO UPDATE SET
        play = EXCLUDED.play,
        mode = EXCLUDED.mode,
        picks = EXCLUDED.picks,
        dans = EXCLUDED.dans,
        tuos = EXCLUDED.tuos,
        ai_picks = EXCLUDED.ai_picks,
        created_at = now()`
    return res.status(200).json({ ok: true, drawId })
  } catch (e) {
    console.error('store-prediction error:', e)
    return res.status(500).json({ error: e.message })
  }
}
