// ============================================================
// Tauri 检测与命令调用 —— 兼容 iframe 场景
// 桌面端 React 应用以 iframe 形式加载在 Vue 外壳内，
// __TAURI_INTERNALS__ 只注入在父窗口（Vue 外壳）的 window 上，
// iframe 自身的 window.__TAURI_INTERNALS__ 为 undefined。
// 因此需要沿 window.parent 链向上查找可用的 Tauri 注入对象。
// ============================================================

/**
 * 沿 window 链（自身 → parent）找到第一个注入了 __TAURI_INTERNALS__ 的窗口。
 * 返回该 window 对象，找不到返回 null。
 */
function getTauriWindow() {
  if (typeof window === 'undefined') return null
  let w = window
  // 最多向上查找 5 层，防止跨域或异常循环
  for (let i = 0; i < 5; i++) {
    if (w && w.__TAURI_INTERNALS__) return w
    try {
      if (w.parent === w) break
      w = w.parent
    } catch {
      // 跨域访问 parent 会抛错，说明不在同源 Tauri 环境
      break
    }
  }
  return null
}

/** 当前是否运行在 Tauri 桌面端（含 iframe 嵌套场景） */
export function isTauri() {
  return getTauriWindow() !== null
}

/**
 * 调用 Tauri 命令。自动定位到有 __TAURI_INTERNALS__ 的窗口执行。
 * 用法同 @tauri-apps/api 的 invoke，但不依赖该包在当前 window 的注入。
 */
export async function invoke(cmd, args) {
  const w = getTauriWindow()
  if (!w) throw new Error('当前不在 Tauri 桌面环境中')
  return w.__TAURI_INTERNALS__.invoke(cmd, args || {})
}
