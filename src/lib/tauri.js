// ============================================================
// Tauri 检测与命令调用 —— 兼容 iframe 场景
// 桌面端 React 应用以 iframe 形式加载在 Vue 外壳内。
// 由于 iframe 与父窗口可能不同源，无法直接访问
// window.parent.__TAURI_INTERNALS__，因此采用 postMessage 桥接：
//   - iframe 通过 window.parent.postMessage 把命令委托给父窗口
//   - 父窗口（Vue 外壳）调用 invoke 后把结果回传
// 父窗口 iframe src 带 ?tauri=1，用于同步识别桌面端环境。
// ============================================================

const TAURI_MARKER = /[?&]tauri=1([&#]|$)/

/** 尝试沿 window.parent 链拿到直接注入的 Tauri 对象（同域时有效） */
function getDirectWindow() {
  if (typeof window === 'undefined') return null
  let w = window
  for (let i = 0; i < 5; i++) {
    if (w && w.__TAURI_INTERNALS__) return w
    try {
      if (w.parent === w) break
      w = w.parent
    } catch {
      break
    }
  }
  return null
}

/** 当前是否运行在 Tauri 桌面端（含 iframe 嵌套场景） */
export function isTauri() {
  if (typeof window === 'undefined') return false
  if (getDirectWindow()) return true
  // 父窗口在 iframe URL 上加了 ?tauri=1 标记
  if (TAURI_MARKER.test(window.location.search)) return true
  return false
}

// ---- postMessage 桥接 ----
const pending = new Map()
let bridgeReady = false

/**
 * 把 Tauri 抛回来的任意值统一成 Error。
 * Rust 命令返回 Err(String) 时，invoke 的 reject 值就是一个纯字符串，
 * 直接取 e.message 会得到 undefined，真正的错误就被吞掉了。
 */
function toError(e, fallback = '调用失败') {
  if (e instanceof Error) return e
  if (typeof e === 'string' && e.trim()) return new Error(e)
  try {
    const s = JSON.stringify(e)
    if (s && s !== '{}' && s !== 'null' && s !== '""') return new Error(s)
  } catch {
    /* 无法序列化时走兜底文案 */
  }
  return new Error(fallback)
}

function ensureBridge() {
  if (bridgeReady || typeof window === 'undefined') return
  bridgeReady = true
  window.addEventListener('message', (e) => {
    const d = e?.data
    if (!d || d._tauriBridge !== true) return
    const p = pending.get(d.id)
    if (!p) return
    pending.delete(d.id)
    if (d.error) p.reject(toError(d.error, '桌面端命令执行失败'))
    else p.resolve(d.result)
  })
}

/**
 * 调用 Tauri 命令。
 * 优先直接调用（同域能拿到 __TAURI_INTERNALS__），否则走 postMessage 桥接。
 */
export async function invoke(cmd, args) {
  if (!isTauri()) throw new Error('当前不在 Tauri 桌面环境中')

  // 路径 A：能直接访问到 __TAURI_INTERNALS__
  const w = getDirectWindow()
  if (w) {
    try {
      return await w.__TAURI_INTERNALS__.invoke(cmd, args || {})
    } catch (e) {
      throw toError(e, `桌面端命令 "${cmd}" 执行失败`)
    }
  }

  // 路径 B：postMessage 委托父窗口
  ensureBridge()
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    pending.set(id, { resolve, reject })
    try {
      window.parent.postMessage(
        { _tauriBridge: true, id, cmd, args: args || {} },
        '*',
      )
    } catch (err) {
      pending.delete(id)
      reject(new Error(`postMessage 失败：${err?.message || err}`))
      return
    }
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`Tauri 命令 "${cmd}" 超时`))
      }
    }, 30000)
  })
}

/**
 * 用系统默认浏览器打开 URL。
 * - 桌面端：通过 postMessage 桥接委托父窗口调用 opener 插件
 * - 浏览器端：直接 window.open
 */
export async function openUrl(url) {
  if (!url) throw new Error('URL 不能为空')
  if (isTauri()) {
    return invoke('open_url', { url })
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
