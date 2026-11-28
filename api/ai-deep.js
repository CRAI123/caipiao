// ============================================================
// POST /api/ai-deep —— 「AI 深度分析」
//
// 与单次 AI 选号的区别：
//   1. 样本外回测：对近 60 期做严格前推（只用当期之前的数据建池），
//      量化推荐池 / 排除池 / 结构选号的实际命中与随机期望的差距（含 z 值）
//   2. 第一轮 3 个模型 × 3 个温度 = 9 次独立分析，候选限定 v7 推荐池
//   3. 第二轮 3 个模型复核：拿到第一轮共识 + 回测结果后重给出最终号码
//   4. 加权投票 + 区间/奇偶结构约束聚合，输出最终一注
//
// 说明：轮次多、耗时久并不会改变「每号 25%」的独立随机性，回测数字就是证据。
// body: { draws, play }
// ============================================================
import {
  scoreBalls,
  pickBalanced,
  range,
  BALL_MAX,
  comb,
  isOdd,
} from '../src/lib/stats.js'
import { v7Recommend } from '../src/lib/kl8V7.js'
import { kl8PlayStats, KL8_PLAY_LABEL } from '../src/lib/kl8Math.js'
import { kl8Calibration } from '../src/lib/kl8Calib.js'
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { applyCors } from './_lib/http.js'
import { getSql, ensureTables } from './_lib/neon.js'
import { loadLearning, persistPredictions } from './_lib/learning.js'

export const config = { maxDuration: 60 }

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', weight: 1 },
  { id: 'claude-opus-5', label: 'Opus 5', weight: 0.8 },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', weight: 0.6 },
]
const TEMPS = [0.65, 0.85, 1.0]
const ROUND2_WEIGHT = 1.5
// 结果结构版本：v5 起终审不足 10 个时按算法融合顺序补齐，不再整体回退
const SCHEMA = 5

