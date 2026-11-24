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
import { PRO_EXPERTS as QXC_EXPERTS } from '../../src/lib/qxcPredict.js'
import { FC3D_EXPERTS } from '../../src/lib/fc3dPredict.js'
import { WINDOWS as KL8_WINDOWS } from '../../src/lib/kl8V7.js'
import { KL8_PLAY } from '../../src/lib/kl8Math.js'
import {
  DLT_FRONT_SIGNALS,
  DLT_BACK_SIGNALS,
  DLT_FRONT_WEIGHTS,
  DLT_BACK_WEIGHTS,
  dltSignalScores,
} from '../../src/lib/dltPredict.js'
import { callAi } from './ai.js'
import { readConfig, writeConfig } from './neon.js'

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
  qxc: {
    experts: {
      keys: QXC_EXPERTS.map((e) => e.key),
      weights: norm(QXC_EXPERTS.map(() => 1)),
      positions: 7,
    },
  },
  dlt: {
    frontSignals: { keys: DLT_FRONT_SIGNALS, weights: norm(DLT_FRONT_WEIGHTS) },
    backSignals: { keys: DLT_BACK_SIGNALS, weights: norm(DLT_BACK_WEIGHTS) },
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
  if (game === 'qxc') return QXC_EXPERTS
  if (game === 'pl5') return PL5_EXPERTS
  return PL3_EXPERTS
}
function digitPositions(game) {
  if (game === 'qxc') return 7
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
        AND COALESCE(meta->>'kind', '') <> 'digest'
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
    const changes = [] // 本期各键权重新旧变动（供日报与前端展示）
    const hitsOut = {} // 本期各来源命中数
    const today = new Date().toISOString().slice(0, 10)
    /** 取族当前状态：有历史就接着累加（冷启动阶段也必须累积，否则样本永远停在 1/8） */
    const getFamily = (paramKey, keys, weights) => {
      const v = stateRows.get(paramKey)
      if (v && Array.isArray(v.weights) && v.weights.length === keys.length) return v
      return newStateValue(keys, weights)
    }
    const saveFamily = async (paramKey, value, prev) => {
      const saved = { ...value, lastDrawId: drawId }
      await upsertState(sql, game, paramKey, saved)
      updated.push(paramKey)
      // 权重演化快照：upsert 进 learning_history（失败静默，不影响打分主流程）
      try {
        const json = JSON.stringify(saved)
        await sql`
          INSERT INTO learning_history (game, param_key, day, value, updated_at)
          VALUES (${game}, ${paramKey}, ${today}, ${json}::jsonb, now())
          ON CONFLICT (game, param_key, day) DO UPDATE
            SET value = EXCLUDED.value, updated_at = now()`
      } catch {
        /* 快照失败不影响打分 */
      }
      // 对比新旧 weights 逐键记录实际变动（只记 |to-from|>1e-6 的）
      if (prev && Array.isArray(prev.weights) && Array.isArray(saved.weights)) {
        const keys = saved.keys || prev.keys || []
        saved.weights.forEach((to, i) => {
          const from = prev.weights[i]
          if (typeof from === 'number' && typeof to === 'number' && Math.abs(to - from) > 1e-6) {
            changes.push({ paramKey, key: keys[i] ?? String(i), from, to })
          }
        })
      }
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
        const loss = hitLoss(hits, picks.length || KL8_PLAY, 0.25)
        rowLoss[source] = loss
        hitsOut[source] = hits
        await markScored(source, { actual: actual.nums, hits, logLoss: +loss.toFixed(4) })
      }
      // ── 模型 × 温度：从 kl8_ai_deep_runs.result.round1Picks 逐条打分 ──
      const modelFam = getFamily('model', d.model.keys, d.model.weights)
      const tempFam = getFamily('temp', d.temp.keys, d.temp.weights)
      const runRows = await sql`
        SELECT result FROM kl8_ai_deep_runs WHERE draw_id = ${drawId} AND play = ${KL8_PLAY} LIMIT 1`
      const result = parseJson(runRows[0]?.result)
      const round1 = result?.round1Picks || result?.result?.round1Picks
      if (Array.isArray(round1) && round1.length) {
        const perModel = new Map()
        const perTemp = new Map()
        const actualSet = new Set(actual.nums)
        for (const r of round1) {
          if (!r || !Array.isArray(r.picks) || !r.picks.length) continue
          const hits = r.picks.filter((n) => actualSet.has(n)).length
          const loss = hitLoss(hits, r.picks.length || KL8_PLAY, 0.25)
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
        // 无该模型/温度预测时按随机期望命中兜底，不奖不罚
        const neutral = hitLoss(KL8_PLAY * 0.25, KL8_PLAY, 0.25)
        const mLosses = avgLosses(perModel, modelFam.keys)
        const tLosses = avgLosses(perTemp, tempFam.keys)
        await saveFamily('model', hedgeUpdate(modelFam, mLosses.map((l) => (l == null ? neutral : l))), modelFam)
        await saveFamily('temp', hedgeUpdate(tempFam, tLosses.map((l) => (l == null ? neutral : l))), tempFam)
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
        await saveFamily('mix', mixUpdate(mixFam, rowLoss['algo:v7'], rowLoss['ai:final']), mixFam)
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
      await saveFamily('windows', hedgeUpdate(winFam, winLosses), winFam)
    } else if (game === 'fc3d' || game === 'pl3' || game === 'pl5' || game === 'qxc') {
      const npos = digitPositions(game)
      const experts = digitExperts(game)
      // ── 算法池 / AI 终选 / 站内 AI：按注回填命中 ──
      for (const source of ['algo:pool', 'ai:final', 'ai:site']) {
        const picks = bySource.get(source)
        if (!picks || typeof picks !== 'object') continue
        const straight = Array.isArray(picks.straight) ? picks.straight : []
        let straightHits = 0
        if (game === 'qxc') {
          // 七星彩推荐是 "7 2 4 7 6 3 14" 字符串，按最大逐位命中数计分
          for (const s of straight) {
            const arr = Array.isArray(s) ? s.map(Number) : String(s).trim().split(/[\s,，]+/).map(Number)
            if (arr.length !== 7 || arr.some((x) => !Number.isInteger(x))) continue
            const h = arr.filter((x, i) => x === actual.num[i]).length
            straightHits = Math.max(straightHits, h)
          }
        } else {
          straightHits = straight.filter((x, i) => i < npos && x === actual.num[i]).length
        }
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
        const loss = hitLoss(straightHits, npos, game === 'qxc' ? 0.09 : 0.1)
        hitsOut[source] = straightHits
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
          await saveFamily(`experts:p${pos}`, hedgeUpdate(fam, losses), fam)
        }
        await markScored('hedge:experts', { actual: actual.num, perExpertLoss })
      }
    } else if (game === 'dlt') {
      // ── 推荐行命中打分：算法 + 站内 AI 终选（前区命中 + 后区命中）──
      for (const source of ['algo:dlt', 'ai:site', 'ai:final']) {
        const picks = bySource.get(source)
        if (!picks || !Array.isArray(picks.front) || !picks.front.length) continue
        const actualFront = new Set(actual.front)
        const actualBack = new Set(actual.back)
        const frontHits = picks.front.filter((n) => actualFront.has(n)).length
        const backHits = (picks.back || []).filter((n) => actualBack.has(n)).length
        // AI 行前区可能 5-8 个、后区 2-4 个，按实际选号数计损失（前区单号 5/35，后区单号 2/12）
        const loss =
          hitLoss(frontHits, picks.front.length, 5 / 35) + hitLoss(backHits, picks.back?.length || 2, 2 / 12)
        hitsOut[source] = frontHits + backHits
        hitsOut[`${source}:backHits`] = backHits
        await markScored(source, {
          actual: { front: actual.front, back: actual.back },
          frontHits,
          backHits,
          logLoss: +loss.toFixed(4),
        })
      }
      // ── 信号权重：每信号拆成逐号概率，对开出/未开出号求平均 log-loss ──
      // 与数字彩专家一致：信号模型给的是无条件概率分布，无论当期有没有推荐行都按实际开奖推进
      {
        const sig = dltSignalScores(hist)
        const signalLosses = (raw, keys, poolMax, drawnSet) =>
          keys.map((k) => {
            const arr = raw[k]
            const s = arr.reduce((a, b) => a + Math.max(0, b), 0)
            const p = arr.map((v) => (s > 0 ? clamp(Math.max(0, v) / s, 0.02, 0.6) : 1 / poolMax))
            let acc = 0
            for (let i = 0; i < poolMax; i++) acc += drawnSet.has(i + 1) ? -Math.log(p[i]) : -Math.log(1 - p[i])
            return acc / poolMax
          })
        const frontLosses = signalLosses(sig.front, d.frontSignals.keys, 35, new Set(actual.front))
        const backLosses = signalLosses(sig.back, d.backSignals.keys, 12, new Set(actual.back))
        const frontFam = getFamily('frontSignals', d.frontSignals.keys, d.frontSignals.weights)
        const backFam = getFamily('backSignals', d.backSignals.keys, d.backSignals.weights)
        await saveFamily('frontSignals', hedgeUpdate(frontFam, frontLosses), frontFam)
        await saveFamily('backSignals', hedgeUpdate(backFam, backLosses), backFam)
        await markScored('signals:dlt', {
          actual: { front: actual.front, back: actual.back },
          frontSignalLoss: Object.fromEntries(d.frontSignals.keys.map((k, i) => [k, +frontLosses[i].toFixed(4)])),
          backSignalLoss: Object.fromEntries(d.backSignals.keys.map((k, i) => [k, +backLosses[i].toFixed(4)])),
        })
      }
    }

    return { skipped: false, drawId, updated, hits: hitsOut, changes }
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
          (m.frontHits != null
            ? `前区${m.frontHits}/后区${m.backHits ?? 0}`
            : m.redHits != null
              ? `红${m.redHits}/蓝${m.blueHit ? '中' : '未中'}`
              : '-')
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
            frontSignals: st.frontSignals?.weights,
            backSignals: st.backSignals?.weights,
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

// ────────────────────────── 每日学习日报 + 每周深度复盘 ──────────────────────────

const DIGEST_LABEL = {
  'algo:v7': '算法',
  'algo:pool': '算法池',
  'algo:dlt': '算法',
  'ai:final': 'AI终选',
  'ai:site': '站内AI',
}

/** 权重数值展示：最多 4 位小数、去尾零（0.15000→0.15） */
const fmtW = (v) => String(Number(Number(v).toFixed(4)))

/**
 * 拼学习日报纯文本（纯函数，不依赖 DB，≤200 字）：
 * 例 `第2026312期打分：算法命中5、AI终选命中6（AI占优）；今日最大权重变动 windows[24] 0.15→0.17；样本n=23`
 * 无 hits 数据时退化为只报权重变动条数；dlt 补后区命中。
 */
export function buildDigestText(game, { drawId, result, sampleN } = {}) {
  const hits = (result && result.hits) || {}
  const changes = Array.isArray(result && result.changes) ? result.changes : []
  const id = drawId ?? (result && result.drawId) ?? '?'
  // 比较对：kl8 algo:v7 vs AI；数字彩 algo:pool vs AI；大乐透 algo:dlt vs AI
  const algoKey = game === 'kl8' ? 'algo:v7' : game === 'dlt' ? 'algo:dlt' : 'algo:pool'
  const aiKeys = game === 'kl8' ? ['ai:final', 'ai:site'] : ['ai:site', 'ai:final']
  // 大乐透总分含后区，展示时拆回前区命中并补后区结果
  const redOf = (k) =>
    typeof hits[k] !== 'number' ? null : game === 'dlt' ? hits[k] - (hits[`${k}:backHits`] || 0) : hits[k]
  const blueOf = (k) => (game === 'dlt' ? `，后区命中${hits[`${k}:backHits`] || 0}/2` : '')
  const segs = []
  const algoVal = redOf(algoKey)
  if (algoVal != null) segs.push(`${DIGEST_LABEL[algoKey]}命中${algoVal}${blueOf(algoKey)}`)
  let bestKey = null
  let bestVal = null
  for (const k of aiKeys) {
    const v = redOf(k)
    if (v != null && (bestVal == null || v > bestVal)) {
      bestVal = v
      bestKey = k
    }
  }
  if (bestKey != null) segs.push(`${DIGEST_LABEL[bestKey]}命中${bestVal}${blueOf(bestKey)}`)
  let body
  if (segs.length) {
    body = segs.join('、')
    if (algoVal != null && bestVal != null) {
      body += bestVal > algoVal ? '（AI占优）' : bestVal < algoVal ? '（算法占优）' : '（持平）'
    }
    if (changes.length) {
      const max = changes.reduce((a, b) => (Math.abs(b.to - b.from) > Math.abs(a.to - a.from) ? b : a))
      body += `；今日最大权重变动 ${max.paramKey}[${max.key}] ${fmtW(max.from)}→${fmtW(max.to)}`
    }
  } else {
    // 无命中数据可报：退化为只报权重变动条数
    body = `今日权重变动${changes.length}条`
  }
  if (typeof sampleN === 'number' && Number.isFinite(sampleN)) body += `；样本n=${sampleN}`
  return `第${id}期打分：${body}`.slice(0, 200)
}

/**
 * 每日学习日报：确定性拼装 scoreAndLearn 返回值（不调 LLM），写 kind='digest' 笔记。
 * 每彩种只保留最新一条（更早 digest 置 active=false，不挤占真实笔记 12 条配额）。
 * 全程 try/catch 静默，绝不 throw。
 */
export async function writeDigest(sql, game, { drawId, result } = {}) {
  try {
    if (!sql || !game || !result || result.skipped) return null
    // 当前最大样本数（日报尾「样本n」；查询失败省略该段）
    let sampleN = null
    try {
      const rows = await sql`SELECT value FROM learning_state WHERE game = ${game}`
      for (const r of rows) {
        const n = Number(parseJson(r.value)?.n ?? NaN)
        if (Number.isFinite(n) && n > (sampleN ?? -1)) sampleN = n
      }
    } catch {
      /* 样本数查询失败不影响日报 */
    }
    const id = drawId ?? result.drawId ?? null
    const content = buildDigestText(game, { drawId: id, result, sampleN })
    if (!content) return null
    const meta = JSON.stringify({ kind: 'digest', drawId: id })
    const ins = await sql`
      INSERT INTO ai_experience_notes (game, content, meta)
      VALUES (${game}, ${content}, ${meta}::jsonb)
      RETURNING id`
    const newId = ins[0]?.id
    if (newId != null) {
      // 清理只针对 digest 行：每天只留最新一条日报
      await sql`
        UPDATE ai_experience_notes SET active = false
        WHERE game = ${game} AND active = true
          AND meta->>'kind' = 'digest' AND id < ${newId}`
    }
    return { id: newId, content }
  } catch (e) {
    console.error('[learning] writeDigest 失败：', e?.message || e)
    return null
  }
}

/** 每周深度复盘最小间隔（毫秒） */
const DEEP_REVIEW_MS = 7 * 86400000

/**
 * 每周深度复盘（批量重优化）：距上次 ≥7 天才执行，用各彩种近 24 期已打分记录
 * 重建平均损失向量，按 eta=0.8 一次性成型（与前端 proHedge 批量版对齐）。
 * 批量重优化不算新样本：lastDrawId 保持原值、n 不 +1；结果快照进 learning_history。
 * 生成 game='all' 周报笔记（kind='weekly'，保留最近 4 条 active）。
 * 全程 try/catch 绝不 throw；无 DATABASE_URL / 未到周期返回 null。
 */
export async function deepReviewWeekly(sql, games) {
  try {
    if (!sql || !Array.isArray(games) || !games.length) return null
    let lastTs = NaN
    try {
      const raw = await readConfig(sql, 'learning.lastDeepReview')
      lastTs = Date.parse(typeof raw === 'string' ? raw : String(raw ?? ''))
    } catch {
      /* 配置读不到按从未执行处理 */
    }
    if (Number.isFinite(lastTs) && Date.now() - lastTs < DEEP_REVIEW_MS) return null
    const today = new Date().toISOString().slice(0, 10)
    const fromDay = new Date(Date.now() - DEEP_REVIEW_MS).toISOString().slice(0, 10)
    const report = []
    for (const game of games) {
      const d = LEARN_DEFAULTS[game]
      if (!d) continue
      const stateRows = await readStateRows(sql, game)
      const getFamily = (paramKey, keys, weights) => {
        const v = stateRows.get(paramKey)
        if (v && v.n >= MIN_SAMPLES && Array.isArray(v.weights) && v.weights.length === keys.length) return v
        return newStateValue(keys, weights)
      }
      // 近 24 期已打分行（每期多个来源行，按期号去重取最近 24 期）
      const rows = await sql`
        SELECT draw_id, source, meta FROM learning_predictions
        WHERE game = ${game} AND scored = true
        ORDER BY draw_id DESC LIMIT 500`
      const drawIds = [...new Set(rows.map((r) => r.draw_id))].slice(0, 24)
      if (drawIds.length < 4) continue
      const idSet = new Set(drawIds)
      const metasOf = new Map()
      for (const r of rows) {
        if (!idSet.has(r.draw_id)) continue
        const m = parseJson(r.meta)
        if (!m) continue
        if (!metasOf.has(r.source)) metasOf.set(r.source, [])
        metasOf.get(r.source).push(m)
      }
      const adjusted = []
      const famChanges = []
      const saveReviewed = async (paramKey, fam, next) => {
        // 批量重优化不算新样本：n 与 lastDrawId 保持原值
        const value = { ...next, n: fam.n ?? 0, lastDrawId: fam.lastDrawId ?? null }
        await upsertState(sql, game, paramKey, value)
        try {
          const json = JSON.stringify(value)
          await sql`
            INSERT INTO learning_history (game, param_key, day, value, updated_at)
            VALUES (${game}, ${paramKey}, ${today}, ${json}::jsonb, now())
            ON CONFLICT (game, param_key, day) DO UPDATE
              SET value = EXCLUDED.value, updated_at = now()`
        } catch {
          /* 快照失败不影响复盘 */
        }
        adjusted.push(paramKey)
        const keys = value.keys || fam.keys || []
        value.weights.forEach((to, i) => {
          const from = fam.weights[i]
          if (typeof from === 'number' && typeof to === 'number' && Math.abs(to - from) > 1e-6) {
            famChanges.push({ paramKey, key: keys[i] ?? String(i), from, to })
          }
        })
      }
      // 各来源对象型损失按 key 跨期求均值；无数据键用其他键均值兜底，全无数据返回 null
      const meanLossByKeys = (source, field, keys) => {
        const ms = metasOf.get(source) || []
        const out = keys.map((k) => {
          const vals = ms.map((m) => Number(m[field]?.[k])).filter((v) => Number.isFinite(v))
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
        })
        const known = out.filter((v) => v != null)
        if (!known.length) return null
        const fb = known.reduce((a, b) => a + b, 0) / known.length
        return out.map((v) => (v == null ? fb : v))
      }
      const avgLogLoss = (source) => {
        const vals = (metasOf.get(source) || []).map((m) => Number(m.logLoss)).filter((v) => Number.isFinite(v))
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
      if (game === 'kl8') {
        const mLoss = meanLossByKeys('models:kl8', 'modelLoss', d.model.keys)
        if (mLoss) {
          const fam = getFamily('model', d.model.keys, d.model.weights)
          await saveReviewed('model', fam, hedgeUpdate(fam, mLoss, { eta: 0.8 }))
        }
        const tLoss = meanLossByKeys('models:kl8', 'tempLoss', d.temp.keys)
        if (tLoss) {
          const fam = getFamily('temp', d.temp.keys, d.temp.weights)
          await saveReviewed('temp', fam, hedgeUpdate(fam, tLoss, { eta: 0.8 }))
        }
        // mix 连续等效：w_ai = clamp(w_ai*exp(0.8*(lossAlgo-lossAi)), 0.3, 0.7)
        const lossAlgo = avgLogLoss('algo:v7')
        const lossAi = avgLogLoss('ai:final')
        if (lossAlgo != null && lossAi != null) {
          const fam = getFamily('mix', d.mix.keys, d.mix.weights)
          const wAi = clamp(fam.weights[0] * Math.exp(0.8 * (lossAlgo - lossAi)), 0.3, 0.7)
          await saveReviewed('mix', fam, { ...fam, weights: [wAi, 1 - wAi] })
        }
        // windows 逐期损失未入库，周复盘跳过（逐日增量更新已覆盖）
      } else if (d.experts) {
        // 数字彩：hedge:experts 行 perExpertLoss[pos][e]，各专家跨位跨期求均值（同前端均值口径）
        const hs = metasOf.get('hedge:experts') || []
        const perExpert = d.experts.keys.map(() => [])
        for (const m of hs) {
          if (!Array.isArray(m.perExpertLoss)) continue
          for (const posArr of m.perExpertLoss) {
            if (!Array.isArray(posArr)) continue
            posArr.forEach((l, e) => {
              const x = Number(l)
              if (Number.isFinite(x) && perExpert[e]) perExpert[e].push(x)
            })
          }
        }
        const losses = perExpert.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null))
        const known = losses.filter((v) => v != null)
        if (known.length) {
          const fb = known.reduce((a, b) => a + b, 0) / known.length
          const vec = losses.map((v) => (v == null ? fb : v))
          for (let pos = 0; pos < d.experts.positions; pos++) {
            const paramKey = `experts:p${pos}`
            const fam = getFamily(paramKey, d.experts.keys, d.experts.weights)
            await saveReviewed(paramKey, fam, hedgeUpdate(fam, vec, { eta: 0.8 }))
          }
        }
      } else if (game === 'dlt') {
        const fLoss = meanLossByKeys('signals:dlt', 'frontSignalLoss', d.frontSignals.keys)
        if (fLoss) {
          const fam = getFamily('frontSignals', d.frontSignals.keys, d.frontSignals.weights)
          await saveReviewed('frontSignals', fam, hedgeUpdate(fam, fLoss, { eta: 0.8 }))
        }
        const bLoss = meanLossByKeys('signals:dlt', 'backSignalLoss', d.backSignals.keys)
        if (bLoss) {
          const fam = getFamily('backSignals', d.backSignals.keys, d.backSignals.weights)
          await saveReviewed('backSignals', fam, hedgeUpdate(fam, bLoss, { eta: 0.8 }))
        }
      }
      if (adjusted.length) {
        famChanges.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
        report.push({
          game,
          families: adjusted,
          top: famChanges
            .slice(0, 2)
            .map((c) => `${c.paramKey}[${c.key}] ${fmtW(c.from)}→${fmtW(c.to)}`),
        })
      }
    }
    if (!report.length) return null
    // 周报笔记：game='all'，只保留最近 4 条 active weekly
    const lines = report.map((r) => `${r.game}调整${r.families.join('、')}${r.top.length ? `（最大变动 ${r.top.join('，')}）` : ''}`)
    const content = `每周深度复盘（${fromDay}~${today}，近24期均值批量重优化 eta=0.8）：${lines.join('；')}。仅调整信号权重的历史一致性，不提高中奖概率。`.slice(0, 300)
    const meta = JSON.stringify({
      kind: 'weekly',
      games: report.map((r) => r.game),
      fromDay,
      toDay: today,
    })
    await sql`
      INSERT INTO ai_experience_notes (game, content, meta)
      VALUES ('all', ${content}, ${meta}::jsonb)`
    await sql`
      UPDATE ai_experience_notes SET active = false
      WHERE game = 'all' AND active = true AND meta->>'kind' = 'weekly'
        AND id NOT IN (
          SELECT id FROM ai_experience_notes
          WHERE game = 'all' AND active = true AND meta->>'kind' = 'weekly'
          ORDER BY created_at DESC LIMIT 4
        )`
    await writeConfig(sql, 'learning.lastDeepReview', new Date().toISOString())
    return { performed: true, games: report.map((r) => r.game), content }
  } catch (e) {
    console.error('[learning] deepReviewWeekly 失败：', e?.message || e)
    return null
  }
}
