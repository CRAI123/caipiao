// 体彩排列三 / 排列五开奖数据代理（浏览器无法跨域直连体彩接口）
// GET /api/pl3-proxy?count=100            → 排列三
// GET /api/pl3-proxy?game=pl5&count=100   → 排列五
// 说明：Hobby 计划限制 12 个 Serverless Function，排列五复用本函数，用 game 参数区分。
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchPl5Draws } from './_lib/pl5.js'
import { applyCors } from './_lib/http.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  const game = req.query?.game === 'pl5' ? 'pl5' : 'pl3'
  const label = game === 'pl5' ? '排列五' : '排列三'
  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await (game === 'pl5' ? fetchPl5Draws(count) : fetchPl3Draws(count))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error(`[${game}-proxy]`, e)
    return res.status(502).json({ error: e.message || `${label}开奖数据获取失败` })
  }
}
