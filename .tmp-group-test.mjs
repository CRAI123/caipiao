import { getSql, readConfig } from './api/_lib/neon.js'
import dailyPush from './api/daily-push.js'

const API = 'https://open.feishu.cn/open-apis'
const ROUNDS = Number(process.env.ROUNDS || 3)

function fakeRes() {
  const box = {}
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v
    },
    getHeader(k) {
      return this.headers[String(k).toLowerCase()]
    },
    status(c) {
      this.statusCode = c
      return this
    },
    json(o) {
      box.body = o
      return this
    },
    end() {},
    box,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const sql = getSql()
  const cfg = JSON.parse((await readConfig(sql, 'lark_bot_config')) || '{}')
  const chatIds = cfg.chatIds || []
  console.log('chatIds =', JSON.stringify(chatIds), 'openIds =', JSON.stringify(cfg.openIds || []))
  if (!chatIds.length) {
    console.log('NO_GROUP：机器人还没收到过群消息')
    return
  }

  const tr = await fetch(`${API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret }),
  })
  const td = await tr.json()
  if (td.code !== 0) throw new Error(`token 失败：${td.msg}`)
  const token = td.tenant_access_token

  const chatId = chatIds[0]
  for (let round = 1; round <= ROUNDS; round++) {
    const res = fakeRes()
    const t0 = Date.now()
    await dailyPush({ method: 'GET', query: { dry: '1' }, headers: {} }, res)
    const cards = res.box.body?.cards || []
    console.log(`round ${round}: 生成 ${cards.length} 张卡，用时 ${Date.now() - t0}ms`)
    let ok = 0
    for (const payload of cards) {
      const r = await fetch(`${API}/im/v1/messages?receive_id_type=chat_id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(payload.card) }),
      })
      const d = await r.json()
      if (d.code === 0) ok++
      else console.log(`  ${payload.card?.header?.title?.content} => code=${d.code} ${d.msg}`)
    }
    console.log(`round ${round}: 成功 ${ok}/${cards.length}`)
    if (round < ROUNDS) await sleep(2000)
  }
}

main().catch((e) => {
  console.error('FAILED', e.message)
  process.exit(1)
})
