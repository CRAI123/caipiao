// 飞书自定义机器人：签名 + 发卡片（夜间学习报告等内部通知共用）
import crypto from 'node:crypto'
import { readConfig } from './neon.js'

/** 飞书自定义机器人签名：以 "timestamp\nsecret" 为密钥，对空串做 HMAC-SHA256 */
export function feishuSign(secret, timestamp) {
  if (!secret) return {}
  const stringToSign = `${timestamp}\n${secret}`
  const sign = crypto.createHmac('sha256', stringToSign).update('').digest('base64')
  return { timestamp, sign }
}

/** 读取推送目标：优先 admin_config 的 daily_push_config，其次环境变量（与每日推荐共用同一个机器人） */
export async function loadFeishuTarget(sql) {
  let cfg = {}
  if (sql) {
    try {
      const raw = await readConfig(sql, 'daily_push_config')
      if (raw) cfg = JSON.parse(raw) || {}
    } catch (e) {
      console.error('[feishu] 读取推送配置失败：', e?.message || e)
    }
  }
  return {
    webhook: cfg.webhook || process.env.FEISHU_WEBHOOK_URL || '',
    secret: cfg.secret || process.env.FEISHU_WEBHOOK_SECRET || '',
  }
}

/** 发送一张交互卡片，返回 { ok, sentAt?, error? }，绝不 throw */
export async function sendFeishuCard({ webhook, secret }, payload) {
  if (!webhook) return { ok: false, error: '未配置飞书 Webhook' }
  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...feishuSign(secret, timestamp) }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || (data.code ?? 0) !== 0) {
      return { ok: false, error: data.msg || `HTTP ${r.status}` }
    }
    return { ok: true, sentAt: new Date().toISOString() }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
