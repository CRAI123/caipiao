// 近 100 期统计 + AI 解读卡片（福彩3D / 排列三共用）
// 号码来自本地统计的候选池，AI 只负责解读与挑选，不自行造号。
//
// 点击分析时：
//   1. 先强制拉取最新开奖数据（不用页面上的旧数据）
//   2. 若期号没有前进且本期还没有共享解析 → 弹「暂时没有新数据」
//   3. 本期解析全站共享：首位用户真实调用，后续用户读取并模拟一段分析等待
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Note, Dialog } from './common.jsx'
import { summarizeDigit, buildDigitMessages } from '../lib/digitAi.js'
import { runDigitAi, peekDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与服务端 api/digit-ai.js 的 ROUNDS 一一对应
const ROUND_STAGES = ['第 1/3 轮 · 结构解读', '第 2/3 轮 · 反向质询', '第 3/3 轮 · 定稿合成']

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
  const busyRef = useRef(false)
  const latestId = Number(draws?.[0]?.id) || 0

  // 切到别的页面再回来时组件会重新挂载，本地状态会丢：从共享缓存恢复本期解析。
  // 若本期分析还在跑（可能是自己刚点的），继续等待并显示进度。
  useEffect(() => {
    if (!latestId) return undefined
    let alive = true
    const applyResult = (r, owner) => {
      setText(r.text)
      setMeta({
        model: r.model,
        at: r.at,
        cached: true,
        owner,
        rounds: r.rounds,
        roundCount: r.roundCount || r.rounds?.length || 3,
      })
    }
    const restore = async () => {
      let p = null
      try {
        p = await peekDigitAi({ game, drawId: latestId })
      } catch {
        return
      }
      if (!alive || busyRef.current || !p?.exists) return
      if (p.status === 'done' && p.result?.text) {
        applyResult(p.result, p.owner)
        return
      }
      if (p.status !== 'running') return
      setBusy(true)
      setPct(8)
      setElapsed(0)
      setPhase('本期分析仍在进行，正在等待结果…')
      for (let i = 0; i < 24; i++) {
        await sleep(5000)
        if (!alive) return
        const q = await peekDigitAi({ game, drawId: latestId }).catch(() => null)
        if (!alive) return
        if (q?.exists && q.status === 'done' && q.result?.text) {
          applyResult(q.result, q.owner)
          setPct(100)
          setPhase('分析完成')
          setBusy(false)
          return
        }
        setPct(Math.min(96, 8 + (i + 1) * 4))
        setElapsed((i + 1) * 5)
      }
      if (!alive) return
      setBusy(false)
      setPhase('')
      setError('本期分析仍未完成，请稍后再点一次查看')
    }
    restore()
    return () => {
      alive = false
    }
  }, [game, latestId])

  if (!summary || summary.total < 10) return null

  const onTick = ({ elapsed: s, pct: p, stage }) => {
    setElapsed(s)
    setPct(p)
    setPhase(stage)
  }

  const run = async () => {
    if (busy) return
    busyRef.current = true
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
        setPhase(ROUND_STAGES[0])
        await fakeAnalyze({ seconds: sharedWaitSeconds(), stages: ROUND_STAGES, onTick })
        setText(cached.result.text)
        setMeta({
          model: cached.result.model,
          at: cached.result.at,
          cached: true,
          owner: cached.owner,
          rounds: cached.result.rounds,
          roundCount: cached.result.roundCount || cached.result.rounds?.length || 3,
        })
        setPct(100)
        setPhase('分析完成')
        return
      }

      // 5. 首位用户：真实三轮分析（进度按轮次推进，不等待模拟计时结束）
      setPhase(ROUND_STAGES[0])
      fakeAnalyze({ seconds: 45, stages: ROUND_STAGES, onTick })
      try {
        const r = await runDigitAi({
          game,
          drawId,
          label,
          messages: buildDigitMessages(freshSummary, label),
          deviceId: getDeviceId()?.id || '',
        })
        setText(r.text)
        setMeta({
          model: r.model,
          at: r.at,
          cached: Boolean(r.cached),
          owner: r.owner,
          rounds: r.rounds,
          roundCount: r.roundCount || r.rounds?.length || 3,
        })
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
              setMeta({
                model: p.result.model,
                at: p.result.at,
                cached: true,
                owner: p.owner,
                rounds: p.result.rounds,
                roundCount: p.result.roundCount || p.result.rounds?.length || 3,
              })
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
      busyRef.current = false
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
          共 3 轮 AI 分析（结构解读 → 反向质询 → 定稿合成）；点击会先同步最新开奖数据，每期仅首位用户真实调用
        </span>
      </div>

      {busy && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              {phase || ROUND_STAGES[0]}
            </span>
            <span className="mono small muted">已用 {elapsed} 秒</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
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
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {ROUND_STAGES.map((s, i) => {
              const current = phase === s
              const passed = pct >= Math.round(((i + 1) / ROUND_STAGES.length) * 100) - 1
              return (
                <span
                  key={s}
                  className="chip"
                  style={{
                    opacity: current || passed ? 1 : 0.45,
                    borderColor: current ? '#c23a2b' : undefined,
                    color: current ? '#c23a2b' : undefined,
                  }}
                >
                  <i>{passed ? '✓ ' : ''}{s}</i>
                </span>
              )
            })}
          </div>
          <div className="mono small muted" style={{ marginTop: 6 }}>
            {pct}%
          </div>
        </div>
      )}

      {error && <div className="note note-warn">{error}</div>}

      {text && (
        <>
          <div className="predict-sub" style={{ marginTop: 12 }}>
            {meta?.roundCount || 3} 轮 AI 分析 · {meta?.model} ·{' '}
            {meta?.at ? new Date(meta.at).toLocaleString('zh-CN') : ''}
            {meta?.cached ? ' · 本期共享解析' : ' · 本期首位生成'}
          </div>
          <div className="ai-report-body">{text}</div>
          {meta?.rounds?.length > 1 && (
            <details style={{ marginTop: 10 }}>
              <summary className="small muted" style={{ cursor: 'pointer' }}>
                查看 {meta.rounds.length} 轮分析过程
              </summary>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {meta.rounds.map((r, i) => (
                  <div key={i} className="note">
                    <b>
                      第 {i + 1} 轮 · {r.name}
                    </b>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.text}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
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
