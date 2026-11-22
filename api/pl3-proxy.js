// 体彩排列三 / 排列五 / 七星彩开奖数据代理（浏览器无法跨域直连体彩接口）
// GET /api/pl3-proxy?count=100            → 排列三
// GET /api/pl3-proxy?game=pl5&count=100   → 排列五
// GET /api/pl3-proxy?game=qxc&count=100   → 七星彩
// 说明：Hobby 计划限制 12 个 Serverless Function，排列五 / 七星彩复用本函数，用 game 参数区分。
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchPl5Draws } from './_lib/pl5.js'
import { fetchQxcDraws } from './_lib/qxc.js'
import { applyCors } from './_lib/http.js'

const GAMES = {
  pl3: { label: '排列三', fetch: fetchPl3Draws },
  pl5: { label: '排列五', fetch: fetchPl5Draws },
  qxc: { label: '七星彩', fetch: fetchQxcDraws },
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  const game = GAMES[req.query?.game] ? req.query.game : 'pl3'
  const { label, fetch: fetchDraws } = GAMES[game]
  const count = Math.min(200, Math.max(10, Number(req.query?.count) || 100))
  try {
    const { draws, source } = await fetchDraws(count)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ draws, source })
  } catch (e) {
    console.error(`[${game}-proxy]`, e)
    return res.status(502).json({ error: e.message || `${label}开奖数据获取失败` })
  }
}
