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
// 结果结构版本：旧版（纯候选池 / 纯自由推演）命中后重算为「算法评分 + AI 复核」
const SCHEMA = 4

// 四轮真实分析：结构解读 → 反向质询 → 算法候选复核 → 定稿合成（每轮单独调用一次大模型）
const ROUNDS = [
  {
    name: '结构解读',
    prompt:
      '第一轮：只依据前面给出的统计数据，解读本期号码结构（位置频率、遗漏、和值/跨度区间、形态倾向）。不要编造数据，不要承诺中奖。控制在 300 字内。',
    temperature: 0.5,
  },
  {
    name: '反向质询',
    prompt:
      '第二轮：请以严格质疑者的身份审查第一轮结论——指出其中过度解读、样本不足或自相矛盾之处，并给出更保守的表述。控制在 250 字内。',
    temperature: 0.3,
  },
  {
    name: '算法复核',
    prompt:
      '第三轮：复核底层算法评分前列的候选，决定哪些值得保留。' +
      '从直选评分前列保留 6 个、组六保留 4 个、组三保留 2 个；对你要否决的高分候选给出理由。' +
      '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
      '{"keep":{"straight":["123","456"],"group":["135","246"],"group3":["112"]},"drop":[{"num":"789","why":"一句话"}],"notes":"60 字内"}。' +
      'keep 里的号码必须来自上面给出的算法评分候选；drop 最多 5 条。',
    temperature: 0.3,
  },
  {
    name: '定稿合成',
    prompt:
      '第四轮：综合前三轮与上一轮的算法保留清单，定稿本期号码，只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
      '{"straight":["123","456"],"group":["135","246"],"group3":["112"],"reasons":{"123":"一句话理由"},"summary":"本期结构判断，80 字内","risk":"一句风险提示"}。' +
      '要求：straight 是 3 注直选，优先从算法保留清单里选；group 是 2 注组六（三个数字互不相同）；group3 是 1 注组三（两同一异）；' +
      '如果要选保留清单之外的号码，必须在该号 reasons 里写明「为什么放弃算法高分号」；' +
      'reasons 的键必须是上面出现过的号码，每个号码一句话依据（含算法排名或结构依据）；' +
      '不要承诺中奖，risk 必须写明「每注直选 1/1000、组六约 1/167、组三约 1/333 不变」。',
    temperature: 0.3,
  },
]

/** 从模型输出里抠出 JSON（可能带 ```json 围栏或前后废话） */
function extractJson(text) {
  const raw = String(text || '')
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : raw
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const slice = body.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    /* 继续尝试修复 */
  }
  // 模型可能把号码写成 012 这种带前导零的数字（JSON 不合法），去掉前导零再解析
  try {
    return JSON.parse(slice.replace(/(?<![\d."'\-])0+(\d+)/g, '$1'))
  } catch {
    return null
  }
}

/** 规整模型给出的号码：只保留 3 位数字，限制条数 */
function normalizePicks(raw) {
  if (!raw || typeof raw !== 'object') return null
  const nums = (v, max) =>
    (Array.isArray(v) ? v : [])
      .map((x) => String(x).replace(/\D/g, ''))
      .filter((x) => x.length === 3)
      .slice(0, max)
  const straight = nums(raw.straight, 5)
  const group = nums(raw.group, 5)
  const group3 = nums(raw.group3, 3)
  if (!straight.length && !group.length && !group3.length) return null
  const reasons = {}
  if (raw.reasons && typeof raw.reasons === 'object') {
    for (const [k, v] of Object.entries(raw.reasons)) {
      const key = String(k).replace(/\D/g, '')
      if (key.length === 3) reasons[key] = String(v).slice(0, 120)
    }
  }
  return {
    straight,
    group,
    group3,
    reasons,
    summary: String(raw.summary || '').slice(0, 400),
    risk: String(raw.risk || '').slice(0, 200),
  }
}

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

    try {
      sqlRef = getSql()
      await ensureTables(sqlRef)
    } catch (e) {
      if (action === 'peek') return res.status(503).json({ error: `共享数据库不可用：${e.message}` })
      sqlRef = null
    }

    // ---- 只读：历史 AI 推荐，用于前端回测命中率 ----
    if (action === 'audit') {
      if (!sqlRef) return res.status(200).json({ ok: false, runs: [] })
      const rows = await sqlRef`
        SELECT draw_id, result
        FROM digit_ai_runs
        WHERE game = ${game} AND status = 'done' AND result IS NOT NULL
        ORDER BY draw_id DESC
        LIMIT 30`
      return res.status(200).json({
        ok: true,
        runs: rows.map((r) => ({
          drawId: Number(r.draw_id),
          picks: r.result.picks || null,
          at: r.result.at || null,
          schema: r.result.schema || 0,
        })),
      })
    }

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '缺少 drawId' })

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
      if (row && row.status === 'done' && row.result && row.result.schema !== SCHEMA) {
        // 旧版结果（没有推荐号码）直接重算，避免用户拿不到号码
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
    const conv = [...msgs]
    const rounds = []
    for (const r of ROUNDS) {
      const ask = { role: 'user', content: r.prompt }
      const text = await callAi(llm, [...conv, ask], { maxTokens: 1200, temperature: r.temperature })
      rounds.push({ name: r.name, text })
      conv.push(ask, { role: 'assistant', content: text })
    }
    let picks = normalizePicks(extractJson(rounds[rounds.length - 1].text))
    // 模型偶发拒答或格式漂移：用干净的上下文再要一次纯 JSON
    if (!picks) {
      try {
        const retry = await callAi(
          llm,
          [
            msgs[0],
            msgs[1],
            {
              role: 'user',
              content:
                '只输出一个 JSON 对象，不要任何解释文字、不要代码块围栏。格式：' +
                '{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],"reasons":{"123":"一句话依据"},"summary":"80 字内","risk":"一句风险提示"}。' +
                'straight 是 3 注直选，group 是 2 注组六（三个数字互不相同），group3 是 1 注组三（两同一异）；' +
                '优先从前面给出的算法评分前列与算法保留清单里选，选清单外的号要写明为什么放弃高分号。',
            },
          ],
          { maxTokens: 700, temperature: 0.2 },
        )
        picks = normalizePicks(extractJson(retry))
      } catch {
        /* 重试失败按无号码处理 */
      }
    }
    const payload = {
      game,
      drawId: id,
      label: String(label || GAMES[game]).slice(0, 20),
      // 有推荐号码时正文只放结论摘要，避免把 JSON 原文当解读展示
      text: picks
        ? [picks.summary, picks.risk].filter(Boolean).join('\n\n') || rounds[rounds.length - 1].text
        : rounds[rounds.length - 1].text,
      picks,
      schema: SCHEMA,
      rounds,
      roundCount: ROUNDS.length,
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
