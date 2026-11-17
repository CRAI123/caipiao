// ============================================================
// POST /api/digit-ai —— 福彩3D / 排列三 / 排列五 近 100 期 AI 解读（全站共享）
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
import { notesForPrompt, persistPredictions } from './_lib/learning.js'

export const config = { maxDuration: 60 }

const GAMES = { fc3d: '福彩3D', pl3: '排列三', pl5: '排列五', ssq: '双色球' }
// 每位彩种的号码位数：排列三 3 位（直选/组选），排列五 5 位（只有直选）
const POS_LEN = { fc3d: 3, pl3: 3, pl5: 5 }
const maskId = (id) => (id ? `尾号${String(id).slice(-4)}` : '匿名设备')
// 结果结构版本：v6 起服务端注入【历史经验笔记】段，命中旧版会重算
const SCHEMA = 6

/** 某个位数对应的 JSON 输出格式说明（供模型与重试用） */
function jsonHint(len) {
  return len === 5
    ? '{"straight":["01234","56789"],"reasons":{"01234":"一句话理由"},"summary":"80 字内","risk":"一句风险提示"}'
    : '{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],"reasons":{"123":"一句话理由"},"summary":"80 字内","risk":"一句风险提示"}'
}

/** 双色球的 JSON 输出格式说明 */
function jsonHintSsq() {
  return '{"red":[1,7,12,18,25,30],"blue":7,"reasons":{"1":"一句话理由"},"summary":"80 字内","risk":"一句风险提示"}'
}

/** 双色球四轮：红球 6 个 + 蓝球 1 个，只能在算法候选池内终选 */
function roundsSsq() {
  return [
    {
      name: '结构解读',
      prompt:
        '第一轮：只依据前面给出的统计数据，解读本期红球/蓝球结构（区间分布、冷热、遗漏、和值、奇偶、连号与重号倾向）。不要编造数据，不要承诺中奖。控制在 300 字内。',
      temperature: 0.5,
    },
    {
      name: '反向质询',
      prompt:
        '第二轮：请以严格质疑者的身份审查第一轮结论——指出其中过度解读、样本不足或自相矛盾之处，并给出更保守的表述。控制在 250 字内。',
      temperature: 0.3,
    },
    {
      name: '算法候选终选',
      prompt:
        '第三轮：只能从上面给出的算法候选池里终选本期号码——红球 6 个、蓝球 1 个，不得自创池外号码。' +
        '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
        jsonHintSsq() +
        '。red 必须正好 6 个（1-33，升序、不重复），blue 必须正好 1 个（1-16），且都来自候选池；reasons 的键必须是上面出现过的红球号码。',
      temperature: 0.3,
    },
    {
      name: '终审校验',
      prompt:
        '第四轮：终审校验上一轮结果——逐个检查：红球是否正好 6 个、在 1-33 之间且不重复；蓝球是否在 1-16 之间；是否都在算法候选池内。' +
        '有不合规的立即替换为候选池里的次优号。只输出最终 JSON（格式同上一轮），不要解释文字、不要代码块围栏。' +
        'risk 必须写明「一等奖概率 1/17721088 不变」。',
      temperature: 0.2,
    },
  ]
}

