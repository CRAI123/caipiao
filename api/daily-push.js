// ============================================================
// 每日推荐推送 —— Vercel Cron（14:00 Asia/Shanghai = 06:00 UTC）
// 计算快乐8 / 福彩3D / 排列三 / 双色球 下期参考号码，推送到飞书自定义机器人 Webhook。
// 每个彩种都走站内当前最强算法，卡片标题里标明档位：排列三 = v3 Pro（9 专家 Hedge 权重 + 结构约束）。
//
// 配置来源（优先数据库）：
//   1) Neon admin_config 表 key = 'daily_push_config'
//      value = {"webhook":"https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
//               "secret":"（可选，机器人开启签名校验时必填）",
//               "kl8":true,"fc3d":true,"pl3":true,"ssq":true}
//   2) 环境变量 FEISHU_WEBHOOK_URL / FEISHU_WEBHOOK_SECRET
//
// 手动触发：GET /api/daily-push?test=1
// ============================================================
import crypto from 'node:crypto'
import { getSql, readConfig, writeConfig, ensureTables } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchSsqDraws } from './_lib/ssq.js'
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { scoreBalls, pickBalanced, BALL_MAX, comb } from '../src/lib/stats.js'
import { v7Recommend } from '../src/lib/kl8V7.js'
import { summarizeDigit, digitCandidatePool, buildDigitMessages } from '../src/lib/digitAi.js'
import { predictFC3Dv2 } from '../src/lib/fc3dPredict.js'
import { predictPL3Pro } from '../src/lib/pl3Predict.js'
import { predictSSQ } from '../src/lib/ssqPredict.js'
import { applyCors } from './_lib/http.js'

export const config = { maxDuration: 60 }

const CONFIG_KEY = 'daily_push_config'
const STATUS_KEY = 'daily_push_last'
// 上期推送记录（用于「上期中奖几个」的 AI 结果对照，算法部分直接用历史数据重算）
const HISTORY_KEY = 'daily_push_history'
const FRESH_RETRY_MS = 1500
// AI 终选与站内共用同一套结构版本号，只有同版本的历史结果才复用
const DIGIT_SCHEMA = 5
const KL8_SCHEMA = 3
// 单个 AI 调用最多等这么久，超时就发算法结果，避免整个推送被拖死
const AI_TIMEOUT_MS = 38000

/** 北京时间日期（YYYY-MM-DD） */
const shDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d)

/**
 * 判断数据是否够新。
 * 快乐8 / 3D / 排列三 每天开一期，14:00 推送时最新一期应当是「昨天」（maxAgeDays=1）；
 * 双色球每周二、四、日开奖，14:00 推送时最新一期最多是 3 天前，所以放宽到 4 天。
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
    ssq: cfg.ssq !== false,
  }
}

/** 快乐8：v7 多窗口加权评分（站内推荐页同款）+ 三注分注参考 */
function buildKl8(draws) {
  const history = draws.slice(0, 200)
  const nextId = history[0].id + 1
  const v7 = v7Recommend(history, { play: 10, nextId })
  const { scores } = scoreBalls(history, { periods: 100, halfLife: 20, hotMode: 'mix' })
  const ranked = Array.from({ length: BALL_MAX }, (_, i) => i + 1)
    .map((n) => ({ n, score: scores[n] }))
    .sort((a, b) => b.score - a.score)
  const picks = (v7?.picks?.length === 10 ? [...v7.picks] : pickBalanced(ranked, 10).map((x) => x.n)).sort(
    (a, b) => a - b,
  )
  const groups = [0, 3, 6].map((off) =>
    pickBalanced(ranked.slice(off), 10).map((x) => x.n).sort((a, b) => a - b),
  )
  return { latest: history[0], nextId, v7, picks, groups }
}

const pad = (n) => String(n).padStart(2, '0')

