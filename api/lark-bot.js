// ============================================================
// POST /api/lark-bot —— 飞书自建应用机器人回调
//
// 用途：群里 @机器人 或单聊直接发关键词，机器人回当期算法 + AI 推荐卡片。
//   快乐8 / 3D / 排列三 / 双色球 / 全部 / 命中 / 帮助
//
// 配置存 Neon admin_config key = 'lark_bot_config'：
//   {"appId":"cli_xxx","appSecret":"xxx","token":"（事件订阅校验令牌，可选）",
//    "encryptKey":"（开启加密时填）","openIds":["ou_xxx"]}
// 也支持环境变量 LARK_APP_ID / LARK_APP_SECRET / LARK_VERIFICATION_TOKEN / LARK_ENCRYPT_KEY
// ============================================================
import crypto from 'node:crypto'
import { getSql, readConfig, writeConfig } from './_lib/neon.js'
import dailyPush from './daily-push.js'

export const config = { maxDuration: 60 }

const CONFIG_KEY = 'lark_bot_config'
const API = 'https://open.feishu.cn/open-apis'
// 同一实例内复用 tenant_access_token（有效期约 2 小时）
let tokenCache = { token: '', exp: 0 }
// 消息去重：飞书超时会重推同一条事件，避免重复回复
const seen = new Set()

async function loadConfig() {
  let cfg = {}
  if (process.env.DATABASE_URL) {
    try {
      const raw = await readConfig(getSql(), CONFIG_KEY)
      if (raw) cfg = JSON.parse(raw) || {}
    } catch (e) {
      console.error('[lark-bot] 读取配置失败：', e.message)
    }
  }
  return {
    appId: cfg.appId || process.env.LARK_APP_ID || '',
    appSecret: cfg.appSecret || process.env.LARK_APP_SECRET || '',
    token: cfg.token || process.env.LARK_VERIFICATION_TOKEN || '',
    encryptKey: cfg.encryptKey || process.env.LARK_ENCRYPT_KEY || '',
    openIds: Array.isArray(cfg.openIds) ? cfg.openIds : [],
  }
}

/** 飞书事件加密：AES-256-CBC，key = SHA256(encryptKey)，IV = 密文前 16 字节 */
function decrypt(encrypt, encryptKey) {
  const key = crypto.createHash('sha256').update(encryptKey).digest()
  const data = Buffer.from(encrypt, 'base64')
  const iv = data.subarray(0, 16)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  decipher.setAutoPadding(false)
  let out = Buffer.concat([decipher.update(data.subarray(16)), decipher.final()])
  const padLen = out[out.length - 1]
  if (padLen > 0 && padLen <= 16) out = out.subarray(0, out.length - padLen)
  return JSON.parse(out.toString('utf8'))
}

async function tenantToken(cfg) {
  if (tokenCache.token && tokenCache.exp > Date.now() + 60000) return tokenCache.token
  const r = await fetch(`${API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret }),
  })
  const d = await r.json().catch(() => ({}))
  if (d.code !== 0 || !d.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败：${d.msg || `HTTP ${r.status}`}${d.code ? `（${d.code}）` : ''}`)
  }
  tokenCache = { token: d.tenant_access_token, exp: Date.now() + (d.expire || 7200) * 1000 }
  return tokenCache.token
}

/** 发消息：msgType = 'interactive' 时 content 为卡片对象，'text' 时为 {text} */
async function send(cfg, chatId, msgType, content) {
  const token = await tenantToken(cfg)
  const r = await fetch(`${API}/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receive_id: chatId, msg_type: msgType, content: JSON.stringify(content) }),
  })
  const d = await r.json().catch(() => ({}))
  if (d.code !== 0) throw new Error(`发送失败：${d.msg || `HTTP ${r.status}`}${d.code ? `（${d.code}）` : ''}`)
  return d.data
}

/** 在本进程内调用每日推送的 dry 模式，拿到卡片 JSON（不发群） */
function dryCards(only) {
  return new Promise((resolve, reject) => {
    const query = { dry: '1' }
    if (only) query.only = only
    const headers = {}
    if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`
    const req = { method: 'GET', query, headers }
    const res = {
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
        resolve(o)
        return this
      },
      end() {},
    }
    Promise.resolve(dailyPush(req, res)).catch(reject)
  })
}

const HELP = [
  '我可以这样用（单聊直接发，群里 @我 再发）：',
  '· 快乐8 —— 推荐十码 + 算法 20 码 AI 终审',
  '· 3D / 排列三 —— 算法候选池 → AI 终选',
  '· 双色球 —— 结构评分推荐',
  '· 全部 —— 四个彩种一起发',
  '· 命中 —— 上期算法与 AI 各中几个',
].join('\n')

