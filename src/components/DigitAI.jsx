// 近 100 期统计 + AI 解读卡片（福彩3D / 排列三共用）
// 号码来自本地统计的候选池，AI 只负责解读与挑选，不自行造号。
//
// 点击分析时：
//   1. 先强制拉取最新开奖数据（不用页面上的旧数据）
//   2. 若期号没有前进且本期还没有共享解析 → 弹「暂时没有新数据」
//   3. 本期解析全站共享：首位用户真实调用，后续用户读取并模拟一段分析等待
import React, { useMemo, useState } from 'react'
import { Card, Note, Dialog } from './common.jsx'
import { summarizeDigit, buildDigitMessages } from '../lib/digitAi.js'
import { runDigitAi, peekDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function DigitAI({ draws, label = '福彩3D', game = 'fc3d', onRefreshData }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [pct, setPct] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [tip, setTip] = useState('')

  const summary = useMemo(() => summarizeDigit(draws, 100), [draws])

  if (!summary || summary.total < 10) return null

  const onTick = ({ elapsed: s, pct: p, stage }) => {
    setElapsed(s)
    setPct(p)
    setPhase(stage)
  }

  const run = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setText('')
    setMeta(null)
    setPhase('正在同步最新开奖数据…')
    setPct(3)
    setElapsed(0)
    try {
      // 1. 强制刷新开奖数据
      let fresh = draws
      if (onRefreshData) {
        try {
          fresh = await onRefreshData()
        } catch (e) {
          throw new Error(`开奖数据更新失败：${e.message || e}`)
        }
      }
      const latestFresh = Array.isArray(fresh) ? fresh[0] : null
      if (!latestFresh) throw new Error('没有取到开奖数据，请稍后重试')
      const freshSummary = summarizeDigit(fresh, 100)
      if (!freshSummary) throw new Error('最新数据不足 10 期，无法分析')

      const prevLatest = draws?.[0]
      const hasNew = !prevLatest || Number(latestFresh.id) > Number(prevLatest.id)
      const drawId = Number(latestFresh.id)

      // 2. 本期是否已有共享解析
      let cached = null
      try {
        const p = await peekDigitAi({ game, drawId })
        if (p?.exists && p.status === 'done' && p.result?.text) cached = p
      } catch {
        /* 数据库不可用时继续走实时分析 */
      }

      // 3. 没有新数据、也没有已生成的解析 → 提示
      if (!hasNew && !cached) {
        setTip(`第 ${drawId} 期开奖数据已经是最新的，还没有新一期开奖，暂时没有新数据。\n新一期开奖后再来点「AI 分析」即可。`)
        return
      }

      // 4. 已有共享结果：模拟一段分析等待，让后面看的人也有体验
      if (cached) {
        setPhase('正在读取本期共享解析…')
        await fakeAnalyze({ seconds: sharedWaitSeconds(), onTick })
        setText(cached.result.text)
        setMeta({ model: cached.result.model, at: cached.result.at, cached: true, owner: cached.owner })
        setPct(100)
        setPhase('分析完成')
        return
      }

      // 5. 首位用户：真实调用（至少保留 8 秒进度，避免瞬间跳变）
      setPhase('AI 正在分析…')
      const timer = fakeAnalyze({ seconds: 8, onTick })
      try {
        const r = await runDigitAi({
          game,
          drawId,
          label,
          messages: buildDigitMessages(freshSummary, label),
          deviceId: getDeviceId()?.id || '',
        })
        await timer
        setText(r.text)
        setMeta({ model: r.model, at: r.at, cached: Boolean(r.cached), owner: r.owner })
        setPct(100)
        setPhase('分析完成')
      } catch (e) {
        // 别人正在分析：等待并轮询共享结果
        if (e.status === 409) {
          setPhase('本期已有用户在分析，等待结果同步…')
          for (let i = 0; i < 12; i++) {
            await sleep(5000)
            const p = await peekDigitAi({ game, drawId }).catch(() => null)
            if (p?.exists && p.status === 'done' && p.result?.text) {
              setText(p.result.text)
              setMeta({ model: p.result.model, at: p.result.at, cached: true, owner: p.owner })
              setPct(100)
              setPhase('分析完成')
              return
            }
            setPct(Math.min(96, 20 + i * 7))
          }
          throw new Error('本期分析仍在进行中，请过一会儿再点一次查看')
        }
        throw e
      }
    } catch (e) {
      setError(e?.message || String(e))
      setPhase('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={`近 ${summary.total} 期 AI 分析 · ${label}`} tag={meta?.cached ? '全站共享' : 'AI'}>
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
          点击后会自动同步最新开奖数据；每期仅首位用户调用 AI，结果全站共享
        </span>
      </div>

      {busy && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: '#ece6da',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #c23a2b, #e0a24a)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {phase} · 已用 {elapsed} 秒
          </div>
        </div>
      )}

      {error && <div className="note note-warn">{error}</div>}

      {text && (
        <>
          <div className="predict-sub" style={{ marginTop: 12 }}>
            AI 分析 · {meta?.model} ·{' '}
            {meta?.at ? new Date(meta.at).toLocaleString('zh-CN') : ''}
            {meta?.cached ? ' · 本期共享解析' : ' · 本期首位生成'}
          </div>
          <div className="ai-report-body">{text}</div>
        </>
      )}

      <Note>
        候选组合只描述近 100 期的历史分布（频率、遗漏、位置转移），不是预测。
        每注直选中奖概率恒为 1/1000，组六约 1/167，AI 解读不会改变这一点。
      </Note>

      <Dialog open={Boolean(tip)} text={tip} onClose={() => setTip('')} />
    </Card>
  )
}
