#!/usr/bin/env node
// ============================================================
// 本地同步脚本：把「研彩室」购彩账本写入飞书多维表格（Base）
//
// 数据来源（二选一）：
//   1) --file journal-export.json   在「购彩账本」页导出的 JSON
//   2) --neon postgres://...         Neon 云数据库（或设置环境变量 NEON_URL）
//
// 飞书凭证来源（环境变量或命令行参数，环境变量优先）：
//   LARK_APP_ID / LARK_APP_SECRET / LARK_APP_TOKEN / LARK_TABLE_ID
//
// 行为：按「日期」字段更新已有记录或新建；自动补齐缺失的表字段；
//       同步成功后把 同步时间 写回来源（JSON 文件或 Neon）。
//
// 用法示例（PowerShell，项目根目录）：
//   $env:LARK_APP_ID="cli_xxx"; $env:LARK_APP_SECRET="yyy"; $env:LARK_APP_TOKEN="zzz"; $env:LARK_TABLE_ID="tblxxx"; node scripts/sync-lark.mjs --file journal-export.json
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://open.feishu.cn/open-apis'

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    } else {
      args._.push(a)
    }
  }
  return args
}

const args = parseArgs(process.argv)
const env = process.env

const appId = args['app-id'] || env.LARK_APP_ID
const appSecret = args['app-secret'] || env.LARK_APP_SECRET
const appToken = args['app-token'] || env.LARK_APP_TOKEN
const tableId = args['table-id'] || env.LARK_TABLE_ID
const file = typeof args.file === 'string' ? args.file : null
const neonUrl = (typeof args.neon === 'string' ? args.neon : null) || env.NEON_URL || null

if (!appId || !appSecret || !appToken || !tableId) {
  console.error('缺少飞书凭证：请设置环境变量 LARK_APP_ID / LARK_APP_SECRET / LARK_APP_TOKEN / LARK_TABLE_ID，或用 --app-id 等参数传入。')
  process.exit(1)
}
if (!file && !neonUrl) {
  console.error('缺少数据来源：请用 --file journal-export.json 指定导出文件，或用 --neon <连接串> 从 Neon 拉取。')
  process.exit(1)
}

// ---------- 读取记录 ----------
async function loadRecords() {
  if (file) {
    // 去掉可能存在的 BOM（Windows 编辑器保存的 JSON 常带）
    const data = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    const records = Array.isArray(data) ? data : data.records
    if (!Array.isArray(records)) throw new Error(`${file} 格式不正确`)
    return { records: records.filter((r) => r && r.date), source: { kind: 'file', path: file, raw: data } }
  }
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(neonUrl)
  const rows = await sql`SELECT payload FROM kl8_journal ORDER BY date DESC`
  return {
    records: rows.map((r) => (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload)),
    source: { kind: 'neon', url: neonUrl },
  }
}

// ---------- 飞书 Open API ----------
async function getToken() {
  const res = await fetch(`${API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败：${data.code} ${data.msg}`)
  return data.tenant_access_token
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`飞书接口 ${path} 失败：${data.code} ${data.msg}`)
  }
  return data.data
}

/** 表字段定义（脚本会自动补齐缺失字段） */
const FIELD_DEFS = [
  { name: '日期', type: 1 },
  { name: '期号', type: 1 },
  { name: '是否购买', type: 1 },
  { name: '号码', type: 1 },
  { name: '花费', type: 2 },
  { name: '命中', type: 2 },
  { name: '奖金', type: 2 },
  { name: '备注', type: 1 },
  { name: 'AI分析', type: 1 },
  { name: '同步时间', type: 1 },
]

const recToFields = (r) => ({
  日期: r.date,
  期号: r.drawId == null ? '' : String(r.drawId),
  是否购买: r.bought ? '买了' : '没买',
  号码: (r.picks || []).map((n) => String(n).padStart(2, '0')).join(' '),
  花费: Number(r.spend || 0),
  命中: r.bought && r.hits != null ? Number(r.hits) : 0,
  奖金: Number(r.prize || 0),
  备注: r.note || '',
  AI分析: r.aiReport ? `${r.aiReport.text}\n\n（${r.aiReport.model} · ${new Date(r.aiReport.at).toLocaleString('zh-CN')}）` : '',
  同步时间: new Date().toISOString(),
})

async function ensureFields(token) {
  const data = await api(token, `/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`)
  const existing = new Set((data.items || []).map((f) => f.field_name))
  for (const def of FIELD_DEFS) {
    if (!existing.has(def.name)) {
      await api(token, `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        method: 'POST',
        body: JSON.stringify({ field_name: def.name, type: def.type }),
      })
      console.log(`  已创建缺失字段：${def.name}`)
    }
  }
}

async function listExisting(token) {
  const map = new Map()
  let pageToken = ''
  do {
    const q = pageToken ? `?page_size=100&page_token=${encodeURIComponent(pageToken)}` : '?page_size=100'
    const data = await api(token, `/bitable/v1/apps/${appToken}/tables/${tableId}/records${q}`)
    for (const item of data.items || []) {
      const date = item.fields?.['日期']
      if (typeof date === 'string') map.set(date, item.record_id)
    }
    pageToken = data.page_token || ''
  } while (pageToken)
  return map
}

const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

async function writeBack(records) {
  const stamp = new Date().toISOString()
  const stamped = records.map((r) => ({ ...r, synced: { ...(r.synced || {}), lark: stamp } }))
  if (source.kind === 'file') {
    const out = Array.isArray(source.raw) ? stamped : { ...source.raw, records: stamped }
    writeFileSync(source.path, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
    console.log(`已把同步时间写回 ${source.path}`)
  } else {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(source.url)
    for (const rec of stamped) {
      await sql`
        INSERT INTO kl8_journal (date, payload, updated_at)
        VALUES (${rec.date}, ${JSON.stringify(rec)}::jsonb, now())
        ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`
    }
    console.log(`已把同步时间写回 Neon（${stamped.length} 条）`)
  }
}

// ---------- 主流程 ----------
let source
let records
try {
  const loaded = await loadRecords()
  records = loaded.records
  source = loaded.source
} catch (e) {
  console.error(`读取记录失败：${e.message}`)
  process.exit(1)
}
if (!records.length) {
  console.log('没有需要同步的记录。')
  process.exit(0)
}

console.log(`待同步 ${records.length} 条记录（来源：${source.kind === 'file' ? source.path : 'Neon'}）`)

const token = await getToken()
await ensureFields(token)
const existing = await listExisting(token)

const toUpdate = []
const toCreate = []
for (const r of records) {
  const rid = existing.get(r.date)
  if (rid) toUpdate.push({ record_id: rid, fields: recToFields(r) })
  else toCreate.push({ fields: recToFields(r) })
}

for (const batch of chunk(toUpdate, 100)) {
  await api(token, `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`, {
    method: 'POST',
    body: JSON.stringify({ records: batch }),
  })
}
for (const batch of chunk(toCreate, 100)) {
  await api(token, `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
    method: 'POST',
    body: JSON.stringify({ records: batch }),
  })
}

console.log(`同步完成：更新 ${toUpdate.length} 条，新建 ${toCreate.length} 条。`)
await writeBack(records)
