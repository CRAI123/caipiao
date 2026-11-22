// ============================================================
// 每日推荐推送 —— Vercel Cron（14:00 Asia/Shanghai = 06:00 UTC）
// 计算快乐8 / 福彩3D / 排列三 / 排列五 / 大乐透 下期参考号码，推送到飞书自定义机器人 Webhook。
// 每个彩种都走站内当前最强算法，卡片标题里标明档位：排列三、排列五 = v3 Pro（9 专家 Hedge 权重 + 结构约束）。
//
// 配置来源（优先数据库）：
//   1) Neon admin_config 表 key = 'daily_push_config'
//      value = {"webhook":"https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
//               "secret":"（可选，机器人开启签名校验时必填）",
//               "kl8":true,"fc3d":true,"pl3":true,"pl5":true,"dlt":true}
//   2) 环境变量 FEISHU_WEBHOOK_URL / FEISHU_WEBHOOK_SECRET
//
// 手动触发：GET /api/daily-push?test=1
// ============================================================
import crypto from 'node:crypto'
import { getSql, readConfig, writeConfig, ensureTables } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchPl5Draws } from './_lib/pl5.js'
import { fetchDltDraws } from './_lib/dlt.js'
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { scoreBalls, pickBalanced, BALL_MAX, comb } from '../src/lib/stats.js'
import { v7Recommend } from '../src/lib/kl8V7.js'
import { KL8_PLAY, KL8_PLAY_LABEL } from '../src/lib/kl8Math.js'
import {
  summarizeDigit,
  digitCandidatePool,
  buildDigitMessages,
  summarizeDigit5,
  pl5CandidatePool,
  buildPL5Messages,
} from '../src/lib/digitAi.js'
import { predictFC3Dv2 } from '../src/lib/fc3dPredict.js'
import { predictPL3Pro } from '../src/lib/pl3Predict.js'
import { predictPL5 } from '../src/lib/pl5Predict.js'
import { predictDLT } from '../src/lib/dltPredict.js'
import { applyCors } from './_lib/http.js'
import {
  loadLearning,
  notesForPrompt,
  scoreAndLearn,
  persistPredictions,
  maybeGenerateNotes,
  buildRecentSummary,
  writeDigest,
  deepReviewWeekly,
} from './_lib/learning.js'

export const config = { maxDuration: 60 }

const CONFIG_KEY = 'daily_push_config'
const STATUS_KEY = 'daily_push_last'
// 上期推送记录（用于「上期中奖几个」的 AI 结果对照，算法部分直接用历史数据重算）
const HISTORY_KEY = 'daily_push_history'
const FRESH_RETRY_MS = 1500
// AI 终选与站内共用同一套结构版本号，只有同版本的历史结果才复用
const DIGIT_SCHEMA = 7
export const KL8_SCHEMA = 5
// 夜间学习批次（22:00）预生成的次日快乐8终选，14:00 推送直接复用
const PREWARM_KL8_KEY = 'push_prewarm_kl8'
// 单个 AI 调用最多等这么久，超时就发算法结果，避免整个推送被拖死
const AI_TIMEOUT_MS = 38000

/** 北京时间日期（YYYY-MM-DD） */
const shDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d)

/**
 * 判断数据是否够新。
 * 快乐8 / 3D / 排列三 每天开一期，14:00 推送时最新一期应当是「昨天」（maxAgeDays=1）；
 * 大乐透每周一、三、六开奖，14:00 推送时最新一期最多是 3 天前，所以放宽到 4 天。
 * state='stale' 表示数据源还没更新，卡片顶部会亮红字提醒。
 */
function freshness(latest, maxAgeDays = 1) {
  const expected = shDate(new Date(Date.now() - 86400000 * maxAgeDays))
  const date = latest?.date || null
  if (!date) return { state: 'unknown', expected, date: null, id: latest?.id ?? null }
  return {
    state: date >= expected ? 'ok' : 'stale',
    expected,
    date,
    id: latest?.id ?? null,
  }
}

const staleWarning = (f, name) =>
  f && f.state === 'stale'
    ? line(
        `<font color='red'>⚠️ ${name}数据源还没更新：最新只到 ${f.date}（第 ${f.id} 期），本期推荐基于旧数据，稍后可手动重发</font>`,
      )
    : null

/** 记录最近一次推送结果，供设置页查看（失败也能看到，不会被静默吞掉） */
async function savePushStatus(status) {
  if (!process.env.DATABASE_URL) return
  try {
    await writeConfig(getSql(), STATUS_KEY, JSON.stringify(status))
  } catch (e) {
    console.error('[daily-push] 记录推送状态失败：', e.message)
  }
}

async function loadConfig() {
  let cfg = {}
  if (process.env.DATABASE_URL) {
    try {
      const sql = getSql()
      const raw = await readConfig(sql, CONFIG_KEY)
      if (raw) cfg = JSON.parse(raw) || {}
    } catch (e) {
      console.error('[daily-push] 读取推送配置失败：', e.message)
    }
  }
  return {
    webhook: cfg.webhook || process.env.FEISHU_WEBHOOK_URL || '',
    secret: cfg.secret || process.env.FEISHU_WEBHOOK_SECRET || '',
    kl8: cfg.kl8 !== false,
    fc3d: cfg.fc3d !== false,
    pl3: cfg.pl3 !== false,
    pl5: cfg.pl5 !== false,
    dlt: cfg.dlt !== false,
  }
}

/** 快乐8：v7 多窗口加权评分（站内推荐页同款）+ 三注分注参考；learned 非冷启动时注入窗口权重 */
export function buildKl8(draws, learned = null) {
  const history = draws.slice(0, 200)
  const nextId = history[0].id + 1
  // state.windows（{keys:['100',...], weights:[...]}）→ v7Recommend 需要的 [{w,weight}]
  const winOverride =
    learned && !learned.coldStart && Array.isArray(learned.windows?.weights)
      ? learned.windows.weights.map((weight, i) => ({ w: Number(learned.windows.keys[i]), weight }))
      : null
  const v7 = v7Recommend(history, { play: KL8_PLAY, nextId, windowWeightsOverride: winOverride })
  const { scores } = scoreBalls(history, { periods: 100, halfLife: 20, hotMode: 'mix' })
  const ranked = Array.from({ length: BALL_MAX }, (_, i) => i + 1)
    .map((n) => ({ n, score: scores[n] }))
    .sort((a, b) => b.score - a.score)
  const picks = (v7?.picks?.length === KL8_PLAY ? [...v7.picks] : pickBalanced(ranked, KL8_PLAY).map((x) => x.n)).sort(
    (a, b) => a - b,
  )
  const groups = [0, 3, 6].map((off) =>
    pickBalanced(ranked.slice(off), KL8_PLAY).map((x) => x.n).sort((a, b) => a - b),
  )
  return { latest: history[0], nextId, v7, picks, groups }
}

const pad = (n) => String(n).padStart(2, '0')

