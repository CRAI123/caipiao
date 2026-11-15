// 快乐8 加奖 / 派奖监控
// 抓取中国福彩网「通知公告」列表，筛出含「派奖 / 加奖 / 促销」的官方公告。
// 只有派奖期，部分玩法的实际返还率才可能超过 100%；平时固定奖金表返还率约 57.5%。
//
// 数据源有两个，按顺序降级：
// 1. 官网 HTML：国内节点可直连，Vercel 等海外机房常被 WAF 返 403
// 2. r.jina.ai 文本镜像：海外节点可用，用来绕过 WAF（国内网络反而不通）
import { applyCors } from './_lib/http.js'

const LIST = 'https://www.cwl.gov.cn/xxgk/tzgg/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const ITEM_RE =
  /<a[^>]+href="(\/c\/\d{4}\/\d{2}\/\d{2}\/\d+\.shtml)"[^>]*>\s*<li>[\s\S]*?class="[^"]*txt\s+lg[^"]*">([\s\S]*?)<\/div>[\s\S]*?class="ul-date">\s*([\d-]+)\s*<\/div>/g
const MD_RE = /\[([^\]\n]{6,140})\]\((https?:\/\/[^\s)]+\/c\/\d{4}\/\d{2}\/\d{2}\/\d+\.shtml)\)/g

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

/** 从 r.jina.ai 的 markdown 里提取公告 */
function parseMarkdown(text) {
  const out = []
  const seen = new Set()
  let m
  while ((m = MD_RE.exec(text)) && out.length < 12) {
    const title = clean(m[1])
    if (!title || seen.has(m[2])) continue
    seen.add(m[2])
    const d = m[2].match(/\/c\/(\d{4})\/(\d{2})\/(\d{2})\//)
    out.push({ title, date: d ? `${d[1]}-${d[2]}-${d[3]}` : '', url: m[2] })
  }
  return out
}

/** 依次尝试数据源，取第一个有结果的 */
async function loadAnnouncements() {
  const sources = [
    { name: 'cwl', run: async () => parseHtml(await fetchText(LIST)) },
    { name: 'jina', run: async () => parseMarkdown(await fetchText(`https://r.jina.ai/${LIST}`)) },
  ]
  const errors = []
  for (const s of sources) {
    try {
      const all = await s.run()
      if (all.length) return { source: s.name, all }
      errors.push(`${s.name}: 无公告条目`)
    } catch (e) {
      errors.push(`${s.name}: ${e.message}`)
    }
  }
  throw new Error(`公告源均不可用（${errors.join('；')}）`)
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const { source, all } = await loadAnnouncements()

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
      source,
      active: active.length > 0,
      items,
      officialUrl: LIST,
      baseReturnRate: 0.5753,
    })
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json({
      ok: false,
      checkedAt: new Date().toISOString(),
      message: e.message || '官方公告抓取失败',
      items: [],
      officialUrl: LIST,
      baseReturnRate: 0.5753,
    })
  }
}
