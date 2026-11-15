// 近 100 期统计 + AI 推算号码（福彩3D / 排列三共用）
// AI 在全盘里自行推演（直选 000-999、组六 220 组、组三 90 组），统计候选只作参考不作限制。
//
// 点击分析时：
//   1. 先强制拉取最新开奖数据（不用页面上的旧数据）
//   2. 若期号没有前进且本期还没有共享解析 → 弹「暂时没有新数据」
//   3. 本期解析全站共享：首位用户真实调用，后续用户读取并模拟一段分析等待
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Note, Dialog } from './common.jsx'
import { summarizeDigit, buildDigitMessages } from '../lib/digitAi.js'
import { runDigitAi, peekDigitAi, auditDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与服务端 api/digit-ai.js 的 ROUNDS 一一对应
const ROUND_STAGES = ['第 1/3 轮 · 结构解读', '第 2/3 轮 · 反向质询', '第 3/3 轮 · 定稿合成']

// 结果结构版本：与服务端 SCHEMA 对齐，旧版（只从候选池挑号）会重算
const SCHEMA = 3

const digitsOf = (s) => String(s).replace(/\D/g, '').slice(0, 3)

/** 校验 AI 给的号码格式：3 位、去重、组六三不同、组三两同；不再限制在候选池内 */
function sanitizePicks(raw) {
  if (!raw) return null
  const take = (arr, max, kinds) =>
    (Array.isArray(arr) ? arr : [])
      .map(digitsOf)
      .filter((n) => n.length === 3)
      .filter((n) => kinds.includes(new Set(n).size))
      .filter((n, i, a) => a.indexOf(n) === i)
      .slice(0, max)
  const straight = take(raw.straight, 5, [1, 2, 3])
  const group = take(raw.group, 5, [3])
  const group3 = take(raw.group3, 3, [2])
  if (!straight.length && !group.length && !group3.length) return null
  return { straight, group, group3, reasons: raw.reasons || {}, summary: raw.summary || '', risk: raw.risk || '' }
}

function DigitAIInner({ draws, label = '福彩3D', game = 'fc3d', onRefreshData }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [pct, setPct] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [tip, setTip] = useState('')
  const [stale, setStale] = useState(false)

  const summary = useMemo(
    () => (Array.isArray(draws) && draws.length ? summarizeDigit(draws, 100) : null),
    [draws],
  )
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
        picks: r.picks,
      })
      if (r.schema !== SCHEMA) setStale(true)
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

  const picks = useMemo(() => sanitizePicks(meta?.picks), [meta])

  const [audit, setAudit] = useState(null)

  // 历史 AI 推荐回测：拿已生成的历史推荐对照实际开奖期
  useEffect(() => {
    let alive = true
    auditDigitAi({ game })
      .then((r) => {
        if (alive && r?.ok) setAudit(r.runs || [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [game])

  const backtest = useMemo(() => {
    if (!Array.isArray(audit) || !Array.isArray(draws)) return null
    const byId = new Map(draws.map((d) => [Number(d.id), d]))
    let n = 0
    let sHit = 0
    let gHit = 0
    let g3Hit = 0
    for (const run of audit) {
      const next = byId.get(Number(run.drawId) + 1)
      const actual = (next?.nums || []).join('')
      if (!run.picks || actual.length !== 3) continue
      n++
      if ((run.picks.straight || []).includes(actual)) sHit++
      const key = [...actual].sort().join('')
      const uniq = new Set(actual).size
      if (uniq === 3 && (run.picks.group || []).some((x) => [...x].sort().join('') === key)) gHit++
      if (uniq === 2 && (run.picks.group3 || []).some((x) => [...x].sort().join('') === key)) g3Hit++
    }
    return { n, sHit, gHit, g3Hit }
  }, [audit, draws])

  if (!summary || summary.total < 10) return null

  const onTick = ({ elapsed: s, pct: p, stage }) => {
    setElapsed(s)
    setPct(p)
    setPhase(stage)
  }

  const run = async ({ force = false } = {}) => {
    if (busy) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setText('')
    setMeta(null)
    setStale(false)
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

      // 2. 本期是否已有共享解析（旧版结构没有号码，视为需要重算）
      let cached = null
      let old = null
      try {
        const p = await peekDigitAi({ game, drawId })
        if (p?.exists && p.status === 'done' && p.result?.text) {
          if (p.result.schema === SCHEMA) cached = p
          else old = p
        }
      } catch {
        /* 数据库不可用时继续走实时分析 */
      }

      // 3. 没有新数据、也没有可用的解析 → 提示
      if (!hasNew && !cached && !old && !force) {
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
          picks: cached.result.picks,
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
          picks: r.picks,
        })
        if (r.schema !== SCHEMA) setStale(true)
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
                picks: p.result.picks,
              })
              if (p.result.schema !== SCHEMA) setStale(true)
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
    <Card title={`AI 推算下期号码 · ${label}`} tag={meta?.cached ? '全站共享' : 'AI'}>
      <div className="predict-sub" style={{ marginTop: 2, marginBottom: 4 }}>
        下面三行只是近 {summary.total} 期的<b>统计参考</b>（频率 / 遗漏 / 位置转移加权），
        不是给 AI 的限制——AI 会在全盘里自行推演：直选 000-999、组六 220 组、组三 90 组。
      </div>
      <div className="predict-row">
        <div className="predict-label">统计参考 · 直选</div>
        <div className="predict-value">
          {(summary.candidates?.straight || []).map((x) => (
            <span key={x.join('')} className="draw-num">
              {x.join('')}
            </span>
          ))}
          <span className="muted small">按频率/遗漏/转移加权排序</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">统计参考 · 组选</div>
        <div className="predict-value">
          {(summary.candidates?.group || []).map((x) => (
            <span key={`g${x.join('')}`} className="draw-num">
              {x.join('')}
            </span>
          ))}
          <span className="muted small">组六，不含重号</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">统计参考 · 组三</div>
        <div className="predict-value">
          {(summary.candidates?.group3 || []).map((x) => (
            <span key={`g3${x.join('')}`} className="draw-num">
              {x[0]}
              {x[0]}
              {x[1]}
            </span>
          ))}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="tab-btn active" onClick={() => run()} disabled={busy}>
          {busy ? 'AI 推算中…' : picks ? '重新推算' : 'AI 推算本期号码'}
        </button>
        <span className="muted small">
          3 轮 AI 分析（结构解读 → 反向质询 → 全盘定稿），结果全站共享；点击会先同步最新开奖数据
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

          {stale && !picks && (
            <div className="note note-warn" style={{ marginTop: 8 }}>
              这一版解析只有文字、没有推荐号码。
              <button
                className="tab-btn active"
                style={{ marginLeft: 8 }}
                onClick={() => run({ force: true })}
                disabled={busy}
              >
                重新生成号码
              </button>
            </div>
          )}

          {picks && (
            <div style={{ marginTop: 8 }}>
              {[
                ['直选推荐', picks.straight, '每注 1/1000'],
                ['组选推荐 · 组六', picks.group, '约 1/167'],
                ['组三推荐', picks.group3, '约 1/333'],
              ].map(([name, list, odds]) =>
                list.length ? (
                  <div className="predict-row" key={name}>
                    <div className="predict-label">{name}</div>
                    <div className="predict-value">
                      {list.map((n) => (
                        <span key={n} className="draw-num" title={String(picks.reasons?.[n] || '')}>
                          {n}
                        </span>
                      ))}
                      <span className="muted small">{list.length} 注 · {odds}</span>
                    </div>
                  </div>
                ) : null,
              )}

              {(() => {
                const all = [...picks.straight, ...picks.group, ...picks.group3].filter(
                  (n) => picks.reasons?.[n],
                )
                if (!all.length) return null
                return (
                  <ul className="small muted" style={{ margin: '4px 0 0 18px', lineHeight: 1.8 }}>
                    {all.map((n) => (
                      <li key={n}>
                        <b className="mono">{n}</b> {String(picks.reasons[n])}
                      </li>
                    ))}
                  </ul>
                )
              })()}

              {picks.summary && (
                <div className="note note-info" style={{ marginTop: 10 }}>{String(picks.summary)}</div>
              )}
              {picks.risk && (
                <div className="note note-warn" style={{ marginTop: 8 }}>{String(picks.risk)}</div>
              )}
            </div>
          )}

          {!picks && <div className="ai-report-body">{text}</div>}

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

      {backtest && backtest.n > 0 && (
        <div className="note note-info" style={{ marginTop: 12 }}>
          历史回测：已有 {backtest.n} 期 AI 推荐能对上后续开奖 ·
          直选命中 <b>{backtest.sHit}</b> 期（每期 3 注）· 组选命中 <b>{backtest.gHit}</b> 期（每期 2 注）·
          组三命中 <b>{backtest.g3Hit}</b> 期（每期 1 注）
          {backtest.n < 5 ? '。样本太少，还看不出真实水平' : '。这是实际命中记录，不是估计值'}
        </div>
      )}

      <Note>
        推荐号码是 AI 在全盘里推演的（直选 000-999、组六 220 组、组三 90 组），
        上面的统计只是参考，不构成限制。每注直选中奖概率恒为 1/1000、组六约 1/167、组三约 1/333，AI 选号不会改变这一点。
      </Note>

      <Dialog open={Boolean(tip)} text={tip} onClose={() => setTip('')} />
    </Card>
  )
}

// 局部兜底：AI 卡片自身渲染出错时只影响这张卡，不会让整页白屏
class DigitAIBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  componentDidCatch(err, info) {
    console.error('AI 卡片渲染出错：', err, info)
  }

  render() {
    if (this.state.err) {
      return (
        <Card title="AI 推算">
          <div className="note note-warn">
            AI 卡片渲染出错：{String(this.state.err?.message || this.state.err)}
            <br />
            页面其他内容不受影响，可刷新后重试。
          </div>
        </Card>
      )
    }
    return this.props.children
  }
}

export default function DigitAI(props) {
  return (
    <DigitAIBoundary>
      <DigitAIInner {...props} />
    </DigitAIBoundary>
  )
}