function buildFc3d(draws, learned = null) {
  const ex = learned && !learned.coldStart ? learned.experts : null
  // 引擎只接受一组长度 4 的成分权重（百/十/个共用）：把逐位学习权重按成分取均值
  const wOverride =
    ex && Array.isArray(ex.p0) && Array.isArray(ex.p1) && Array.isArray(ex.p2)
      ? ex.p0.map((_, i) => (ex.p0[i] + ex.p1[i] + ex.p2[i]) / 3)
      : null
  const p = predictFC3Dv2(draws, wOverride ? { weightsOverride: wOverride } : {})
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 排列三：v3 Pro 档（9 专家 Hedge 自适应权重 + 六维结构约束），站内概率最高的一档 */
function buildPl3(draws, learned = null) {
  const ex = learned && !learned.coldStart ? learned.experts : null
  const wOverride =
    ex && Array.isArray(ex.p0) && Array.isArray(ex.p1) && Array.isArray(ex.p2)
      ? [ex.p0, ex.p1, ex.p2]
      : null
  const p = predictPL3Pro(draws, wOverride ? { weightsOverride: wOverride } : {})
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 排列五：v3 Pro 档（9 专家 Hedge 自适应权重 + 结构约束 + 5 位穷举 10 万注） */
function buildPl5(draws, learned = null) {
  const ex = learned && !learned.coldStart ? learned.experts : null
  const wOverride =
    ex && Array.isArray(ex.p0) && Array.isArray(ex.p1) && Array.isArray(ex.p2) &&
    Array.isArray(ex.p3) && Array.isArray(ex.p4)
      ? [ex.p0, ex.p1, ex.p2, ex.p3, ex.p4]
      : null
  const p = predictPL5(draws, wOverride ? { weightsOverride: wOverride } : {})
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 大乐透：前区结构评分枚举 + 后区周期/振荡评分 */
function buildDlt(draws, learned = null) {
  const opts = {}
  if (learned && !learned.coldStart) {
    if (Array.isArray(learned.frontSignals?.weights)) opts.frontWeightsOverride = learned.frontSignals.weights
    if (Array.isArray(learned.backSignals?.weights)) opts.backWeightsOverride = learned.backSignals.weights
  }
  const p = predictDLT(draws, opts)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

// ============================================================
// AI 终选：算法先选 → AI 只在候选池内终选
// 与站内规则一致（3D / 排列三 直选 3 + 组六 2 + 组三 1；快乐8 算法 20 码 → AI 终选 6 码），
// 优先复用全站共享结果，没有才现场调用一次大模型，失败一律回退算法结果。
// ============================================================

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
  // 模型常把号码写成 012 / 07 这种带前导零的数字，JSON 不合法：去掉前导零再解析
  try {
    return JSON.parse(slice.replace(/(?<![\d."'\-])0+(\d+)/g, '$1'))
  } catch {
    return null
  }
}

/** 单次 AI 调用的兜底超时（超时按失败处理，发送算法结果） */
function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI 调用超过 ${Math.round(ms / 1000)} 秒`)), ms)
    }),
  ])
}

/** 按分数从推荐池里做结构约束取号（四区间均衡 + 奇偶均衡），与站内终选同口径 */
function balancedFromPool(pool, n) {
  const bandOf = (x) => Math.min(3, Math.floor((x - 1) / 20))
  const bandLimit = Math.max(2, Math.ceil(n / 4) + 1)
  const oddLimit = Math.ceil(n / 2) + 1
  const ordered = [...pool].sort((a, b) => b.score - a.score)
  const picked = []
  const band = [0, 0, 0, 0]
  let odd = 0
  const push = (x, strict) => {
    if (picked.includes(x.n)) return false
    const b = bandOf(x.n)
    if (strict && band[b] >= bandLimit) return false
    if (strict && (x.n % 2 === 1 ? odd >= oddLimit : picked.length - odd >= oddLimit)) return false
    picked.push(x.n)
    band[b]++
    if (x.n % 2 === 1) odd++
    return true
  }
  for (const x of ordered) {
    if (picked.length >= n) break
    push(x, true)
  }
  for (const x of ordered) {
    if (picked.length >= n) break
    push(x, false)
  }
  return picked.sort((a, b) => a - b)
}

/**
 * 把推送端算出的 3D / 排列三 AI 终选写回全站共享表（与网站同一份）。
 * 只覆盖「推送端自己写的」或「结构版本落后」的记录；
 * 站内用户正在分析（status='running'）或已是当前版本的真实结果时跳过，绝不覆盖。
 */
async function persistDigitRun(sql, payload) {
  if (!sql) return
  try {
    const result = JSON.stringify(payload)
    const rows = await sql`
      INSERT INTO digit_ai_runs (game, draw_id, status, device_id, result, updated_at)
      VALUES (${payload.game}, ${payload.drawId}, 'done', 'daily-push', ${result}::jsonb, now())
      ON CONFLICT (game, draw_id) DO UPDATE
      SET status = 'done',
          device_id = 'daily-push',
          result = EXCLUDED.result,
          updated_at = now()
      WHERE digit_ai_runs.device_id = 'daily-push'
         OR (
              digit_ai_runs.status = 'done'
              AND COALESCE((digit_ai_runs.result->>'schema')::int, 0) < ${payload.schema}
            )
      RETURNING draw_id`
    if (!rows.length) {
      console.log(`[daily-push] ${payload.game} ${payload.drawId} 已有更新的站内 AI 结果，跳过回写`)
    }
  } catch (e) {
    console.error('[daily-push] 回写 AI 结果失败：', e.message)
  }
}

/** 3D / 排列三 / 排列五：算法候选池 + AI 终选（3D/排列三 3+2+1，排列五 5 注直选），失败回退算法前几 */
export async function buildDigitAi({ game, label, draws, sql, llm }) {
  const started = Date.now()
  const is5 = game === 'pl5'
  const digitCount = is5 ? 5 : 3
  const needStraight = is5 ? 5 : 3
  const needGroup = is5 ? 0 : 2
  const needGroup3 = is5 ? 0 : 1
  const totalNeed = needStraight + needGroup + needGroup3
  const drawId = Number(draws?.[0]?.id)
  const summary = (is5 ? summarizeDigit5 : summarizeDigit)(draws, 100)
  if (!drawId || !summary) return null
  const pool = is5 ? pl5CandidatePool(summary) : digitCandidatePool(summary)
  if (!pool.straight.length || (!is5 && (!pool.group.length || !pool.group3.length))) return null
  const algoTop = {
    straight: pool.straight.slice(0, needStraight),
    group: (pool.group || []).slice(0, needGroup),
    group3: (pool.group3 || []).slice(0, needGroup3),
  }
  const base = { drawId, pool, algoTop, picks: algoTop, source: 'algo', note: '', summary: '', cached: false }

  // 1) 全站已有本期 AI 终选（用户点过）→ 直接复用
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${drawId} AND status = 'done'`
      const r = rows[0]?.result
      if (r && r.schema === DIGIT_SCHEMA && r.picks?.straight?.length === needStraight) {
        return {
          ...base,
          picks: {
            straight: r.picks.straight,
            group: r.picks.group || [],
            group3: r.picks.group3 || [],
          },
          source: r.finalSource === 'algo' ? 'algo' : 'ai',
          note: r.finalNote || '',
          summary: r.picks.summary || '',
          cached: true,
        }
      }
    } catch {
      /* 读缓存失败继续现算 */
    }
  }

  // 2) 现场调用一次大模型：只让它从候选池里终选
  try {
    const [sys, user] = (is5 ? buildPL5Messages : buildDigitMessages)(summary, label)
    // 注入 AI 自我复盘沉淀的历史经验笔记（空串跳过）
    const notes = await notesForPrompt(sql, game)
    const notesBlock = notes
      ? '【历史经验笔记（AI 自我复盘沉淀，仅供参考，不提高中奖概率）】\n' + notes + '\n\n'
      : ''
    const messages = [
      sys,
      {
        role: 'user',
        content:
          `${user.content}\n\n` +
          notesBlock +
          '只输出一个 JSON 对象，不要解释文字、不要代码块围栏：' +
          (is5
            ? '{"straight":["01234","56789"],"reasons":{"01234":"一句话依据"},"summary":"60 字内","risk":"一句风险提示"}。' +
              'straight 必须正好 5 个，且都只能来自上面给出的候选池。'
            : '{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],' +
              '"reasons":{"123":"一句话依据"},"summary":"60 字内","risk":"一句风险提示"}。' +
              'straight 必须正好 3 个、group 正好 2 个、group3 正好 1 个，且都只能来自上面给出的候选池。'),
      },
    ]
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 900, temperature: 0.3 }),
      AI_TIMEOUT_MS,
    )
    const obj = extractJson(raw)
    if (!obj) return { ...base, note: `AI 输出无法解析，已回退算法前${is5 ? '五' : '三'}` }
    const take = (arr, max) =>
      [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x).replace(/\D/g, '')))]
        .filter((n) => n.length === digitCount)
        .slice(0, max)
    // AI 选中的（先过滤到池内），不足的用算法池顺序补齐——不因为缺一两注就整份作废
    const sAi = pickInPool(take(obj?.straight, 12), pool.straight, needStraight)
    const gAi = is5 ? [] : pickInPool(take(obj?.group, 8), pool.group, needGroup)
    const g3Ai = is5 ? [] : pickInPool(take(obj?.group3, 5), pool.group3, needGroup3)
    const fillTo = (have, poolList, need) => {
      const out = [...have]
      for (const n of poolList) {
        if (out.length >= need) break
        if (!out.includes(n)) out.push(n)
      }
      return out.slice(0, need)
    }
    const straight = fillTo(sAi, pool.straight, needStraight)
    const group = fillTo(gAi, pool.group || [], needGroup)
    const group3 = fillTo(g3Ai, pool.group3 || [], needGroup3)
    const missing =
      needStraight - sAi.length + (needGroup - gAi.length) + (needGroup3 - g3Ai.length)
    const note = missing
      ? `AI 终选 ${totalNeed - missing}/${totalNeed} 注在池内，其余 ${missing} 注由算法候选补齐`
      : 'AI 已在算法候选池内完成终选'
    const summaryText = String(obj?.summary || '').slice(0, 200)
    const risk = is5
      ? '每注直选 1/100000 不变。'
      : '每注直选 1/1000、组六约 1/167、组三约 1/333 不变。'
    // 写回共享表：14:00 推送算一次，站内用户当天直接复用
    await persistDigitRun(sql, {
      game,
      drawId,
      label,
      text: [summaryText, risk].filter(Boolean).join('\n\n'),
      picks: {
        straight,
        group,
        group3,
        reasons: obj?.reasons && typeof obj.reasons === 'object' ? obj.reasons : {},
        summary: summaryText,
        risk,
      },
      finalSource: 'ai',
      finalNote: note,
      algoPicks: algoTop,
      schema: DIGIT_SCHEMA,
      rounds: [
        {
          name: '算法候选终选',
          text: summaryText || (is5 ? '推送端单轮终选（池内直选 5 注）' : '推送端单轮终选（池内 3 + 2 + 1）'),
        },
      ],
      roundCount: 1,
      model: llm.llmModel,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
    })
    return {
      ...base,
      picks: { straight, group, group3 },
      source: 'ai',
      note,
      summary: summaryText,
    }
  } catch (e) {
    return { ...base, note: `AI 终选失败（${e.message || e}），已回退算法前${is5 ? '五' : '三'}` }
  }
}

