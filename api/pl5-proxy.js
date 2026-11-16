// 体彩排列五开奖数据代理（浏览器无法跨域直连体彩接口）
// GET /api/pl5-proxy?count=100
import { fetchPl5Draws } from './_lib/pl5.js'
import { applyCors } from './_lib/http.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await fetchPl5Draws(count)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error('[pl5-proxy]', e)
    return res.status(502).json({ error: e.message || '排列五开奖数据获取失败' })
  }
}
