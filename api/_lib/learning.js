// ============================================================
// AI 自主学习核心（服务端唯一权威学习状态）
//
// 写者唯一：只有 daily-push 调 scoreAndLearn 打分并推进权重；
// 站内 ai-deep / digit-ai 只读 loadLearning / notesForPrompt，
// 并把本期 AI picks 通过 persistPredictions 追加写 learning_predictions。
//
// 诚实口径：学习循环调整的是信号权重与 AI/算法配比，优化推荐的一致性与
// 可解释性；开奖是独立随机事件，本功能不提高中奖概率。
//
// 与前端 pl3Predict.proHedge 批量版（eta=0.8、对 24 期均值一次成型）的区别：
// 这里逐期增量更新用小 eta=0.25 + clamp [0.02,0.6]，防止追逐单期噪声。
// ============================================================

import { scoreBalls } from '../../src/lib/stats.js'
import { PRO_EXPERTS as PL3_EXPERTS } from '../../src/lib/pl3Predict.js'
import { PRO_EXPERTS as PL5_EXPERTS } from '../../src/lib/pl5Predict.js'
import { FC3D_EXPERTS } from '../../src/lib/fc3dPredict.js'
import { WINDOWS as KL8_WINDOWS } from '../../src/lib/kl8V7.js'
import {
  SSQ_RED_SIGNALS,
  SSQ_BLUE_SIGNALS,
  SSQ_RED_WEIGHTS,
  SSQ_BLUE_WEIGHTS,
  ssqSignalScores,
} from '../../src/lib/ssqPredict.js'
import { callAi } from './ai.js'

/** 冷启动阈值：样本数 n < 8 的参数族一律回退代码默认值 */
export const MIN_SAMPLES = 8

// kl8 三模型 id 与 api/ai-deep.js MODELS 保持一致（模型权重 1/0.8/0.6、温度三档）
const KL8_MODEL_KEYS = ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5']
const KL8_TEMP_KEYS = ['0.65', '0.85', '1.0']