/** 按顺序取候选池里出现过的号码，凑够 max 个 */
function pickInPool(list, pool, max) {
  return [...new Set(list)].filter((n) => pool.includes(n)).slice(0, max)
}

/** 3D/排列三/排列五：算法候选池 Top 注（写 learning_predictions algo:pool 行用） */
function digitAlgoPicks(game, draws) {
  const is5 = game === 'pl5'
  const summary = (is5 ? summarizeDigit5 : summarizeDigit)(draws, 100)
  if (!summary) return null
  const pool = is5 ? pl5CandidatePool(summary) : digitCandidatePool(summary)
  if (!pool?.straight?.length) return null
  return is5
    ? { straight: pool.straight.slice(0, 5) }
    : {
        straight: pool.straight.slice(0, 3),
        group: (pool.group || []).slice(0, 2),
        group3: (pool.group3 || []).slice(0, 1),
      }
}

/** 快乐8：算法 20 码 → AI 终选 6 码，失败回退算法融合 6 码 */
export async function buildKl8Ai({ draws, built, sql, llm }) {
  if (!built?.v7) return null
  const history = draws.slice(0, 200)
  const nextId = built.nextId
  const algoTen = [...built.picks]
  const wide = balancedFromPool(built.v7.pool, 20)
  const base = { nextId, wide, ten: algoTen, source: 'algo', note: '', summary: '', cached: false }

  // 1) 全站已有本期深度分析 → 复用它的终选 6 码
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM kl8_ai_deep_runs
        WHERE draw_id = ${nextId} AND play = ${KL8_PLAY} AND status = 'done'`
      const r = rows[0]?.result
      if (r && r.schema === KL8_SCHEMA && Array.isArray(r.final10) && r.final10.length === KL8_PLAY) {
        return {
          ...base,
          ten: [...r.final10].sort((a, b) => a - b),
          source: r.final10Source === 'algo' ? 'algo' : 'ai',
          note: r.final10Note || '',
          cached: true,
        }
      }
    } catch {
      /* 读缓存失败继续现算 */
    }
  }

  // 1.5) 夜间学习批次（22:00）预生成的本期终选 → 直接复用，避免 14:00 推送再等 AI
  if (sql) {
    try {
      const raw = await readConfig(sql, PREWARM_KL8_KEY)
      const p = raw ? JSON.parse(raw) : null
      if (
        p &&
        p.nextId === nextId &&
        p.schema === KL8_SCHEMA &&
        Array.isArray(p.ten) &&
        p.ten.length === KL8_PLAY
      ) {
        return {
          ...base,
          ten: [...p.ten].sort((a, b) => a - b),
          source: p.source || 'ai',
          note: p.note || '',
          summary: p.summary || '',
          cached: true,
        }
      }
    } catch {
      /* 预生成结果读不到就现算 */
    }
  }

  // 2) 现场调用一次大模型：从算法 20 码里终选 6 码
  try {
    // 注入 AI 自我复盘沉淀的历史经验笔记（空串跳过）
    const notes = await notesForPrompt(sql, 'kl8')
    const messages = [
      {
        role: 'system',
        content:
          '你是快乐8（80 选 20）数据分析助手。每个号码每期出现概率恒为 25%，开奖独立随机，' +
          '不得声称发现规律、不得承诺中奖。只输出 JSON。',
      },
      {
        role: 'user',
        content: [
          `目标：第 ${nextId} 期，玩法「${KL8_PLAY_LABEL[KL8_PLAY]}」，给出 ${KL8_PLAY} 个号码。`,
          '',
          `最近 5 期开奖：`,
          ...history
            .slice(0, 5)
            .map((d) => `第${d.id}期：${d.nums.map(pad).join(' ')}`),
          '',
          `算法候选 20 码（按底层评分排序）：${wide.map(pad).join(' ')}`,
          ...(notes
            ? [
                '',
                '【历史经验笔记（AI 自我复盘沉淀，仅供参考，不提高中奖概率）】',
                notes,
              ]
            : []),
          '',
          `请从上面 20 个候选里终选正好 ${KL8_PLAY} 个（可以放弃排名靠后的号）。` +
            `只输出 JSON：{"picks":[号码 x${KL8_PLAY}],"summary":"60 字内"}。不要逐号解释，不要代码块。`,
        ].join('\n'),
      },
    ]
    // 1200 tokens：逐号理由会让 JSON 超长被截断（截断后无法解析，整轮终审作废）
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 1200, temperature: 0.3 }),
      AI_TIMEOUT_MS,
    )
    const obj = extractJson(raw)
    const picked = [
      ...new Set((Array.isArray(obj?.picks) ? obj.picks : []).map(Number).filter(Number.isInteger)),
    ]
      .filter((n) => wide.includes(n))
      .slice(0, KL8_PLAY)
    if (picked.length) {
      // 不足时按算法融合顺序补齐，保证永远正好 KL8_PLAY 码
      const ten = [...picked]
      for (const n of algoTen) {
        if (ten.length >= KL8_PLAY) break
        if (!ten.includes(n)) ten.push(n)
      }
      return {
        ...base,
        ten: ten.slice(0, KL8_PLAY).sort((a, b) => a - b),
        source: 'ai',
        note:
          picked.length === KL8_PLAY
            ? '算法 20 码 → AI 终审完成'
            : `AI 终审给出 ${picked.length} 个有效号，其余 ${KL8_PLAY - picked.length} 个由算法融合补齐`,
        summary: String(obj?.summary || '').slice(0, 200),
      }
    }
    return { ...base, note: 'AI 终审未给出有效号码，已采用算法融合结果' }
  } catch (e) {
    return { ...base, note: `AI 终审失败（${e.message || e}），已回退算法融合结果` }
  }
}

// ============================================================
// 上期中奖对照：算法部分用「上期之前」的数据严格前推重算（不偷未来数据），
// AI 部分优先读站内共享结果，其次读上一次推送存下的号码。
// ============================================================

async function loadHistory() {
  if (!process.env.DATABASE_URL) return null
  try {
    const raw = await readConfig(getSql(), HISTORY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function saveHistory(history) {
  if (!process.env.DATABASE_URL) return
  try {
    await writeConfig(getSql(), HISTORY_KEY, JSON.stringify(history))
  } catch (e) {
    console.error('[daily-push] 记录上期推送失败：', e.message)
  }
}

/** 3D / 排列三 / 排列五：把一组推荐对照实际开奖，返回各玩法命中注数 */
function digitHitOf(picks, num, digitCount = 3) {
  const actual = (num || []).join('')
  if (actual.length !== digitCount) return null
  const key = [...actual].sort().join('')
  const uniq = new Set(actual).size
  const hit = (list, test) => (Array.isArray(list) ? list.filter(test).length : 0)
  return {
    actual,
    straight: hit(picks?.straight, (n) => n === actual),
    group: digitCount === 3 && uniq === 3 ? hit(picks?.group, (n) => [...n].sort().join('') === key) : 0,
    group3: digitCount === 3 && uniq === 2 ? hit(picks?.group3, (n) => [...n].sort().join('') === key) : 0,
  }
}

/** 上期算法推荐（严格前推：只用上期及更早的数据） */
function kl8AlgoPrev(draws) {
  const latest = draws?.[0]
  const hist = draws?.slice(1) || []
  if (!latest || hist.length < 20) return null
  const v7 = v7Recommend(hist, { play: 10, nextId: latest.id })
  if (!v7) return null
  const drawn = new Set(latest.nums)
  return { drawId: Number(latest.id), picks: v7.picks, hits: v7.picks.filter((n) => drawn.has(n)).length }
}

function digitAlgoPrev(draws, game = 'fc3d') {
  const latest = draws?.[0]
  const hist = draws?.slice(1) || []
  if (!latest || hist.length < 10) return null
  const is5 = game === 'pl5'
  const digitCount = is5 ? 5 : 3
  const summary = (is5 ? summarizeDigit5 : summarizeDigit)(hist, 100)
  const pool = summary ? (is5 ? pl5CandidatePool(summary) : digitCandidatePool(summary)) : null
  if (!pool?.straight.length) return null
  const picks = is5
    ? { straight: pool.straight.slice(0, 5) }
    : {
        straight: pool.straight.slice(0, 3),
        group: pool.group.slice(0, 2),
        group3: pool.group3.slice(0, 1),
      }
  const h = digitHitOf(picks, latest.num, digitCount)
  return h ? { drawId: Number(latest.id), ...h } : null
}

function dltAlgoPrev(draws) {
  const latest = draws?.[0]
  const hist = draws?.slice(1) || []
  if (!latest || hist.length < 12) return null
  const p = predictDLT(hist)
  if (!p) return null
  return {
    drawId: Number(latest.id),
    front: p.front.filter((n) => latest.front.includes(n)).length,
    back: p.back.filter((n) => latest.back.includes(n)).length,
  }
}

/** 上期 AI 推荐：站内共享结果 → 上一次推送存下的号码 */
async function kl8AiPrev(sql, draws, prev) {
  const latest = draws?.[0]
  if (!latest) return null
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM kl8_ai_deep_runs
        WHERE draw_id = ${Number(latest.id)} AND play = ${KL8_PLAY} AND status = 'done'`
      const r = rows[0]?.result
      if (r?.schema === KL8_SCHEMA && Array.isArray(r.final10)) return r.final10
    } catch {
      /* 读缓存失败继续看推送记录 */
    }
  }
  const rec = prev?.kl8
  return rec && Number(rec.targetId) === Number(latest.id) && Array.isArray(rec.ai10) ? rec.ai10 : null
}

