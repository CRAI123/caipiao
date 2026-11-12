// ============================================================
// 每日推荐推送 —— Vercel Cron（14:00 Asia/Shanghai = 06:00 UTC）
// 计算快乐8 / 福彩3D / 排列三 / 双色球 下期参考号码，推送到飞书自定义机器人 Webhook。
// 每个彩种都走站内当前最强算法，卡片标题里标明档位：排列三 = v3 Pro（9 专家 Hedge 权重 + 结构约束）。
//
// 配置来源（优先数据库）：
//   1) Neon admin_config 表 key = 'daily_push_config'
//      value = {"webhook":"https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
//               "secret":"（可选，机器人开启签名校验时必填）",
//               "kl8":true,"fc3d":true,"pl3":true,"ssq":true}
//   2) 环境变量 FEISHU_WEBHOOK_URL / FEISHU_WEBHOOK_SECRET
//
// 手动触发：GET /api/daily-push?test=1
// ============================================================
import crypto from 'node:crypto'
import { getSql, readConfig, writeConfig } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchSsqDraws } from './_lib/ssq.js'
import { scoreBalls, pickBalanced, BALL_MAX } from '../src/lib/stats.js'
import { predictFC3Dv2 } from '../src/lib/fc3dPredict.js'
import { predictPL3Pro } from '../src/lib/pl3Predict.js'
import { predictSSQ } from '../src/lib/ssqPredict.js'
import { applyCors } from './_lib/http.js'

const CONFIG_KEY = 'daily_push_config'
const STATUS_KEY = 'daily_push_last'
const FRESH_RETRY_MS = 1500

/** 北京时间日期（YYYY-MM-DD） */
const shDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d)

/**
 * 判断数据是否够新。
 * 快乐8 / 3D / 排列三 每天开一期，14:00 推送时最新一期应当是「昨天」（maxAgeDays=1）；
 * 双色球每周二、四、日开奖，14:00 推送时最新一期最多是 3 天前，所以放宽到 4 天。
 * state='stale' 表示数据源还没更新，卡片顶部会亮红字提醒。
 */
function freshness(latest, maxAgeDays = 1) {
  const expected = shDate(new Date(Date.now() - 86400000 * maxAgeDays))
  const date = latest?.date || null
  if (!date) return { state: 'unknown', expected, date: null, id: latest?.id ?? null }
  return {
    state: date >= expected ? 'ok' : 'stale',
    expected,
    date,
    id: latest?.id ?? null,
  }
}

const staleWarning = (f, name) =>
  f && f.state === 'stale'
    ? line(
        `<font color='red'>⚠️ ${name}数据源还没更新：最新只到 ${f.date}（第 ${f.id} 期），本期推荐基于旧数据，稍后可手动重发</font>`,
      )
    : null

/** 记录最近一次推送结果，供设置页查看（失败也能看到，不会被静默吞掉） */
async function savePushStatus(status) {
  if (!process.env.DATABASE_URL) return
  try {
    await writeConfig(getSql(), STATUS_KEY, JSON.stringify(status))
  } catch (e) {
    console.error('[daily-push] 记录推送状态失败：', e.message)
  }
}

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
    pl3: cfg.pl3 !== false,
    ssq: cfg.ssq !== false,
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

/** 排列三：v3 Pro 档（9 专家 Hedge 自适应权重 + 六维结构约束），站内概率最高的一档 */
function buildPl3(draws) {
  const p = predictPL3Pro(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

/** 双色球：红球结构评分枚举 + 蓝球周期/振荡评分 */
function buildSsq(draws) {
  const p = predictSSQ(draws)
  if (!p) return null
  return { latest: draws[0], pred: p }
}

const DISCLAIMER = {
  tag: 'note',
  elements: [
    {
      tag: 'plain_text',
      content: '开奖为独立随机事件，以上号码仅为历史数据整理，不构成任何投注建议。',
    },
  ],
}

const red = (s) => `<font color='red'>${s}</font>`
const grey = (s) => `<font color='grey'>${s}</font>`

/** 飞书卡片：一个彩种一张卡 */
function buildCard({ title, template, blocks, warning }) {
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: { template, title: { tag: 'plain_text', content: title } },
      elements: [...(warning ? [warning, HR] : []), ...blocks, { tag: 'hr' }, DISCLAIMER],
    },
  }
}

/** 一行文本（手机端按单列渲染最稳，不要用 fields 并排） */
const line = (content) => ({ tag: 'div', text: { tag: 'lark_md', content } })

const HR = { tag: 'hr' }

function buildKl8Card(kl8, title, warning) {
  const picks = kl8.picks.map(pad).join(' ')
  return buildCard({
    title,
    template: 'blue',
    warning,
    blocks: [
      line(`上期开奖：${grey(kl8.latest.nums.map(pad).join(' '))}`),
      HR,
      line(`**推荐十码**\n<font color='red'>${picks}</font>`),
      HR,
      line('**三注参考**'),
      line(`① ${kl8.groups[0].map(pad).join(' ')}`),
      line(`② ${kl8.groups[1].map(pad).join(' ')}`),
      line(`③ ${kl8.groups[2].map(pad).join(' ')}`),
    ],
  })
}

