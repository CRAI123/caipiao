// 双色球 下期推荐 —— 按《吴明揭秘双色球》十步研判流程输出 6 红 + 1 蓝
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, StatCard, Note, Ball, SsqDraw } from './common.jsx'
import {
  predictSSQ,
  backtestSSQ,
  analyzeDraw,
  recent5Pool,
  newOldRatio,
  heatRatio,
  repeatNeighbor,
  patternSummary,
  ssqCandidatePool,
  buildSsqMessages,
  ZONE3,
  ZONE4,
} from '../lib/ssqPredict.js'
import { runDigitAi, peekDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'

const LEVEL_CLASS = { 热: 'hot', 温: 'warm', 冷: 'cold' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与服务端 api/digit-ai.js 的 roundsSsq 一一对应
const AI_ROUNDS = [
  '第 1/4 轮 · 结构解读',
  '第 2/4 轮 · 反向质询',
  '第 3/4 轮 · 算法候选终选',
  '第 4/4 轮 · 终审校验',
]
const AI_SCHEMA = 5

// AI 终选：算法候选池 → AI 只在池内终选 6 红 + 1 蓝，结果全站共享、每期一条记录
function SsqAiCard({ draws, pred }) {
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [pct, setPct] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [stale, setStale] = useState(false)
  const busyRef = useRef(false)
  const latestId = Number(draws?.[0]?.id) || 0
  const pool = useMemo(() => ssqCandidatePool(pred), [pred])
  const picks = meta?.picks || null

  // 切页回来时从共享缓存恢复本期解析
  useEffect(() => {
    if (!latestId) return undefined
    let alive = true
    peekDigitAi({ game: 'ssq', drawId: latestId })
      .then((p) => {
        if (!alive || busyRef.current || !p?.exists) return
        if (p.status === 'done' && p.result?.text) {
          setMeta({
            model: p.result.model,
            at: p.result.at,
            cached: true,
            owner: p.owner,
            picks: p.result.picks,
            finalSource: p.result.finalSource,
            finalNote: p.result.finalNote,
          })
          if (p.result.schema !== AI_SCHEMA) setStale(true)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [latestId])

  const onTick = ({ elapsed: s, pct: p, stage }) => {
    setElapsed(s)
    setPct(p)
    setPhase(stage)
  }

  const applyResult = (r, owner) => {
    setMeta({
      model: r.model,
      at: r.at,
      cached: true,
      owner,
      picks: r.picks,
      finalSource: r.finalSource,
      finalNote: r.finalNote,
    })
    if (r.schema !== AI_SCHEMA) setStale(true)
    setPct(100)
    setPhase('分析完成')
  }

  const run = async () => {
    if (busy) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setMeta(null)
    setStale(false)
    setPhase(AI_ROUNDS[0])
    setPct(4)
    setElapsed(0)
    try {
      // 本期已有共享结果：走一遍模拟进度，让后来的人也有分析体验
      const cached = await peekDigitAi({ game: 'ssq', drawId: latestId }).catch(() => null)
      if (cached?.exists && cached.status === 'done' && cached.result?.text) {
        await fakeAnalyze({ seconds: sharedWaitSeconds(), stages: AI_ROUNDS, onTick })
        applyResult(cached.result, cached.owner)
        return
      }
      fakeAnalyze({ seconds: 45, stages: AI_ROUNDS, onTick })
      const r = await runDigitAi({
        game: 'ssq',
        drawId: latestId,
        label: '双色球',
        messages: buildSsqMessages(draws, pred),
        algo: pool,
        deviceId: getDeviceId()?.id || '',
      })
      setMeta({
        model: r.model,
        at: r.at,
        cached: Boolean(r.cached),
        owner: r.owner,
        picks: r.picks,
        finalSource: r.finalSource,
        finalNote: r.finalNote,
      })
      if (r.schema !== AI_SCHEMA) setStale(true)
      setPct(100)
      setPhase('分析完成')
    } catch (e) {
      // 别人正在分析：等待并轮询共享结果
      if (e?.status === 409) {
        setPhase('本期已有用户在分析，等待结果同步…')
        let done = false
        for (let i = 0; i < 12 && !done; i++) {
          await sleep(5000)
          const p = await peekDigitAi({ game: 'ssq', drawId: latestId }).catch(() => null)
          if (p?.exists && p.status === 'done' && p.result?.text) {
            applyResult(p.result, p.owner)
            done = true
          } else {
            setPct(Math.min(96, 20 + i * 7))
          }
        }
        if (!done) {
          setError('本期分析仍在进行中，请过一会儿再点一次查看')
          setPhase('')
        }
      } else {
        setError(e?.message || String(e))
        setPhase('')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Card title="AI 终选 · 双色球" tag={meta?.cached ? '全站共享' : 'AI'}>
      <div className="predict-sub" style={{ marginTop: 2, marginBottom: 4 }}>
        流程与 3D / 排列三 / 快乐8 一致：<b>算法先选 → AI 终选</b>。底层算法对 33 个红球、16 个蓝球打分，
        给出红球 12 个 + 蓝球 4 个候选池，AI 只在池内终选 6 红 + 1 蓝。
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 红球</div>
        <div className="predict-value">
          {(pool?.red || []).map((n) => (
            <span key={n} className="draw-num">
              {String(n).padStart(2, '0')}
            </span>
          ))}
          <span className="muted small">{(pool?.red || []).length} 个</span>
        </div>
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 蓝球</div>
        <div className="predict-value">
          {(pool?.blue || []).map((n) => (
            <span key={n} className="draw-num">
              {String(n).padStart(2, '0')}
            </span>
          ))}
          <span className="muted small">{(pool?.blue || []).length} 个</span>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="tab-btn active" onClick={run} disabled={busy}>
          {busy ? 'AI 终选中…' : picks ? '重新终选' : '🔬 AI 深度分析（算法候选 → AI 终选）'}
        </button>
        <span className="muted small">
          4 轮 AI 分析（结构解读 → 反向质询 → 算法候选终选 → 终审校验），结果全站共享；每期保留最后一次，可在「方法体检」查看是否命中
        </span>
      </div>

      {busy && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              {phase || AI_ROUNDS[0]}
            </span>
            <span className="mono small muted">已用 {elapsed} 秒</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: '#ece6da', overflow: 'hidden' }}>
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
            {AI_ROUNDS.map((s, i) => {
              const current = phase === s
              const passed = pct >= Math.round(((i + 1) / AI_ROUNDS.length) * 100) - 1
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
                  <i>
                    {passed ? '✓ ' : ''}
                    {s}
                  </i>
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

      {picks && (
        <div style={{ marginTop: 10 }}>
          <div className="predict-sub" style={{ marginTop: 0, marginBottom: 6 }}>
            {meta?.finalSource === 'algo' ? '⚠️ AI 终选未通过校验，已回退到算法候选' : '✅ 算法候选 → AI 终选已完成'}
            {meta?.finalNote ? ` · ${meta.finalNote}` : ''}
            {meta?.model ? ` · ${meta.model}` : ''}
            {meta?.at ? ` · ${new Date(meta.at).toLocaleString('zh-CN')}` : ''}
            {meta?.cached ? ' · 本期共享解析' : ' · 本期首位生成'}
          </div>
          <div className="ssq-predict-balls">
            {(picks.red || []).map((n) => (
              <Ball key={n} n={n} kind="red" size="lg" />
            ))}
            <span className="ssq-divider ssq-divider-lg" aria-hidden="true" />
            {picks.blue != null ? <Ball n={picks.blue} kind="blue" size="lg" /> : <span className="muted">蓝球缺失</span>}
          </div>
          {(() => {
            const list = (picks.red || []).filter((n) => picks.reasons?.[n])
            if (!list.length) return null
            return (
              <ul className="small muted" style={{ margin: '8px 0 0 18px', lineHeight: 1.8 }}>
                {list.map((n) => (
                  <li key={n}>
                    <b className="mono">{String(n).padStart(2, '0')}</b> {String(picks.reasons[n])}
                  </li>
                ))}
              </ul>
            )
          })()}
          <div className="note note-info" style={{ marginTop: 10 }}>
            <b>纯算法基准</b>（不加 AI，直接取算法主推）：红球 {(pred.red || []).join(' ')} · 蓝球 {pred.blue}
            <br />
            与 AI 定稿重合：红球 {(picks.red || []).filter((n) => pred.red.includes(n)).length}/6 · 蓝球{' '}
            {picks.blue === pred.blue ? '一致' : '不同'}
          </div>
          {picks.summary && <div className="note note-info" style={{ marginTop: 8 }}>{String(picks.summary)}</div>}
          {picks.risk && <div className="note note-warn" style={{ marginTop: 8 }}>{String(picks.risk)}</div>}
          {stale && <Note tone="warn">这一版解析来自旧结构，可点「重新终选」生成新的记录。</Note>}
        </div>
      )}
    </Card>
  )
}

export default function SSQPredict({ draws }) {
  const [cover, setCover] = useState(6)
  const pred = useMemo(() => predictSSQ(draws, { cover }), [draws, cover])
  const bt = useMemo(() => backtestSSQ(draws, { periods: 50, minTrain: 30 }), [draws])

  const steps = useMemo(() => {
    if (!draws.length) return []
    const pool = recent5Pool(draws)
    const no = newOldRatio(draws)
    const heat = heatRatio(draws)
    const p10 = patternSummary(draws, 10)
    const prev = draws[1]
    const rn = repeatNeighbor(prev, draws[0])
    const z3Avg = p10.zone3.avg
    const z4Avg = p10.zone4.avg
    return [
      {
        no: 1,
        title: '大势总览',
        text: `近 10 期和值均值 ${p10.sumAvg}（理论 102），跨度均值 ${p10.spanAvg}，振幅正常，按常规节奏研判。`,
      },
      {
        no: 2,
        title: '5 期重号池',
        text: `最近 5 期共出 ${pool.count} 个红球，${pool.strong ? '≥20，重号偏强，可多留旧码' : '<20，重号偏弱，优先考虑新码'}。`,
        tone: pool.strong ? 'info' : 'warn',
      },
      {
        no: 3,
        title: '新旧码配比',
        text: no
          ? `上期 6 红中旧码 ${no.old} 个、新码 ${no.new} 个（5 期旧码池 ${no.poolSize} 个）。常见配比为 2:4 或 3:3。`
          : '数据不足。',
      },
      {
        no: 4,
        title: '热温冷配比',
        text: heat
          ? `上期结构为 热 ${heat.hot} / 温 ${heat.warm} / 冷 ${heat.cold}，推荐沿用 3:2:1 或 2:2:2 的均衡配比。`
          : '数据不足。',
      },
      {
        no: 5,
        title: '三区结构',
        text: `近 10 期三区平均出号 ${z3Avg.join(' / ')}，断区率 ${p10.zone3.breakRate}%；推荐 ${pred ? pred.structure.zone3.join(':') : '2:2:2'}。`,
      },
      {
        no: 6,
        title: '四区与断区',
        text: `近 10 期四区平均 ${z4Avg.join(' / ')}，断区率 ${p10.zone4.breakRate}%。断区常见，不必强行每区都选。`,
      },
      {
        no: 7,
        title: '余数结构',
        text: pred
          ? `推荐 012 路 ${pred.structure.road012.join(':')}，三路尽量都有覆盖，避免单路扎堆。`
          : '—',
      },
      {
        no: 8,
        title: '大小 · 单双 · 质合',
        text: pred
          ? `推荐 大小 ${pred.structure.big}:${pred.structure.small}、单双 ${pred.structure.odd}:${pred.structure.even}、质合 ${pred.structure.prime}:${pred.structure.composite}，均取历史主流形态。`
          : '—',
      },
      {
        no: 9,
        title: '重邻孤',
        text: rn
          ? `上期开出 重号 ${rn.repeat.length} 个、邻号 ${rn.neighbor.length} 个、孤号 ${rn.orphan.length} 个；下期可保留 0–2 个重号。`
          : '—',
      },
      {
        no: 10,
        title: '和值 · 跨度 · 连号',
        text: pred
          ? `推荐和值 ${pred.structure.sum}、跨度 ${pred.structure.span}、连号 ${pred.structure.groups.length} 组、尾号组数 ${pred.structure.tailGroups}，全部落在高频区间。`
          : '—',
      },
    ]
  }, [draws, pred])

  if (!pred) {
    return (
      <div className="page">
        <Note tone="warn">数据不足，至少需要 12 期才能进行推算。</Note>
      </div>
    )
  }

  const latest = draws[0]
  const lastA = analyzeDraw(latest)
  const tier = pred.tiers.find((t) => t.cover === cover) || pred.tiers[0]
  const hitSet = new Set(pred.red)
  const hitBlue = pred.blue === latest.blue

  return (
    <div className="page">
      <Card title="下期推荐" tag={`基于 ${draws.length} 期历史 · 第 ${latest.id + 1} 期`}>
        <div className="ssq-predict-hero">
          <div className="ssq-predict-balls">
            {pred.red.map((n) => (
              <Ball key={n} n={n} kind="red" size="lg" />
            ))}
            <span className="ssq-divider ssq-divider-lg" aria-hidden="true" />
            <Ball n={pred.blue} kind="blue" size="lg" />
          </div>
          <div className="ssq-predict-meta">
            <div>
              <span className="muted small">蓝球备选</span>
              <span className="ssq-blue-backup">
                {pred.blueBackups.map((b) => (
                  <Ball key={b} n={b} kind="blue" size="xs" />
                ))}
              </span>
            </div>
            <div className="mono small muted">
              和值 {pred.structure.sum} · 跨度 {pred.structure.span} · AC {pred.structure.ac} · 三区{' '}
              {pred.structure.zone3.join(':')}
            </div>
            <div className="mono small muted">
              大小 {pred.structure.big}:{pred.structure.small} · 单双 {pred.structure.odd}:
              {pred.structure.even} · 质合 {pred.structure.prime}:{pred.structure.composite}
            </div>
          </div>
        </div>

        <div className="predict-row" style={{ marginTop: 8 }}>
          <div className="predict-label">上期开奖</div>
          <div className="predict-value">
            <SsqDraw draw={latest} size="sm" hitSet={hitSet} hitBlue={hitBlue} />
            <span className="muted small">
              和 {lastA.sum} · 跨 {lastA.span} · 三区 {lastA.zone3.join(':')} · 重号命中 {latest.red.filter((n) => pred.red.includes(n)).length}
            </span>
          </div>
        </div>
      </Card>

      <SsqAiCard draws={draws} pred={pred} />

      <div className="stat-grid">
        <StatCard
          label="近 50 期红球平均命中"
          value={bt.avgRedHits}
          note={`纯随机基准 ${bt.baselineRed}`}
        />
        <StatCard
          label="近 50 期蓝球命中率"
          value={`${bt.blueRate}%`}
          tone="blue"
          note={`纯随机基准 ${bt.baselineBlue}%`}
        />
        <StatCard label="候选池" value={pred.candidates.length} tone="amber" note="参与组合枚举的号码" />
        <StatCard label="杀号" value={pred.kill.length} tone="green" note="评分最低，仅供参照" />
      </div>

      <Card title="十步研判流程" tag="书中方法体系">
        <ol className="ssq-steps">
          {steps.map((s) => (
            <li key={s.no} className="ssq-step">
              <span className="ssq-step-no">{s.no}</span>
              <div>
                <div className="ssq-step-title">{s.title}</div>
                <div className="ssq-step-text">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="覆盖档位" tag="多选几个红球的命中期望与成本">
        <div className="toolbar">
          <span className="toolbar-label">覆盖红球</span>
          {pred.tiers.map((t) => (
            <button
              key={t.cover}
              className={`tab-btn ${cover === t.cover ? 'active' : ''}`}
              onClick={() => setCover(t.cover)}
            >
              {t.cover} 码
            </button>
          ))}
        </div>
        <div className="ssq-ball-row" style={{ marginTop: 12 }}>
          {tier.codes.map((n) => (
            <Ball key={n} n={n} kind="red" size="sm" className={pred.red.includes(n) ? 'ball-dan' : ''} />
          ))}
        </div>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>档位</th>
                <th>平均命中</th>
                <th>6 红全覆盖概率</th>
                <th>单蓝注数</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {pred.tiers.map((t) => (
                <tr key={t.cover} className={t.cover === cover ? 'ssq-row-active' : ''}>
                  <td>{t.cover} 码</td>
                  <td className="mono">{t.expectHits} 个</td>
                  <td className="mono">{t.fullHitRate}%</td>
                  <td className="mono">{t.bets.toLocaleString('zh-CN')}</td>
                  <td className="mono">{t.cost.toLocaleString('zh-CN')} 元</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          覆盖 k 个红球的平均命中 = k × 6/33。档位升高只增加覆盖与花费，
          “6 个红球全覆盖概率”仍是 C(k,6)/C(33,6)，不存在更划算的档位。
        </Note>
      </Card>

      <Card title="红球候选评分" tag="前 16 名 · 分数越高越贴合历史节奏">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>号码</th>
                <th>评分</th>
                <th>冷热</th>
                <th>当前遗漏</th>
                <th>入选</th>
              </tr>
            </thead>
            <tbody>
              {pred.candidates.map((c) => (
                <tr key={c.n}>
                  <td>
                    <Ball n={c.n} kind="red" size="xs" />
                  </td>
                  <td className="mono">{c.score}</td>
                  <td>
                    <span className={`ssq-level ssq-level-${LEVEL_CLASS[c.level]}`}>{c.level}</span>
                  </td>
                  <td className="mono">{c.curOmit}</td>
                  <td>
                    {pred.red.includes(c.n) ? (
                      <span className="prize-badge prize-badge-win">主推</span>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="two-col">
        <Card title="杀号参考" tag="评分最低 5 个">
          <div className="ssq-ball-row">
            {pred.kill.map((n) => (
              <Ball key={n} n={n} kind="red" size="sm" dim />
            ))}
          </div>
          <Note>杀号只是评分排名的结果，任何号码下期被抽中的机会都相同（6/33）。</Note>
        </Card>
        <Card title="蓝球候选" tag="前 8 名">
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>蓝球</th>
                  <th>评分</th>
                  <th>冷热</th>
                  <th>遗漏</th>
                  <th>平均周期</th>
                </tr>
              </thead>
              <tbody>
                {pred.blues.map((b) => (
                  <tr key={b.n} className={b.n === pred.blue ? 'ssq-row-active' : ''}>
                    <td>
                      <Ball n={b.n} kind="blue" size="xs" />
                    </td>
                    <td className="mono">{b.score}</td>
                    <td>
                      <span
                        className={`ssq-level ${
                          b.level === '热' ? 'ssq-level-hot' : b.level === '温' ? 'ssq-level-warm' : 'ssq-level-cold'
                        }`}
                      >
                        {b.level}
                      </span>
                    </td>
                    <td className="mono">{b.curOmit}</td>
                    <td className="mono muted">{b.period === Infinity ? '—' : b.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="三区 / 四区定义" tag="结构校验口径">
        <div className="ssq-base-grid mono">
          <div>三区：{ZONE3.map(([a, b]) => `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`).join(' / ')}</div>
          <div>四区：{ZONE4.map(([a, b]) => `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`).join(' / ')}</div>
        </div>
      </Card>

      <Note tone="warn">
        以上推荐是按书中十章方法做的结构化筛选，本质是“从 33 个号里挑一组看起来最像历史开奖的号码”。
        每一注的中奖概率始终是 1/17,721,088，任何方法都无法改变。请勿据此加大投入。
      </Note>
    </div>
  )
}
