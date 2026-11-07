// 自测：账本统计 + AI prompt 组装 + 设备识别码哈希（node scripts/selftest.mjs）
import assert from 'node:assert/strict'
import { hashId, sha256Hex } from '../src/lib/device.js'
import {
  parseTickets,
  formatTickets,
  autoHits,
  perTicketHits,
  normalizeRecord,
  journalStats,
  hitTheory,
  exportJson,
  importJson,
  upsertRecord,
  removeRecord,
} from '../src/lib/journal.js'
import { buildMessages, AI_SYSTEM_PROMPT } from '../src/lib/ai.js'

// 0. 设备识别码哈希（纯函数部分）
assert.equal(hashId('abc'), hashId('abc')) // 确定性
assert.match(hashId('abc'), /^[0-9a-f]{8}$/)
assert.notEqual(hashId('abc'), hashId('abd'))
assert.equal((await sha256Hex('x')).length, 64) // SHA-256 十六进制
assert.match(await sha256Hex('x'), /^[0-9a-f]{64}$/)

const draw = {
  id: 2026296,
  date: '2026-11-06',
  nums: [1, 5, 12, 23, 34, 45, 56, 67, 78, 2, 8, 15, 21, 33, 44, 55, 66, 77, 3, 9],
}

// 1. 票面解析
const tickets = parseTickets('01 05 12 23 34 45 56 67 78 80\n02,08,15,21,33,44,55,66,77,79')
assert.equal(tickets.length, 2)
assert.deepEqual(tickets[0], [1, 5, 12, 23, 34, 45, 56, 67, 78, 80])
assert.equal(parseTickets('80 81 0').length, 1) // 80 合法，81/0 被过滤
assert.equal(parseTickets('').length, 0)
assert.equal(formatTickets(tickets).split('\n').length, 2)

// 2. 命中自动计算：票1 中 1,5,12,23,34,45,56,67,78 → 9 个；票2 中 2,8,15,21,33,44,55,66,77 → 9 个
assert.equal(autoHits(tickets, draw), 9)
assert.deepEqual(perTicketHits(tickets, draw), [9, 9])
assert.equal(autoHits([[80]], draw), 0)

// 3. 记录规范化：默认 hits 取自动值；没买时花费/命中/奖金归零
const rec = normalizeRecord(
  { date: '2026-11-06', drawId: draw.id, bought: true, tickets, spend: '4', hits: '', prize: '0', note: '测试' },
  draw,
)
assert.equal(rec.hits, 9)
assert.equal(rec.spend, 4)
assert.equal(rec.play, 10)
assert.equal(rec.picks.length, 20) // 两注共 20 个不重复号码
const noBuy = normalizeRecord(
  { date: '2026-11-07', drawId: 2026297, bought: false, tickets: [], spend: '4', hits: '3', prize: '10', note: '' },
  draw,
)
assert.equal(noBuy.spend, 0)
assert.equal(noBuy.hits, null)
assert.equal(noBuy.prize, 0)

// 4. 统计聚合
let list = [rec, noBuy]
const rec2 = normalizeRecord(
  { date: '2026-11-05', drawId: 2026295, bought: true, tickets: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], spend: 2, hits: '', prize: 4.6, note: '' },
  { ...draw, date: '2026-11-05', id: 2026295 },
)
list = upsertRecord(list, rec2)
list = upsertRecord(list, rec) // 重复 date 应覆盖而不是新增
assert.equal(list.length, 3)
assert.equal(list[0].date, '2026-11-07') // 倒序
const stats = journalStats(list)
assert.equal(stats.days, 3)
assert.equal(stats.boughtDays, 2)
assert.equal(stats.noBuyDays, 1)
assert.equal(stats.spend, 6)
assert.equal(stats.prize, 4.6)
assert.ok(Math.abs(stats.net - -1.4) < 1e-9)
assert.ok(Math.abs(stats.roi - 4.6 / 6) < 1e-9)
assert.deepEqual(stats.best, { date: '2026-11-05', prize: 4.6 })
// 命中分布：实际 {9:1, 10:1}（11-05 那注中 1..10 → 开奖号含 1,2,3,5,8,9,12,15,21,23 → 6 个）
assert.equal(stats.hitRows.find((r) => r.k === 9).actual, 1)
assert.equal(stats.hitRows.find((r) => r.k === 6).actual, 1)
// 理论期望：两期选十，中 0 个的期望 = 2 * P0
const p0 = hitTheory(10).find((t) => t.k === 0).prob
assert.ok(Math.abs(stats.hitRows[0].expected - 2 * p0) < 0.01) // expected 保留 2 位小数

// 5. 理论分布归一
for (const play of [1, 5, 10]) {
  const sum = hitTheory(play).reduce((s, t) => s + t.prob, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, `选${play}概率和应为 1`)
}

// 6. 导出 / 导入 round-trip
const round = importJson(exportJson(list))
assert.equal(round.length, 3)
assert.equal(round[0].date, '2026-11-07')

// 7. AI prompt 组装：系统提示词写死边界，用户内容含真实统计
const messages = buildMessages({ stats, records: list, latestDraw: draw })
assert.equal(messages.length, 2)
assert.equal(messages[0].role, 'system')
assert.match(AI_SYSTEM_PROMPT, /不得预测/)
assert.match(AI_SYSTEM_PROMPT, /回报率/)
assert.match(AI_SYSTEM_PROMPT, /规律/)
const user = messages[1].content
assert.match(user, /累计投入：6 元/)
assert.match(user, /回报率：76\.67%/)
assert.match(user, /2026-11-06/)
assert.match(user, /未购买/)

// 8. 删除
assert.equal(removeRecord(list, '2026-11-07').length, 2)

console.log('selftest OK：9 组断言全部通过')
