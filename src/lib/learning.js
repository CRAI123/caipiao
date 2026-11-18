// ============================================================
// 学习中心 —— 前端只读模块（服务端 daily-push 是唯一写者）
// 读取三张表：learning_state / learning_predictions(scored) / ai_experience_notes
// 兜底链：浏览器直连 Neon（同 settings/neon 模式）→ /api/get-reviews?learning=1&game=xxx → 无数据
// 绝不 throw：任何失败都退化为 source:'none' 空数据，由 UI 显示友好空态。
// ============================================================

import { loadSettings, isNeonReady } from './settings.js'
import { getSql } from './neon.js'
import { getLearning } from './api.js'

/** jsonb 可能以字符串返回（HTTP 驱动），统一解析 */
function parseMaybe(v) {
  if (typeof v !== 'string') return v ?? null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

/** 权重向量归一化熵：-Σw·ln(w)/ln(k)，1=完全均匀，0=完全集中（学习健康度用） */
export function normEntropy(weights) {
  const w = (weights || []).map((x) => Math.max(0, Number(x) || 0))
  const t = w.reduce((a, b) => a + b, 0)
  if (t <= 0 || w.length < 2) return 0
  let s = 0
  for (const x of w) {
    const p = x / t
    if (p > 0) s += p * Math.log(p)
  }
  return -s / Math.log(w.length)
}

function normalizeStateRow(r) {
  return {
    paramKey: r.paramKey ?? r.param_key ?? '',
    value: parseMaybe(r.value) || {},
    version: r.version ?? null,
    updatedAt: r.updatedAt ?? r.updated_at ?? null,
  }
}

function normalizeRunRow(r) {
  return {
    drawId: r.drawId ?? r.draw_id ?? null,
    source: r.source ?? '',
    picks: parseMaybe(r.picks),
    meta: parseMaybe(r.meta),
    createdAt: r.createdAt ?? r.created_at ?? null,
  }
}

function normalizeNoteRow(r) {
  return {
    id: r.id ?? null,
    game: r.game ?? '',
    content: r.content ?? '',
    meta: parseMaybe(r.meta),
    createdAt: r.createdAt ?? r.created_at ?? null,
  }
}

function normalizeHistoryRow(r) {
  return {
    paramKey: r.paramKey ?? r.param_key ?? '',
    day: String(r.day ?? '').slice(0, 10),
    value: parseMaybe(r.value),
  }
}

/** 冷启动判定：无 state 行，或任一行样本数 n < 8 */
function isColdStart(stateRows) {
  return !stateRows.length || stateRows.some((s) => Number(s.value?.n ?? 0) < 8)
}

async function readFromDb(game) {
  const settings = loadSettings()
  if (!isNeonReady(settings)) return null
  const sql = getSql(settings.neonUrl)
  const [stateRows, runRows, noteRows, historyRows] = await Promise.all([
    sql`SELECT param_key, value, version, updated_at FROM learning_state WHERE game = ${game}`,
    sql`SELECT draw_id, source, picks, meta, created_at FROM learning_predictions
        WHERE game = ${game} AND scored = true
        ORDER BY draw_id DESC LIMIT 60`,
    sql`SELECT id, game, content, meta, created_at FROM ai_experience_notes
        WHERE game IN (${game}, 'all') AND active = true
        ORDER BY created_at DESC LIMIT 12`,
    sql`SELECT param_key, day, value FROM learning_history
        WHERE game = ${game} AND day >= CURRENT_DATE - INTERVAL '60 days'
        ORDER BY day`,
  ])
  return {
    state: (stateRows || []).map(normalizeStateRow),
    runs: (runRows || []).map(normalizeRunRow),
    notes: (noteRows || []).map(normalizeNoteRow),
    history: (historyRows || []).map(normalizeHistoryRow),
  }
}

async function readFromApi(game) {
  const data = await getLearning(game)
  // 服务端无库时返回 {error:'no_db'}；apiFetch 对非 2xx 会 throw，此处双保险
  if (!data || data.error) return null
  return {
    state: (data.state || []).map(normalizeStateRow),
    runs: (data.runs || []).map(normalizeRunRow),
    notes: (data.notes || []).map(normalizeNoteRow),
    history: (data.history || []).map(normalizeHistoryRow),
  }
}

/**
 * 读取某彩种的学习状态。
 * @returns {Promise<{state:object[],runs:object[],notes:object[],history:object[],source:'db'|'api'|'none',coldStart:boolean,error?:string}>}
 */
export async function readLearning(game) {
  const empty = { state: [], runs: [], notes: [], history: [], source: 'none', coldStart: true }
  if (!game) return empty
  let lastErr = null
  try {
    const db = await readFromDb(game)
    if (db) return { ...db, source: 'db', coldStart: isColdStart(db.state) }
  } catch (e) {
    lastErr = e
  }
  try {
    const api = await readFromApi(game)
    if (api) return { ...api, source: 'api', coldStart: isColdStart(api.state) }
  } catch (e) {
    lastErr = lastErr || e
  }
  return { ...empty, error: String(lastErr?.message || lastErr || '') }
}