const bandOf = (n) => Math.min(3, Math.floor((n - 1) / 20))
const pad = (n) => String(n).padStart(2, '0')
const maskId = (id) => (id ? `尾号${String(id).slice(-4)}` : '匿名设备')

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
  // 模型常把号码写成 09 / 07 这种带前导零的数字，JSON 不合法：去掉前导零再解析
  try {
    return JSON.parse(slice.replace(/(?<![\d."'\-])0+(\d+)/g, '$1'))
  } catch {
    return null
  }
}

/** 严格前推回测：每期只用「该期之前」的数据建池，统计实际命中 */
function walkForward(draws, { periods = 60, poolSize = 30, play = 10 }) {
  const rows = []
  const maxN = Math.min(periods, draws.length - 40)
  for (let i = 0; i < maxN; i++) {
    const target = draws[i]
    const history = draws.slice(i + 1)
    if (history.length < 30) break
    const { scores } = scoreBalls(history, { periods: 100, halfLife: 20, hotMode: 'mix' })
    const ranked = range(BALL_MAX)
      .map((n) => ({ n, score: scores[n] }))
      .sort((a, b) => b.score - a.score)
    const hit = new Set(target.nums)
    const pool = ranked.slice(0, poolSize)
    const kill = ranked.slice(-poolSize)
    const picks = pickBalanced(ranked, play)
    rows.push({
      id: target.id,
      poolHits: pool.filter((x) => hit.has(x.n)).length,
      killHits: kill.filter((x) => hit.has(x.n)).length,
      pickHits: picks.filter((x) => hit.has(x.n)).length,
    })
  }

  const avg = (key) => rows.reduce((s, r) => s + r[key], 0) / (rows.length || 1)
  const poolMean = avg('poolHits')
  const killMean = avg('killHits')
  const pickMean = avg('pickHits')
  const expPool = (poolSize * 20) / 80
  const expPick = (play * 20) / 80
  const sdPool = Math.sqrt((poolSize * 0.25 * 0.75 * (80 - poolSize)) / 79)
  const sdPick = Math.sqrt(play * 0.25 * 0.75 * ((80 - play) / 79))
  const z = rows.length ? (poolMean - expPool) / (sdPool / Math.sqrt(rows.length)) : 0
  const zPick = rows.length ? (pickMean - expPick) / (sdPick / Math.sqrt(rows.length)) : 0

  return {
    n: rows.length,
    poolMean: +poolMean.toFixed(2),
    poolExp: +expPool.toFixed(2),
    killMean: +killMean.toFixed(2),
    pickMean: +pickMean.toFixed(2),
    pickExp: +expPick.toFixed(2),
    z: +z.toFixed(2),
    zPick: +zPick.toFixed(2),
    significant: Math.abs(z) >= 1.96,
    rows: rows.slice(0, 8),
  }
}

function calibText(calib) {
  if (!calib) return '样本不足，未做分档校准'
  return (
    calib.buckets.map((b) => `${b.name}档 ${(b.rate * 100).toFixed(2)}%(n=${b.n})`).join('，') +
    `；动态分组 log-loss ${calib.logLossDyn.toFixed(6)} vs 恒定25% ${calib.logLossBase.toFixed(6)}（差 ${calib.diff >= 0 ? '+' : ''}${calib.diff.toFixed(6)}）`
  )
}

function buildContext(draws, play, v7, calib, bt) {
  const nextId = draws[0].id + 1
  const pool = v7.pool.map((x) => `${pad(x.n)}(分${x.score},遗${x.miss})`).join(' ')
  const kill = v7.kill.map((x) => pad(x.n)).join(' ')
  const recent = draws.slice(0, 10)
    .map((d) => `第${d.id}期：${d.nums.map(pad).join(' ')}`)
    .join('\n')
  const lines = [
    `目标：第 ${nextId} 期，玩法「${KL8_PLAY_LABEL[play] || `选${play}`}」，给出 ${play} 个号码。`,
    '',
    `推荐池 30 码（号码(综合分,当前遗漏)）：${pool}`,
    `排除池 30 码：${kill}`,
    '',
    `最近 10 期开奖：`,
    recent,
    '',
    `遗漏分档校准（严格前推）：${calibText(calib)}`,
    `样本外回测（近 ${bt.n} 期，逐期只用历史建池）：`,
    `  推荐池 30 码平均命中 ${bt.poolMean} 个（随机期望 ${bt.poolExp}，z=${bt.z}）`,
    `  排除池 30 码平均命中 ${bt.killMean} 个（随机期望 ${bt.poolExp}）`,
    `  结构选号 ${play} 码平均命中 ${bt.pickMean} 个（随机期望 ${bt.pickExp}，z=${bt.zPick}）`,
    `  结论：${bt.significant ? '达到 5% 显著性（仍需警惕多重比较）' : '与随机无显著差异'}`,
    '',
  ]
  lines.push('请在推荐池内选号并按格式输出 JSON。')
  return lines.join('\n')
}

function schemaPrompt(play) {
  const bandLimit = Math.max(2, Math.ceil(play / 4) + 1)
  return `硬性规则：
1. 每个号码每期出现概率恒为 25%，开奖独立随机；不得声称发现规律、不得保证中奖。
2. 候选只能来自「推荐池 30 码」，必须正好 ${play} 个且不重复。
3. 四区间(1-20/21-40/41-60/61-80)每区至少 1 个，任一区间不超过 ${bandLimit} 个；奇偶数量差不超过 2。
4. 若回测显示与随机无显著差异，你必须在 risks 与 review 中如实写明「统计上无预测优势」。
5. 只输出一个 JSON 对象，不要代码块、不要解释文字：
{"picks":[号码],"confidence":"低|中","key_points":["3-5 条，必须引用给出的具体数据"],"risks":["1-3 条"],"review":"不超过 60 字"}`
}

function aggregate(pool, voteMap, play) {
  const bandLimit = Math.max(2, Math.ceil(play / 4) + 1)
  const oddLimit = Math.ceil(play / 2) + 1
  const ordered = [...pool].sort(
    (a, b) => (voteMap[b.n] || 0) - (voteMap[a.n] || 0) || b.score - a.score,
  )
  const picked = []
  const bandCount = [0, 0, 0, 0]
  let odd = 0
  for (const x of ordered) {
    if (picked.length >= play) break
    const b = bandOf(x.n)
    const oddFull = isOdd(x.n) ? odd >= oddLimit : picked.length - odd >= oddLimit
    if (bandCount[b] >= bandLimit || oddFull) continue
    picked.push(x.n)
    bandCount[b]++
    if (isOdd(x.n)) odd++
  }
  for (const x of ordered) {
    if (picked.length >= play) break
    if (!picked.includes(x.n)) picked.push(x.n)
  }
  return picked.sort((a, b) => a - b)
}

/**
 * 终选 10 码：底层算法分（v7 池内评分）× AI 投票分 融合后，再做结构约束收敛到 10 个
 * - ai：12 轮投票权重归一化
 * - algo：底层算法评分归一化
 * - total：mix[0] AI + mix[1] 算法（学习状态非冷启动时来自 state.mix，否则 0.55/0.45）
 */
function finalize10(pool, voteMap, hitsMap, play = 10, mix = [0.55, 0.45]) {
  const maxAi = Math.max(1, ...pool.map((x) => voteMap[x.n] || 0))
  const maxAlgo = Math.max(1, ...pool.map((x) => x.score || 0))
  const scored = pool.map((x) => {
    const ai = (voteMap[x.n] || 0) / maxAi
    const algo = (x.score || 0) / maxAlgo
    return {
      n: x.n,
      ai: Math.round(ai * 100),
      algo: Math.round(algo * 100),
      total: mix[0] * ai + mix[1] * algo,
      hits: hitsMap[x.n] || 0,
    }
  })
  const ordered = scored.sort((a, b) => b.total - a.total)
  const bandLimit = Math.max(2, Math.ceil(play / 4) + 1)
  const oddLimit = Math.ceil(play / 2) + 1
  const picked = []
  const bandCount = [0, 0, 0, 0]
  let odd = 0
  const tryPush = (x, strict) => {
    if (picked.some((p) => p.n === x.n)) return false
    const b = bandOf(x.n)
    if (strict && bandCount[b] >= bandLimit) return false
    if (strict) {
      const oddFull = isOdd(x.n) ? odd >= oddLimit : picked.length - odd >= oddLimit
      if (oddFull) return false
    }
    picked.push(x)
    bandCount[b]++
    if (isOdd(x.n)) odd++
    return true
  }
  // 先按结构约束取号，凑不满再放宽
  for (const x of ordered) {
    if (picked.length >= play) break
    tryPush(x, true)
  }
  for (const x of ordered) {
    if (picked.length >= play) break
    tryPush(x, false)
  }
  return picked.sort((a, b) => a.n - b.n)
}

/** 单次调用，解析失败降温度重试一次 */
async function askOnce(llm, model, messages, temperature, maxTokens = 900) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callAi(
        { ...llm, llmModel: model },
        messages,
        { maxTokens, temperature: attempt ? Math.max(0.3, temperature - 0.4) : temperature },
      )
      const obj = extractJson(raw)
      if (obj && Array.isArray(obj.picks)) return obj
    } catch {
      /* 重试 */
    }
  }
  return null
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const started = Date.now()
  let sqlRef = null
  let claimedKey = null
  try {
    const { draws = [], play = 10, action = 'run', deviceId = '', drawId } = req.body || {}

    // ---- 只读：历史 AI 终选记录（用于方法体检的命中对照） ----
    if (action === 'audit') {
      const k = Math.min(10, Math.max(1, Number(play) || 10))
      let sql
      try {
        sql = getSql()
        await ensureTables(sql)
      } catch (e) {
        return res.status(200).json({ ok: false, runs: [], error: `共享数据库不可用：${e.message}` })
      }
      const rows = await sql`
        SELECT draw_id, result, updated_at
        FROM kl8_ai_deep_runs
        WHERE play = ${k} AND status = 'done' AND result IS NOT NULL
        ORDER BY draw_id DESC
        LIMIT 30`
      return res.status(200).json({
        ok: true,
        runs: rows.map((r) => ({
          drawId: Number(r.draw_id),
          final: Array.isArray(r.result.final10) ? r.result.final10 : [],
          algo: Array.isArray(r.result.algo10) ? r.result.algo10 : [],
          at: r.result.at || r.updated_at || null,
          schema: r.result.schema || 0,
        })),
      })
    }

    // ---- 只读：取本期已生成的解析（所有人可见） ----
    if (action === 'peek') {
      const id = Number(drawId)
      const k = Math.min(10, Math.max(1, Number(play) || 10))
      if (!Number.isInteger(id)) return res.status(400).json({ error: '缺少 drawId' })
      let sql
      try {
        sql = getSql()
        await ensureTables(sql)
      } catch (e) {
        return res.status(503).json({ error: `共享数据库不可用：${e.message}` })
      }
      const rows = await sql`
        SELECT status, device_id, result, created_at
        FROM kl8_ai_deep_runs
        WHERE draw_id = ${id} AND play = ${k}`
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

    // ---- 分析：同一期同一玩法只允许首位用户触发 ----
    if (!Array.isArray(draws) || draws.length < 60) {
      return res.status(400).json({ error: '深度分析至少需要 60 期历史数据' })
    }
    const k = Math.min(10, Math.max(1, Number(play) || 10))
    const history = draws.slice(0, 200)
    const nextId = history[0].id + 1

    try {
      sqlRef = getSql()
      await ensureTables(sqlRef)
    } catch (e) {
      console.warn('ai-deep: 数据库不可用，跳过共享缓存', e.message)
      sqlRef = null
    }

    if (sqlRef) {
      const read = async () => {
        const rows = await sqlRef`
          SELECT status, device_id, result, created_at
          FROM kl8_ai_deep_runs
          WHERE draw_id = ${nextId} AND play = ${k}`
        return rows[0]
      }
      let row = await read()
      // 卡在 running 超过 5 分钟视为失败，允许重新领取
      if (row && row.status === 'running' && Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000) {
        await sqlRef`DELETE FROM kl8_ai_deep_runs WHERE draw_id = ${nextId} AND play = ${k}`
        row = undefined
      }
      // 旧版结果（结构不符，或号码数与当前玩法不一致）直接重算
      if (
        row &&
        row.status === 'done' &&
        row.result &&
        (row.result.schema !== SCHEMA ||
          !Array.isArray(row.result.final10) ||
          row.result.final10.length !== k)
      ) {
        await sqlRef`DELETE FROM kl8_ai_deep_runs WHERE draw_id = ${nextId} AND play = ${k}`
        row = undefined
      }
      if (row) {
        if (row.status === 'done' && row.result) {
          return res.status(200).json({
            cached: true,
            owner: row.device_id,
            cachedAt: row.created_at,
            ...row.result,
          })
        }
        return res.status(409).json({
          error: '本期已有用户正在分析，请稍后刷新查看结果',
          running: true,
          owner: row.device_id,
        })
      }
      const claim = await sqlRef`
        INSERT INTO kl8_ai_deep_runs (draw_id, play, status, device_id)
        VALUES (${nextId}, ${k}, 'running', ${maskId(deviceId)})
        ON CONFLICT (draw_id, play) DO NOTHING
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
        return res.status(409).json({
          error: '本期已有用户正在分析，请稍后刷新查看结果',
          running: true,
          owner: again?.device_id,
        })
      }
      claimedKey = { drawId: nextId, play: k }
    }

    // 读服务端学习状态（冷启动/读失败回退硬编码常量）；不读取任何往期 AI 生成内容
    let learnedKl8 = null
    try {
      const st = await loadLearning(sqlRef, 'kl8')
      if (st && !st.coldStart) learnedKl8 = st
    } catch (e) {
      console.warn('ai-deep: 读取学习状态失败，使用默认权重：', e.message)
    }
    const modelW =
      learnedKl8?.model?.weights?.length === MODELS.length
        ? learnedKl8.model.weights
        : MODELS.map((m) => m.weight)
    const tempW =
      learnedKl8?.temp?.weights?.length === TEMPS.length
        ? learnedKl8.temp.weights
        : TEMPS.map(() => 1)
    const mixW =
      learnedKl8?.mix?.weights?.length === 2 ? learnedKl8.mix.weights : [0.55, 0.45]
    const weightFor = (m, t) => modelW[MODELS.indexOf(m)] * tempW[TEMPS.indexOf(t)]

    const v7 = v7Recommend(history, { play: k, nextId })
    if (!v7) {
      if (sqlRef && claimedKey) {
        await sqlRef`DELETE FROM kl8_ai_deep_runs WHERE draw_id = ${claimedKey.drawId} AND play = ${claimedKey.play}`
      }
      return res.status(400).json({ error: '历史数据不足，无法生成推荐池' })
    }
    const calib = kl8Calibration(history, 300)
    const bt = walkForward(history, { periods: 60, play: k })
    const context = buildContext(history, k, v7, calib, bt)
    const poolSet = new Set(v7.pool.map((x) => x.n))

    const llm = await resolveLlmSettings()
    const system1 = `你是快乐8（80 选 20）数据分析助手，正在为第 ${nextId} 期做一次独立分析。
${schemaPrompt(k)}`
    const messages1 = [
      { role: 'system', content: system1 },
      { role: 'user', content: context },
    ]

    // 第一轮：3 模型 × 3 温度 = 9 次独立分析，全部并行
    const round1Tasks = []
    for (const m of MODELS) {
      for (const t of TEMPS) {
        round1Tasks.push(
          askOnce(llm, m.id, messages1, t).then((obj) => (obj ? { model: m, obj, temp: t } : null)),
        )
      }
    }
    const round1Raw = await Promise.all(round1Tasks)
    const round1 = round1Raw
      .filter(Boolean)
      .map(({ model, obj, temp }) => {
        const picks = [...new Set(obj.picks.map(Number))].filter((n) => poolSet.has(n)).slice(0, k)
        return picks.length >= Math.min(k, 3)
          ? { model, obj, picks, temp, weight: weightFor(model, temp) }
          : null
      })
      .filter(Boolean)
    if (!round1.length) {
      return res.status(502).json({ error: '第一轮 9 次分析均未返回有效号码，请稍后重试' })
    }

    // 第一轮共识（按模型×温度学习权重计票）
    const vote1 = {}
    round1.forEach(({ picks, weight }) => picks.forEach((n) => (vote1[n] = (vote1[n] || 0) + weight)))
    const consensus1 = Object.entries(vote1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(20, k * 2))
      .map(([n]) => Number(n))
      .sort((a, b) => a - b)
    const voteLines = round1
      .map(({ model, picks }) => `${model.label}：${picks.map(pad).join(' ')}`)
      .join('\n')

    // 第二轮：每个模型复核第一轮共识 + 回测，重新给最终号码
    const system2 = `你是快乐8研究助手，现在是第二轮复核。第一轮已有多模型独立给号（下方列出）。
你的任务：对照第一轮共识与样本外回测结果，重新给出最终 ${k} 个号码；若认为共识票数虚高或结构失衡可以换号，但必须说明理由。
${schemaPrompt(k)}`
    const messages2 = [
      { role: 'system', content: system2 },
      {
        role: 'user',
        content: [
          context,
          '',
          `第一轮各模型给号：`,
          voteLines,
          `第一轮共识（票数前列）：${consensus1.map(pad).join(' ')}`,
          '',
          `请给出你的最终 ${k} 个号码。`,
        ].join('\n'),
      },
    ]
    const round2Raw = await Promise.all(
      MODELS.map((m) => askOnce(llm, m.id, messages2, 0.5).then((obj) => (obj ? { model: m, obj } : null))),
    )
    const round2 = round2Raw
      .filter(Boolean)
      .map(({ model, obj }) => {
        const picks = [...new Set(obj.picks.map(Number))].filter((n) => poolSet.has(n)).slice(0, k)
        return picks.length >= Math.min(k, 3) ? { model, obj, picks } : null
      })
      .filter(Boolean)

    // 合并计票：第二轮按学习到的模型权重 ×1.5
    const voteMap = { ...vote1 }
    round2.forEach(({ model, picks }) => {
      const w = modelW[MODELS.indexOf(model)] * ROUND2_WEIGHT
      picks.forEach((n) => (voteMap[n] = (voteMap[n] || 0) + w))
    })

    const finalPicks = aggregate(v7.pool, voteMap, k)
    const votes = finalPicks
      .map((n) => ({
        n,
        score: +(voteMap[n] || 0).toFixed(1),
        hits: round1.filter((x) => x.picks.includes(n)).length + round2.filter((x) => x.picks.includes(n)).length,
      }))
      .sort((a, b) => b.score - a.score)

    const best =
      [...round2, ...round1].sort(
        (a, b) =>
          b.picks.filter((n) => finalPicks.includes(n)).length -
          a.picks.filter((n) => finalPicks.includes(n)).length,
      )[0] || round1[0]

    const stats = kl8PlayStats(k)
    const hitsMap = {}
    for (const { picks } of [...round1, ...round2]) {
      for (const n of picks) hitsMap[n] = (hitsMap[n] || 0) + 1
    }
    // 第二次收敛：按目标玩法收敛到 k 个，另出一份 20 码候选供终审
    const ten = finalize10(v7.pool, voteMap, hitsMap, k, mixW)
    const wide = finalize10(v7.pool, voteMap, hitsMap, Math.max(20, k), mixW)

    // 第三次：把 20 码算法候选交给 AI 终审，让它自己决定最终 k 码（失败则回退算法结果）
    const candLine = wide.map((x) => `${pad(x.n)}(算法${x.algo}/票${x.ai})`).join(' ')
    // JSON 示例必须给具体数字：用“号码”占位时模型会把字符串原样写回，导致解析后被全部过滤
    const demoPicks = Array.from({ length: k }, (_, i) => i + 1).join(',')
    const messages3 = [
      {
        role: 'system',
        content:
          '你是快乐8研究助手，现在做第 13 步终审。候选号已按「底层算法评分 × 12 轮模型投票」排好序。' +
          `任务：从这 ${wide.length} 个候选里挑出正好 ${k} 个（可以放弃算法排名靠后的号）。` +
          '只输出一行 JSON，不要代码块、不要逐号理由、不要任何解释：' +
          `{"picks":[${demoPicks}],"summary":"60 字内"}。` +
          `picks 必须正好 ${k} 个、不重复、且只能来自候选；不要承诺中奖。`,
      },
      {
        role: 'user',
        content: [context, '', `终审候选（算法分/票分）：${candLine}`, '', `请给出终审的 ${k} 个号码。`].join('\n'),
      },
    ]
    let finalTen = ten.map((x) => x.n)
    let finalTenSource = 'algo'
    let finalTenNote = ''
    const wideNums = wide.map((x) => x.n)
    try {
      // 终审用小模型即可（opus 在“只输出一行 JSON”上反而容易夹带解释，导致解析失败）
      const judgeModel = llm.llmModel || MODELS[MODELS.length - 1].id
      let judge = null
      let judgeRaw = ''
      for (let attempt = 0; attempt < 2 && !judge; attempt++) {
        judgeRaw = await callAi({ ...llm, llmModel: judgeModel }, messages3, {
          maxTokens: 900,
          temperature: attempt ? 0.1 : 0.3,
        })
        const obj = extractJson(judgeRaw)
        if (obj && Array.isArray(obj.picks)) judge = obj
      }
      if (!judge) console.error('[ai-deep] 终审返回无法解析：', String(judgeRaw).slice(0, 300))
      const picked = [...new Set((judge?.picks || []).map(Number))]
        .filter((n) => wideNums.includes(n))
        .slice(0, k)
      if (picked.length) {
        // 终审不足 k 个时按算法融合顺序补齐，保证永远正好给出 k 个
        const filled = [...picked]
        for (const n of finalTen) {
          if (filled.length >= k) break
          if (!filled.includes(n)) filled.push(n)
        }
        finalTen = filled.slice(0, k)
        finalTenSource = 'ai'
        finalTenNote =
          picked.length === k
            ? String(judge.summary || '').slice(0, 200)
            : `AI 终审给出 ${picked.length} 个有效号，其余 ${k - picked.length} 个按算法融合顺序补齐`
      } else {
        finalTenNote = '终审未给出有效号码，已采用算法融合结果'
      }
    } catch (e) {
      finalTenNote = `终审调用失败（${e.message || e}），已回退到算法融合结果`
    }

    const payload = {
      mode: 'deep',
      schema: SCHEMA,
      nextId,
      play: k,
      models: MODELS.map((m) => m.id),
      calls: MODELS.length * TEMPS.length + MODELS.length + 1,
      round1: round1.length,
      round2: round2.length,
      elapsedMs: Date.now() - started,
      finalPicks,
      final10: finalTen,
      final10Source: finalTenSource,
      final10Note: finalTenNote,
      algo10: ten.map((x) => x.n),
      final10Detail: finalTen
        .map((n) => {
          const w = wide.find((x) => x.n === n)
          return w ? { n, ai: w.ai, algo: w.algo, total: Math.round(w.total * 100), hits: w.hits } : null
        })
        .filter(Boolean),
      votes,
      report: {
        confidence: best?.obj?.confidence || '低',
        key_points: Array.isArray(best?.obj?.key_points) ? best.obj.key_points.slice(0, 6) : [],
        risks: Array.isArray(best?.obj?.risks) ? best.obj.risks.slice(0, 4) : [],
        review: best?.obj?.review || '',
      },
      round1Picks: round1.map(({ model, temp, weight, picks }) => ({
        modelId: model.id,
        model: model.label,
        temp,
        weight: +weight.toFixed(4),
        picks,
      })),
      round2Picks: round2.map(({ model, picks }) => ({ model: model.label, picks })),
      learned: {
        mix: mixW.map((v) => +v.toFixed(4)),
        modelW: modelW.map((v) => +v.toFixed(4)),
        tempW: tempW.map((v) => +v.toFixed(4)),
      },
      backtest: bt,
      v7: {
        picks: v7.picks,
        primaryWindow: v7.primaryWindow,
        pool: v7.pool.map((x) => x.n),
      },
      calibration: calib
        ? {
            diff: +calib.diff.toFixed(6),
            logLossDyn: +calib.logLossDyn.toFixed(6),
            logLossBase: +calib.logLossBase.toFixed(6),
          }
        : null,
      stats: {
        label: KL8_PLAY_LABEL[k] || `选${k}`,
        ev: +stats.ev.toFixed(3),
        returnRate: +(stats.returnRate * 100).toFixed(2),
        firstPrize: Math.round(comb(BALL_MAX, k) / comb(20, k)),
      },
    }

    if (sqlRef && claimedKey) {
      await sqlRef`
        UPDATE kl8_ai_deep_runs
        SET status = 'done', result = ${JSON.stringify(payload)}::jsonb, updated_at = now()
        WHERE draw_id = ${claimedKey.drawId} AND play = ${claimedKey.play}`
    }

    // 本期站内 AI 终选 10 码写入学习预测表（draw_id=目标期号，次日由 daily-push 打分）
    try {
      if (sqlRef) await persistPredictions(sqlRef, 'kl8', nextId, [{ source: 'ai:site', picks: finalTen }])
    } catch (e) {
      console.warn('ai-deep: 写入学习预测失败：', e.message)
    }

    return res.status(200).json({ ...payload, cached: false, owner: maskId(deviceId) })
  } catch (e) {
    console.error('ai-deep error:', e)
    if (sqlRef && claimedKey) {
      try {
        await sqlRef`DELETE FROM kl8_ai_deep_runs WHERE draw_id = ${claimedKey.drawId} AND play = ${claimedKey.play} AND status = 'running'`
      } catch {
        /* 清理失败不阻塞报错 */
      }
    }
    return res.status(500).json({ error: e.message || 'AI 深度分析失败' })
  }
}