// 四轮真实分析：结构解读 → 反向质询 → 算法候选终选 → 终审校验（每轮单独调用一次大模型）
function roundsFor(len) {
  const is5 = len === 5
  return [
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
      name: '算法候选终选',
      prompt: is5
        ? '第三轮：只能从上面给出的算法候选池里终选本期号码——直选 5 注，不得自创池外号码。' +
          '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
          jsonHint(5) +
          '。straight 必须正好 5 个，且都来自候选池；reasons 的键必须是上面出现过的号码。'
        : '第三轮：只能从上面给出的算法候选池里终选本期号码——直选 3 注、组六 2 注、组三 1 注，不得自创池外号码。' +
          '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
          jsonHint(3) +
          '。straight 必须正好 3 个、group 必须正好 2 个、group3 必须正好 1 个，且都来自候选池；reasons 的键必须是上面出现过的号码。',
      temperature: 0.3,
    },
    {
      name: '终审校验',
      prompt: is5
        ? '第四轮：终审校验上一轮结果——逐个检查：直选是否正好 5 注、是否都在算法候选池内、是否都是 5 位数字。' +
          '有不合规的立即替换为候选池里的次优号。只输出最终 JSON（格式同上一轮），不要解释文字、不要代码块围栏。' +
          'risk 必须写明「每注直选 1/100000 不变」。'
        : '第四轮：终审校验上一轮结果——逐个检查：直选是否正好 3 注、组六 2 注、组三 1 注；是否都在算法候选池内；是否都是 3 位数字，组六三位互不相同，组三两同一异。' +
          '有不合规的立即替换为候选池里的次优号。只输出最终 JSON（格式同上一轮），不要解释文字、不要代码块围栏。' +
          'risk 必须写明「每注直选 1/1000、组六约 1/167、组三约 1/333 不变」。',
      temperature: 0.2,
    },
  ]
}

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

