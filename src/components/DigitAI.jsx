// 近 100 期统计 + 算法候选池 + AI 终选（福彩3D / 排列三共用）
// 与快乐8一致：算法先对直选 1000 注 / 组六 120 组 / 组三 90 组打分选池，AI 只在池内终选，失败回退算法前三。
//
// 点击分析时：
//   1. 先强制拉取最新开奖数据（不用页面上的旧数据）
//   2. 若期号没有前进且本期还没有共享解析 → 弹「暂时没有新数据」
//   3. 本期解析全站共享：首位用户真实调用，后续用户读取并模拟一段分析等待
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Note, Dialog } from './common.jsx'
import { summarizeDigit, buildDigitMessages, rankDigitCandidates, digitCandidatePool } from '../lib/digitAi.js'
import { runDigitAi, peekDigitAi, auditDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与服务端 api/digit-ai.js 的 ROUNDS 一一对应
const ROUND_STAGES = [
  '第 1/4 轮 · 结构解读',
  '第 2/4 轮 · 反向质询',
  '第 3/4 轮 · 算法候选终选',
  '第 4/4 轮 · 终审校验',
]

// 结果结构版本：与服务端 SCHEMA 对齐，旧版（候选池 / 自由推演 / 复核制）会重算
const SCHEMA = 5

const digitsOf = (s) => String(s).replace(/\D/g, '').slice(0, 3)

/** 校验 AI 给的号码格式：3 位、去重、组六三不同、组三两同（是否在候选池内由服务端校验） */
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
        roundCount: r.roundCount || r.rounds?.length || 4,
        picks: r.picks,
        finalSource: r.finalSource,
        finalNote: r.finalNote,
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

  // 算法层：全盘评分排序（直选 1000 / 组六 120 / 组三 90），用于显示算法名次与纯算法基准
  const algo = useMemo(() => (summary ? rankDigitCandidates(summary) : null), [summary])
  const algoTop = useMemo(
    () => ({
      straight: (algo?.straight || []).slice(0, 3),
      group: (algo?.group || []).slice(0, 2),
      group3: (algo?.group3 || []).slice(0, 1),
    }),
    [algo],
  )
  // 算法候选池：直选 12 注 / 组六 8 组 / 组三 5 组，AI 只能在这里终选
  const pool = useMemo(() => (summary ? digitCandidatePool(summary) : null), [summary])
  /** 号码在全盘算法里的名次（1 起），找不到返回 null */
  const algoRank = (kind, num) => {
    const i = (algo?.[kind] || []).findIndex((x) => x.num === num)
    return i >= 0 ? i + 1 : null
  }

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

  // 回测同时算「纯算法基准」：用同一期当时的历史数据做全盘评分，公平对照 AI 是否更好
  const backtest = useMemo(() => {
    if (!Array.isArray(audit) || !Array.isArray(draws)) return null
    const idxById = new Map(draws.map((d, i) => [Number(d.id), i]))
    let n = 0
    let sHit = 0
    let gHit = 0
    let g3Hit = 0
    let an = 0
    let aS = 0
    let aG = 0
    let aG3 = 0
    for (const run of audit) {
      const i = idxById.get(Number(run.drawId))
      if (i === undefined || i < 1) continue
      const actual = (draws[i - 1]?.nums || []).join('')
      if (actual.length !== 3) continue
      const key = [...actual].sort().join('')
      const uniq = new Set(actual).size
      if (run.picks) {
        n++
        if ((run.picks.straight || []).includes(actual)) sHit++
        if (uniq === 3 && (run.picks.group || []).some((x) => [...x].sort().join('') === key)) gHit++
        if (uniq === 2 && (run.picks.group3 || []).some((x) => [...x].sort().join('') === key)) g3Hit++
      }
      // 纯算法基准：只用该期及更早的数据建评分（严格前推，不用未来数据）
      const histSum = summarizeDigit(draws.slice(i, i + 100), 100)
      const rk = histSum ? rankDigitCandidates(histSum) : null
      if (rk) {
        an++
        if (rk.straight.slice(0, 3).some((x) => x.num === actual)) aS++
        if (uniq === 3 && rk.group.slice(0, 2).some((x) => x.num === key)) aG++
        if (uniq === 2 && rk.group3.slice(0, 1).some((x) => x.num === key)) aG3++
      }
    }
    return { n, sHit, gHit, g3Hit, an, aS, aG, aG3 }
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
          roundCount: cached.result.roundCount || cached.result.rounds?.length || 4,
          picks: cached.result.picks,
          finalSource: cached.result.finalSource,
          finalNote: cached.result.finalNote,
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
          algo: digitCandidatePool(freshSummary),
          deviceId: getDeviceId()?.id || '',
        })
        setText(r.text)
        setMeta({
          model: r.model,
          at: r.at,
          cached: Boolean(r.cached),
          owner: r.owner,
          rounds: r.rounds,
          roundCount: r.roundCount || r.rounds?.length || 4,
          picks: r.picks,
          finalSource: r.finalSource,
          finalNote: r.finalNote,
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
                roundCount: p.result.roundCount || p.result.rounds?.length || 4,
                picks: p.result.picks,
                finalSource: p.result.finalSource,
                finalNote: p.result.finalNote,
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
        流程和快乐8一致：<b>算法先选 → AI 终选</b>。底层算法按频率 / 遗漏 / 同位转移对全盘打分
        （直选 1000 注、组六 120 组、组三 90 组），选出候选池后由 AI 只在池内终选 3 注直选 + 2 注组六 + 1 注组三。
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 直选</div>
        <div className="predict-value">
          {(pool?.straight || []).map((n) => (
            <span key={n} className="draw-num">
              {n}
            </span>
          ))}
          <span className="muted small">{(pool?.straight || []).length} 注</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 组六</div>
        <div className="predict-value">
          {(pool?.group || []).map((n) => (
            <span key={n} className="draw-num">
              {n}
            </span>
          ))}
          <span className="muted small">{(pool?.group || []).length} 组</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 组三</div>
        <div className="predict-value">
          {(pool?.group3 || []).map((n) => (
            <span key={n} className="draw-num">
              {n}
            </span>
          ))}
          <span className="muted small">{(pool?.group3 || []).length} 组</span>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="tab-btn active" onClick={() => run()} disabled={busy}>
          {busy ? 'AI 终选中…' : picks ? '重新终选' : '🔬 AI 深度分析（算法候选 → AI 终选）'}
        </button>
        <span className="muted small">
          4 轮 AI 分析（结构解读 → 反向质询 → 算法候选终选 → 终审校验），结果全站共享；点击会先同步最新开奖数据
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
            {meta?.roundCount || 4} 轮 AI 分析 · {meta?.model} ·{' '}
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
              <div className="predict-sub" style={{ marginTop: 0, marginBottom: 6 }}>
                {meta?.finalSource === 'algo'
                  ? '⚠️ AI 终选未通过校验，已回退到算法前三'
                  : '✅ 算法候选 → AI 终选已完成'}
                {meta?.finalNote ? ` · ${meta.finalNote}` : ''}
              </div>
              {[
                ['直选推荐', picks.straight, '每注 1/1000', 'straight'],
                ['组选推荐 · 组六', picks.group, '约 1/167', 'group'],
                ['组三推荐', picks.group3, '约 1/333', 'group3'],
              ].map(([name, list, odds, kind]) =>
                list.length ? (
                  <div className="predict-row" key={name}>
                    <div className="predict-label">{name}</div>
                    <div className="predict-value">
                      {list.map((n) => (
                        <span key={n} className="draw-num" title={String(picks.reasons?.[n] || '')}>
                          {n}
                          <i style={{ fontStyle: 'normal', fontSize: 10, color: '#9b8f7d', marginLeft: 2 }}>
                            #{algoRank(kind, n) ?? '—'}
                          </i>
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

              {algoTop.straight.length > 0 && (
                <div className="note note-info" style={{ marginTop: 10 }}>
                  <b>纯算法基准</b>（不加 AI，直接取全盘评分最高）：直选{' '}
                  {algoTop.straight.map((x) => x.num).join(' ')} · 组六 {algoTop.group.map((x) => x.num).join(' ')} ·
                  组三 {algoTop.group3.map((x) => x.num).join(' ')}
                  <br />
                  与 AI 定稿重合：直选{' '}
                  {picks.straight.filter((n) => algoTop.straight.some((x) => x.num === n)).length}/
                  {picks.straight.length} · 组六{' '}
                  {picks.group.filter((n) => algoTop.group.some((x) => x.num === n)).length}/{picks.group.length} ·
                  组三 {picks.group3.filter((n) => algoTop.group3.some((x) => x.num === n)).length}/
                  {picks.group3.length}（号码后的 #N 是它在本期全盘算法评分里的名次）
                </div>
              )}

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

      {backtest && (backtest.n > 0 || backtest.an > 0) && (
        <div className="note note-info" style={{ marginTop: 12 }}>
          历史回测（同期对照，样本 {Math.max(backtest.n, backtest.an)} 期）：
          {backtest.n > 0 && (
            <>
              AI 推荐命中 直选 <b>{backtest.sHit}/{backtest.n}</b>、组六 <b>{backtest.gHit}/{backtest.n}</b>、组三{' '}
              <b>{backtest.g3Hit}/{backtest.n}</b>；
            </>
          )}
          {backtest.an > 0 && (
            <>
              纯算法基准命中 直选 <b>{backtest.aS}/{backtest.an}</b>、组六 <b>{backtest.aG}/{backtest.an}</b>、组三{' '}
              <b>{backtest.aG3}/{backtest.an}</b>。
            </>
          )}
          {Math.max(backtest.n, backtest.an) < 5
            ? '样本太少，还看不出真实水平。'
            : '这是实际命中记录，不是估计值；概率仍是直选 1/1000、组六 1/167、组三 1/333。'}
        </div>
      )}

      <Note>
        流程与快乐8一致：底层算法对全盘打分（直选 1000 注、组六 120 组、组三 90 组），
        选出直选 12 注 / 组六 8 组 / 组三 5 组的候选池，AI 只在池内终选 3 + 2 + 1 注并给出理由；终选不合规自动回退算法前三。
        概率仍是直选 1/1000、组六 1/167、组三 1/333，选号方式不会改变这一点。
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
