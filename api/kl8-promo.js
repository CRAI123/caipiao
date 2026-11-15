// 快乐8 加奖 / 派奖监控
// 抓取中国福彩网「通知公告」列表，筛出含「派奖 / 加奖 / 促销」的官方公告。
// 只有派奖期，部分玩法的实际返还率才可能超过 100%；平时固定奖金表返还率约 57.5%。
//
// 数据源：官网「通知公告」列表页。
// 注意：福彩官网对海外 / 机房 IP 有 WAF，Vercel 节点通常返回 403，
// 所以失败时返回 ok:false，并用 lastKnown 提供最近一次派奖的可核查记录。
import { applyCors } from './_lib/http.js'

const LIST = 'https://www.cwl.gov.cn/xxgk/tzgg/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const ITEM_RE =
  /<a[^>]+href="(\/c\/\d{4}\/\d{2}\/\d{2}\/\d+\.shtml)"[^>]*>\s*<li>[\s\S]*?class="[^"]*txt\s+lg[^"]*">([\s\S]*?)<\/div>[\s\S]*?class="ul-date">\s*([\d-]+)\s*<\/div>/g

// 最近一次快乐8 派奖（据官网公告人工核对，仅作兜底展示）
const LAST_KNOWN = {
  start: '2026-08-21',
  end: '2026-10-06',
  startTitle: '关于开展2026年中国福利彩票快乐8游戏派奖活动的公告',
  endTitle: '关于2026年中国福利彩票快乐8游戏派奖活动结束的公告',
  checkedOn: '2026-11-15',
}

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

async function fetchText(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://www.cwl.gov.cn/', Accept: 'text/html,application/xhtml+xml,*/*' },
        signal: AbortSignal.timeout(9000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    } catch (e) {
      if (i === 1) throw e
    }
  }
  return ''
}

/** 从官网列表页 HTML 提取公告 */
function parseHtml(html) {
  const out = []
  let m
  while ((m = ITEM_RE.exec(html)) && out.length < 12) {
    const title = clean(m[2])
    if (title) out.push({ title, date: m[3], url: `https://www.cwl.gov.cn${m[1]}` })
  }
  return out
}

/** 抓取官网列表页并提取公告 */
async function loadAnnouncements() {
  const html = await fetchText(LIST)
  if (!html) throw new Error('官网无响应')
  const all = parseHtml(html)
  if (!all.length) throw new Error('未解析到公告条目（页面结构可能已变）')
  return all
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const all = await loadAnnouncements()

    const items = []
    const seen = new Set()
    for (const it of all) {
      if (!/派奖|加奖|促销/.test(it.title) || seen.has(it.url)) continue
      seen.add(it.url)
      items.push({ ...it, kl8: /快乐8/.test(it.title) })
    }

    // 列表按日期倒序：一旦出现更新的「快乐8 派奖结束」公告，更早的派奖即视为已结束
    let kl8Closed = false
    for (const it of items) {
      const closed = /结束|截止/.test(it.title)
      if (it.kl8 && closed) kl8Closed = true
      it.ended = closed || (it.kl8 && kl8Closed)
    }

    const active = items.filter((x) => x.kl8 && !x.ended)
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      active: active.length > 0,
      items,
      lastKnown: LAST_KNOWN,
      officialUrl: LIST,
      baseReturnRate: 0.5753,
    })
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json({
      ok: false,
      checkedAt: new Date().toISOString(),
      message: `官网公告自动抓取失败（${e.message}）：福彩官网限制海外服务器访问`,
      items: [],
      lastKnown: LAST_KNOWN,
      officialUrl: LIST,
      baseReturnRate: 0.5753,
    })
  }
}
