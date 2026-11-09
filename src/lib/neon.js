// ============================================================
// Neon 云 Postgres —— 浏览器直连（@neondatabase/serverless，WebSocket）
// 表结构：kl8_journal(date text, lottery text, payload jsonb, updated_at)，
// 主键 (date, lottery)：同一天可以分别存快乐8 与 福彩3D 各一条。
// 连接串只来自本地设置，属于个人本地使用方式。
// ============================================================

import { neon } from '@neondatabase/serverless'

const sqlCache = new Map()

export function getSql(url) {
  if (!sqlCache.has(url)) sqlCache.set(url, neon(url))
  return sqlCache.get(url)
}

/** 记录所属彩种 */
function lotOf(rec) {
  return rec?.lottery === 'fc3d' ? 'fc3d' : 'kl8'
}

/** 建表（幂等）；老表自动补 lottery 列并把主键升级为 (date, lottery) */
export async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_journal (
      date text NOT NULL,
      lottery text NOT NULL DEFAULT 'kl8',
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (date, lottery)
    )`

  // 兼容早期只按 date 建主键的表
  const cols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'kl8_journal'`
  if (!cols.some((c) => c.column_name === 'lottery')) {
    await sql`ALTER TABLE kl8_journal ADD COLUMN lottery text NOT NULL DEFAULT 'kl8'`
  }
  const pk = await sql`
    SELECT a.attname FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'kl8_journal'::regclass AND i.indisprimary`
  const pkCols = pk.map((r) => r.attname)
  if (pkCols.length !== 2 || !pkCols.includes('date') || !pkCols.includes('lottery')) {
    await sql`ALTER TABLE kl8_journal DROP CONSTRAINT IF EXISTS kl8_journal_pkey`
    await sql`ALTER TABLE kl8_journal ADD PRIMARY KEY (date, lottery)`
  }
}

/** 测试连通性并确保表存在 */
export async function testConnection(url) {
  const sql = getSql(url)
  const rows = await sql`select 1 as ok`
  await ensureTable(sql)
  return rows[0]?.ok === 1
}

/** 按「日期 + 彩种」upsert 多条记录（整条 payload 覆盖写） */
export async function pushRecords(url, records) {
  if (!records?.length) return 0
  const sql = getSql(url)
  await ensureTable(sql)
  for (const rec of records) {
    await sql`
      INSERT INTO kl8_journal (date, lottery, payload, updated_at)
      VALUES (${rec.date}, ${lotOf(rec)}, ${JSON.stringify(rec)}::jsonb, now())
      ON CONFLICT (date, lottery) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`
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
