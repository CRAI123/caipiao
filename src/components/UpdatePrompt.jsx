// 新版本提示弹窗：展示版本号、更新说明与下载入口
import React from 'react'
import { openDownload } from '../lib/update.js'

export default function UpdatePrompt({ update, onClose }) {
  if (!update) return null
  const size = update.size ? ` · 安装包约 ${(update.size / 1048576).toFixed(1)} MB` : ''

  return (
    <div className="changelog-mask" role="presentation" onClick={onClose}>
      <div
        className="changelog-card"
        role="dialog"
        aria-modal="true"
        aria-label="发现新版本"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="changelog-head">
          <h3>发现新版本 v{update.version}</h3>
          <button className="changelog-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="changelog-latest">
          <div className="changelog-ver mono">
            当前 v{update.current}
            {size}
          </div>
          {update.notes && (
            <div
              style={{
                marginTop: 8,
                maxHeight: '34vh',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.8,
                color: 'var(--ink-80)',
              }}
            >
              {update.notes}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="tab-btn" style={{ borderBottom: '1px solid var(--ink-20)' }} onClick={onClose}>
            稍后再说
          </button>
          <button className="btn-primary" onClick={() => openDownload(update.url)}>
            立即更新
          </button>
        </div>

        <p className="changelog-foot mono">下载完成后按系统提示安装 · 首次需允许浏览器「安装未知应用」</p>
      </div>
    </div>
  )
}
