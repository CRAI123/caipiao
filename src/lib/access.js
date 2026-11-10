// ============================================================
// 访问控制 —— Neon 表与函数（申请访问 / 后台审核 / 管理员）
// 表：
//   access_requests(device_id 主键, nickname, status[pending|approved|rejected],
//                   requested_at, decided_at, admin_note)
//   admin_config(key 主键, value)             —— 存管理员令牌 SHA-256 哈希
//   admins(device_id 主键, nickname, created_at)
// 用户区分 = device_id（设备识别码）+ 昵称；管理员身份 = 知道令牌 或 设备在 admins 表。
// ============================================================

import { getSql, ensureTable } from './neon.js'
import { sha256Hex } from './device.js'

export const REQUEST_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' }

export async function ensureAccessTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS access_requests (
      device_id text PRIMARY KEY,
      nickname text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      requested_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz,
      admin_note text NOT NULL DEFAULT ''
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS admin_config (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      device_id text PRIMARY KEY,
      nickname text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )`
}

/** 我的申请记录（没有则 null） */
export async function fetchMyRequest(sql, deviceId) {
  const rows = await sql`
    SELECT device_id, nickname, status, requested_at, decided_at, admin_note
    FROM access_requests WHERE device_id = ${deviceId}`
  return rows[0] || null
}

/** 提交 / 重新提交申请（被拒后重新申请会重置为 pending） */
export async function submitRequest(sql, { deviceId, nickname }) {
  const name = String(nickname || '').trim().slice(0, 20)
  if (!name) throw new Error('请填写昵称')
  await sql`
    INSERT INTO access_requests (device_id, nickname, status, requested_at, admin_note)
    VALUES (${deviceId}, ${name}, 'pending', now(), '')
    ON CONFLICT (device_id) DO UPDATE SET
      nickname = EXCLUDED.nickname, status = 'pending',
      requested_at = now(), decided_at = NULL, admin_note = ''`
  return fetchMyRequest(sql, deviceId)
}

/** 后台：全部申请（最新在前） */
export async function listRequests(sql) {
  return sql`
    SELECT device_id, nickname, status, requested_at, decided_at, admin_note
    FROM access_requests ORDER BY requested_at DESC`
}

/** 后台：审核（approve / reject） */
export async function decideRequest(sql, { deviceId, status, note = '' }) {
  if (![REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED].includes(status)) {
    throw new Error('status 只能是 approved 或 rejected')
  }
  await sql`
    UPDATE access_requests
    SET status = ${status}, decided_at = now(), admin_note = ${String(note).slice(0, 200)}
    WHERE device_id = ${deviceId}`
}

/** 后台：把某条申请重置回待审 */
export async function resetRequest(sql, deviceId) {
  await sql`
    UPDATE access_requests
    SET status = 'pending', decided_at = NULL, admin_note = ''
    WHERE device_id = ${deviceId}`
}

// ---------- 管理员 ----------

const TOKEN_KEY = 'admin_token_hash'

export async function hashToken(token) {
  return sha256Hex(`kl8-admin|${String(token || '')}`)
}

async function readConfig(sql, key) {
  const rows = await sql`SELECT value FROM admin_config WHERE key = ${key}`
  return rows[0]?.value || null
}

async function writeConfig(sql, key, value) {
  await sql`
    INSERT INTO admin_config (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
}

/** 是否已设置管理员令牌 */
export async function hasAdminToken(sql) {
  return !!(await readConfig(sql, TOKEN_KEY))
}

/** 首次设置管理员令牌（只有未设置时才能用），并把当前设备加入管理员 */
export async function setupAdmin(sql, { token, deviceId, nickname }) {
  const t = String(token || '')
  if (t.length < 4) throw new Error('管理员令牌至少 4 位')
  if (await hasAdminToken(sql)) throw new Error('管理员令牌已设置，请直接用令牌登录')
  await writeConfig(sql, TOKEN_KEY, await hashToken(t))
  await sql`
    INSERT INTO admins (device_id, nickname) VALUES (${deviceId}, ${String(nickname || '管理员').slice(0, 20)})
    ON CONFLICT (device_id) DO UPDATE SET nickname = EXCLUDED.nickname`
}

/** 校验令牌；返回 { ok, reason } */
export async function verifyAdminToken(sql, token) {
  const stored = await readConfig(sql, TOKEN_KEY)
  if (!stored) return { ok: false, reason: 'not-setup' }
  const hash = await hashToken(token)
  return { ok: hash === stored, reason: hash === stored ? null : 'wrong' }
}

/** 令牌登录成功后把当前设备记为管理员（免重复输令牌） */
export async function addAdminDevice(sql, { deviceId, nickname }) {
  await sql`
    INSERT INTO admins (device_id, nickname) VALUES (${deviceId}, ${String(nickname || '管理员').slice(0, 20)})
    ON CONFLICT (device_id) DO UPDATE SET nickname = EXCLUDED.nickname`
}

export async function listAdmins(sql) {
  return sql`SELECT device_id, nickname, created_at FROM admins ORDER BY created_at`
}

export async function removeAdmin(sql, deviceId) {
  await sql`DELETE FROM admins WHERE device_id = ${deviceId}`
}

/** 后台概览：账本记录数（复用账本表） */
export async function countJournal(sql) {
  await ensureTable(sql)
  const rows = await sql`SELECT count(*)::int AS n FROM kl8_journal`
  return rows[0]?.n || 0
}

// ---------- 共享系统配置（大模型等，存 admin_config，所有人共用） ----------

const LLM_CONFIG_KEY = 'shared_llm_config'

/** 读取管理员统一配置的大模型参数；未配置返回 null */
export async function getSharedLlmConfig(sql) {
  const raw = await readConfig(sql, LLM_CONFIG_KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    return {
      llmBaseUrl: obj.llmBaseUrl || '',
      llmModel: obj.llmModel || '',
      llmKey: obj.llmKey || '',
    }
  } catch {
    return null
  }
}

/** 管理员保存共享大模型配置 */
export async function setSharedLlmConfig(sql, { llmBaseUrl, llmModel, llmKey }) {
  const payload = JSON.stringify({
    llmBaseUrl: String(llmBaseUrl || ''),
    llmModel: String(llmModel || ''),
    llmKey: String(llmKey || ''),
  })
  await writeConfig(sql, LLM_CONFIG_KEY, payload)
}

// ---------- 共享飞书配置（应用凭证 + 多维表格，存 admin_config，所有人共用） ----------

const LARK_CONFIG_KEY = 'shared_lark_config'

/** 读取管理员统一配置的飞书参数；未配置返回 null */
export async function getSharedLarkConfig(sql) {
  const raw = await readConfig(sql, LARK_CONFIG_KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    return {
      feishuAppId: obj.feishuAppId || '',
      feishuAppSecret: obj.feishuAppSecret || '',
      feishuAppToken: obj.feishuAppToken || '',
      feishuTableId: obj.feishuTableId || '',
    }
  } catch {
    return null
  }
}

/** 管理员保存共享飞书配置 */
export async function setSharedLarkConfig(sql, { feishuAppId, feishuAppSecret, feishuAppToken, feishuTableId }) {
  const payload = JSON.stringify({
    feishuAppId: String(feishuAppId || ''),
    feishuAppSecret: String(feishuAppSecret || ''),
    feishuAppToken: String(feishuAppToken || ''),
    feishuTableId: String(feishuTableId || ''),
  })
  await writeConfig(sql, LARK_CONFIG_KEY, payload)
}

// ---------- 每日推荐推送配置（服务端 Cron 读取） ----------
const PUSH_CONFIG_KEY = 'daily_push_config'

/** 读取每日推送配置；未配置返回 null */
export async function getDailyPushConfig(sql) {
  const raw = await readConfig(sql, PUSH_CONFIG_KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    return {
      webhook: obj.webhook || '',
      secret: obj.secret || '',
      kl8: obj.kl8 !== false,
      fc3d: obj.fc3d !== false,
      pl3: obj.pl3 !== false,
    }
  } catch {
    return null
  }
}

/** 保存每日推送配置 */
export async function setDailyPushConfig(sql, { webhook, secret, kl8, fc3d, pl3 }) {
  const payload = JSON.stringify({
    webhook: String(webhook || '').trim(),
    secret: String(secret || '').trim(),
    kl8: kl8 !== false,
    fc3d: fc3d !== false,
    pl3: pl3 !== false,
  })
  await writeConfig(sql, PUSH_CONFIG_KEY, payload)
}
