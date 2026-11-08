// 服务端 API 调用封装（Vercel Serverless Functions）
// - 浏览器部署在 Vercel 上时，用相对路径 /api
// - Tauri 桌面端（本地 iframe）时，用线上域名 https://cai.rayzo.cn
import { isTauri } from './tauri.js'

const WEB_BASE = 'https://cai.rayzo.cn'

/** 解析 API 基础地址 */
export function apiBase() {
  // 浏览器环境且非 Tauri：用相对路径（同域 Vercel）
  if (typeof window !== 'undefined' && !isTauri()) {
    // 如果当前页面是 file:// 或 localhost，也走线上域名
    const proto = window.location?.protocol
    if (proto === 'http:' || proto === 'https:') {
      return ''
    }
  }
  return WEB_BASE
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
