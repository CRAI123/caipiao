// 双色球开奖数据代理（浏览器无法跨域直连开奖站点）
// GET /api/ssq-proxy?count=100
import { fetchSsqDraws } from './_lib/ssq.js'
import { applyCors } from './_lib/http.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await fetchSsqDraws(count)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error('[ssq-proxy]', e)
    return res.status(502).json({ error: e.message || '双色球开奖数据获取失败' })
  }
}