function hitText(hits) {
  const lines = []
  if (hits?.kl8) lines.push(`快乐8（第 ${hits.kl8.drawId} 期）：算法 ${hits.kl8.algo}/10 · AI ${hits.kl8.ai ?? '无记录'}/10`)
  for (const [game, name] of [
    ['fc3d', '福彩3D'],
    ['pl3', '排列三'],
  ]) {
    const h = hits?.[game]
    if (!h) continue
    const fmt = (x) => (x ? `${x.straight}/${x.group}/${x.group3}` : '无记录')
    lines.push(`${name}（第 ${h.drawId} 期 ${h.actual}，直选/组六/组三）：算法 ${fmt(h.algo)} · AI ${fmt(h.ai)}`)
  }
  if (hits?.ssq) lines.push(`双色球（第 ${hits.ssq.drawId} 期）：红球 ${hits.ssq.red}/6 · 蓝球 ${hits.ssq.blue ? '命中' : '未中'}`)
  return lines.length ? `上期命中\n${lines.join('\n')}` : '暂时没有上期命中记录'
}

/** 记住发过消息的用户，后续可做每日私聊推送 */
async function rememberOpenId(cfg, openId) {
  if (!openId || !process.env.DATABASE_URL || cfg.openIds.includes(openId)) return
  try {
    await writeConfig(getSql(), CONFIG_KEY, JSON.stringify({ ...cfg, openIds: [...cfg.openIds, openId] }))
  } catch (e) {
    console.error('[lark-bot] 记录 open_id 失败：', e.message)
  }
}

async function onMessage(cfg, event) {
  const msg = event?.message
  if (!msg || msg.message_type !== 'text') {
    await send(cfg, msg?.chat_id, 'text', { text: '目前只支持文字指令，发「帮助」看看能做什么。' })
    return
  }
  if (seen.has(msg.message_id)) return
  seen.add(msg.message_id)
  if (seen.size > 300) seen.clear()

  await rememberOpenId(cfg, event?.sender?.sender_id?.open_id)

  let text = ''
  try {
    text = JSON.parse(msg.content || '{}').text || ''
  } catch {
    text = ''
  }
  // 去掉 @ 占位符（@_user_1 / @_all）
  text = text.replace(/@_user_\d+/g, ' ').replace(/@_all/g, ' ').trim()
  const t = text.toLowerCase().replace(/\s+/g, '')

  try {
    if (!t || /帮助|菜单|help|怎么用/.test(t)) {
      await send(cfg, msg.chat_id, 'text', { text: HELP })
      return
    }
    if (/命中|中几|中奖|回测/.test(t)) {
      const data = await dryCards('')
      await send(cfg, msg.chat_id, 'text', { text: hitText(data.hits) })
      return
    }

    let only = ''
    if (/快乐8|快乐八|kl8|xuanshi|选十/.test(t)) only = 'kl8'
    else if (/排列三|排三|pl3|p3/.test(t)) only = 'pl3'
    else if (/3d|福彩3d|fc3d/.test(t)) only = 'fc3d'
    else if (/双色球|ssq|双色/.test(t)) only = 'ssq'
    else if (/全部|今天|推荐|all|都发/.test(t)) only = ''
    else {
      await send(cfg, msg.chat_id, 'text', { text: `没听懂「${text.slice(0, 20)}」。\n\n${HELP}` })
      return
    }

    const data = await dryCards(only)
    if (!data?.cards?.length) {
      await send(cfg, msg.chat_id, 'text', { text: '暂时取不到开奖数据，稍后再试。' })
      return
    }
    for (const payload of data.cards) {
      await send(cfg, msg.chat_id, 'interactive', payload.card)
    }
  } catch (e) {
    console.error('[lark-bot] 回复失败：', e.message)
    try {
      await send(cfg, msg.chat_id, 'text', { text: `出错：${e.message}` })
    } catch {
      /* 连文本都发不出去，只能记日志 */
    }
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  body = body || {}

  const cfg = await loadConfig()

  let data = body
  if (body.encrypt) {
    if (!cfg.encryptKey) return res.status(400).json({ error: '收到加密事件，但未配置 Encrypt Key' })
    try {
      data = decrypt(body.encrypt, cfg.encryptKey)
    } catch (e) {
      console.error('[lark-bot] 解密失败：', e.message)
      return res.status(400).json({ error: '解密失败' })
    }
  }

  // 配置回调地址时飞书的 URL 校验
  if (data.type === 'url_verification') {
    if (cfg.token && data.token && data.token !== cfg.token) {
      return res.status(401).json({ error: 'verification token 不匹配' })
    }
    return res.status(200).json({ challenge: data.challenge })
  }

  const header = data.header || {}
  if (cfg.token && header.token && header.token !== cfg.token) {
    return res.status(403).json({ error: 'verification token 不匹配' })
  }

  // 飞书要求 3 秒内响应，先回 200 再处理（AI 未命中缓存时会比较慢）
  res.status(200).json({ code: 0 })

  if (header.event_type === 'im.message.receive_v1') {
    await onMessage(cfg, data.event).catch((e) => console.error('[lark-bot] 处理消息异常：', e))
  }
}
