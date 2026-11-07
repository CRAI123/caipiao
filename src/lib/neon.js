// ============================================================
// Neon 云 Postgres —— 浏览器直连（@neondatabase/serverless，WebSocket）
// 表结构：kl8_journal(date text 主键, payload jsonb, updated_at)
// 连接串只来自本地设置，属于个人本地使用方式。
// ============================================================

import { neon } from '@neondatabase/serverless'

const sqlCache = new Map()

export function getSql(url) {
  if (!sqlCache.has(url)) sqlCache.set(url, neon(url))
  return sqlCache.get(url)
}

/** 建表（幂等） */
export async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_journal (
      date text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
}

/** 测试连通性并确保表存在 */
export async function testConnection(url) {
  const sql = getSql(url)
  const rows = await sql`select 1 as ok`
  await ensureTable(sql)
  return rows[0]?.ok === 1
}

/** 按日期 upsert 多条记录（整条 payload 覆盖写） */
export async function pushRecords(url, records) {
  if (!records?.length) return 0
  const sql = getSql(url)
  await ensureTable(sql)
  for (const rec of records) {
    await sql`
      INSERT INTO kl8_journal (date, payload, updated_at)
      VALUES (${rec.date}, ${JSON.stringify(rec)}::jsonb, now())
      ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`
  }
  return records.length
}

/** 拉取全部记录，按日期倒序 */
export async function pullRecords(url) {
  const sql = getSql(url)
  await ensureTable(sql)
  const rows = await sql`SELECT payload FROM kl8_journal ORDER BY date DESC`
  return rows.map((r) => (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload))
}
