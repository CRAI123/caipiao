// 端到端验证：用应用自身的 src/lib/neon.js（浏览器同款驱动与调用路径）打通 Neon Postgres
// 步骤：读 .env.local 的 DATABASE_URL → select 1 → 建表 → upsert 探针记录 → 读回 → 清理探针
import { readFileSync } from 'node:fs'
import { testConnection, pushRecords, pullRecords, getSql } from '../src/lib/neon.js'

function loadEnvLocal() {
  const text = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnvLocal()
const url = process.env.DATABASE_URL || env.DATABASE_URL
if (!url) {
  console.error('FAIL：.env.local 中未找到 DATABASE_URL（neon init/deploy 应已拉取）')
  process.exit(1)
}
const host = new URL(url).host
console.log(`目标 Neon 主机：${host}（连接串已脱敏）`)

const probe = {
  date: '__e2e_probe__',
  drawId: 0,
  bought: true,
  tickets: [[1, 2, 3]],
  picks: [1, 2, 3],
  play: 3,
  spend: 2,
  hits: 3,
  prize: 0,
  note: 'e2e probe',
  aiReport: null,
  synced: { neon: null, lark: null },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

try {
  // 1. 连通性 + 建表（应用设置页「测试连接并建表」同一函数）
  const ok = await testConnection(url)
  console.log(`1. select 1 + CREATE TABLE IF NOT EXISTS kl8_journal：${ok ? 'PASS' : 'FAIL'}`)
  if (!ok) process.exit(1)

  // 2. upsert（打卡保存 / AI 分析上传同一函数）
  const pushed = await pushRecords(url, [probe])
  console.log(`2. pushRecords upsert ${pushed} 条探针记录：PASS`)

  // 3. 读回（同步/拉取同一函数）
  const all = await pullRecords(url)
  const found = all.find((r) => r.date === '__e2e_probe__')
  const same = found && found.hits === 3 && found.picks.join(',') === '1,2,3'
  console.log(`3. pullRecords 读回探针（共 ${all.length} 条，字段一致）：${same ? 'PASS' : 'FAIL'}`)
  if (!same) process.exit(1)

  // 4. 清理探针
  const sql = getSql(url)
  await sql`DELETE FROM kl8_journal WHERE date = ${'__e2e_probe__'}`
  const left = await pullRecords(url)
  console.log(`4. 清理探针后剩余 ${left.length} 条：${left.some((r) => r.date === '__e2e_probe__') ? 'FAIL' : 'PASS'}`)

  console.log('\nneon-e2e OK：Neon Postgres 服务端到端可用')
} catch (e) {
  console.error(`FAIL：${e.message}`)
  process.exit(1)
}
