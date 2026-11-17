// AI 等待剧场：上半「分析过程直播」+ 下半「冷知识卡片轮播」
// 纯展示组件：进度由外部真实等待计时驱动（pct），自己不发起任何请求。
// stages: [{label, desc}]  desc 只能是流程事实描述；facts: [{title, text}] 必须来自真实数据现算。
import React, { useEffect, useMemo, useState } from 'react'

const TYPE_MS = 45 // 打字机每拍毫秒
const TYPE_STEP = 2 // 每拍打出的字符数
const FACT_MS = 2500 // 趣闻卡轮播间隔

export default function AiWaitTheater({ stages, facts, pct = 0, elapsedSec = 0 }) {
  const steps = useMemo(
    () => (Array.isArray(stages) ? stages.filter((s) => s && s.label) : []),
    [stages],
  )
  const cards = useMemo(
    () => (Array.isArray(facts) ? facts.filter((f) => f && f.title && f.text) : []),
    [facts],
  )

  // 进度按真实等待 pct 均匀映射到各步；最后一步在结果到达（组件卸载）前始终停在「进行中」
  const p = Math.min(100, Math.max(0, Number(pct) || 0))
  const cur = steps.length ? Math.min(steps.length - 1, Math.floor((p / 100) * steps.length)) : -1
  const desc = cur >= 0 ? steps[cur].desc || '' : ''

  // 打字机：当前步 desc 逐字打出
  const [typed, setTyped] = useState('')
  useEffect(() => {
    setTyped('')
    if (!desc) return undefined
    let i = 0
    const id = setInterval(() => {
      i += TYPE_STEP
      setTyped(desc.slice(0, i))
      if (i >= desc.length) clearInterval(id)
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [desc])

  // 趣闻卡每 2.5s 轮播一张
  const [fi, setFi] = useState(0)
  useEffect(() => {
    if (cards.length < 2) return undefined
    const id = setInterval(() => setFi((x) => (x + 1) % cards.length), FACT_MS)
    return () => clearInterval(id)
  }, [cards.length])
  const fact = cards.length ? cards[fi % cards.length] : null

  if (!steps.length) return null
  return (
    <div className="wait-theater">
      <div className="wait-theater-head">
        <span className="wait-theater-title mono">分析过程直播</span>
        <span className="mono small muted">
          已用 {elapsedSec} 秒 · {Math.round(p)}%
        </span>
      </div>
      <ol className="wait-theater-steps">
        {steps.map((s, i) => {
          const state = i < cur ? 'done' : i === cur ? 'active' : 'todo'
          return (
            <li key={`${s.label}-${i}`} className={`wait-theater-step wait-theater-step-${state}`}>
              <span className="wait-theater-mark mono">{state === 'done' ? '✓' : state === 'active' ? '▸' : '·'}</span>
              <span className="wait-theater-label">{s.label}</span>
              {state === 'active' && (
                <span className="wait-theater-desc">
                  {typed}
                  <i className="wait-theater-caret" aria-hidden="true" />
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {fact && (
        <div className="wait-theater-fact" key={fi}>
          <span className="wait-theater-fact-count mono">
            冷知识 {(fi % cards.length) + 1}/{cards.length}
          </span>
          <div className="wait-theater-fact-title mono">{fact.title}</div>
          <div className="wait-theater-fact-text">{fact.text}</div>
        </div>
      )}
    </div>
  )
}
