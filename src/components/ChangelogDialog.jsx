// 更新公告弹窗：上半部分展示最新一条，下半部分折叠展示历史全部条目
import React, { useState } from 'react'
import { CHANGELOG } from '../data/changelog.js'

function Entry({ entry }) {
  return (
    <div className="changelog-entry">
      <div className="changelog-ver mono">
        {entry.date} · v{entry.version}
      </div>
      <h4 className="changelog-title">{entry.title}</h4>
      <ul className="changelog-items">
        {entry.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ChangelogDialog({ open, onClose }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [latest, ...history] = CHANGELOG
  if (!open || !latest) return null
  return (
    <div className="changelog-mask" role="presentation" onClick={onClose}>
      <div className="changelog-card" role="dialog" aria-modal="true" aria-label="更新公告" onClick={(e) => e.stopPropagation()}>
        <header className="changelog-head">
          <h3>更新公告</h3>
          <button className="changelog-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="changelog-latest">
          <Entry entry={latest} />
        </div>

        {history.length > 0 && (
          <section className="changelog-history">
            <button className="changelog-toggle" onClick={() => setHistoryOpen((v) => !v)}>
              {historyOpen ? '▾' : '▸'} 历史更新（{history.length} 条）
            </button>
            {historyOpen && (
              <div className="changelog-history-list">
                {history.map((e) => (
                  <Entry key={e.version} entry={e} />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="changelog-foot mono">更新内容如实记录 · 统计仅供研究，不构成投注建议</p>
      </div>
    </div>
  )
}
