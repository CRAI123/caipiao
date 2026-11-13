// 近 100 期统计 + AI 解读卡片（福彩3D / 排列三共用）
// 号码来自本地统计的候选池，AI 只负责解读与挑选，不自行造号
import React, { useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import { summarizeDigit, analyzeDigit } from '../lib/digitAi.js'
import { resolveLlmSettings } from '../lib/sync.js'

export default function DigitAI({ draws, label = '福彩3D' }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')

  const summary = useMemo(() => summarizeDigit(draws, 100), [draws])

  if (!summary || summary.total < 10) return null

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const llm = await resolveLlmSettings()
      const result = await analyzeDigit(llm, { summary, label })
      setText(result.text)
      setMeta({ model: result.model, at: result.at })
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={`近 ${summary.total} 期 AI 分析 · ${label}`} tag="AI">
      <div className="predict-row">
        <div className="predict-label">直选候选</div>
        <div className="predict-value">
          {summary.candidates.straight.map((x) => (
            <span key={x.join('')} className="draw-num">
              {x.join('')}
            </span>
          ))}
          <span className="muted small">按频率/遗漏/转移加权排序</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">组选候选</div>
        <div className="predict-value">
          {summary.candidates.group.map((x) => (
            <span key={`g${x.join('')}`} className="draw-num">
              {x.join('')}
            </span>
          ))}
          <span className="muted small">组六，不含重号</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">组三候选</div>
        <div className="predict-value">
          {summary.candidates.group3.map((x) => (
            <span key={`g3${x.join('')}`} className="draw-num">
              {x[0]}
              {x[0]}
              {x[1]}
            </span>
          ))}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="tab-btn active" onClick={run} disabled={busy}>
          {busy ? 'AI 分析中…' : text ? '重新分析' : 'AI 解读近 100 期'}
        </button>
        <span className="muted small">
          需要先在「设置」页配置大模型 API Key（或由管理员统一配置）
        </span>
      </div>

      {error && <div className="note note-warn">{error}</div>}

      {text && (
        <>
          <div className="predict-sub" style={{ marginTop: 12 }}>
            AI 分析 · {meta?.model} · {meta ? new Date(meta.at).toLocaleString('zh-CN') : ''}
          </div>
          <div className="ai-report-body">{text}</div>
        </>
      )}

      <Note>
        候选组合只描述近 100 期的历史分布（频率、遗漏、位置转移），不是预测。
        每注直选中奖概率恒为 1/1000，组六约 1/167，AI 解读不会改变这一点。
      </Note>
    </Card>
  )
}
