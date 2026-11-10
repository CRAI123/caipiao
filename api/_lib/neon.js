// 服务端 Neon 连接（Vercel Serverless Functions）
// 连接串来自环境变量 DATABASE_URL（Vercel 项目设置里配置）
import { neon } from '@neondatabase/serverless'

let _sql = null
export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL 环境变量未设置')
    _sql = neon(url)
  }
  return _sql
}

/** 建表（幂等）—— 账本、预测、每日复盘 */
export async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_journal (
      date text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_predictions (
      draw_id integer PRIMARY KEY,
      play integer NOT NULL DEFAULT 10,
      mode text NOT NULL DEFAULT 'mix',
      picks jsonb NOT NULL,
      dans jsonb DEFAULT '[]'::jsonb,
      tuos jsonb DEFAULT '[]'::jsonb,
      ai_picks jsonb DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_daily_reviews (
      date text PRIMARY KEY,
      draw_id integer NOT NULL,
      predicted jsonb,
      actual jsonb,
      hits integer NOT NULL DEFAULT 0,
      won boolean NOT NULL DEFAULT false,
      prize numeric NOT NULL DEFAULT 0,
      ai_summary text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
}

/** 读取 admin_config 表的共享配置 */
export async function readConfig(sql, key) {
  const rows = await sql`SELECT value FROM admin_config WHERE key = ${key}`
  return rows[0]?.value || null
}

/** 写入 admin_config 表的共享配置（不存在则插入） */
export async function writeConfig(sql, key, value) {
  await sql`
    INSERT INTO admin_config (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
}
