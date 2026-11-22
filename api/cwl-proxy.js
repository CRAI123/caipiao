// 福彩官网开奖数据代理（浏览器端无法跨域直连官网，且官网要求 Referer 头）
// GET /api/cwl-proxy?path=/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?...
// 服务端带 Referer 请求官网并透传 JSON 响应
import { applyCors } from './_lib/http.js'

const CWL_BASE = 'https://www.cwl.gov.cn'

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  try {
    const path = req.query?.path
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      return res.status(400).json({ error: '缺少或非法的 path 参数' })
    }
    // 安全限制：只允许代理福彩官网的开奖接口路径
    if (!path.startsWith('/cwl_admin/')) {
      return res.status(400).json({ error: '不允许的代理路径' })
    }

    const url = `${CWL_BASE}${path}`
    const referer = (req.query?.referer && typeof req.query.referer === 'string' && req.query.referer.startsWith('https://www.cwl.gov.cn/'))
      ? req.query.referer
      : 'https://www.cwl.gov.cn/'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let text = ''
    let status = 502
    try {
      const upstream = await fetch(url, {
        signal: controller.signal,
        headers: {
          Referer: referer,
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      status = upstream.status
      text = await upstream.text()
    } catch (e) {
      clearTimeout(timer)
      return res
        .status(504)
        .json({ error: `福彩官网请求失败（${e.name === 'AbortError' ? '超时' : e.message}），海外服务器可能被官网 WAF 拦截，请使用桌面端抓取。` })
    }
    clearTimeout(timer)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.end(text)
    return
  } catch (e) {
    console.error('cwl-proxy error:', e)
    return res.status(502).json({ error: `代理请求失败：${e.message}` })
  }
}
