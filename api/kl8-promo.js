// 快乐8 加奖 / 派奖监控
// 抓取中国福彩网「通知公告」列表，筛出含「派奖 / 加奖 / 促销」的官方公告。
// 只有派奖期，部分玩法的实际返还率才可能超过 100%；平时固定奖金表返还率约 57.5%。
// 说明：官网首页存在重定向循环，直接用服务端渲染的公告列表页 /xxgk/tzgg/。
import { applyCors } from './_lib/http.js'

const LIST = 'https://www.cwl.gov.cn/xxgk/tzgg/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const ITEM_RE =
  /<a[^>]+href="(\/c\/\d{4}\/\d{2}\/\d{2}\/\d+\.shtml)"[^>]*>\s*<li>[\s\S]*?class="[^"]*txt\s+lg[^"]*">([\s\S]*?)<\/div>[\s\S]*?class="ul-date">\s*([\d-]+)\s*<\/div>/g

/** 去掉标签与 HTML 实体 */
function clean(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchHtml() {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(LIST, {
        headers: { 'User-Agent': UA, Referer: 'https://www.cwl.gov.cn/', Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(9000),
      })
      if (!r.ok) throw new Error(`福彩官网 HTTP ${r.status}`)
      return await r.text()
    } catch (e) {
      if (i === 1) throw e
    }
  }
  return ''
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  try {
    const html = await fetchHtml()
    if (!html) throw new Error('福彩官网无响应')

    const items = []
    const seen = new Set()
    let m
    while ((m = ITEM_RE.exec(html)) && items.length < 12) {
      const title = clean(m[2])
      if (!title || seen.has(m[1])) continue
      if (!/派奖|加奖|促销/.test(title)) continue
      seen.add(m[1])
      items.push({
        title,
        date: m[3],
        url: `https://www.cwl.gov.cn${m[1]}`,
        kl8: /快乐8/.test(title),
      })
    }

    // 列表按日期倒序：一旦出现更新的「快乐8 派奖结束」公告，更早的派奖即视为已结束
    let kl8Closed = false
    for (const it of items) {
      const closed = /结束|截止/.test(it.title)
      if (it.kl8 && closed) kl8Closed = true
      it.ended = closed || (it.kl8 && kl8Closed)
    }

    const active = items.filter((x) => x.kl8 && !x.ended)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      active: active.length > 0,
      items,
      baseReturnRate: 0.5753,
    })
  } catch (e) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json({
      ok: false,
      checkedAt: new Date().toISOString(),
      message: e.message || '官方公告抓取失败',
      items: [],
      baseReturnRate: 0.5753,
    })
  }
}
