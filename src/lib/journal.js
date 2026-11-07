// ============================================================
// 购彩账本 —— 每日打卡：买了吗 / 选的什么号 / 花多少 / 中几个 / 中多少
// 记录结构（一行一天，主键为开奖日期）：
// {
//   date: '2026-11-07', drawId: 2026296, bought: true,
//   tickets: [[1,5,12,...], ...],   // 每张票一行（选几就是几）
//   picks: [...],                   // 全部票合并去重（便于展示）
//   spend: 20, hits: 3, prize: 0,   // 花费 / 命中个数（默认按开奖号自动算，可手改）/ 奖金
//   note: '', aiReport: null, synced: { neon: null, lark: null },
//   createdAt, updatedAt
// }
// ============================================================

import { comb } from './stats.js'

const KEY = 'kl8_journal_v1'

let memoryStore = null
function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* 隐私模式等场景 */
  }
  if (!memoryStore) memoryStore = new Map()
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, v),
    removeItem: (k) => memoryStore.delete(k),
  }
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 读取全部记录，按日期倒序（最新在前） */
export function loadJournal() {
  try {
    const raw = storage().getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1)) : []
  } catch {
    return []
  }
}

export function persistJournal(list) {
  storage().setItem(KEY, JSON.stringify(list))
  return list
}

export function getRecord(list, date) {
  return list.find((r) => r.date === date) || null
}

/** 按日期 upsert，返回新数组（不改原数组） */
export function upsertRecord(list, rec) {
  const idx = list.findIndex((r) => r.date === rec.date)
  const next = [...list]
  if (idx >= 0) next[idx] = { ...next[idx], ...rec }
  else next.unshift(rec)
  return next.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function removeRecord(list, date) {
  return list.filter((r) => r.date !== date)
}

/** 解析票面文本：每行一注，号码用空格/逗号/制表符分隔 */
export function parseTickets(text) {
  return String(text || '')
    .split('\n')
    .map((line) =>
      line
        .split(/[\s,，、]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80),
    )
    .filter((t) => t.length > 0)
    .map((t) => [...new Set(t)].sort((a, b) => a - b))
}

export function formatTickets(tickets) {
  return (tickets || [])
    .map((t) => t.map((n) => String(n).padStart(2, '0')).join(' '))
    .join('\n')
}

/** 一注命中的号码个数 */
const ticketHits = (ticket, hitSet) => ticket.filter((n) => hitSet.has(n)).length

/** 全部票里的最大命中数（用户口算「中几个」通常指最幸运的那注） */
export function autoHits(tickets, draw) {
  const hitSet = new Set(draw?.nums || [])
  if (!hitSet.size || !tickets?.length) return 0
  return Math.max(...tickets.map((t) => ticketHits(t, hitSet)))
}

/** 每注各自的命中数（展示用） */
export function perTicketHits(tickets, draw) {
  const hitSet = new Set(draw?.nums || [])
  return (tickets || []).map((t) => ticketHits(t, hitSet))
}

const num = (v, dft = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : dft
}

/** 把表单草稿规范化为一条记录（hits 为空时用自动命中） */
export function normalizeRecord(draft, draw, existing = null) {
  const tickets = draft.tickets?.length ? draft.tickets : []
  const picks = [...new Set(tickets.flat())].sort((a, b) => a - b)
  const auto = autoHits(tickets, draw)
  const now = new Date().toISOString()
  const hits = draft.hits === '' || draft.hits == null ? auto : Math.max(0, num(draft.hits, auto))
  return {
    date: draft.date,
    drawId: draft.drawId ?? draw?.id ?? null,
    bought: !!draft.bought,
    tickets,
    picks,
    play: tickets.reduce((m, t) => Math.max(m, t.length), 0),
    spend: draft.bought ? Math.max(0, num(draft.spend, 0)) : 0,
    hits: draft.bought ? hits : null,
    prize: draft.bought ? Math.max(0, num(draft.prize, 0)) : 0,
    note: String(draft.note || '').slice(0, 200),
    aiReport: existing?.aiReport || null,
    synced: existing?.synced || { neon: null, lark: null },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
}

/**
 * 账本统计聚合。
 * hitRows：实际命中天数 vs 理论期望天数（按每期实际玩法概率加权）。
 */
export function journalStats(list) {
  const bought = list.filter((r) => r.bought)
  const spend = bought.reduce((s, r) => s + num(r.spend), 0)
  const prize = bought.reduce((s, r) => s + num(r.prize), 0)

  // 命中分布：实际 vs 理论期望
  const actual = {}
  const expected = {}
  const playMap = {}
  for (const r of bought) {
    const k = r.hits == null ? 0 : r.hits
    actual[k] = (actual[k] || 0) + 1
    const p = r.play >= 1 && r.play <= 10 ? r.play : 10
    const dist = hitTheory(p)
    for (const { k: kk, prob } of dist) expected[kk] = (expected[kk] || 0) + prob
    if (!playMap[p]) playMap[p] = { play: p, days: 0, spend: 0, prize: 0 }
    playMap[p].days += 1
    playMap[p].spend += num(r.spend)
    playMap[p].prize += num(r.prize)
  }

  const maxK = Math.max(10, ...bought.map((r) => r.play || 10))
  const hitRows = Array.from({ length: maxK + 1 }, (_, k) => ({
    k,
    actual: actual[k] || 0,
    expected: +(expected[k] || 0).toFixed(2),
  }))

  const playRows = Object.values(playMap)
    .map((row) => ({ ...row, net: row.prize - row.spend, roi: row.spend ? row.prize / row.spend : 0 }))
    .sort((a, b) => a.play - b.play)

  const best = bought.reduce(
    (top, r) => (num(r.prize) > num(top?.prize, 0) ? r : top),
    null,
  )

  return {
    days: list.length,
    boughtDays: bought.length,
    noBuyDays: list.length - bought.length,
    spend,
    prize,
    net: prize - spend,
    roi: spend ? prize / spend : 0,
    avgSpend: bought.length ? spend / bought.length : 0,
    hitRows,
    playRows,
    best: best ? { date: best.date, prize: num(best.prize) } : null,
    lastCheckin: list[0]?.date || null,
    theory10: hitTheory(10), // 选十理论分布（对照基准）
  }
}

/** 选 play 个号命中 k 个的超几何概率分布（机选基准） */
export function hitTheory(play) {
  const p = Math.min(10, Math.max(1, Math.round(play) || 10))
  const total = comb(80, p)
  return Array.from({ length: p + 1 }, (_, k) => ({
    k,
    prob: (comb(20, k) * comb(60, p - k)) / total,
  }))
}

export function exportJson(list) {
  return JSON.stringify({ app: 'kl8-journal', exportedAt: new Date().toISOString(), records: list }, null, 2)
}

export function importJson(text) {
  const data = JSON.parse(text)
  const records = Array.isArray(data) ? data : data.records
  if (!Array.isArray(records)) throw new Error('文件格式不正确：应为记录数组或 { records: [...] }')
  return records
    .filter((r) => r && typeof r.date === 'string')
    .map((r) => ({ ...r }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
