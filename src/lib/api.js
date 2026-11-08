// 服务端 API 调用封装（Vercel Serverless Functions）
// - 浏览器部署在 Vercel 上时，用相对路径 /api
// - Tauri 桌面端（本地 iframe）时，用线上域名 https://cai.rayzo.cn
import { isTauri } from './tauri.js'

const WEB_BASE = 'https://cai.rayzo.cn'

/** 解析 API 基础地址 */
export function apiBase() {
  // 桌面端（含 iframe 嵌套）：直接走线上域名的 Serverless 接口
  if (isTauri()) return WEB_BASE
  if (typeof window === 'undefined') return WEB_BASE
  // 本地开发 / file:// 等非线上环境：也只能调用线上接口
  const host = window.location?.hostname || ''
  if (!host || host === 'localhost' || host === '127.0.0.1') return WEB_BASE
  // 线上部署：同域相对路径
  return ''
}

/** 通用 fetch 封装 */
async function apiFetch(path, options = {}) {
  const url = `${apiBase()}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

/** AI 选号：底层统计逻辑之后，调用 AI 辅助选号 */
export async function aiPredict({ draws, play = 10, mode = 'mix' }) {
  return apiFetch('/api/ai-predict', {
    method: 'POST',
    body: JSON.stringify({ draws, play, mode }),
  })
}

/** 存储一期预测号码（供每日 cron 复盘对比） */
export async function storePrediction({ drawId, play, mode, picks, dans = [], tuos = [], aiPicks = [] }) {
  return apiFetch('/api/store-prediction', {
    method: 'POST',
    body: JSON.stringify({ drawId, play, mode, picks, dans, tuos, aiPicks }),
  })
}

/** 拉取每日 AI 复盘记录 */
export async function getReviews(limit = 30) {
  return apiFetch(`/api/get-reviews?limit=${limit}`)
}
