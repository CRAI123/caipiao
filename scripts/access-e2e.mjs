// 端到端验证：访问申请 / 审核 / 管理员（走应用自身的 src/lib/access.js 同一代码路径）
// 注意：会临时改动 admin_config 的管理员令牌哈希，结束后恢复原值（未设置则删回未设置状态）。
import { readFileSync } from 'node:fs'
import { getSql } from '../src/lib/neon.js'
import {
  ensureAccessTables,
  fetchMyRequest,
  submitRequest,
  listRequests,
  decideRequest,
  resetRequest,
  hasAdminToken,
  setupAdmin,
  verifyAdminToken,
  addAdminDevice,
  listAdmins,
  removeAdmin,
  countJournal,
} from '../src/lib/access.js'

function loadEnvLocal() {
  const text = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const url = process.env.DATABASE_URL || loadEnvLocal().DATABASE_URL
if (!url) {
  console.error('FAIL：.env.local 中未找到 DATABASE_URL')
  process.exit(1)
}
console.log(`目标 Neon 主机：${new URL(url).host}（连接串已脱敏）`)

const sql = getSql(url)
const DEV = 'KL8-e2e-0001-dev'
const ADMIN_DEV = 'KL8-e2e-0002-dev'
const PROBE_TOKEN = 'e2e-probe-token-1234'

const results = []
function check(name, ok, extra = '') {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}：${name}${extra ? `（${extra}）` : ''}`)
  if (!ok) process.exitCode = 1
}

async function cleanup() {
  await sql`DELETE FROM access_requests WHERE device_id LIKE ${'KL8-e2e-%'}`
  await sql`DELETE FROM admins WHERE device_id LIKE ${'KL8-e2e-%'}`
}

try {
  // 0. 建表 + 记录管理员令牌初始状态（用于恢复）
  await ensureAccessTables(sql)
  const tokenExisted = await hasAdminToken(sql)
  const originalHash = tokenExisted
    ? (await sql`SELECT value FROM admin_config WHERE key = ${'admin_token_hash'}`)[0]?.value
    : null
  console.log(`初始状态：管理员令牌${tokenExisted ? '已设置' : '未设置'}`)

  // 1. 首次设置管理员令牌（仅在未设置时走真实路径；已设置则只验证错误令牌）
  if (!tokenExisted) {
    await setupAdmin(sql, { token: PROBE_TOKEN, deviceId: ADMIN_DEV, nickname: 'E2E管理员' })
    const okTrue = (await verifyAdminToken(sql, PROBE_TOKEN)).ok
    const okFalse = (await verifyAdminToken(sql, 'wrong-token')).ok
    check('setupAdmin + verifyAdminToken（正确令牌通过/错误令牌拒绝）', okTrue && !okFalse)
    check('setupAdmin 后本设备进入 admins 表', (await listAdmins(sql)).some((a) => a.device_id === ADMIN_DEV))
    // 恢复「未设置」状态，留给使用者在 UI 里设置自己的令牌
    await sql`DELETE FROM admin_config WHERE key = ${'admin_token_hash'}`
    check('清理后恢复为未设置令牌', !(await hasAdminToken(sql)))
  } else {
    const wrong = await verifyAdminToken(sql, 'definitely-wrong-token')
    check('verifyAdminToken 拒绝错误令牌', !wrong.ok)
    console.log('（已存在真实管理员令牌，跳过设置路径，保持原值不变）')
  }

  // 2. 提交申请（新用户）
  const req = await submitRequest(sql, { deviceId: DEV, nickname: '测试用户甲' })
  check('submitRequest 创建待审申请', req.status === 'pending' && req.nickname === '测试用户甲')

  // 3. 列表可见
  check('listRequests 能看到该申请', (await listRequests(sql)).some((r) => r.device_id === DEV))

  // 4. 审核：同意
  await decideRequest(sql, { deviceId: DEV, status: 'approved', note: '同意，自己人' })
  const approved = await fetchMyRequest(sql, DEV)
  check('decideRequest 同意 → 状态/备注/审核时间', approved.status === 'approved' && approved.admin_note === '同意，自己人' && !!approved.decided_at)

  // 5. 审核：拒绝
  await decideRequest(sql, { deviceId: DEV, status: 'rejected', note: '名额已满' })
  const rejected = await fetchMyRequest(sql, DEV)
  check('decideRequest 拒绝 → 状态/备注', rejected.status === 'rejected' && rejected.admin_note === '名额已满')

  // 6. 被拒后重新申请 → 回到 pending 且备注清空
  const reapplied = await submitRequest(sql, { deviceId: DEV, nickname: '测试用户甲改' })
  check('被拒后重新申请 → pending 且昵称更新', reapplied.status === 'pending' && reapplied.nickname === '测试用户甲改' && reapplied.admin_note === '')

  // 7. 重置为待审
  await resetRequest(sql, DEV)
  check('resetRequest → pending', (await fetchMyRequest(sql, DEV)).status === 'pending')

  // 8. 管理员设备增删
  await addAdminDevice(sql, { deviceId: ADMIN_DEV, nickname: 'E2E管理员' })
  check('addAdminDevice', (await listAdmins(sql)).some((a) => a.device_id === ADMIN_DEV))
  await removeAdmin(sql, ADMIN_DEV)
  check('removeAdmin', !(await listAdmins(sql)).some((a) => a.device_id === ADMIN_DEV))

  // 9. 账本计数（确保 journal 表存在）
  const n = await countJournal(sql)
  check('countJournal 返回数字', Number.isInteger(n), `当前 ${n} 条`)

  // 10. 清理探针 + 恢复令牌原值
  await cleanup()
  if (originalHash) {
    await sql`
      INSERT INTO admin_config (key, value, updated_at) VALUES (${'admin_token_hash'}, ${originalHash}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
  }
  const left = (await listRequests(sql)).filter((r) => r.device_id.startsWith('KL8-e2e-'))
  check('清理探针记录', left.length === 0)
  check('管理员令牌状态复原', (await hasAdminToken(sql)) === tokenExisted)

  console.log(`\naccess-e2e ${process.exitCode ? '存在失败项' : 'OK'}：访问控制全链路可用`)
} catch (e) {
  await cleanup().catch(() => {})
  console.error(`FAIL：${e.message}`)
  process.exit(1)
}