const norm = (arr) => {
  const t = arr.reduce((a, b) => a + b, 0) || 1
  return arr.map((v) => v / t)
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** 各彩种参数族默认值（冷启动回退基准，同时存进 learning_state.defaults） */
export const LEARN_DEFAULTS = {
  kl8: {
    model: { keys: KL8_MODEL_KEYS, weights: [1, 0.8, 0.6] },
    temp: { keys: KL8_TEMP_KEYS, weights: [1, 1, 1] },
    mix: { keys: ['ai', 'algo'], weights: [0.55, 0.45] },
    windows: { keys: KL8_WINDOWS.map(String), weights: [0.15, 0.15, 0.15, 0.55] },
  },
  fc3d: {
    experts: { keys: FC3D_EXPERTS.map((e) => e.key), weights: [0.4, 0.3, 0.2, 0.1], positions: 3 },
  },
  pl3: {
    experts: {
      keys: PL3_EXPERTS.map((e) => e.key),
      weights: norm(PL3_EXPERTS.map(() => 1)),
      positions: 3,
    },
  },
  pl5: {
    experts: {
      keys: PL5_EXPERTS.map((e) => e.key),
      weights: norm(PL5_EXPERTS.map(() => 1)),
      positions: 5,
    },
  },
  ssq: {
    redSignals: { keys: SSQ_RED_SIGNALS, weights: norm(SSQ_RED_WEIGHTS) },
    blueSignals: { keys: SSQ_BLUE_SIGNALS, weights: norm(SSQ_BLUE_WEIGHTS) },
  },
}

/** 统一对数损失：n 个独立伯努利试验命中 h 个、单事件概率 p */
export function binomialLoss(h, n, p) {
  return -(h * Math.log(p) + (n - h) * Math.log(1 - p)) / n
}

/**
 * 来源命中损失（方向修正）：binomialLoss 直接代入命中数时是「数据在基准
 * 模型下的惊讶度」——命中越多损失越大，与 hedge「低损失升权」方向相反。
 * 等价改传未命中数 n-hits（p 仍为基准命中概率），保证命中越多损失越小。
 */
const hitLoss = (hits, n, p) => binomialLoss(n - hits, n, p)

/** 构造一份新的参数族状态（learning_state.value 结构） */
export function newStateValue(keys, weights, lastDrawId = null) {
  return {
    keys: [...keys],
    weights: [...weights],
    n: 0,
    lastDrawId,
    defaults: [...weights],
    eta: 0.25,
    minWeight: 0.02,
    maxWeight: 0.6,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Hedge 单期增量乘性更新（纯函数，不改入参）：
 * w_i *= exp(-eta*(loss_i - meanLoss))，归一化，clamp [minWeight,maxWeight] 后再归一，n+1。
 */
export function hedgeUpdate(state, losses, opts = {}) {
  const eta = opts.eta ?? state.eta ?? 0.25
  const lo = opts.minWeight ?? state.minWeight ?? 0.02
  const hi = opts.maxWeight ?? state.maxWeight ?? 0.6
  const mean = losses.reduce((a, b) => a + b, 0) / losses.length
  let w = state.weights.map((wi, i) => wi * Math.exp(-eta * (losses[i] - mean)))
  w = norm(w).map((v) => clamp(v, lo, hi))
  w = norm(w)
  return {
    ...state,
    weights: w,
    n: (state.n || 0) + 1,
    updatedAt: new Date().toISOString(),
  }
}

/** AI/算法混合比更新（纯函数）：w_ai = clamp(w_ai*exp(0.15*(lossAlgo-lossAi)), 0.30, 0.70) */
export function mixUpdate(state, lossAlgo, lossAi) {
  const wAi = clamp(state.weights[0] * Math.exp(0.15 * (lossAlgo - lossAi)), 0.3, 0.7)
  return {
    ...state,
    weights: [wAi, 1 - wAi],
    n: (state.n || 0) + 1,
    updatedAt: new Date().toISOString(),
  }
}

// ────────────────────────── DB 读写（全部静默降级，绝不 throw） ──────────────────────────

const parseJson = (v) => {
  if (v == null) return null
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return null
    }
  }
  return v
}

async function readStateRows(sql, game) {
  const map = new Map()
  if (!sql) return map
  const rows = await sql`SELECT param_key, value FROM learning_state WHERE game = ${game}`
  for (const r of rows) {
    const v = parseJson(r.value)
    if (v && Array.isArray(v.weights)) map.set(r.param_key, v)
  }
  return map
}

async function upsertState(sql, game, paramKey, value) {
  const json = JSON.stringify(value)
  await sql`
    INSERT INTO learning_state (game, param_key, value, version, updated_at)
    VALUES (${game}, ${paramKey}, ${json}::jsonb, 1, now())
    ON CONFLICT (game, param_key) DO UPDATE
      SET value = EXCLUDED.value,
          version = learning_state.version + 1,
          updated_at = now()`
}

/** 数字彩专家表（按 game 选择引擎导出的专家数组） */
function digitExperts(game) {
  if (game === 'fc3d') return FC3D_EXPERTS
  if (game === 'pl5') return PL5_EXPERTS
  return PL3_EXPERTS
}
function digitPositions(game) {
  return game === 'pl5' ? 5 : 3
}

/**
 * 读取某彩种当前学习状态；任何行缺失或 n < MIN_SAMPLES 时该参数族回退默认。
 * sql 为 null 或 DB 异常一律返回全默认，绝不 throw。
 * 返回：{ windows?, model?, temp?, mix?, redSignals?, blueSignals?, experts?: {p0:[...],...}, n, coldStart }
 * 每个非 experts 族为 { keys, weights, n }。
 */
export async function loadLearning(sql, game) {
  const d = LEARN_DEFAULTS[game]
  if (!d) return { n: 0, coldStart: true }
  const out = { n: 0, coldStart: true }
  let rows = new Map()
  try {
    if (sql) rows = await readStateRows(sql, game)
  } catch {
    rows = new Map() // DB 异常：全默认
  }
  const fams = []
  if (d.experts) {
    out.experts = {}
    for (let pos = 0; pos < d.experts.positions; pos++) {
      fams.push({
        paramKey: `experts:p${pos}`,
        keys: d.experts.keys,
        weights: d.experts.weights,
        assign: (w) => {
          out.experts[`p${pos}`] = w
        },
      })
    }
  } else {
    for (const [k, fam] of Object.entries(d)) {
      fams.push({
        paramKey: k,
        keys: fam.keys,
        weights: fam.weights,
        assign: (w, n) => {
          out[k] = { keys: fam.keys, weights: w, n }
        },
      })
    }
  }
  let minN = Infinity
  let anyLearned = false
  for (const fam of fams) {
    let weights = fam.weights
    let n = 0
    const v = rows.get(fam.paramKey)
    if (v && v.n >= MIN_SAMPLES && Array.isArray(v.weights) && v.weights.length === fam.keys.length) {
      weights = v.weights
      n = v.n
      anyLearned = true
    }
    fam.assign([...weights], n)
    minN = Math.min(minN, n)
  }
  out.n = Number.isFinite(minN) ? minN : 0
  out.coldStart = !anyLearned || out.n < MIN_SAMPLES
  return out
}

/** 取该彩种 + 'all' 最近 3 条 active 经验笔记，拼为可直接注入 prompt 的字符串 */
export async function notesForPrompt(sql, game) {
  try {
    if (!sql) return ''
    const rows = await sql`
      SELECT content FROM ai_experience_notes
      WHERE game IN (${game}, 'all') AND active = true
      ORDER BY created_at DESC
      LIMIT 3`
    return rows
      .map((r) => String(r.content || '').slice(0, 400))
      .join('\n')
      .slice(0, 1200)
  } catch (e) {
    console.error('[learning] notesForPrompt 失败：', e.message)
    return ''
  }
}

/**
 * 幂等打分 + 权重推进：draws 最新在前，对 draws[0]（最新开奖）给全部
 * scored=false 的 learning_predictions 行打分，并推进各参数族权重。
 * 任一 learning_state 行 lastDrawId >= 开奖期号则跳过（防 ?test=1 重复学习）。
 * 整个函数 try/catch，失败返回 {skipped:true,...}，绝不 throw。
 */
export async function scoreAndLearn(sql, game, draws) {
  try {
    if (!sql) return { skipped: true, reason: 'no_db' }
    if (!Array.isArray(draws) || draws.length < 2) return { skipped: true, reason: 'no_data' }
    const actual = draws[0]
    const drawId = Number(actual.id)
    if (!Number.isFinite(drawId)) return { skipped: true, reason: 'bad_id' }
    const hist = draws.slice(1)

    const stateRows = await readStateRows(sql, game)
    for (const v of stateRows.values()) {
      if (Number(v.lastDrawId ?? -1) >= drawId) return { skipped: true, reason: 'already_scored', drawId }
    }

    const d = LEARN_DEFAULTS[game]
    if (!d) return { skipped: true, reason: 'unknown_game' }
    const updated = []
    /** 取族当前状态（库里 n>=阈值 用库值，否则默认） */
    const getFamily = (paramKey, keys, weights) => {
      const v = stateRows.get(paramKey)
      if (v && v.n >= MIN_SAMPLES && Array.isArray(v.weights) && v.weights.length === keys.length) return v
      return newStateValue(keys, weights)
    }
    const saveFamily = async (paramKey, value) => {
      await upsertState(sql, game, paramKey, { ...value, lastDrawId: drawId })
      updated.push(paramKey)
    }
    const markScored = async (source, meta) => {
      const json = JSON.stringify(meta)
      await sql`
        UPDATE learning_predictions
        SET scored = true, meta = ${json}::jsonb, updated_at = now()
        WHERE game = ${game} AND draw_id = ${drawId} AND source = ${source}`
    }

    const preds = await sql`
      SELECT source, picks FROM learning_predictions
      WHERE game = ${game} AND draw_id = ${drawId} AND scored = false`
    const bySource = new Map(preds.map((r) => [r.source, parseJson(r.picks)]))

    if (game === 'kl8') {
      // ── 单行命中打分 ──
      const rowLoss = {}
      for (const source of ['algo:v7', 'ai:final', 'ai:site']) {
        const picks = bySource.get(source)
        if (!Array.isArray(picks) || !picks.length) continue
        const actualSet = new Set(actual.nums)
        const hits = picks.filter((n) => actualSet.has(n)).length
        const loss = hitLoss(hits, 10, 0.25)
        rowLoss[source] = loss
        await markScored(source, { actual: actual.nums, hits, logLoss: +loss.toFixed(4) })
      }
      // ── 模型 × 温度：从 kl8_ai_deep_runs.result.round1Picks 逐条打分 ──
      const modelFam = getFamily('model', d.model.keys, d.model.weights)
      const tempFam = getFamily('temp', d.temp.keys, d.temp.weights)
      const runRows = await sql`
        SELECT result FROM kl8_ai_deep_runs WHERE draw_id = ${drawId} AND play = 10 LIMIT 1`
      const result = parseJson(runRows[0]?.result)
      const round1 = result?.round1Picks || result?.result?.round1Picks
      if (Array.isArray(round1) && round1.length) {
        const perModel = new Map()
        const perTemp = new Map()
        const actualSet = new Set(actual.nums)
        for (const r of round1) {
          if (!r || !Array.isArray(r.picks) || !r.picks.length) continue
          const hits = r.picks.filter((n) => actualSet.has(n)).length
          const loss = hitLoss(hits, 10, 0.25)
          // 温度等数值键在 JSON 里 1.0 会序列化成 1，按数值匹配回 keys 表
          const resolveKey = (keys, val) => {
            const s = String(val ?? '')
            if (keys.includes(s)) return s
            const num = Number(s)
            return keys.find((k) => Number(k) === num) ?? s
          }
          const mk = resolveKey(modelFam.keys, r.modelId)
          const tk = resolveKey(tempFam.keys, r.temp)
          if (!perModel.has(mk)) perModel.set(mk, [])
          perModel.get(mk).push(loss)
          if (!perTemp.has(tk)) perTemp.set(tk, [])
          perTemp.get(tk).push(loss)
        }
        const avgLosses = (map, keys) =>
          keys.map((k) => {
            const arr = map.get(k)
            return arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
          })
        // 无该模型/温度预测时按随机期望命中（10×0.25）兜底，不奖不罚
        const neutral = hitLoss(10 * 0.25, 10, 0.25)
        const mLosses = avgLosses(perModel, modelFam.keys)
        const tLosses = avgLosses(perTemp, tempFam.keys)
        await saveFamily('model', hedgeUpdate(modelFam, mLosses.map((l) => (l == null ? neutral : l))))
        await saveFamily('temp', hedgeUpdate(tempFam, tLosses.map((l) => (l == null ? neutral : l))))
        if (preds.some((r) => r.source === 'models:kl8')) {
          await markScored('models:kl8', {
            actual: actual.nums,
            modelLoss: Object.fromEntries(modelFam.keys.map((k, i) => [k, +(mLosses[i] ?? 0).toFixed(4)])),
            tempLoss: Object.fromEntries(tempFam.keys.map((k, i) => [k, +(tLosses[i] ?? 0).toFixed(4)])),
          })
        }
      }
      // ── AI/算法混合比 ──
      if (rowLoss['ai:final'] != null && rowLoss['algo:v7'] != null) {
        const mixFam = getFamily('mix', d.mix.keys, d.mix.weights)
        await saveFamily('mix', mixUpdate(mixFam, rowLoss['algo:v7'], rowLoss['ai:final']))
        if (preds.some((r) => r.source === 'mix:kl8')) {
          await markScored('mix:kl8', {
            lossAlgo: +rowLoss['algo:v7'].toFixed(4),
            lossAi: +rowLoss['ai:final'].toFixed(4),
          })
        }
      }
      // ── 窗口权重：严格前推，4 个窗口各取 Top30 池算命中 ──
      const winFam = getFamily('windows', d.windows.keys, d.windows.weights)
      const winLosses = d.windows.keys.map((w) => {
        const { scores } = scoreBalls(hist, { periods: Number(w), halfLife: 20, hotMode: 'mix' })
        const top = new Set(
          Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([n]) => Number(n)),
        )
        const hits = actual.nums.filter((n) => top.has(n)).length
        return hitLoss(hits, 30, 0.25)
      })
      await saveFamily('windows', hedgeUpdate(winFam, winLosses))
    } else if (game === 'fc3d' || game === 'pl3' || game === 'pl5') {
      const npos = digitPositions(game)
      const experts = digitExperts(game)
      // ── 算法池 / AI 终选 / 站内 AI：按注回填命中 ──
      for (const source of ['algo:pool', 'ai:final', 'ai:site']) {
        const picks = bySource.get(source)
        if (!picks || typeof picks !== 'object') continue
        const straight = Array.isArray(picks.straight) ? picks.straight : []
        const straightHits = straight.filter((x, i) => i < npos && x === actual.num[i]).length
        const group = Array.isArray(picks.group) ? picks.group : []
        const groupSet = new Set(group)
        const groupHits = actual.num.filter((x) => groupSet.has(x)).length
        let group3Hits = 0
        if (Array.isArray(picks.group3)) {
          for (const c of picks.group3) {
            const arr = Array.isArray(c) ? c : String(c).split('').map(Number)
            const h = arr.filter((x, i) => i < npos && x === actual.num[i]).length
            group3Hits = Math.max(group3Hits, h)
          }
        }
        const loss = hitLoss(straightHits, npos, 0.1)
        await markScored(source, {
          actual: actual.num,
          straightHits,
          groupHits,
          group3Hits,
          logLoss: +loss.toFixed(4),
        })
      }
      // ── 逐位专家 log-loss → hedgeUpdate('experts:p{pos}') ──
      // 专家模型给的是无条件概率分布，无论有没有推荐行都可按实际开奖推进权重
      {
        const perExpertLoss = []
        for (let pos = 0; pos < npos; pos++) {
          const losses = experts.map((e) => {
            const p = e.fn(hist, pos)
            return -Math.log(clamp(p[actual.num[pos]], 1e-4, 0.999))
          })
          perExpertLoss.push(losses.map((l) => +l.toFixed(4)))
          const fam = getFamily(`experts:p${pos}`, d.experts.keys, d.experts.weights)
          await saveFamily(`experts:p${pos}`, hedgeUpdate(fam, losses))
        }
        await markScored('hedge:experts', { actual: actual.num, perExpertLoss })
      }
    } else if (game === 'ssq') {
      // ── 推荐行命中打分：算法 + 站内 AI 终选（红球命中 + 蓝球对）──
      for (const source of ['algo:ssq', 'ai:site', 'ai:final']) {
        const picks = bySource.get(source)
        if (!picks || !Array.isArray(picks.red) || !picks.red.length) continue
        const actualRed = new Set(actual.red)
        const redHits = picks.red.filter((n) => actualRed.has(n)).length
        const blueHit = picks.blue === actual.blue
        // AI 行红球可能 6-8 个，按实际选号数计损失（每号期望命中概率 6/33）
        const loss = hitLoss(redHits, picks.red.length, 6 / 33) + hitLoss(blueHit ? 1 : 0, 1, 1 / 16)
        await markScored(source, {
          actual: { red: actual.red, blue: actual.blue },
          redHits,
          blueHit,
          logLoss: +loss.toFixed(4),
        })
      }
      // ── 信号权重：每信号拆成逐号概率，对开出/未开出号求平均 log-loss ──
      if (preds.some((r) => r.source === 'signals:ssq')) {
        const sig = ssqSignalScores(hist)
        const signalLosses = (raw, keys, poolMax, drawnSet) =>
          keys.map((k) => {
            const arr = raw[k]
            const s = arr.reduce((a, b) => a + Math.max(0, b), 0)
            const p = arr.map((v) => (s > 0 ? clamp(Math.max(0, v) / s, 0.02, 0.6) : 1 / poolMax))
            let acc = 0
            for (let i = 0; i < poolMax; i++) acc += drawnSet.has(i + 1) ? -Math.log(p[i]) : -Math.log(1 - p[i])
            return acc / poolMax
          })
        const redLosses = signalLosses(sig.red, d.redSignals.keys, 33, new Set(actual.red))
        const blueLosses = signalLosses(sig.blue, d.blueSignals.keys, 16, new Set([actual.blue]))
        const redFam = getFamily('redSignals', d.redSignals.keys, d.redSignals.weights)
        const blueFam = getFamily('blueSignals', d.blueSignals.keys, d.blueSignals.weights)
        await saveFamily('redSignals', hedgeUpdate(redFam, redLosses))
        await saveFamily('blueSignals', hedgeUpdate(blueFam, blueLosses))
        await markScored('signals:ssq', {
          actual: { red: actual.red, blue: actual.blue },
          redSignalLoss: Object.fromEntries(d.redSignals.keys.map((k, i) => [k, +redLosses[i].toFixed(4)])),
          blueSignalLoss: Object.fromEntries(d.blueSignals.keys.map((k, i) => [k, +blueLosses[i].toFixed(4)])),
        })
      }
    }

    return { skipped: false, drawId, updated }
  } catch (e) {
    console.error('[learning] scoreAndLearn 失败：', e?.message || e)
    return { skipped: true, error: String(e?.message || e) }
  }
}

