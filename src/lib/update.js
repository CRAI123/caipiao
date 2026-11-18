// ============================================================
// 应用内更新检查（仅 Capacitor APK 生效）
// - 版本来源：GitHub Releases 最新 tag（如 v1.0.1）
// - 已安装版本：Android versionName（由打包时 -PversionName 注入）
// - 有新版时返回 { version, current, notes, url }，由 UpdatePrompt 弹窗展示
// ============================================================

import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

const RELEASES_API = 'https://api.github.com/repos/CRAI123/caipiao/releases/latest'
const LAST_CHECK_KEY = 'caipiao.update.lastCheck'
const CHECK_INTERVAL = 12 * 60 * 60 * 1000 // 12 小时内只自动检查一次

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

/** 语义化版本比较：remote 比 current 新则返回 true */
function isNewer(remote, current) {
  const a = String(remote).split('.').map((n) => parseInt(n, 10) || 0)
  const b = String(current).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

/**
 * 检查是否有新版本。
 * force=true 时忽略 12 小时间隔（预留给以后的手动检查入口）。
 */
export async function checkAppUpdate({ force = false } = {}) {
  if (!isNativeApp()) return null
  try {
    if (!force) {
      const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0)
      if (Date.now() - last < CHECK_INTERVAL) return null
    }
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))

    const info = await CapApp.getInfo()
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const release = await res.json()

    const version = String(release?.tag_name || '').replace(/^v/i, '')
    if (!version || !isNewer(version, info.version)) return null

    const apk = (release.assets || []).find((a) => /\.apk$/i.test(a.name || ''))
    if (!apk) return null

    return {
      version,
      current: info.version,
      notes: String(release.body || '').trim(),
      url: apk.browser_download_url,
      size: apk.size || 0,
    }
  } catch {
    return null // 网络失败 / 无 release 时静默跳过，不打扰用户
  }
}

/** 打开下载地址：APK 内走系统浏览器，网页端新开标签 */
export async function openDownload(url) {
  if (isNativeApp()) {
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}