async function digitAiPrev(sql, game, draws, prev) {
  const latest = draws?.[0]
  const prevDraw = draws?.[1]
  if (!latest) return null
  if (sql && prevDraw) {
    try {
      const rows = await sql`
        SELECT result FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${Number(prevDraw.id)} AND status = 'done'`
      const r = rows[0]?.result
      if (r?.schema === DIGIT_SCHEMA && r.picks?.straight?.length === (game === 'pl5' ? 5 : 3)) return r.picks
    } catch {
      /* 读缓存失败继续看推送记录 */
    }
  }
  const rec = prev?.[game]
  return rec && Number(rec.targetId) === Number(latest.id) && rec.ai?.straight?.length ? rec.ai : null
}

const DISCLAIMER = {
  tag: 'note',
  elements: [
    {
      tag: 'plain_text',
      content: '开奖为独立随机事件，以上号码仅为历史数据整理，不构成任何投注建议。',
    },
  ],
}

const red = (s) => `<font color='red'>${s}</font>`
const grey = (s) => `<font color='grey'>${s}</font>`

/** 飞书卡片：一个彩种一张卡 */
function buildCard({ title, template, blocks, warning }) {
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: { template, title: { tag: 'plain_text', content: title } },
      elements: [...(warning ? [warning, HR] : []), ...blocks, { tag: 'hr' }, DISCLAIMER],
    },
  }
}