/**
 * 本期 algo/ai/hedge 行批量 upsert（已打分的历史行不覆盖）。
 * rows: [{ source, picks }]；失败仅 console.error，绝不 throw。
 */
export async function persistPredictions(sql, game, drawId, rows) {
  if (!sql || !Array.isArray(rows)) return
  for (const r of rows) {
    try {
      const json = JSON.stringify(r.picks ?? null)
      await sql`
        INSERT INTO learning_predictions (game, draw_id, source, picks, updated_at)
        VALUES (${game}, ${Number(drawId)}, ${r.source}, ${json}::jsonb, now())
        ON CONFLICT (game, draw_id, source) DO UPDATE
          SET picks = EXCLUDED.picks, updated_at = now()
          WHERE learning_predictions.scored = false`
    } catch (e) {
      console.error(`[learning] persistPredictions ${game}/${r?.source} 失败：`, e?.message || e)
    }
  }
}

// ────────────────────────── Phase 2：AI 自我复盘经验笔记 ──────────────────────────

const NOTES_SYSTEM =
  '你是彩票推荐系统的自我复盘模块。根据各彩种近期命中摘要与当前权重，总结一条对后续分析有用的经验笔记。' +
  '只输出JSON {"note":"…"}，≤300字，诚实：只优化一致性与可解释性，不提高中奖概率。'

