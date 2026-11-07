// ============================================================
// 设备识别码 —— 用浏览器稳定特征生成「电脑唯一识别码」
// 组成：指纹哈希（UA/屏幕/时区/硬件/Canvas/WebGL 等）+ 本地随机盐值
// 盐值存在 localStorage，因此同一浏览器配置稳定、不同配置/机器互不重复。
// 纯前端实现，无第三方库；识别码只用于访问申请与后台区分用户。
// ============================================================

const DEVICE_KEY = 'kl8_device_v1'

/** FNV-1a 32 位哈希（纯函数，可单测） */
export function hashId(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** SHA-256 十六进制（用于管理员令牌哈希）；无 SubtleCrypto 时退化为双 FNV */
export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return hashId(text) + hashId(`${text}:${text.length}`)
}

function canvasFp() {
  try {
    const c = document.createElement('canvas')
    c.width = 200
    c.height = 40
    const ctx = c.getContext('2d')
    if (!ctx) return 'na'
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(0, 0, 80, 20)
    ctx.fillStyle = '#2c3e50'
    ctx.fillText('kl8-device-fp', 2, 2)
    ctx.strokeStyle = 'rgba(41,128,185,0.7)'
    ctx.arc(50, 12, 8, 0, Math.PI * 2, true)
    ctx.stroke()
    return c.toDataURL().slice(-64)
  } catch {
    return 'na'
  }
}

function webglFp() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return 'na'
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'na'
  } catch {
    return 'na'
  }
}

function collectFingerprint() {
  const nav = navigator
  const parts = [
    nav.userAgent || '',
    nav.platform || '',
    nav.language || '',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    `tz${new Date().getTimezoneOffset()}`,
    `hc${nav.hardwareConcurrency || 0}`,
    `dm${nav.deviceMemory || 0}`,
    `touch${nav.maxTouchPoints || 0}`,
    canvasFp(),
    webglFp(),
  ]
  return parts.join('|')
}

function randomSalt() {
  const arr = new Uint8Array(8)
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(arr)
  else for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 获取本机识别码（异步：内部用 SubtleCrypto 时更稳，这里用同步哈希+盐值）。
 * 返回 { id, createdAt }；id 形如 KL8-1a2b3c4d-5e6f7a8b。
 */
export function getDeviceId() {
  let salt = null
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.id) return { id: parsed.id, createdAt: parsed.createdAt || null }
      salt = parsed?.salt
    }
  } catch {
    /* 隐私模式 */
  }
  if (!salt) salt = randomSalt()
  const fp = hashId(collectFingerprint())
  const id = `KL8-${fp.slice(0, 8)}-${hashId(fp + salt).slice(0, 8)}`
  const record = { id, salt, createdAt: new Date().toISOString() }
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(record))
  } catch {
    /* 隐私模式下仅内存有效 */
  }
  return { id, createdAt: record.createdAt }
}

/** 展示用短码（后台表格里省空间） */
export const shortDevice = (id) => (id || '').replace(/^KL8-/, '')
