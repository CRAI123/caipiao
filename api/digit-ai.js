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

const GAMES = { fc3d: '福彩3D', pl3: '排列三', pl5: '排列五', qxc: '七星彩', dlt: '大乐透' }
// 每位彩种的号码位数：排列三 3 位（直选/组选），排列五 5 位，七星彩 7 位（前 6 位 0-9 + 后区 0-14）
const POS_LEN = { fc3d: 3, pl3: 3, pl5: 5, qxc: 7 }
const maskId = (id) => (id ? `尾号${String(id).slice(-4)}` : '匿名设备')
// 结果结构版本：v9 起 AI 结果包含四段完整分析（analysis），命中旧版会重算
const SCHEMA = 9

/** 某个位数对应的 JSON 输出格式说明（供模型与重试用） */
function jsonHint(len) {
  const analysis =
    '"analysis":"四段完整分析：①结构概览 ②位置观察 ③组合参考 ④风险提示，300-450 字，分段输出，不要 Markdown 表格"'
  if (len === 7) {
    return `{"straight":["7 2 4 7 6 3 14","1 9 3 5 2 8 12"],"reasons":{"7 2 4 7 6 3 14":"一句话理由"},${analysis},"summary":"80 字内","risk":"一句风险提示"}`
  }
  return len === 5
    ? `{"straight":["01234","56789"],"reasons":{"01234":"一句话理由"},${analysis},"summary":"80 字内","risk":"一句风险提示"}`
    : `{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],"reasons":{"123":"一句话理由"},${analysis},"summary":"80 字内","risk":"一句风险提示"}`
}

/** 大乐透的 JSON 输出格式说明 */
function jsonHintDlt() {
  const analysis =
    '"analysis":"四段完整分析：①结构概览 ②冷热观察 ③组合参考 ④风险提示，300-450 字，分段输出，不要 Markdown 表格"'
  return `{"front":[3,11,17,24,31],"back":[4,9],"reasons":{"3":"一句话理由"},${analysis},"summary":"80 字内","risk":"一句风险提示"}`
}

/** 大乐透六轮：结构解读 → 反向质询 → 前区专项 → 后区专项 → 算法候选终选 → 终审校验 */
function roundsDlt() {
  return [
    {
      name: '结构解读',
      prompt:
        '第一轮：只依据前面给出的统计数据，解读本期前区/后区结构（区间分布、冷热、遗漏、和值、奇偶、连号与重号倾向）。不要编造数据，不要承诺中奖。控制在 300 字内。',
      temperature: 0.5,
    },
    {
      name: '反向质询',
      prompt:
        '第二轮：请以严格质疑者的身份审查第一轮结论——指出其中过度解读、样本不足或自相矛盾之处，并给出更保守的表述。控制在 250 字内。',
      temperature: 0.3,
    },
    {
      name: '前区专项',
      prompt:
        '第三轮：只做前区专项——结合上面的统计，分析 35 个前区号的区间分布（01-12 / 13-24 / 25-35）、连号与重号倾向、冷热与遗漏，给出 8-10 个优先关注的前区候选并说明取舍。' +
        '不要给出最终 5 个，不要编造数据，不要承诺中奖。控制在 250 字内。',
      temperature: 0.4,
      maxTokens: 600,
    },
    {
      name: '后区专项',
      prompt:
        '第四轮：只做后区专项——分析 12 个后区号的大小（01-06 / 07-12）、奇偶、遗漏与近期振幅，给出 3-4 个优先关注的后区候选并说明取舍。' +
        '不要编造数据，不要承诺中奖。控制在 150 字内。',
      temperature: 0.4,
      maxTokens: 400,
    },
    {
      name: '算法候选终选',
      prompt:
        '第五轮：综合前面四轮的结论，只能从上面给出的算法候选池里终选本期号码——前区 5 个、后区 2 个，不得自创池外号码。' +
        '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
        jsonHintDlt() +
        '。front 必须正好 5 个（1-35，升序、不重复），back 必须正好 2 个（1-12，升序、不重复），且都来自候选池；reasons 的键必须是上面出现过的前区号码。',
      temperature: 0.3,
    },
    {
      name: '终审校验',
      prompt:
        '第六轮：终审校验上一轮结果——逐个检查：前区是否正好 5 个、在 1-35 之间且不重复；后区是否正好 2 个、在 1-12 之间且不重复；是否都在算法候选池内。' +
        '有不合规的立即替换为候选池里的次优号。只输出最终 JSON（格式同上一轮），不要解释文字、不要代码块围栏。' +
        'risk 必须写明「一等奖概率 1/21425712 不变」。',
      temperature: 0.2,
    },
  ]
}

