// ============================================================
// POST /api/digit-ai —— 福彩3D / 排列三 近 100 期 AI 解读（全站共享）
//
// 每期每彩种只允许首位用户触发真实的大模型调用，结果写入数据库；
// 后续用户读到同一份结果（前端会补一段模拟等待，保证体验一致）。
//
// body  peek: { action: 'peek', game, drawId }
// body  run : { action: 'run', game, drawId, label, messages, deviceId }
// ============================================================
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { applyCors } from './_lib/http.js'
import { getSql, ensureTables } from './_lib/neon.js'

export const config = { maxDuration: 60 }

const GAMES = { fc3d: '福彩3D', pl3: '排列三' }
const maskId = (id) => (id ? `尾号${String(id).slice(-4)}` : '匿名设备')

/** 校验客户端传来的 messages，避免把接口当任意代理用 */
function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 4) return null
  const out = []
  for (const m of messages) {
    if (!m || typeof m !== 'object') return null
    const role = String(m.role || '')
    if (!['system', 'user', 'assistant'].includes(role)) return null
    const content = String(m.content || '')
    if (!content || content.length > 24000) return null
    out.push({ role, content })
  }
  return out
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let sqlRef = null
  let claimed = null
  try {
    const { action = 'run', game = 'fc3d', drawId, label, messages, deviceId = '' } = req.body || {}
    const id = Number(drawId)
    if (!GAMES[game]) return res.status(400).json({ error: '未知彩种' })
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '缺少 drawId' })

    try {
      sqlRef = getSql()
      await ensureTables(sqlRef)
    } catch (e) {
      if (action === 'peek') return res.status(503).json({ error: `共享数据库不可用：${e.message}` })
      sqlRef = null
    }

    // ---- 只读：本期共享解析 ----
    if (action === 'peek') {
      const rows = await sqlRef`
        SELECT status, device_id, result, created_at
        FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${id}`
      const row = rows[0]
      if (!row) return res.status(200).json({ exists: false })
      return res.status(200).json({
        exists: true,
        status: row.status,
        owner: row.device_id,
        cachedAt: row.created_at,
        result: row.result || null,
      })
    }

    // ---- 分析：同一期同一彩种只允许首位用户触发 ----
    const msgs = sanitizeMessages(messages)
    if (!msgs) return res.status(400).json({ error: '分析参数不合法' })

    if (sqlRef) {
      const read = async () => {
        const rows = await sqlRef`
          SELECT status, device_id, result, created_at
          FROM digit_ai_runs
          WHERE game = ${game} AND draw_id = ${id}`
        return rows[0]
      }
      let row = await read()
      // 卡在 running 超过 3 分钟视为失败，允许重新领取
      if (row && row.status === 'running' && Date.now() - new Date(row.created_at).getTime() > 3 * 60 * 1000) {
        await sqlRef`DELETE FROM digit_ai_runs WHERE game = ${game} AND draw_id = ${id}`
        row = undefined
      }
      if (row) {
        if (row.status === 'done' && row.result) {
          return res.status(200).json({ cached: true, owner: row.device_id, cachedAt: row.created_at, ...row.result })
        }
        return res.status(409).json({ error: '本期已有用户正在分析，请稍后查看结果', running: true })
      }
      const claim = await sqlRef`
        INSERT INTO digit_ai_runs (game, draw_id, status, device_id)
        VALUES (${game}, ${id}, 'running', ${maskId(deviceId)})
        ON CONFLICT (game, draw_id) DO NOTHING
        RETURNING draw_id`
      if (!claim.length) {
        const again = await read()
        if (again?.status === 'done' && again.result) {
          return res.status(200).json({
            cached: true,
            owner: again.device_id,
            cachedAt: again.created_at,
            ...again.result,
          })
        }
        return res.status(409).json({ error: '本期已有用户正在分析，请稍后查看结果', running: true })
      }
      claimed = { game, drawId: id }
    }

    const started = Date.now()
    const llm = await resolveLlmSettings()
    const text = await callAi(llm, msgs, { maxTokens: 1800, temperature: 0.4 })
    const payload = {
      game,
      drawId: id,
      label: String(label || GAMES[game]).slice(0, 20),
      text,
      model: llm.llmModel,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
    }

    if (sqlRef) {
      await sqlRef`
        UPDATE digit_ai_runs
        SET status = 'done', result = ${JSON.stringify(payload)}::jsonb, updated_at = now()
        WHERE game = ${game} AND draw_id = ${id}`
    }

    return res.status(200).json({ ...payload, cached: false, owner: maskId(deviceId) })
  } catch (e) {
    console.error('digit-ai error:', e)
    if (sqlRef && claimed) {
      try {
        await sqlRef`DELETE FROM digit_ai_runs WHERE game = ${claimed.game} AND draw_id = ${claimed.drawId} AND status = 'running'`
      } catch {
        /* 清理失败不阻塞报错 */
      }
    }
    return res.status(500).json({ error: e.message || 'AI 分析失败' })
  }
}
