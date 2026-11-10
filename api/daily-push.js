// ============================================================
// 每日推荐推送 —— Vercel Cron（14:00 Asia/Shanghai = 06:00 UTC）
// 计算快乐8 / 福彩3D 下期参考号码，推送到飞书自定义机器人 Webhook。
//
// 配置来源（优先数据库）：
//   1) Neon admin_config 表 key = 'daily_push_config'
//      value = {"webhook":"https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
//               "secret":"（可选，机器人开启签名校验时必填）",
//               "kl8":true,"fc3d":true}
//   2) 环境变量 FEISHU_WEBHOOK_URL / FEISHU_WEBHOOK_SECRET
//
// 手动触发：GET /api/daily-push?test=1
// ============================================================
import crypto from 'node:crypto'
import { getSql, readConfig } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { scoreBalls, pickBalanced, BALL_MAX } from '../src/lib/stats.js'
import { predictFC3Dv2 } from '../src/lib/fc3dPredict.js'
import { applyCors } from './_lib/http.js'

const CONFIG_KEY = 'daily_push_config'

async function loadConfig() {
  let cfg = {}
  if (process.env.DATABASE_URL) {
    try {
      const sql = getSql()
      const raw = await readConfig(sql, CONFIG_KEY)
      if (raw) cfg = JSON.parse(raw) || {}
    } catch (e) {
      console.error('[daily-push] 读取推送配置失败：', e.message)
    }
  }
  return {
    webhook: cfg.webhook || process.env.FEISHU_WEBHOOK_URL || '',
    secret: cfg.secret || process.env.FEISHU_WEBHOOK_SECRET || '',
    kl8: cfg.kl8 !== false,
    fc3d: cfg.fc3d !== false,
  }
}

/** 快乐8：推荐页同款选十单式 + 三注分注参考 */
function buildKl8(draws) {
  const { scores } = scoreBalls(draws, { periods: 100, halfLife: 20, hotMode: 'mix' })
  const ranked = Array.from({ length: BALL_MAX }, (_, i) => i + 1)
    .map((n) => ({ n, score: scores[n] }))
    .sort((a, b) => b.score - a.score)
  const picks = pickBalanced(ranked, 10).map((x) => x.n).sort((a, b) => a - b)
  const groups = [0, 3, 6].map((off) =>
    pickBalanced(ranked.slice(off), 10).map((x) => x.n).sort((a, b) => a - b),
  )
  return { latest: draws[0], picks, groups }
}

const pad = (n) => String(n).padStart(2, '0')

function buildFc3d(draws) {
  const p = predictFC3Dv2(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

function buildElements(kl8, fc3d) {
  const els = []

  if (kl8) {
    els.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**快乐8** · 参考第 ${kl8.latest.id} 期之后\n` +
          `最新开奖：${kl8.latest.nums.map(pad).join(' ')}\n` +
          `推荐十码：**${kl8.picks.map(pad).join(' ')}**\n` +
          `分注参考：\n① ${kl8.groups[0].map(pad).join(' ')}\n② ${kl8.groups[1].map(pad).join(' ')}\n③ ${kl8.groups[2].map(pad).join(' ')}`,
      },
    })
  }

  if (fc3d) {
    const p = fc3d.pred
    const posText = ['百', '十', '个'].map((label, i) => `${label} ${p.posTop[i].join('/')}`).join(' · ')
    els.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**福彩3D** · 参考第 ${fc3d.latest.id} 期之后\n` +
          `最新开奖：${fc3d.latest.num.join(' ')}\n` +
          `位置推荐：${posText}\n` +
          `双胆：**${p.dan.join(' ')}**　拖码：${p.tuo.join(' ')}\n` +
          `和值：${p.sumRange[0]}~${p.sumRange[1]}　跨度：${p.spanRange[0]}~${p.spanRange[1]}\n` +
          `奇偶倾向：${p.recommendedOdd.slice(0, 2).join(' / ')}\n` +
          `参考杀号：${p.kill.map((k) => k.digit).join(' ')}`,
      },
    })
  }

  els.push({ tag: 'hr' })
  els.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: '开奖为独立随机事件，以上号码仅为历史数据整理，不构成任何投注建议。',
      },
    ],
  })
  return els
}

/** 飞书自定义机器人签名：以 "timestamp\\nsecret" 为密钥，对空串做 HMAC-SHA256 */
function feishuSign(secret, timestamp) {
  if (!secret) return {}
  const stringToSign = `${timestamp}\n${secret}`
  const sign = crypto.createHmac('sha256', stringToSign).update('').digest('base64')
  return { timestamp, sign }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  // 如果配置了 CRON_SECRET，则要求定时调用带 Bearer（前端手动测试走 POST，不受影响）
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.method === 'GET' && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const isTest = req.method === 'POST' || req.query?.test === '1'

  try {
    const cfg = await loadConfig()
    if (!cfg.webhook) {
      return res.status(400).json({
        error: '还没有配置飞书机器人 Webhook。请到「设置 → 每日推荐推送」里填写并保存。',
      })
    }

    // 并行走两边数据源，单个失败不影响另一个
    const [kl8Res, fc3dRes] = await Promise.allSettled([
      cfg.kl8 ? fetchKl8Draws(100) : Promise.resolve(null),
      cfg.fc3d ? fetchFc3dDraws(100) : Promise.resolve(null),
    ])

    const kl8 = kl8Res.status === 'fulfilled' && kl8Res.value ? buildKl8(kl8Res.value) : null
    const fc3d = fc3dRes.status === 'fulfilled' && fc3dRes.value ? buildFc3d(fc3dRes.value) : null

    if (!kl8 && !fc3d) {
      const errs = [kl8Res, fc3dRes]
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason?.message)
        .filter(Boolean)
      return res.status(502).json({ error: `开奖数据获取失败：${errs.join('；') || '未知原因'}` })
    }

    const now = new Date()
    const dateText = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
    }).format(now)

    const payload = {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: 'blue',
          title: {
            tag: 'plain_text',
            content: `${isTest ? '【测试】' : ''}每日推荐 · ${dateText}`,
          },
        },
        elements: buildElements(kl8, fc3d),
      },
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const body = { ...payload, ...feishuSign(cfg.secret, timestamp) }

    const r = await fetch(cfg.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || (data.code ?? 0) !== 0) {
      return res.status(502).json({
        error: `飞书推送失败：${data.msg || `HTTP ${r.status}`}${data.code ? `（${data.code}）` : ''}`,
      })
    }

    return res.status(200).json({
      ok: true,
      test: isTest,
      pushed: { kl8: !!kl8, fc3d: !!fc3d },
      skipped: {
        kl8: kl8Res.status === 'rejected' ? kl8Res.reason?.message : null,
        fc3d: fc3dRes.status === 'rejected' ? fc3dRes.reason?.message : null,
      },
    })
  } catch (e) {
    console.error('[daily-push]', e)
    return res.status(500).json({ error: e.message || '推送失败' })
  }
}