// 四轮真实分析：结构解读 → 反向质询 → 算法候选终选 → 终审校验（每轮单独调用一次大模型）
function roundsFor(len) {
  const is5 = len === 5
  const is7 = len === 7
  return [
    {
      name: '结构解读',
      prompt: is7
        ? '第一轮：只依据前面给出的统计数据，解读本期七星彩结构（前 6 位与后区的位置频率、遗漏、和值/跨度区间、不同数字个数形态）。不要编造数据，不要承诺中奖。控制在 300 字内。'
        : '第一轮：只依据前面给出的统计数据，解读本期号码结构（位置频率、遗漏、和值/跨度区间、形态倾向）。不要编造数据，不要承诺中奖。控制在 300 字内。',
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
      prompt: is7
        ? '第三轮：只能从上面给出的算法候选池里终选本期号码——直选 5 注，不得自创池外号码。' +
          '只输出一个 JSON 对象，不要解释文字、不要代码块围栏。格式：' +
          jsonHint(7) +
          '。straight 必须正好 5 个，每个号码 7 位（前 6 位 0-9，后区 0-14，用空格分隔），且都来自候选池；reasons 的键必须是上面出现过的号码。'
        : is5
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
      prompt: is7
        ? '第四轮：终审校验上一轮结果——逐个检查：直选是否正好 5 注、是否都在算法候选池内、是否都是 7 位（前 6 位 0-9，后区 0-14）。' +
          '有不合规的立即替换为候选池里的次优号。只输出最终 JSON（格式同上一轮），不要解释文字、不要代码块围栏。' +
          'risk 必须写明「每注直选 1/15000000 不变，一、二等奖为浮动奖金」。'
        : is5
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

/** 七星彩号码解析：数组 / "7 2 4 7 6 3 14" / "72476314" → 7 位数组 */
function parseQxcNum(x) {
  let arr = null
  if (Array.isArray(x)) arr = x.map(Number)
  else {
    const s = String(x || '').trim()
    const parts = s.split(/[\s,，]+/).filter(Boolean)
    if (parts.length === 7 && parts.every((p) => /^\d+$/.test(p))) arr = parts.map(Number)
    else if (/^\d{8}$/.test(s)) {
      const d = s.split('').map(Number)
      arr = [d[0], d[1], d[2], d[3], d[4], d[5], d[6] * 10 + d[7]]
    }
  }
  if (!arr || arr.length !== 7) return null
  const ok =
    arr.slice(0, 6).every((n) => Number.isInteger(n) && n >= 0 && n <= 9) &&
    Number.isInteger(arr[6]) &&
    arr[6] >= 0 &&
    arr[6] <= 14
  return ok ? arr : null
}

/** 规整模型给出的号码：只保留 digitCount 位数字，限制条数 */
function normalizePicks(raw, digitCount = 3) {
  if (!raw || typeof raw !== 'object') return null
  if (digitCount === 7) {
    const straight = []
    for (const x of Array.isArray(raw.straight) ? raw.straight : []) {
      const arr = parseQxcNum(x)
      if (!arr) continue
      const s = arr.join(' ')
      if (!straight.includes(s)) straight.push(s)
      if (straight.length >= 8) break
    }
    if (!straight.length) return null
    const reasons = {}
    if (raw.reasons && typeof raw.reasons === 'object') {
      for (const [k, v] of Object.entries(raw.reasons)) {
        const arr = parseQxcNum(k)
        if (arr) reasons[arr.join(' ')] = String(v).slice(0, 120)
      }
    }
    return {
      straight,
      group: [],
      group3: [],
      reasons,
      analysis: String(raw.analysis || '').slice(0, 2000),
      summary: String(raw.summary || '').slice(0, 400),
      risk: String(raw.risk || '').slice(0, 200),
    }
  }
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
    analysis: String(raw.analysis || '').slice(0, 2000),
    summary: String(raw.summary || '').slice(0, 400),
    risk: String(raw.risk || '').slice(0, 200),
  }
}

/** 规整大乐透号码：前区 1-35 去重升序，后区 1-12 去重升序 */
function normalizePicksDlt(raw) {
  if (!raw || typeof raw !== 'object') return null
  const fronts = []
  for (const x of Array.isArray(raw.front) ? raw.front : []) {
    const n = Number(String(x).replace(/\D/g, ''))
    if (Number.isInteger(n) && n >= 1 && n <= 35 && !fronts.includes(n)) fronts.push(n)
  }
  const front = fronts.sort((a, b) => a - b).slice(0, 8)
  const backs = []
  for (const x of Array.isArray(raw.back) ? raw.back : []) {
    const n = Number(String(x).replace(/\D/g, ''))
    if (Number.isInteger(n) && n >= 1 && n <= 12 && !backs.includes(n)) backs.push(n)
  }
  const back = backs.sort((a, b) => a - b).slice(0, 4)
  if (front.length < 5 || back.length < 2) return null
  const reasons = {}
  if (raw.reasons && typeof raw.reasons === 'object') {
    for (const [k, v] of Object.entries(raw.reasons)) {
      const n = Number(String(k).replace(/\D/g, ''))
      if (Number.isInteger(n) && n >= 1 && n <= 35) reasons[n] = String(v).slice(0, 120)
    }
  }
  return {
    front,
    back,
    reasons,
    analysis: String(raw.analysis || '').slice(0, 2000),
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

/** 校验客户端传来的算法候选池（大乐透：前区 1-35 / 后区 1-12；数字彩：digitCount 位号码数组） */
function sanitizeAlgo(raw, digitCount = 3) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.kind === 'dlt') {
    const ints = (arr, min, max, cap) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => Number(String(x).replace(/\D/g, '')))
        .filter((n) => Number.isInteger(n) && n >= min && n <= max)
        .filter((n, i, a) => a.indexOf(n) === i)
        .slice(0, cap)
    const front = ints(raw.front, 1, 35, 20)
    const back = ints(raw.back, 1, 12, 8)
    if (front.length < 5 || back.length < 2) return null
    return { kind: 'dlt', front, back }
  }
  if (digitCount === 7) {
    const straight = []
    for (const x of Array.isArray(raw.straight) ? raw.straight : []) {
      const arr = parseQxcNum(x)
      if (!arr) continue
      const s = arr.join(' ')
      if (!straight.includes(s)) straight.push(s)
      if (straight.length >= 40) break
    }
    if (straight.length < 5) return null
    return { straight, group: [], group3: [] }
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
  if (algo.kind === 'dlt') {
    return {
      ...picks,
      front: (picks.front || []).filter((n) => algo.front.includes(n)),
      back: (picks.back || []).filter((n) => algo.back.includes(n)),
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
    const isDlt = game === 'dlt'
    const needStraight = digitCount === 3 ? 3 : 5
    const needGroup = digitCount === 3 ? 2 : 0
    const needGroup3 = digitCount === 3 ? 1 : 0
    const needFront = 5
    const needBack = 2
    const ROUNDS = isDlt ? roundsDlt() : roundsFor(digitCount)

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
      const text = await callAi(llm, [...conv, ask], {
        maxTokens: r.maxTokens || 2000,
        temperature: r.temperature,
      })
      rounds.push({ name: r.name, text })
      conv.push(ask, { role: 'assistant', content: text })
    }
    const algoPool = sanitizeAlgo(algo, digitCount)
    const parsePicks = (raw) => (isDlt ? normalizePicksDlt(raw) : normalizePicks(raw, digitCount))
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
              content: isDlt
                ? '只输出一个 JSON 对象，不要任何解释文字、不要代码块围栏。格式：' +
                  jsonHintDlt() +
                  '。front 必须正好 5 个（1-35，升序、不重复），back 必须正好 2 个（1-12，升序、不重复）。' +
                  '只能从上面给出的算法候选池里选，不得自创池外号码。'
                : '只输出一个 JSON 对象，不要任何解释文字、不要代码块围栏。格式：' +
                  jsonHint(digitCount) +
                  '。' +
                  (digitCount === 3
                    ? 'straight 3 注直选、group 2 注组六（三个数字互不相同）、group3 1 注组三（两同一异）；'
                    : digitCount === 7
                      ? 'straight 必须正好 5 注直选（每注 7 位：前 6 位 0-9，后区 0-14，用空格分隔）；'
                      : 'straight 必须正好 5 注直选（每注 5 位数字）；') +
                  '只能从上面给出的算法候选池里选，不得自创池外号码。',
            },
          ],
          { maxTokens: 2000, temperature: 0.2 },
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
        picks = isDlt
          ? {
              front: algoPool.front.slice(0, needFront),
              back: algoPool.back.slice(0, needBack),
              reasons: {},
              summary: '',
              risk: '一等奖概率 1/21425712 不变。',
            }
          : {
              straight: algoPool.straight.slice(0, needStraight),
              group: algoPool.group.slice(0, needGroup),
              group3: algoPool.group3.slice(0, needGroup3),
              reasons: {},
              summary: '',
              risk:
                digitCount === 7
                  ? '每注直选 1/15000000 不变，一、二等奖为浮动奖金。'
                  : digitCount === 5
                    ? '每注直选 1/100000 不变。'
                    : '每注直选 1/1000、组六约 1/167、组三约 1/333 不变。',
            }
        finalSource = 'algo'
        finalNote = 'AI 终选解析失败，已回退到算法候选'
      } else if (isDlt) {
        const inFront = Math.min(restricted.front.length, needFront)
        const inBack = Math.min(restricted.back.length, needBack)
        const front = fillTo(restricted.front, algoPool.front, needFront)
        const back = fillTo(restricted.back, algoPool.back, needBack)
        picks = { ...restricted, front, back }
        const missing = needFront - inFront + (needBack - inBack)
        finalNote = missing
          ? `AI 终选 ${inFront + inBack}/${needFront + needBack} 个号码在池内，其余 ${missing} 个由算法候选补齐`
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
        ? [picks.analysis, picks.summary, picks.risk].filter(Boolean).join('\n\n') ||
          rounds[rounds.length - 1].text
        : rounds[rounds.length - 1].text,
      picks,
      finalSource,
      finalNote,
      algoPicks: algoPool
        ? algoPool.kind === 'dlt'
          ? { kind: 'dlt', front: algoPool.front.slice(0, 12), back: algoPool.back.slice(0, 4) }
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

    // 本期站内 AI 终选写入学习预测表（draw_id=目标期号，次日由 daily-push 打分）
    try {
      if (sqlRef && picks) {
        await persistPredictions(sqlRef, game, id, [
          isDlt
            ? { source: 'ai:site', picks: { front: picks.front, back: picks.back } }
            : {
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
