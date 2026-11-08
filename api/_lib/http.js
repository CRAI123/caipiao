// 通用 HTTP 辅助：CORS 处理（桌面端 iframe 跨域调用线上 API 需要）
// 用法：在 handler 开头 if (applyCors(req, res)) return
export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