/** 从模型回复里抠出 {note} */
function parseNote(raw) {
  const text = String(raw || '')
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fence ? fence[1] : text).trim()
  try {
    const obj = JSON.parse(body)
    if (obj && obj.note) return String(obj.note)
  } catch {
    const m = body.match(/"note"\s*:\s*"([^"]+)"/)
    if (m) return m[1]
  }
  return null
}

/**
 * 拼经验笔记生成输入：各彩种近 10 期打分命中摘要 + 当前权重 + 上一条笔记。
 * learnedOf 为 { [game]: loadLearning 结果 }。失败一律跳过对应段落，绝不 throw。
 */
export async function buildRecentSummary(sql, games, learnedOf = {}) {
  const parts = []
  for (const g of games) {
    try {
      const rows = await sql`
        SELECT draw_id, source, meta FROM learning_predictions
        WHERE game = ${g} AND scored = true
        ORDER BY draw_id DESC LIMIT 10`
      const brief = rows.map((r) => {
        const m = typeof r.meta === 'string' ? JSON.parse(r.meta || '{}') : r.meta || {}
        const hit =
          m.hits ??
          m.straightHits ??
          (m.redHits != null ? `红${m.redHits}/蓝${m.blueHit ? '中' : '未中'}` : '-')
        return `${r.draw_id}:${r.source}=${hit}`
      })
      parts.push(`【${g} 近 10 期命中】${brief.join(' ') || '无'}`)
    } catch {
      /* 单彩种摘要失败不影响笔记生成 */
    }
  }
  try {
    const w = {}
    for (const g of games) {
      const st = learnedOf[g]
      if (!st) continue
      w[g] = st.experts
        ? { n: st.n, experts: st.experts }
        : {
            n: st.n,
            model: st.model?.weights,
            temp: st.temp?.weights,
            mix: st.mix?.weights,
            windows: st.windows?.weights,
            redSignals: st.redSignals?.weights,
            blueSignals: st.blueSignals?.weights,
          }
    }
    if (Object.keys(w).length) parts.push(`【当前权重】${JSON.stringify(w)}`)
  } catch {
    /* 权重摘要失败不阻塞 */
  }
  try {
    const last = await sql`
      SELECT content FROM ai_experience_notes
      WHERE game = 'all' AND active = true
      ORDER BY created_at DESC LIMIT 1`
    if (last[0]?.content) parts.push(`【上一条笔记】${String(last[0].content).slice(0, 400)}`)
  } catch {
    /* 无上一条笔记也正常 */
  }
  return parts.join('\n\n').slice(0, 6000)
}