/** 一行文本（手机端按单列渲染最稳，不要用 fields 并排） */
const line = (content) => ({ tag: 'div', text: { tag: 'lark_md', content } })

const HR = { tag: 'hr' }

function buildKl8Card(kl8, ai, title, warning, hits = null) {
  const picks = kl8.picks.map(pad).join(' ')
  const firstPrize = Math.round(comb(BALL_MAX, KL8_PLAY) / comb(20, KL8_PLAY))
  return buildCard({
    title,
    template: 'blue',
    warning,
    blocks: [
      line(`上期开奖：${grey(kl8.latest.nums.map(pad).join(' '))}`),
      line(`**概率** 每号每期恒 25%；${KL8_PLAY_LABEL[KL8_PLAY]}中${KL8_PLAY_LABEL[KL8_PLAY].replace('选', '')}约 1/${firstPrize.toLocaleString('en-US')}（单注 2 元）`),
      hits
        ? line(
            `**上期命中**（第 ${hits.drawId} 期）：算法${KL8_PLAY}码 ${hits.algo}/${KL8_PLAY} · AI 终审 ${
              hits.ai === null || hits.ai === undefined ? '无记录' : `${hits.ai}/${KL8_PLAY}`
            }`,
          )
        : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**算法推荐${KL8_PLAY}码**（v7 多窗口加权评分）\n<font color='red'>${picks}</font>`),
      HR,
      line('**三注参考**'),
      line(`① ${kl8.groups[0].map(pad).join(' ')}`),
      line(`② ${kl8.groups[1].map(pad).join(' ')}`),
      line(`③ ${kl8.groups[2].map(pad).join(' ')}`),
      ...kl8AiLines(ai),
    ],
  })
}

/** 快乐8 AI 终审区块：算法 20 码 → AI 终选 6 码 */
function kl8AiLines(ai) {
  if (!ai) return []
  const tag = ai.source === 'ai' ? 'AI 终审' : '算法融合'
  const head = ai.source === 'ai' ? '算法 20 码 → AI 终审' : 'AI 未通过，已回退算法融合'
  return [
    HR,
    line(`**${tag} · 第 ${ai.nextId} 期 ${KL8_PLAY} 码**（${head}）\n<font color='red'>${ai.ten.map(pad).join(' ')}</font>`),
    line(grey(`算法候选 20 码：${ai.wide.map(pad).join(' ')}`)),
    ai.summary ? line(grey(ai.summary)) : null,
    line(grey(`${ai.note || ''}${ai.cached ? ' · 复用站内已生成结果' : ''}`)),
  ].filter(Boolean)
}

/** 3D / 排列三 AI 终选区块（精简版）：算法池规模 + AI 终选 3 + 2 + 1 */
function digitAiLines(ai, digitCount = 3) {
  if (!ai) return []
  const p = ai.picks
  const tag = ai.source === 'ai' ? 'AI 终选' : `算法前${digitCount === 5 ? '五' : '三'}（AI 未过校验）`
  const poolLine =
    digitCount === 5
      ? `算法池 直选 ${ai.pool.straight.length} 注`
      : `算法池 ${ai.pool.straight.length}/${ai.pool.group.length}/${ai.pool.group3.length} 注（直选/组六/组三）`
  return [
    HR,
    line(grey(poolLine)),
    line(`**${tag}** 直选 ${red(p.straight.join(' '))}`),
    digitCount === 5 ? null : line(`组六 ${red(p.group.join(' '))}　组三 ${red(p.group3.join(' '))}`),
    ai.cached ? line(grey('复用站内已生成结果')) : null,
  ].filter(Boolean)
}

function buildFc3dCard(
  digit,
  title,
  { template = 'red', extra = [], warning = null, ai = null, hits = null, digitCount = 3 } = {},
) {
  const p = digit.pred
  const labels = digitCount === 5 ? ['万', '千', '百', '十', '个'] : ['百', '十', '个']
  const bets = p.posTop.reduce((n, list) => n * list.length, 1)
  const hitLine = hits
    ? digitCount === 5
      ? `**上期命中**（第 ${hits.drawId} 期，直选）：算法 ${hits.algo.straight}　AI ${
          hits.ai ? hits.ai.straight : '无记录'
        }`
      : `**上期命中**（第 ${hits.drawId} 期，直选/组六/组三）：算法 ${hits.algo.straight}/${hits.algo.group}/${hits.algo.group3}　AI ${
          hits.ai ? `${hits.ai.straight}/${hits.ai.group}/${hits.ai.group3}` : '无记录'
        }`
    : null
  return buildCard({
    title,
    template,
    warning,
    blocks: [
      line(`上期开奖：${grey(digit.latest.num.join(' '))}`),
      line(
        grey(
          digitCount === 5
            ? '概率 直选 1/100000（排列五只有直选）'
            : '概率 直选 1/1000 · 组六 1/167 · 组三 1/333',
        ),
      ),
      hitLine ? line(hitLine) : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**直选复式** ${bets} 注 · ${bets * 2} 元`),
      line(p.posTop.map((list, i) => `${labels[i]} ${red(list.join('/'))}`).join('　')),
      line(`**胆码** ${red(p.dan.join('/'))}　拖码 ${p.tuo.join('/')}`),
      line(`和值 ${p.sumRange[0]}~${p.sumRange[1]}　跨度 ${p.spanRange[0]}~${p.spanRange[1]}　杀号 ${grey(p.kill.map((k) => k.digit).join('/'))}`),
      ...extra,
      ...digitAiLines(ai, digitCount),
    ],
  })
}

/** 排列三卡：在 3D 版式上补一行覆盖档位（命中与成本） */
function buildPl3Card(pl3, title, warning, ai = null, hits = null) {
  const tiers = pl3.pred.tiers || []
  const extra = tiers.length
    ? [
        line(
          `**覆盖档位** ${tiers
            .map((t) => `${t.cover}码 ${t.expectHits}个/${t.groupCost}元`)
            .join('　')}`,
        ),
      ]
    : []
  return buildFc3dCard(pl3, title, { template: 'orange', extra, warning, ai, hits })
}

/** 排列五卡：5 位直选，补一行覆盖档位（注数与成本） */
function buildPl5Card(pl5, title, warning, ai = null, hits = null) {
  const tiers = pl5.pred.tiers || []
  const extra = tiers.length
    ? [
        line(
          `**覆盖档位** ${tiers
            .map((t) => `${t.cover}码 ${t.directBets}注/${t.directCost}元`)
            .join('　')}`,
        ),
      ]
    : []
  return buildFc3dCard(pl5, title, {
    template: 'purple',
    extra,
    warning,
    ai,
    hits,
    digitCount: 5,
  })
}

