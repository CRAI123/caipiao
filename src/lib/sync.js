// ============================================================
// 同步与分析动作 —— 供「每日打卡」与「购彩账本」共用
// 单条记录 → Neon upsert；单条记录 → AI 分析（结果写回记录）
// ============================================================

import { loadSettings, isNeonReady, isLlmReady } from './settings.js'
import { pushRecords, getSql } from './neon.js'
import { analyzeJournal } from './ai.js'
import { journalStats } from './journal.js'
import { ensureAccessTables, getSharedLlmConfig } from './access.js'

/** 把一条记录上传 Neon，成功返回带上同步时间的新记录 */
export async function syncRecordToNeon(rec) {
  const settings = loadSettings()
  if (!isNeonReady(settings)) throw new Error('尚未配置 Neon 连接串，请先到「设置」页填写')
  await pushRecords(settings.neonUrl, [rec])
  return { ...rec, synced: { ...(rec.synced || {}), neon: new Date().toISOString() } }
}

/** 批量上传（返回成功条数） */
export async function syncAllToNeon(records) {
  const settings = loadSettings()
  if (!isNeonReady(settings)) throw new Error('尚未配置 Neon 连接串，请先到「设置」页填写')
  const n = await pushRecords(settings.neonUrl, records)
  const now = new Date().toISOString()
  return { count: n, stamp: now }
}

/**
 * 解析大模型配置：优先用本机 localStorage；未配置则从 Neon 的 admin_config
 * 读取管理员统一配置的共享参数，实现「管理员配一次，所有人可用」。
 */
export async function resolveLlmSettings() {
  const local = loadSettings()
  if (isLlmReady(local)) return local
  if (!isNeonReady(local)) return local
  try {
    const sql = getSql(local.neonUrl)
    await ensureAccessTables(sql)
    const shared = await getSharedLlmConfig(sql)
    if (shared && shared.llmKey) {
      return { ...local, ...shared }
    }
  } catch {
    /* 云端读取失败，退回本地配置 */
  }
  return local
}

/**
 * 对一条记录跑 AI 分析（分析对象是整本账本，结果存档到该条记录上）。
 * 返回带上 aiReport 与同步时间的新记录。
 */
export async function analyzeRecord(rec, list, latestDraw) {
  const settings = loadSettings()
  const llmSettings = await resolveLlmSettings()
  const result = await analyzeJournal(llmSettings, {
    stats: journalStats(list),
    records: list,
    latestDraw,
  })
  const next = { ...rec, aiReport: { text: result.text, at: result.at, model: result.model } }
  if (isNeonReady(settings)) {
    try {
      next.synced = { ...(next.synced || {}), neon: new Date().toISOString() }
      await pushRecords(settings.neonUrl, [next])
    } catch {
      // Neon 失败不影响本地存档
    }
  }
  return next
}