function buildFc3dCard(digit, title, { template = 'red', extra = [], warning = null } = {}) {
  const p = digit.pred
  const [bai, shi, ge] = p.posTop
  const bets = bai.length * shi.length * ge.length
  return buildCard({
    title,
    template,
    warning,
    blocks: [
      line(`上期开奖：${grey(digit.latest.num.join(' '))}`),
      HR,
      line(`**直选复式** ${bets} 注 · ${bets * 2} 元`),
      line(`百　${red(bai.join('/'))}`),
      line(`十　${red(shi.join('/'))}`),
      line(`个　${red(ge.join('/'))}`),
      HR,
      line(`**双胆** ${red(p.dan.join('/'))}　**拖码** ${p.tuo.join('/')}`),
      HR,
      line(`和值 ${p.sumRange[0]}~${p.sumRange[1]}　跨度 ${p.spanRange[0]}~${p.spanRange[1]}`),
      line(`杀号 ${grey(p.kill.map((k) => k.digit).join('/'))}`),
      ...extra,
    ],
  })
}

/** 排列三卡：在 3D 版式上补一行覆盖档位（命中与成本） */
function buildPl3Card(pl3, title, warning) {
  const tiers = pl3.pred.tiers || []
  const extra = [
    ...(tiers.length
      ? [
          HR,
          line(
            `**覆盖档位** 期望命中 ${tiers
              .map((t) => `${t.cover}码 ${t.expectHits}个/${t.groupCost}元`)
              .join('　')}`,
          ),
        ]
      : []),
    line(grey('算法 v3 Pro · 9 专家 Hedge 自适应权重 + 六维结构约束')),
  ]
  return buildFc3dCard(pl3, title, { template: 'orange', extra, warning })
}