/** 大乐透卡：绿头，5 前区 + 2 后区 + 结构 + 覆盖档位 */
function buildDltCard(dlt, title, warning, hits = null) {
  const p = dlt.pred
  const s = p.structure
  const tiers = p.tiers || []
  const firstPrize = 21425712 // C(35,5) × C(12,2)
  return buildCard({
    title,
    template: 'green',
    warning,
    blocks: [
      line(
        `上期开奖：前区 ${grey(dlt.latest.front.map(pad).join(' '))}　后区 ${grey(
          dlt.latest.back.map(pad).join(' '),
        )}`,
      ),
      line(`**概率** 一等奖 1/${firstPrize.toLocaleString('en-US')}（前区 5/35 + 后区 2/12）`),
      hits
        ? line(
            `**上期命中**（第 ${hits.drawId} 期）：前区 ${hits.front}/5 · 后区 ${hits.back}/2`,
          )
        : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**推荐 5 前区**\n<font color='red'>${p.front.map(pad).join(' ')}</font>`),
      line(
        `**推荐 2 后区** <font color='red'>${p.back.map(pad).join(' ')}</font>　备选 ${p.backBackups
          .map(pad)
          .join(' ')}`,
      ),
      HR,
      line(
        `和值 ${s.sum}　跨度 ${s.span}　三区 ${s.zone3.join(':')}　大小 ${s.big}:${s.small}　奇偶 ${s.odd}:${s.even}`,
      ),
      line(`杀号 ${grey(p.kill.map(pad).join(' '))}`),
      HR,
      line(
        `**覆盖档位** ${tiers
          .map((t) => `${t.cover}码 ${t.expectHits}个/${t.cost}元`)
          .join('　')}`,
      ),
    ],
  })
}

/** 飞书自定义机器人签名：以 "timestamp\\nsecret" 为密钥，对空串做 HMAC-SHA256 */
function feishuSign(secret, timestamp) {
  if (!secret) return {}
  const stringToSign = `${timestamp}\n${secret}`
  const sign = crypto.createHmac('sha256', stringToSign).update('').digest('base64')
  return { timestamp, sign }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  // 设置页查看「最近一次推送」状态（只返回结果，不暴露 webhook，任何 GET 都能读）
  if (req.method === 'GET' && req.query?.status === '1') {
    let last = null
    if (process.env.DATABASE_URL) {
      try {
        const raw = await readConfig(getSql(), STATUS_KEY)
        if (raw) last = JSON.parse(raw)
      } catch (e) {
        console.error('[daily-push] 读取推送状态失败：', e.message)
      }
    }
    return res.status(200).json({ last })
  }

  // 如果配置了 CRON_SECRET，则要求定时调用带 Bearer（前端手动测试走 POST，不受影响）
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.method === 'GET' && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const isTest = req.method === 'POST' || req.query?.test === '1'

  try {
    const handlerStart = Date.now()
    const cfg = await loadConfig()
    const isDry = req.query?.dry === '1'
    if (!cfg.webhook && !isDry) {
      await savePushStatus({ at: new Date().toISOString(), ok: false, error: '未配置飞书 Webhook' })
      return res.status(400).json({
        error: '还没有配置飞书机器人 Webhook。请到「设置 → 每日推荐推送」里填写并保存。',
      })
    }

    // 机器人查询用：only 只算单个彩种；dry=1 只返回卡片内容，不往群里发
    const only = String(req.query?.only || '').trim()
    if (only) {
      for (const k of ['kl8', 'fc3d', 'pl3', 'pl5', 'dlt']) if (k !== only) cfg[k] = false
    }

    // 并行走五个数据源，单个失败不影响其它
    let [kl8Res, fc3dRes, pl3Res, pl5Res, dltRes] = await Promise.allSettled([
      cfg.kl8 ? fetchKl8Draws(100) : Promise.resolve(null),
      cfg.fc3d ? fetchFc3dDraws(100) : Promise.resolve(null),
      cfg.pl3 ? fetchPl3Draws(100) : Promise.resolve(null),
      cfg.pl5 ? fetchPl5Draws(100) : Promise.resolve(null),
      cfg.dlt ? fetchDltDraws(100) : Promise.resolve(null),
    ])

    // 数据源偶发缓存：抓到的最新一期还停在旧日期时，等 1.5 秒补抓一次（四路并行，不叠加耗时）
    const drawsOf = (r) =>
      r.status === 'fulfilled' && r.value ? (Array.isArray(r.value) ? r.value : r.value.draws) : null
    const refetchIfStale = async (r, enabled, fn, maxAgeDays = 1) => {
      if (!enabled) return r
      const list = drawsOf(r)
      // 抓取直接失败（rejected/空）也要补抓一次：这是快乐8 卡片整张缺失的主因
      const failed = !list?.length
      if (!failed && freshness(list[0], maxAgeDays).state !== 'stale') return r
      await new Promise((ok) => setTimeout(ok, failed ? 1200 : FRESH_RETRY_MS))
      const [again] = await Promise.allSettled([fn(100)])
      const retried = drawsOf(again)
      // 补抓没变新就保留原结果，至少还能发出去
      return retried?.length ? again : r
    }
    ;[kl8Res, fc3dRes, pl3Res, pl5Res, dltRes] = await Promise.all([
      refetchIfStale(kl8Res, cfg.kl8, fetchKl8Draws),
      refetchIfStale(fc3dRes, cfg.fc3d, fetchFc3dDraws),
      refetchIfStale(pl3Res, cfg.pl3, fetchPl3Draws),
      refetchIfStale(pl5Res, cfg.pl5, fetchPl5Draws),
      refetchIfStale(dltRes, cfg.dlt, fetchDltDraws, 4),
    ])

    // ── 学习循环 / AI 共享缓存共用的数据库（提前到打分步骤之前获取） ──
    let sqlAi = null
    if (process.env.DATABASE_URL) {
      try {
        sqlAi = getSql()
        await ensureTables(sqlAi)
      } catch (e) {
        console.warn('[daily-push] 数据库不可用，跳过学习循环与 AI 共享缓存：', e.message)
        sqlAi = null
      }
    }

    const kl8Draws = drawsOf(kl8Res)
    const fc3dDraws = drawsOf(fc3dRes)
    const pl3Draws = drawsOf(pl3Res)
    const pl5Draws = drawsOf(pl5Res)
    const dltDraws = drawsOf(dltRes)

    // ② 对最新开奖打分并推进权重（五彩种并行；失败只记日志，不阻塞推送）
    const learningSummary = {}
    const scoredGames = []
    if (sqlAi) {
      try {
        const candidates = [
          ['kl8', kl8Draws],
          ['fc3d', fc3dDraws],
          ['pl3', pl3Draws],
          ['pl5', pl5Draws],
          ['dlt', dltDraws],
        ].filter(([g, d]) => d?.length && freshness(d[0], g === 'dlt' ? 4 : 1).state === 'ok')
        const results = await Promise.all(candidates.map(([g, d]) => scoreAndLearn(sqlAi, g, d)))
        candidates.forEach(([g], i) => {
          learningSummary[g] = results[i]
          if (results[i] && !results[i].skipped) scoredGames.push(g)
        })
      } catch (e) {
        console.error('[daily-push] 学习打分失败：', e.message)
      }
    }

    // ②.5 每日学习日报（确定性文本，不调 LLM）；失败静默，不阻塞推送
    if (sqlAi && scoredGames.length) {
      await Promise.all(
        scoredGames.map(async (g) => {
          try {
            await writeDigest(sqlAi, g, { drawId: learningSummary[g]?.drawId, result: learningSummary[g] })
          } catch (e) {
            console.error('[daily-push] 学习日报生成失败：', e.message)
          }
        }),
      )
      // 每周深度复盘（≥7 天一次，内部门控）；dry/only 手动调试时跳过
      if (!isDry && !only) {
        try {
          await deepReviewWeekly(sqlAi, scoredGames)
        } catch (e) {
          console.error('[daily-push] 每周深度复盘失败：', e.message)
        }
      }
    }

    // ③ 读取各彩种学习状态（冷启动/读失败时 build* 不传 override，行为与现状一致）
    const learnedOf = {}
    if (sqlAi) {
      try {
        const entries = [
          ['kl8', kl8Draws],
          ['fc3d', fc3dDraws],
          ['pl3', pl3Draws],
          ['pl5', pl5Draws],
          ['dlt', dltDraws],
        ].filter(([, d]) => d?.length)
        const states = await Promise.all(entries.map(([g]) => loadLearning(sqlAi, g)))
        entries.forEach(([g], i) => {
          learnedOf[g] = states[i]
        })
      } catch (e) {
        console.error('[daily-push] 读取学习状态失败：', e.message)
      }
    }

    const kl8 = kl8Res.status === 'fulfilled' && kl8Res.value ? buildKl8(kl8Draws, learnedOf.kl8) : null
    const fc3d = fc3dRes.status === 'fulfilled' && fc3dRes.value ? buildFc3d(fc3dDraws, learnedOf.fc3d) : null
    const pl3 = pl3Res.status === 'fulfilled' && pl3Res.value ? buildPl3(pl3Draws, learnedOf.pl3) : null
    const pl5 = pl5Res.status === 'fulfilled' && pl5Res.value ? buildPl5(pl5Draws, learnedOf.pl5) : null
    const dlt = dltRes.status === 'fulfilled' && dltRes.value ? buildDlt(dltDraws, learnedOf.dlt) : null

    // ④ AI 终选：彩种并行（优先复用站内共享结果，没有才现场调用一次大模型）
    let llm = null
    try {
      llm = await resolveLlmSettings()
    } catch (e) {
      console.error('[daily-push] 读取大模型配置失败：', e.message)
    }
    const safely = async (fn) => {
      try {
        return await fn()
      } catch (e) {
        console.error('[daily-push] AI 终选失败：', e.message)
        return null
      }
    }
    // ⑤ 经验笔记生成：与 AI 终选并行；dry/only 手动调试时跳过；失败返回 null 不影响推送
    const notesTask =
      !isDry && !only && llm && sqlAi && scoredGames.length
        ? (async () => {
            try {
              const recentSummary = await buildRecentSummary(sqlAi, scoredGames, learnedOf)
              return await maybeGenerateNotes(sqlAi, llm, {
                games: scoredGames,
                recentSummary,
                elapsedMs: Date.now() - handlerStart,
              })
            } catch (e) {
              console.error('[daily-push] 经验笔记生成失败：', e.message)
              return null
            }
          })()
        : Promise.resolve(null)
    const [kl8Ai, fc3dAi, pl3Ai, pl5Ai] = llm
      ? await Promise.all([
          kl8 ? safely(() => buildKl8Ai({ draws: kl8Draws, built: kl8, sql: sqlAi, llm })) : null,
          fc3d
            ? safely(() =>
                buildDigitAi({ game: 'fc3d', label: '福彩3D', draws: fc3dDraws, sql: sqlAi, llm }),
              )
            : null,
          pl3
            ? safely(() =>
                buildDigitAi({ game: 'pl3', label: '排列三', draws: pl3Draws, sql: sqlAi, llm }),
              )
            : null,
          pl5
            ? safely(() =>
                buildDigitAi({ game: 'pl5', label: '排列五', draws: pl5Draws, sql: sqlAi, llm }),
              )
            : null,
        ])
      : [null, null, null, null]
    await notesTask

    // ⑥ 发卡前写本期目标期预测行（次日 scoreAndLearn 打分用；hedge:experts 行由打分流程自己回填，不写）
    try {
      if (sqlAi) {
        if (kl8) {
          const rows = [{ source: 'algo:v7', picks: kl8.picks }]
          if (kl8Ai) rows.push({ source: 'ai:final', picks: kl8Ai.ten })
          rows.push({ source: 'models:kl8', picks: [] })
          await persistPredictions(sqlAi, 'kl8', kl8.nextId, rows)
        }
        for (const [g, aiRes, dList] of [
          ['fc3d', fc3dAi, fc3dDraws],
          ['pl3', pl3Ai, pl3Draws],
          ['pl5', pl5Ai, pl5Draws],
        ]) {
          if (!dList?.length) continue
          const rows = []
          const algoPicks = digitAlgoPicks(g, dList)
          if (algoPicks) rows.push({ source: 'algo:pool', picks: algoPicks })
          if (aiRes?.picks)
            rows.push({
              source: 'ai:final',
              picks: {
                straight: aiRes.picks.straight || [],
                group: aiRes.picks.group || [],
                group3: aiRes.picks.group3 || [],
              },
            })
          if (rows.length) await persistPredictions(sqlAi, g, Number(dList[0].id) + 1, rows)
        }
        if (dlt)
          await persistPredictions(sqlAi, 'dlt', Number(dlt.latest.id) + 1, [
            { source: 'algo:dlt', picks: { front: dlt.pred.front, back: dlt.pred.back } },
          ])
      }
    } catch (e) {
      console.error('[daily-push] 写入学习预测失败：', e.message)
    }

    // 上期命中：算法部分用「上期及更早」的数据严格前推重算，AI 部分读站内共享结果/上次推送记录
    const prevHistory = await loadHistory()
    const hits = { kl8: null, fc3d: null, pl3: null, pl5: null, dlt: null }
    if (kl8 && kl8Draws) {
      const algo = kl8AlgoPrev(kl8Draws)
      const aiPicks = await kl8AiPrev(sqlAi, kl8Draws, prevHistory)
      const drawn = new Set(kl8Draws[0]?.nums || [])
      hits.kl8 = algo
        ? {
            drawId: algo.drawId,
            algo: algo.hits,
            ai: aiPicks ? aiPicks.filter((n) => drawn.has(n)).length : null,
          }
        : null
    }
    if (fc3d && fc3dDraws) {
      const algo = digitAlgoPrev(fc3dDraws)
      const aiPicks = await digitAiPrev(sqlAi, 'fc3d', fc3dDraws, prevHistory)
      hits.fc3d = algo
        ? {
            drawId: algo.drawId,
            actual: algo.actual,
            algo: { straight: algo.straight, group: algo.group, group3: algo.group3 },
            ai: aiPicks ? digitHitOf(aiPicks, fc3dDraws[0].num) : null,
          }
        : null
    }
    if (pl3 && pl3Draws) {
      const algo = digitAlgoPrev(pl3Draws)
      const aiPicks = await digitAiPrev(sqlAi, 'pl3', pl3Draws, prevHistory)
      hits.pl3 = algo
        ? {
            drawId: algo.drawId,
            actual: algo.actual,
            algo: { straight: algo.straight, group: algo.group, group3: algo.group3 },
            ai: aiPicks ? digitHitOf(aiPicks, pl3Draws[0].num) : null,
          }
        : null
    }
    if (pl5 && pl5Draws) {
      const algo = digitAlgoPrev(pl5Draws, 'pl5')
      const aiPicks = await digitAiPrev(sqlAi, 'pl5', pl5Draws, prevHistory)
      hits.pl5 = algo
        ? {
            drawId: algo.drawId,
            actual: algo.actual,
            algo: { straight: algo.straight },
            ai: aiPicks ? digitHitOf(aiPicks, pl5Draws[0].num, 5) : null,
          }
        : null
    }
    if (dlt && dltDraws) hits.dlt = dltAlgoPrev(dltDraws)

    const fresh = {
      kl8: kl8 ? freshness(kl8.latest) : null,
      fc3d: fc3d ? freshness(fc3d.latest) : null,
      pl3: pl3 ? freshness(pl3.latest) : null,
      pl5: pl5 ? freshness(pl5.latest) : null,
      dlt: dlt ? freshness(dlt.latest, 4) : null,
    }

    const skipped = {
      kl8: kl8Res.status === 'rejected' ? kl8Res.reason?.message : null,
      fc3d: fc3dRes.status === 'rejected' ? fc3dRes.reason?.message : null,
      pl3: pl3Res.status === 'rejected' ? pl3Res.reason?.message : null,
      pl5: pl5Res.status === 'rejected' ? pl5Res.reason?.message : null,
      dlt: dltRes.status === 'rejected' ? dltRes.reason?.message : null,
    }

    if (!kl8 && !fc3d && !pl3 && !pl5 && !dlt) {
      const errs = Object.values(skipped).filter(Boolean)
      const error = `开奖数据获取失败：${errs.join('；') || '未知原因'}`
      await savePushStatus({ at: new Date().toISOString(), ok: false, error, skipped })
      return res.status(502).json({ error })
    }

    const now = new Date()
    const dateText = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
    }).format(now)

    const prefix = isTest ? '【测试】' : ''

    // 一个彩种一张卡：快乐8 蓝头、3D 红头、排列三橙头、大乐透绿头，分别发送
    const cards = []
    if (kl8)
      cards.push(
        buildKl8Card(kl8, kl8Ai, `${prefix}快乐8 推荐 · ${dateText}`, staleWarning(fresh.kl8, '快乐8'), hits.kl8),
      )
    if (fc3d)
      cards.push(
        buildFc3dCard(fc3d, `${prefix}福彩3D 推荐 · ${dateText}`, {
          warning: staleWarning(fresh.fc3d, '福彩3D'),
          ai: fc3dAi,
          hits: hits.fc3d,
        }),
      )
    if (pl3)
      cards.push(
        buildPl3Card(
          pl3,
          `${prefix}排列三 v3 Pro 推荐 · ${dateText}`,
          staleWarning(fresh.pl3, '排列三'),
          pl3Ai,
          hits.pl3,
        ),
      )
    if (pl5)
      cards.push(
        buildPl5Card(
          pl5,
          `${prefix}排列五 v3 Pro 推荐 · ${dateText}`,
          staleWarning(fresh.pl5, '排列五'),
          pl5Ai,
          hits.pl5,
        ),
      )
    if (dlt)
      cards.push(buildDltCard(dlt, `${prefix}大乐透 推荐 · ${dateText}`, staleWarning(fresh.dlt, '大乐透'), hits.dlt))

    // 机器人：只取卡片内容用于回复，不群发、不覆盖推送记录
    if (isDry) {
      return res.status(200).json({ ok: true, cards, hits })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signPart = feishuSign(cfg.secret, timestamp)

    const payloads = cards

    let sent = 0
    // 单张卡片失败不影响其它彩种：继续发完，最后汇总失败原因
    const sendErrors = []
    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i]
      try {
        const r = await fetch(cfg.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...signPart }),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok || (data.code ?? 0) !== 0) {
          sendErrors.push(
            `第 ${i + 1} 张：${data.msg || `HTTP ${r.status}`}${data.code ? `（${data.code}）` : ''}`,
          )
          continue
        }
        sent++
      } catch (e) {
        sendErrors.push(`第 ${i + 1} 张：${e.message || e}`)
      }
    }
    if (sendErrors.length) {
      const error = `飞书推送部分失败（已发 ${sent}/${payloads.length}）：${sendErrors.join('；')}`
      await savePushStatus({ at: new Date().toISOString(), ok: false, error, sent, total: payloads.length, fresh })
      return res.status(502).json({ error })
    }

    // 记录本次推送号码，供下一次推送计算「上期命中」
    await saveHistory({
      at: new Date().toISOString(),
      kl8: kl8
        ? { targetId: kl8.nextId, picks: kl8.picks, ai10: kl8Ai?.ten || null }
        : prevHistory?.kl8 || null,
      fc3d: fc3dAi ? { targetId: Number(fc3dAi.drawId) + 1, ai: fc3dAi.picks } : prevHistory?.fc3d || null,
      pl3: pl3Ai ? { targetId: Number(pl3Ai.drawId) + 1, ai: pl3Ai.picks } : prevHistory?.pl3 || null,
      pl5: pl5Ai ? { targetId: Number(pl5Ai.drawId) + 1, ai: pl5Ai.picks } : prevHistory?.pl5 || null,
      dlt: dlt
        ? { targetId: Number(dlt.latest.id) + 1, front: dlt.pred.front, back: dlt.pred.back }
        : prevHistory?.dlt || null,
    })

    await savePushStatus({
      at: new Date().toISOString(),
      ok: true,
      test: isTest,
      sent,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, pl5: !!pl5, dlt: !!dlt },
      // 抓取失败原因（重试后仍失败才算），用于排查某彩种卡片整张缺失
      fetchErrors: Object.entries({
        kl8: kl8Res,
        fc3d: fc3dRes,
        pl3: pl3Res,
        pl5: pl5Res,
        dlt: dltRes,
      })
        .filter(([, r]) => r.status === 'rejected')
        .map(([g, r]) => `${g}: ${String(r.reason?.message || r.reason).slice(0, 120)}`),
      ai: { kl8: !!kl8Ai, fc3d: !!fc3dAi, pl3: !!pl3Ai, pl5: !!pl5Ai },
      hits,
      fresh,
      learning: learningSummary,
    })

    return res.status(200).json({
      ok: true,
      test: isTest,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, pl5: !!pl5, dlt: !!dlt },
      ai: {
        kl8: kl8Ai ? { source: kl8Ai.source, cached: kl8Ai.cached, ten: kl8Ai.ten } : null,
        fc3d: fc3dAi ? { source: fc3dAi.source, cached: fc3dAi.cached, picks: fc3dAi.picks } : null,
        pl3: pl3Ai ? { source: pl3Ai.source, cached: pl3Ai.cached, picks: pl3Ai.picks } : null,
        pl5: pl5Ai ? { source: pl5Ai.source, cached: pl5Ai.cached, picks: pl5Ai.picks } : null,
      },
      messages: payloads.length,
      hits,
      fresh,
      skipped,
    })
  } catch (e) {
    console.error('[daily-push]', e)
    await savePushStatus({ at: new Date().toISOString(), ok: false, error: e.message || '推送失败' })
    return res.status(500).json({ error: e.message || '推送失败' })
  }
}
