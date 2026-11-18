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
  // AI 深度分析：同一期同一玩法只允许首位用户触发，结果全站共享
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_ai_deep_runs (
      draw_id integer NOT NULL,
      play integer NOT NULL DEFAULT 10,
      status text NOT NULL DEFAULT 'running',
      device_id text,
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (draw_id, play)
    )`
  // 3D / 排列三 AI 解读：同一期同一彩种只允许首位用户触发，结果全站共享
  await sql`
    CREATE TABLE IF NOT EXISTS digit_ai_runs (
      game text NOT NULL,
      draw_id integer NOT NULL,
      status text NOT NULL DEFAULT 'running',
      device_id text,
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game, draw_id)
    )`
  // ── AI 自主学习体系 ──
  // 学习状态：各彩种当前权重（模型/温度/混合比/专家权重），写者唯一=daily-push
  await sql`
    CREATE TABLE IF NOT EXISTS learning_state (
      game text NOT NULL,
      param_key text NOT NULL,
      value jsonb NOT NULL,
      version integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game, param_key)
    )`
  // 预测-命中记录：每期每来源的 picks，开奖后回填命中与损失（学习中心曲线数据源）
  await sql`
    CREATE TABLE IF NOT EXISTS learning_predictions (
      game text NOT NULL,
      draw_id integer NOT NULL,
      source text NOT NULL,
      picks jsonb NOT NULL,
      meta jsonb,
      scored boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game, draw_id, source)
    )`
  await sql`
    CREATE INDEX IF NOT EXISTS lp_scored_idx
      ON learning_predictions (game, scored, draw_id DESC)`
  // AI 经验笔记：自我复盘产物，注入后续分析 prompt，每彩种最多 12 条 active
  await sql`
    CREATE TABLE IF NOT EXISTS ai_experience_notes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      game text NOT NULL,
      content text NOT NULL,
      meta jsonb,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`
    CREATE INDEX IF NOT EXISTS aen_active_idx
      ON ai_experience_notes (game, active, created_at DESC)`
  // 权重演化历史：每期打分后各参数族新状态的按天快照（学习中心近60天曲线数据源）
  await sql`
    CREATE TABLE IF NOT EXISTS learning_history (
      game text NOT NULL,
      param_key text NOT NULL,
      day date NOT NULL,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game, param_key, day)
    )`
  // 共享配置表：服务端也要保证存在（周复盘门控时间戳依赖；DDL 与前端 access.js 一致）
  await sql`
    CREATE TABLE IF NOT EXISTS admin_config (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
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