/** 双色球卡：绿头，6 红 + 1 蓝 + 结构 + 覆盖档位 */
function buildSsqCard(ssq, title, warning) {
  const p = ssq.pred
  const s = p.structure
  const tiers = p.tiers || []
  return buildCard({
    title,
    template: 'green',
    warning,
    blocks: [
      line(
        `上期开奖：红 ${grey(ssq.latest.red.map(pad).join(' '))}　蓝 ${grey(pad(ssq.latest.blue))}`,
      ),
      HR,
      line(`**推荐 6 红**\n<font color='red'>${p.red.map(pad).join(' ')}</font>`),
      line(
        `**推荐蓝球** <font color='red'>${pad(p.blue)}</font>　备选 ${p.blueBackups
          .map(pad)
          .join(' ')}`,
      ),
      HR,
      line(
        `和值 ${s.sum}　跨度 ${s.span}　三区 ${s.zone3.join(':')}　大小 ${s.big}:${s.small}　奇偶 ${s.odd}:${s.even}`,
      ),
      line(`杀红 ${grey(p.kill.map(pad).join(' '))}`),
      HR,
      line(
        `**覆盖档位** ${tiers
          .map((t) => `${t.cover}码 ${t.expectHits}个/${t.cost}元`)
          .join('　')}`,
      ),
    ],
  })
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

  // 设置页查看「最近一次推送」状态（只返回结果，不暴露 webhook，任何 GET 都能读）
  if (req.method === 'GET' && req.query?.status === '1') {
    let last = null
    if (process.env.DATABASE_URL) {
      try {
        const raw = await readConfig(getSql(), STATUS_KEY)
        if (raw) last = JSON.parse(raw)
      } catch (e) {
        console.error('[daily-push] 读取推送状态失败：', e.message)
      }
    }
    return res.status(200).json({ last })
  }

  // 如果配置了 CRON_SECRET，则要求定时调用带 Bearer（前端手动测试走 POST，不受影响）
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.method === 'GET' && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const isTest = req.method === 'POST' || req.query?.test === '1'

  try {
    const cfg = await loadConfig()
    if (!cfg.webhook) {
      await savePushStatus({ at: new Date().toISOString(), ok: false, error: '未配置飞书 Webhook' })
      return res.status(400).json({
        error: '还没有配置飞书机器人 Webhook。请到「设置 → 每日推荐推送」里填写并保存。',
      })
    }

    // 并行走四个数据源，单个失败不影响其它
    let [kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.allSettled([
      cfg.kl8 ? fetchKl8Draws(100) : Promise.resolve(null),
      cfg.fc3d ? fetchFc3dDraws(100) : Promise.resolve(null),
      cfg.pl3 ? fetchPl3Draws(100) : Promise.resolve(null),
      cfg.ssq ? fetchSsqDraws(100) : Promise.resolve(null),
    ])

    // 数据源偶发缓存：抓到的最新一期还停在旧日期时，等 1.5 秒补抓一次（四路并行，不叠加耗时）
    const drawsOf = (r) =>
      r.status === 'fulfilled' && r.value ? (Array.isArray(r.value) ? r.value : r.value.draws) : null
    const refetchIfStale = async (r, enabled, fn, maxAgeDays = 1) => {
      const list = drawsOf(r)
      if (!enabled || !list?.length) return r
      if (freshness(list[0], maxAgeDays).state !== 'stale') return r
      await new Promise((ok) => setTimeout(ok, FRESH_RETRY_MS))
      const [again] = await Promise.allSettled([fn(100)])
      const retried = drawsOf(again)
      // 补抓没变新就保留原结果，至少还能发出去
      return retried?.length ? again : r
    }
    ;[kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.all([
      refetchIfStale(kl8Res, cfg.kl8, fetchKl8Draws),
      refetchIfStale(fc3dRes, cfg.fc3d, fetchFc3dDraws),
      refetchIfStale(pl3Res, cfg.pl3, fetchPl3Draws),
      refetchIfStale(ssqRes, cfg.ssq, fetchSsqDraws, 4),
    ])

    const kl8 = kl8Res.status === 'fulfilled' && kl8Res.value ? buildKl8(kl8Res.value) : null
    const fc3d = fc3dRes.status === 'fulfilled' && fc3dRes.value ? buildFc3d(fc3dRes.value) : null
    const pl3 = pl3Res.status === 'fulfilled' && pl3Res.value ? buildPl3(pl3Res.value.draws) : null
    const ssq = ssqRes.status === 'fulfilled' && ssqRes.value ? buildSsq(ssqRes.value.draws) : null

    const fresh = {
      kl8: kl8 ? freshness(kl8.latest) : null,
      fc3d: fc3d ? freshness(fc3d.latest) : null,
      pl3: pl3 ? freshness(pl3.latest) : null,
      ssq: ssq ? freshness(ssq.latest, 4) : null,
    }

    const skipped = {
      kl8: kl8Res.status === 'rejected' ? kl8Res.reason?.message : null,
      fc3d: fc3dRes.status === 'rejected' ? fc3dRes.reason?.message : null,
      pl3: pl3Res.status === 'rejected' ? pl3Res.reason?.message : null,
      ssq: ssqRes.status === 'rejected' ? ssqRes.reason?.message : null,
    }

    if (!kl8 && !fc3d && !pl3 && !ssq) {
      const errs = Object.values(skipped).filter(Boolean)
      const error = `开奖数据获取失败：${errs.join('；') || '未知原因'}`
      await savePushStatus({ at: new Date().toISOString(), ok: false, error, skipped })
      return res.status(502).json({ error })
    }

    const now = new Date()
    const dateText = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
    }).format(now)

    const prefix = isTest ? '【测试】' : ''

    // 一个彩种一张卡：快乐8 蓝头、3D 红头、排列三橙头、双色球绿头，分别发送
    const cards = []
    if (kl8) cards.push(buildKl8Card(kl8, `${prefix}快乐8 推荐 · ${dateText}`, staleWarning(fresh.kl8, '快乐8')))
    if (fc3d) cards.push(buildFc3dCard(fc3d, `${prefix}福彩3D 推荐 · ${dateText}`, { warning: staleWarning(fresh.fc3d, '福彩3D') }))
    if (pl3) cards.push(buildPl3Card(pl3, `${prefix}排列三 v3 Pro 推荐 · ${dateText}`, staleWarning(fresh.pl3, '排列三')))
    if (ssq) cards.push(buildSsqCard(ssq, `${prefix}双色球 推荐 · ${dateText}`, staleWarning(fresh.ssq, '双色球')))

    const timestamp = Math.floor(Date.now() / 1000)
    const signPart = feishuSign(cfg.secret, timestamp)

    let sent = 0
    for (const payload of cards) {
      const r = await fetch(cfg.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...signPart }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || (data.code ?? 0) !== 0) {
        const error = `飞书推送失败：${data.msg || `HTTP ${r.status}`}${data.code ? `（${data.code}）` : ''}`
        await savePushStatus({ at: new Date().toISOString(), ok: false, error, sent, total: cards.length, fresh })
        return res.status(502).json({ error })
      }
      sent++
    }

    await savePushStatus({
      at: new Date().toISOString(),
      ok: true,
      test: isTest,
      sent,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      fresh,
    })

    return res.status(200).json({
      ok: true,
      test: isTest,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      messages: cards.length,
      fresh,
      skipped,
    })
  } catch (e) {
    console.error('[daily-push]', e)
    await savePushStatus({ at: new Date().toISOString(), ok: false, error: e.message || '推送失败' })
    return res.status(500).json({ error: e.message || '推送失败' })
  }
}