function buildFc3d(draws) {
  const p = predictFC3Dv2(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 排列三：v3 Pro 档（9 专家 Hedge 自适应权重 + 六维结构约束），站内概率最高的一档 */
function buildPl3(draws) {
  const p = predictPL3Pro(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 双色球：红球结构评分枚举 + 蓝球周期/振荡评分 */
function buildSsq(draws) {
  const p = predictSSQ(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

// ============================================================
// AI 终选：算法先选 → AI 只在候选池内终选
// 与站内规则一致（3D / 排列三 直选 3 + 组六 2 + 组三 1；快乐8 算法 20 码 → AI 终选 10 码），
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

/** 3D / 排列三：算法候选池 + AI 终选（3 + 2 + 1），失败回退算法前三 */
async function buildDigitAi({ game, label, draws, sql, llm }) {
  const drawId = Number(draws?.[0]?.id)
  const summary = summarizeDigit(draws, 100)
  if (!drawId || !summary) return null
  const pool = digitCandidatePool(summary)
  if (!pool.straight.length || !pool.group.length || !pool.group3.length) return null
  const algoTop = {
    straight: pool.straight.slice(0, 3),
    group: pool.group.slice(0, 2),
    group3: pool.group3.slice(0, 1),
  }
  const base = { drawId, pool, algoTop, picks: algoTop, source: 'algo', note: '', summary: '', cached: false }

  // 1) 全站已有本期 AI 终选（用户点过）→ 直接复用
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${drawId} AND status = 'done'`
      const r = rows[0]?.result
      if (r && r.schema === DIGIT_SCHEMA && r.picks?.straight?.length === 3) {
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
    const [sys, user] = buildDigitMessages(summary, label)
    const messages = [
      sys,
      {
        role: 'user',
        content:
          `${user.content}\n\n` +
          '只输出一个 JSON 对象，不要解释文字、不要代码块围栏：' +
          '{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],' +
          '"reasons":{"123":"一句话依据"},"summary":"60 字内","risk":"一句风险提示"}。' +
          'straight 必须正好 3 个、group 正好 2 个、group3 正好 1 个，且都只能来自上面给出的候选池。',
      },
    ]
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 900, temperature: 0.3 }),
      AI_TIMEOUT_MS,
    )
    const obj = extractJson(raw)
    const take = (arr, max) =>
      [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x).replace(/\D/g, '')))]
        .filter((n) => n.length === 3)
        .slice(0, max)
    const straight = pickInPool(take(obj?.straight, 12), pool.straight, 3)
    const group = pickInPool(take(obj?.group, 8), pool.group, 2)
    const group3 = pickInPool(take(obj?.group3, 5), pool.group3, 1)
    if (straight.length === 3 && group.length === 2 && group3.length === 1) {
      return {
        ...base,
        picks: { straight, group, group3 },
        source: 'ai',
        note: 'AI 已在算法候选池内完成终选',
        summary: String(obj?.summary || '').slice(0, 200),
      }
    }
    return { ...base, note: 'AI 终选未全部落在候选池内，已回退算法前三' }
  } catch (e) {
    return { ...base, note: `AI 终选失败（${e.message || e}），已回退算法前三` }
  }
}

/** 按顺序取候选池里出现过的号码，凑够 max 个 */
function pickInPool(list, pool, max) {
  return [...new Set(list)].filter((n) => pool.includes(n)).slice(0, max)
}

/** 快乐8：算法 20 码 → AI 终选 10 码，失败回退算法融合 10 码 */
async function buildKl8Ai({ draws, built, sql, llm }) {
  if (!built?.v7) return null
  const history = draws.slice(0, 200)
  const nextId = built.nextId
  const algoTen = [...built.picks]
  const wide = balancedFromPool(built.v7.pool, 20)
  const base = { nextId, wide, ten: algoTen, source: 'algo', note: '', summary: '', cached: false }

  // 1) 全站已有本期深度分析 → 复用它的终选 10 码
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM kl8_ai_deep_runs
        WHERE draw_id = ${nextId} AND play = 10 AND status = 'done'`
      const r = rows[0]?.result
      if (r && r.schema === KL8_SCHEMA && Array.isArray(r.final10) && r.final10.length === 10) {
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

  // 2) 现场调用一次大模型：从算法 20 码里终选 10 码
  try {
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
          `目标：第 ${nextId} 期，玩法「选十」，给出 10 个号码。`,
          '',
          `最近 5 期开奖：`,
          ...history
            .slice(0, 5)
            .map((d) => `第${d.id}期：${d.nums.map(pad).join(' ')}`),
          '',
          `算法候选 20 码（按底层评分排序）：${wide.map(pad).join(' ')}`,
          '',
          '请从上面 20 个候选里终选正好 10 个（可以放弃排名靠后的号），并给每个号一句话理由。' +
            '只输出 JSON：{"picks":[号码 x10],"reasons":{"01":"一句话"},"summary":"60 字内"}。',
        ].join('\n'),
      },
    ]
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 700, temperature: 0.3 }),
      AI_TIMEOUT_MS,
    )
    const obj = extractJson(raw)
    const picked = [
      ...new Set((Array.isArray(obj?.picks) ? obj.picks : []).map(Number).filter(Number.isInteger)),
    ].filter((n) => wide.includes(n))
    if (picked.length === 10) {
      return {
        ...base,
        ten: picked.sort((a, b) => a - b),
        source: 'ai',
        note: '算法 20 码 → AI 终审完成',
        summary: String(obj?.summary || '').slice(0, 200),
      }
    }
    return { ...base, note: 'AI 终审给出的有效号码不足 10 个，已回退算法融合结果' }
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

/** 3D / 排列三：把一组推荐对照实际开奖，返回各玩法命中注数 */
function digitHitOf(picks, num) {
  const actual = (num || []).join('')
  if (actual.length !== 3) return null
  const key = [...actual].sort().join('')
  const uniq = new Set(actual).size
  const hit = (list, test) => (Array.isArray(list) ? list.filter(test).length : 0)
  return {
    actual,
    straight: hit(picks?.straight, (n) => n === actual),
    group: uniq === 3 ? hit(picks?.group, (n) => [...n].sort().join('') === key) : 0,
    group3: uniq === 2 ? hit(picks?.group3, (n) => [...n].sort().join('') === key) : 0,
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

function digitAlgoPrev(draws) {
  const latest = draws?.[0]
  const hist = draws?.slice(1) || []
  if (!latest || hist.length < 10) return null
  const summary = summarizeDigit(hist, 100)
  const pool = summary ? digitCandidatePool(summary) : null
  if (!pool?.straight.length) return null
  const picks = {
    straight: pool.straight.slice(0, 3),
    group: pool.group.slice(0, 2),
    group3: pool.group3.slice(0, 1),
  }
  const h = digitHitOf(picks, latest.num)
  return h ? { drawId: Number(latest.id), ...h } : null
}

function ssqAlgoPrev(draws) {
  const latest = draws?.[0]
  const hist = draws?.slice(1) || []
  if (!latest || hist.length < 10) return null
  const p = predictSSQ(hist)
  if (!p) return null
  return {
    drawId: Number(latest.id),
    red: p.red.filter((n) => latest.red.includes(n)).length,
    blue: p.blue === latest.blue,
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
        WHERE draw_id = ${Number(latest.id)} AND play = 10 AND status = 'done'`
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
      if (r?.schema === DIGIT_SCHEMA && r.picks?.straight?.length === 3) return r.picks
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
  const firstPrize = Math.round(comb(BALL_MAX, 10) / comb(20, 10))
  return buildCard({
    title,
    template: 'blue',
    warning,
    blocks: [
      line(`上期开奖：${grey(kl8.latest.nums.map(pad).join(' '))}`),
      line(`**概率** 每号每期恒 25%；选十中十约 1/${firstPrize.toLocaleString('en-US')}（单注 2 元）`),
      hits
        ? line(
            `**上期命中**（第 ${hits.drawId} 期）：算法十码 ${hits.algo}/10 · AI 终审 ${
              hits.ai === null || hits.ai === undefined ? '无记录' : `${hits.ai}/10`
            }`,
          )
        : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**算法推荐十码**（v7 多窗口加权评分）\n<font color='red'>${picks}</font>`),
      HR,
      line('**三注参考**'),
      line(`① ${kl8.groups[0].map(pad).join(' ')}`),
      line(`② ${kl8.groups[1].map(pad).join(' ')}`),
      line(`③ ${kl8.groups[2].map(pad).join(' ')}`),
      ...kl8AiLines(ai),
    ],
  })
}

/** 快乐8 AI 终审区块：算法 20 码 → AI 终选 10 码 */
function kl8AiLines(ai) {
  if (!ai) return []
  const tag = ai.source === 'ai' ? 'AI 终审' : '算法融合'
  const head = ai.source === 'ai' ? '算法 20 码 → AI 终审' : 'AI 未通过，已回退算法融合'
  return [
    HR,
    line(`**${tag} · 第 ${ai.nextId} 期 10 码**（${head}）\n<font color='red'>${ai.ten.map(pad).join(' ')}</font>`),
    line(grey(`算法候选 20 码：${ai.wide.map(pad).join(' ')}`)),
    ai.summary ? line(grey(ai.summary)) : null,
    line(grey(`${ai.note || ''}${ai.cached ? ' · 复用站内已生成结果' : ''}`)),
  ].filter(Boolean)
}

/** 3D / 排列三 AI 终选区块：算法候选池 → AI 终选 3 + 2 + 1 */
function digitAiLines(ai) {
  if (!ai) return []
  const p = ai.picks
  const tag = ai.source === 'ai' ? 'AI 终选' : '算法前三（AI 未通过校验收敛）'
  return [
    HR,
    line('**算法候选池**（全盘评分：频率 35% + 近 30 期 30% + 遗漏 15% + 同位转移 20%）'),
    line(grey(`直选 ${ai.pool.straight.length} 注：${ai.pool.straight.join(' ')}`)),
    line(grey(`组六 ${ai.pool.group.length} 组：${ai.pool.group.join(' ')}`)),
    line(grey(`组三 ${ai.pool.group3.length} 组：${ai.pool.group3.join(' ')}`)),
    HR,
    line(`**${tag}**`),
    line(`直选 ${red(p.straight.join(' '))}　组六 ${red(p.group.join(' '))}　组三 ${red(p.group3.join(' '))}`),
    ai.summary ? line(grey(ai.summary)) : null,
    line(grey(`${ai.note || ''}${ai.cached ? ' · 复用站内已生成结果' : ''}　概率仍是直选 1/1000、组六 1/167、组三 1/333`)),
  ].filter(Boolean)
}

function buildFc3dCard(digit, title, { template = 'red', extra = [], warning = null, ai = null, hits = null } = {}) {
  const p = digit.pred
  const [bai, shi, ge] = p.posTop
  const bets = bai.length * shi.length * ge.length
  return buildCard({
    title,
    template,
    warning,
    blocks: [
      line(`上期开奖：${grey(digit.latest.num.join(' '))}`),
      line('**概率** 直选 1/1000 · 组六约 1/167 · 组三约 1/333'),
      hits
        ? line(
            `**上期命中**（第 ${hits.drawId} 期开奖 ${hits.actual}）：算法 直选 ${hits.algo.straight}/3 · 组六 ${hits.algo.group}/2 · 组三 ${hits.algo.group3}/1` +
              (hits.ai
                ? `　AI 直选 ${hits.ai.straight}/3 · 组六 ${hits.ai.group}/2 · 组三 ${hits.ai.group3}/1`
                : '　AI 无记录'),
          )
        : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**直选复式** ${bets} 注 · ${bets * 2} 元`),
      line(`百　${red(bai.join('/'))}`),
      line(`十　${red(shi.join('/'))}`),
      line(`个　${red(ge.join('/'))}`),
      HR,
      line(`**双胆** ${red(p.dan.join('/'))}　**拖码** ${p.tuo.join('/')}`),
      HR,
      line(`和值 ${p.sumRange[0]}~${p.sumRange[1]}　跨度 ${p.spanRange[0]}~${p.spanRange[1]}`),
      line(`杀号 ${grey(p.kill.map((k) => k.digit).join('/'))}`),
      ...extra,
      ...digitAiLines(ai),
    ],
  })
}

/** 排列三卡：在 3D 版式上补一行覆盖档位（命中与成本） */
function buildPl3Card(pl3, title, warning, ai = null, hits = null) {
  const tiers = pl3.pred.tiers || []
  const extra = [
    ...(tiers.length
      ? [
          HR,
          line(
            `**覆盖档位** 期望命中 ${tiers
              .map((t) => `${t.cover}码 ${t.expectHits}个/${t.groupCost}元`)
              .join('　')}`,
          ),
        ]
      : []),
    line(grey('算法 v3 Pro · 9 专家 Hedge 自适应权重 + 六维结构约束')),
  ]
  return buildFc3dCard(pl3, title, { template: 'orange', extra, warning, ai, hits })
}

/** 双色球卡：绿头，6 红 + 1 蓝 + 结构 + 覆盖档位 */
function buildSsqCard(ssq, title, warning, hits = null) {
  const p = ssq.pred
  const s = p.structure
  const tiers = p.tiers || []
  const firstPrize = Math.round(comb(33, 6) * 16)
  return buildCard({
    title,
    template: 'green',
    warning,
    blocks: [
      line(
        `上期开奖：红 ${grey(ssq.latest.red.map(pad).join(' '))}　蓝 ${grey(pad(ssq.latest.blue))}`,
      ),
      line(`**概率** 一等奖 1/${firstPrize.toLocaleString('en-US')}（红球 6/33 + 蓝球 1/16）`),
      hits
        ? line(
            `**上期命中**（第 ${hits.drawId} 期）：红球 ${hits.red}/6 · 蓝球 ${hits.blue ? '命中' : '未中'}`,
          )
        : line(grey('上期命中：暂无上期推荐记录，下次推送起显示')),
      HR,
      line(`**推荐 6 红**\n<font color='red'>${p.red.map(pad).join(' ')}</font>`),
      line(
        `**推荐蓝球** <font color='red'>${pad(p.blue)}</font>　备选 ${p.blueBackups
          .map(pad)
          .join(' ')}`,
      ),
      HR,
      line(
        `和值 ${s.sum}　跨度 ${s.span}　三区 ${s.zone3.join(':')}　大小 ${s.big}:${s.small}　奇偶 ${s.odd}:${s.even}`,
      ),
      line(`杀红 ${grey(p.kill.map(pad).join(' '))}`),
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
    const cfg = await loadConfig()
    if (!cfg.webhook) {
      await savePushStatus({ at: new Date().toISOString(), ok: false, error: '未配置飞书 Webhook' })
      return res.status(400).json({
        error: '还没有配置飞书机器人 Webhook。请到「设置 → 每日推荐推送」里填写并保存。',
      })
    }

    // 并行走四个数据源，单个失败不影响其它
    let [kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.allSettled([
      cfg.kl8 ? fetchKl8Draws(100) : Promise.resolve(null),
      cfg.fc3d ? fetchFc3dDraws(100) : Promise.resolve(null),
      cfg.pl3 ? fetchPl3Draws(100) : Promise.resolve(null),
      cfg.ssq ? fetchSsqDraws(100) : Promise.resolve(null),
    ])

    // 数据源偶发缓存：抓到的最新一期还停在旧日期时，等 1.5 秒补抓一次（四路并行，不叠加耗时）
    const drawsOf = (r) =>
      r.status === 'fulfilled' && r.value ? (Array.isArray(r.value) ? r.value : r.value.draws) : null
    const refetchIfStale = async (r, enabled, fn, maxAgeDays = 1) => {
      const list = drawsOf(r)
      if (!enabled || !list?.length) return r
      if (freshness(list[0], maxAgeDays).state !== 'stale') return r
      await new Promise((ok) => setTimeout(ok, FRESH_RETRY_MS))
      const [again] = await Promise.allSettled([fn(100)])
      const retried = drawsOf(again)
      // 补抓没变新就保留原结果，至少还能发出去
      return retried?.length ? again : r
    }
    ;[kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.all([
      refetchIfStale(kl8Res, cfg.kl8, fetchKl8Draws),
      refetchIfStale(fc3dRes, cfg.fc3d, fetchFc3dDraws),
      refetchIfStale(pl3Res, cfg.pl3, fetchPl3Draws),
      refetchIfStale(ssqRes, cfg.ssq, fetchSsqDraws, 4),
    ])

    const kl8 = kl8Res.status === 'fulfilled' && kl8Res.value ? buildKl8(kl8Res.value) : null
    const fc3d = fc3dRes.status === 'fulfilled' && fc3dRes.value ? buildFc3d(fc3dRes.value) : null
    const pl3 = pl3Res.status === 'fulfilled' && pl3Res.value ? buildPl3(pl3Res.value.draws) : null
    const ssq = ssqRes.status === 'fulfilled' && ssqRes.value ? buildSsq(ssqRes.value.draws) : null

    // AI 终选：三个彩种并行（优先复用站内共享结果，没有才现场调用一次大模型）
    let sqlAi = null
    if (process.env.DATABASE_URL) {
      try {
        sqlAi = getSql()
        await ensureTables(sqlAi)
      } catch (e) {
        console.warn('[daily-push] 数据库不可用，跳过 AI 共享缓存：', e.message)
        sqlAi = null
      }
    }
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
    const [kl8Ai, fc3dAi, pl3Ai] = llm
      ? await Promise.all([
          kl8 ? safely(() => buildKl8Ai({ draws: drawsOf(kl8Res), built: kl8, sql: sqlAi, llm })) : null,
          fc3d
            ? safely(() =>
                buildDigitAi({ game: 'fc3d', label: '福彩3D', draws: drawsOf(fc3dRes), sql: sqlAi, llm }),
              )
            : null,
          pl3
            ? safely(() =>
                buildDigitAi({ game: 'pl3', label: '排列三', draws: drawsOf(pl3Res), sql: sqlAi, llm }),
              )
            : null,
        ])
      : [null, null, null]

    // 上期命中：算法部分用「上期及更早」的数据严格前推重算，AI 部分读站内共享结果/上次推送记录
    const prevHistory = await loadHistory()
    const kl8Draws = drawsOf(kl8Res)
    const fc3dDraws = drawsOf(fc3dRes)
    const pl3Draws = drawsOf(pl3Res)
    const ssqDraws = drawsOf(ssqRes)
    const hits = { kl8: null, fc3d: null, pl3: null, ssq: null }
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
    if (ssq && ssqDraws) hits.ssq = ssqAlgoPrev(ssqDraws)

    const fresh = {
      kl8: kl8 ? freshness(kl8.latest) : null,
      fc3d: fc3d ? freshness(fc3d.latest) : null,
      pl3: pl3 ? freshness(pl3.latest) : null,
      ssq: ssq ? freshness(ssq.latest, 4) : null,
    }

    const skipped = {
      kl8: kl8Res.status === 'rejected' ? kl8Res.reason?.message : null,
      fc3d: fc3dRes.status === 'rejected' ? fc3dRes.reason?.message : null,
      pl3: pl3Res.status === 'rejected' ? pl3Res.reason?.message : null,
      ssq: ssqRes.status === 'rejected' ? ssqRes.reason?.message : null,
    }

    if (!kl8 && !fc3d && !pl3 && !ssq) {
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

    // 一个彩种一张卡：快乐8 蓝头、3D 红头、排列三橙头、双色球绿头，分别发送
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
    if (ssq)
      cards.push(buildSsqCard(ssq, `${prefix}双色球 推荐 · ${dateText}`, staleWarning(fresh.ssq, '双色球'), hits.ssq))

    const timestamp = Math.floor(Date.now() / 1000)
    const signPart = feishuSign(cfg.secret, timestamp)

    let sent = 0
    for (const payload of cards) {
      const r = await fetch(cfg.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...signPart }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || (data.code ?? 0) !== 0) {
        const error = `飞书推送失败：${data.msg || `HTTP ${r.status}`}${data.code ? `（${data.code}）` : ''}`
        await savePushStatus({ at: new Date().toISOString(), ok: false, error, sent, total: cards.length, fresh })
        return res.status(502).json({ error })
      }
      sent++
    }

    // 记录本次推送号码，供下一次推送计算「上期命中」
    await saveHistory({
      at: new Date().toISOString(),
      kl8: kl8
        ? { targetId: kl8.nextId, picks: kl8.picks, ai10: kl8Ai?.ten || null }
        : prevHistory?.kl8 || null,
      fc3d: fc3dAi ? { targetId: Number(fc3dAi.drawId) + 1, ai: fc3dAi.picks } : prevHistory?.fc3d || null,
      pl3: pl3Ai ? { targetId: Number(pl3Ai.drawId) + 1, ai: pl3Ai.picks } : prevHistory?.pl3 || null,
      ssq: ssq
        ? { targetId: Number(ssq.latest.id) + 1, red: ssq.pred.red, blue: ssq.pred.blue }
        : prevHistory?.ssq || null,
    })

    await savePushStatus({
      at: new Date().toISOString(),
      ok: true,
      test: isTest,
      sent,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      ai: { kl8: !!kl8Ai, fc3d: !!fc3dAi, pl3: !!pl3Ai },
      hits,
      fresh,
    })

    return res.status(200).json({
      ok: true,
      test: isTest,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      ai: {
        kl8: kl8Ai ? { source: kl8Ai.source, cached: kl8Ai.cached, ten: kl8Ai.ten } : null,
        fc3d: fc3dAi ? { source: fc3dAi.source, cached: fc3dAi.cached, picks: fc3dAi.picks } : null,
        pl3: pl3Ai ? { source: pl3Ai.source, cached: pl3Ai.cached, picks: pl3Ai.picks } : null,
      },
      messages: cards.length,
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