/** 规整模型给出的号码：只保留 digitCount 位数字，限制条数 */
function normalizePicks(raw, digitCount = 3) {
  if (!raw || typeof raw !== 'object') return null
  const nums = (v, max) =>
    (Array.isArray(v) ? v : [])
      .map((x) => String(x).replace(/\D/g, ''))
      .filter((x) => x.length === digitCount)
      .slice(0, max)
  const straight = nums(raw.straight, 8)
  const group = digitCount === 3 ? nums(raw.group, 5) : []
  const group3 = digitCount === 3 ? nums(raw.group3, 3) : []
  if (!straight.length && !group.length && !group3.length) return null
  const reasons = {}
  if (raw.reasons && typeof raw.reasons === 'object') {
    for (const [k, v] of Object.entries(raw.reasons)) {
      const key = String(k).replace(/\D/g, '')
      if (key.length === digitCount) reasons[key] = String(v).slice(0, 120)
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

/** 规整双色球号码：红球 1-33 去重升序，蓝球 1-16 */
function normalizePicksSsq(raw) {
  if (!raw || typeof raw !== 'object') return null
  const reds = []
  for (const x of Array.isArray(raw.red) ? raw.red : []) {
    const n = Number(String(x).replace(/\D/g, ''))
    if (Number.isInteger(n) && n >= 1 && n <= 33 && !reds.includes(n)) reds.push(n)
  }
  const red = reds.sort((a, b) => a - b).slice(0, 8)
  const bn = Number(String(raw.blue ?? '').replace(/\D/g, ''))
  const blue = Number.isInteger(bn) && bn >= 1 && bn <= 16 ? bn : null
  if (red.length < 6) return null
  const reasons = {}
  if (raw.reasons && typeof raw.reasons === 'object') {
    for (const [k, v] of Object.entries(raw.reasons)) {
      const n = Number(String(k).replace(/\D/g, ''))
      if (Number.isInteger(n) && n >= 1 && n <= 33) reasons[n] = String(v).slice(0, 120)
    }
  }
  return {
    red,
    blue,
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

/** 校验客户端传来的算法候选池（双色球：红球 1-33 / 蓝球 1-16；数字彩：digitCount 位号码数组） */
function sanitizeAlgo(raw, digitCount = 3) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.kind === 'ssq') {
    const ints = (arr, min, max, cap) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => Number(String(x).replace(/\D/g, '')))
        .filter((n) => Number.isInteger(n) && n >= min && n <= max)
        .filter((n, i, a) => a.indexOf(n) === i)
        .slice(0, cap)
    const red = ints(raw.red, 1, 33, 20)
    const blue = ints(raw.blue, 1, 16, 8)
    if (red.length < 6 || blue.length < 1) return null
    return { kind: 'ssq', red, blue }
  }
  const take = (arr, max) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => String(x).replace(/\D/g, '').slice(0, digitCount))
      .filter((n) => n.length === digitCount)
      .filter((n, i, a) => a.indexOf(n) === i)
      .slice(0, max)
  const straight = take(raw.straight, 40)
  const group = digitCount === 3 ? take(raw.group, 30) : []
  const group3 = digitCount === 3 ? take(raw.group3, 20) : []
  if (straight.length < (digitCount === 3 ? 3 : 5)) return null
  if (digitCount === 3 && (group.length < 2 || group3.length < 1)) return null
  return { straight, group, group3 }
}

/** 终选号码必须落在算法候选池内 */
function restrictToPool(picks, algo) {
  if (!picks || !algo) return picks
  if (algo.kind === 'ssq') {
    return {
      ...picks,
      red: (picks.red || []).filter((n) => algo.red.includes(n)),
      blue: algo.blue.includes(picks.blue) ? picks.blue : null,
    }
  }
  return {
    ...picks,
    straight: (picks.straight || []).filter((n) => algo.straight.includes(n)),
    group: (picks.group || []).filter((n) => algo.group.includes(n)),
    group3: (picks.group3 || []).filter((n) => algo.group3.includes(n)),
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let sqlRef = null
  let claimed = null
  try {
    const { action = 'run', game = 'fc3d', drawId, label, messages, algo, deviceId = '' } = req.body || {}
    const id = Number(drawId)
    if (!GAMES[game]) return res.status(400).json({ error: '未知彩种' })
    const digitCount = POS_LEN[game] || 3
    const isSsq = game === 'ssq'
    const needStraight = digitCount === 3 ? 3 : 5
    const needGroup = digitCount === 3 ? 2 : 0
    const needGroup3 = digitCount === 3 ? 1 : 0
    const needRed = 6
    const ROUNDS = isSsq ? roundsSsq() : roundsFor(digitCount)

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
    // 四轮开始前注入 AI 自我复盘沉淀的历史经验笔记（空跳过）
    let notesText = ''
    try {
      notesText = await notesForPrompt(sqlRef, game)
    } catch {
      notesText = ''
    }
    const notesBlock = notesText
      ? '\n\n【历史经验笔记（AI 自我复盘沉淀，仅供参考，不提高中奖概率）】\n' + notesText.slice(0, 1200)
      : ''
    const noteCount = notesText ? notesText.split('\n').filter(Boolean).length : 0
    const conv = [...msgs]
    const rounds = []
    for (let i = 0; i < ROUNDS.length; i++) {
      const r = ROUNDS[i]
      const ask = { role: 'user', content: i === 0 ? r.prompt + notesBlock : r.prompt }
      const text = await callAi(llm, [...conv, ask], { maxTokens: 1200, temperature: r.temperature })
      rounds.push({ name: r.name, text })
      conv.push(ask, { role: 'assistant', content: text })
    }
    const algoPool = sanitizeAlgo(algo, digitCount)
    const parsePicks = (raw) => (isSsq ? normalizePicksSsq(raw) : normalizePicks(raw, digitCount))
    let picks = parsePicks(extractJson(rounds[rounds.length - 1].text))
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
              content: isSsq
                ? '只输出一个 JSON 对象，不要任何解释文字、不要代码块围栏。格式：' +
                  jsonHintSsq() +
                  '。red 必须正好 6 个（1-33，升序、不重复），blue 必须正好 1 个（1-16）。' +
                  '只能从上面给出的算法候选池里选，不得自创池外号码。'
                : '只输出一个 JSON 对象，不要任何解释文字、不要代码块围栏。格式：' +
                  jsonHint(digitCount) +
                  '。' +
                  (digitCount === 3
                    ? 'straight 3 注直选、group 2 注组六（三个数字互不相同）、group3 1 注组三（两同一异）；'
                    : 'straight 必须正好 5 注直选（每注 5 位数字）；') +
                  '只能从上面给出的算法候选池里选，不得自创池外号码。',
            },
          ],
          { maxTokens: 700, temperature: 0.2 },
        )
        picks = parsePicks(extractJson(retry))
      } catch {
        /* 重试失败按无号码处理 */
      }
    }

    // 终选收敛：AI 结果必须正好满足注数/个数且都在算法候选池内，否则回退算法候选
    let finalSource = 'ai'
    let finalNote = ''
    if (algoPool) {
      const restricted = restrictToPool(picks, algoPool)
      const fillTo = (have, poolList, need) => {
        const out = [...have]
        for (const n of poolList) {
          if (out.length >= need) break
          if (!out.includes(n)) out.push(n)
        }
        return out.slice(0, need)
      }
      if (!restricted) {
        picks = isSsq
          ? {
              red: algoPool.red.slice(0, needRed),
              blue: algoPool.blue[0],
              reasons: {},
              summary: '',
              risk: '一等奖概率 1/17721088 不变。',
            }
          : {
              straight: algoPool.straight.slice(0, needStraight),
              group: algoPool.group.slice(0, needGroup),
              group3: algoPool.group3.slice(0, needGroup3),
              reasons: {},
              summary: '',
              risk:
                digitCount === 5
                  ? '每注直选 1/100000 不变。'
                  : '每注直选 1/1000、组六约 1/167、组三约 1/333 不变。',
            }
        finalSource = 'algo'
        finalNote = 'AI 终选解析失败，已回退到算法候选'
      } else if (isSsq) {
        const inPool = Math.min(restricted.red.length, needRed)
        const blueOk = restricted.blue != null
        const red = fillTo(restricted.red, algoPool.red, needRed)
        const blue = blueOk ? restricted.blue : algoPool.blue[0]
        picks = { ...restricted, red, blue }
        const missing = needRed - inPool + (blueOk ? 0 : 1)
        finalNote = missing
          ? `AI 终选 ${inPool + (blueOk ? 1 : 0)}/${needRed + 1} 个号码在池内，其余 ${missing} 个由算法候选补齐`
          : 'AI 已在算法候选池内完成终选'
      } else {
        // AI 的池内终选保留，缺的注数用算法候选池顺序补齐，避免整份作废
        const straight = fillTo(restricted.straight, algoPool.straight, needStraight)
        const group = fillTo(restricted.group, algoPool.group, needGroup)
        const group3 = fillTo(restricted.group3, algoPool.group3, needGroup3)
        const totalNeed = needStraight + needGroup + needGroup3
        const missing =
          needStraight - straight.length + (needGroup - group.length) + (needGroup3 - group3.length)
        picks = { ...restricted, straight, group, group3 }
        finalSource = 'ai'
        finalNote = missing
          ? `AI 终选 ${totalNeed - missing}/${totalNeed} 注在池内，其余 ${missing} 注由算法候选补齐`
          : 'AI 已在算法候选池内完成终选'
      }
    } else {
      finalNote = '客户端未提供算法候选池，按 AI 原始结果展示'
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
      finalSource,
      finalNote,
      algoPicks: algoPool
        ? algoPool.kind === 'ssq'
          ? { kind: 'ssq', red: algoPool.red.slice(0, 12), blue: algoPool.blue.slice(0, 4) }
          : {
              straight: algoPool.straight.slice(0, needStraight),
              group: algoPool.group.slice(0, needGroup),
              group3: algoPool.group3.slice(0, needGroup3),
            }
        : null,
      schema: SCHEMA,
      notesInjected: noteCount,
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

    // 本期站内 AI 终选写入学习预测表（draw_id=目标期号，次日由 daily-push 打分；双色球行不参与打分，跳过）
    try {
      if (sqlRef && !isSsq && picks) {
        await persistPredictions(sqlRef, game, id, [
          {
            source: 'ai:site',
            picks: {
              straight: picks.straight || [],
              group: picks.group || [],
              group3: picks.group3 || [],
            },
          },
        ])
      }
    } catch (e) {
      console.warn('digit-ai: 写入学习预测失败：', e.message)
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