/**
 * 经验笔记生成（daily-push / 夜间学习内并行调用，绝不 throw）。
 * 触发条件（force 可跳过时间/打分门控）：有 sql 与 llm、elapsedMs<35000、
 * games 中至少一个今日实际打分过、距上一条 active 总括笔记 ≥7 天或 ≥5 期新打分。
 * recentSummary 由调用方拼（各彩种近10期命中摘要+当前权重+上一条笔记）。
 */
export async function maybeGenerateNotes(sql, llm, { games = [], recentSummary = '', elapsedMs = 0, force = false } = {}) {
  try {
    if (!sql || !llm || !llm.llmKey) return null
    if (!force && elapsedMs >= 35000) return null
    if (!games.length) return null
    const lastRows = await sql`
      SELECT id, content, meta, created_at FROM ai_experience_notes
      WHERE game = 'all' AND active = true
      ORDER BY created_at DESC LIMIT 1`
    const last = lastRows[0]
    if (!force && last) {
      const daysSince = (Date.now() - new Date(last.created_at).getTime()) / 86400000
      let freshScored = 0
      try {
        const cnt = await sql`
          SELECT COUNT(*)::int AS c FROM learning_predictions
          WHERE scored = true AND updated_at > ${last.created_at}`
        freshScored = cnt[0]?.c || 0
      } catch {
        /* 计数失败按 0 处理，仅影响触发门槛 */
      }
      if (daysSince < 7 && freshScored < 5) return null
    }
    const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('notes timeout')), 15000))
    const raw = await Promise.race([
      callAi(
        llm,
        [
          { role: 'system', content: NOTES_SYSTEM },
          { role: 'user', content: recentSummary },
        ],
        { maxTokens: 500, temperature: 0.4 },
      ),
      timeoutP,
    ])
    const note = parseNote(raw)
    if (!note) return null
    // 收集本次打分覆盖的期号（近 10 期 scored 行，按传入彩种过滤）
    const scored = await sql`
      SELECT game, draw_id FROM learning_predictions
      WHERE scored = true
      ORDER BY updated_at DESC LIMIT 50`
    const gameSet = new Set(games)
    const drawIds = scored
      .filter((r) => gameSet.has(r.game))
      .slice(0, 10)
      .map((r) => `${r.game}:${r.draw_id}`)
    const meta = JSON.stringify({ drawIds, windowFrom: games.join(','), windowTo: new Date().toISOString() })
    const ins = await sql`
      INSERT INTO ai_experience_notes (game, content, meta)
      VALUES ('all', ${note.slice(0, 400)}, ${meta}::jsonb)
      RETURNING id`
    // 清理：只保留最新 12 条 active
    await sql`
      UPDATE ai_experience_notes SET active = false
      WHERE game = 'all' AND active = true
        AND id NOT IN (
          SELECT id FROM ai_experience_notes
          WHERE game = 'all' AND active = true
          ORDER BY created_at DESC LIMIT 12
        )`
    return { id: ins[0]?.id, note: note.slice(0, 400) }
  } catch (e) {
    console.error('[learning] maybeGenerateNotes 失败：', e?.message || e)
    return null
  }
}
