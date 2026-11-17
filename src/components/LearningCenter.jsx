// ============================================================
// 学习中心 —— AI 自主学习体系可视化（只读，数据契约见 src/lib/learning.js）
// 内容：诚实声明 / 权重当前值 / 命中走势 / 专家损失曲线 / 经验笔记
// 图表为自绘 SVG（viewBox 自适应宽度），风格同 OmissionChart，不引图表库。
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import { readLearning } from '../lib/learning.js'

const GAME_LABEL = { kl8: '快乐8', fc3d: '福彩3D', pl3: '排列三', pl5: '排列五', ssq: '双色球' }

const SOURCE_LABEL = {
  'algo:v7': '算法 v7',
  'algo:pool': '算法候选池',
  'algo:ssq': '算法预测',
  'ai:final': 'AI 终选',
  'ai:site': 'AI 站内',
  'mix:kl8': '混合推荐',
}

// 各彩种命中走势关注来源；查不到时回退为全部非 hedge 来源
const HIT_SOURCES = {
  kl8: ['algo:v7', 'ai:final', 'ai:site'],
  fc3d: ['ai:final', 'ai:site'],
  pl3: ['ai:final', 'ai:site'],
  pl5: ['ai:final', 'ai:site'],
  ssq: ['algo:ssq', 'ai:final', 'ai:site'],
}

const SOURCE_COLOR = {
  'algo:v7': '#24558f',
  'algo:pool': '#24558f',
  'algo:ssq': '#24558f',
  'ai:final': '#c23a2b',
  'ai:site': '#b7791f',
  'mix:kl8': '#1d6f3e',
}

const EXPERT_PALETTE = [
  '#c23a2b',
  '#24558f',
  '#1d6f3e',
  '#b7791f',
  '#7a4ea3',
  '#0e7c86',
  '#a34e2a',
  '#556270',
  '#8a8577',
]

const SOURCE_TEXT = { db: 'Neon 直连', api: '服务端 API 兜底', none: '无' }

const numOrNull = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 16)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** param_key → 中文区块名 */
function paramLabel(key) {
  if (key === 'model') return '模型权重'
  if (key === 'temp') return '温度权重'
  if (key === 'mix') return 'AI / 算法配比'
  if (key === 'windows') return 'v7 窗口权重'
  if (key === 'redSignals') return '红球信号权重'
  if (key === 'blueSignals') return '蓝球信号权重'
  const m = /^experts:p(\d+)$/.exec(key)
  if (m) return `第 ${Number(m[1]) + 1} 位专家权重`
  return key
}

/** 从已打分 meta 提取该来源的命中值 */
function hitValue(meta, game) {
  if (!meta) return null
  if (game === 'kl8') return numOrNull(meta.hits)
  if (game === 'ssq') return numOrNull(meta.redHits)
  // 数字彩：straight 命中注数（可能是逐注数组，取均值）
  const s = meta.straight
  if (Array.isArray(s)) {
    const nums = s.map(numOrNull).filter((v) => v != null)
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  }
  return numOrNull(s)
}

/** 近 30 期命中走势：按来源分系列 */
function buildHitChart(runs, game) {
  const collect = (sources) => {
    const bySource = new Map()
    for (const r of runs) {
      if (!sources.includes(r.source)) continue
      const v = hitValue(r.meta, game)
      if (v == null || r.drawId == null) continue
      if (!bySource.has(r.source)) bySource.set(r.source, new Map())
      bySource.get(r.source).set(String(r.drawId), v)
    }
    return bySource
  }
  let bySource = collect(HIT_SOURCES[game] || [])
  if (!bySource.size) {
    bySource = collect([...new Set(runs.map((r) => r.source))].filter((s) => s !== 'hedge:experts'))
  }
  if (!bySource.size) return null
  const ids = [...new Set([...bySource.values()].flatMap((m) => [...m.keys()]))]
    .sort((a, b) => {
      const na = Number(a)
      const nb = Number(b)
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
      return a < b ? -1 : 1
    })
    .slice(-30)
  const series = [...bySource.entries()].map(([src, m], idx) => ({
    name: SOURCE_LABEL[src] || src,
    color: SOURCE_COLOR[src] || EXPERT_PALETTE[idx % EXPERT_PALETTE.length],
    values: ids.map((id) => m.get(id) ?? null),
  }))
  const expected = game === 'kl8' ? 2.5 : game === 'ssq' ? 1.08 : 0.3
  const expectedLabel =
    game === 'kl8'
      ? '随机期望 2.5 个'
      : game === 'ssq'
        ? '随机期望 1.08 红'
        : '随机期望 0.3 中/注'
  return { columns: ids, series, expected, expectedLabel }
}

/** Hedge 专家损失曲线：perExpertLoss 每位取多位均值（或第一位置） */
function buildExpertChart(runs) {
  const rows = runs
    .filter((r) => r.source === 'hedge:experts' && Array.isArray(r.meta?.perExpertLoss))
    .sort((a, b) => Number(a.drawId) - Number(b.drawId))
    .slice(-30)
  if (!rows.length) return null
  const nExperts = Math.max(...rows.map((r) => r.meta.perExpertLoss.length))
  return {
    columns: rows.map((r) => String(r.drawId)),
    series: Array.from({ length: nExperts }, (_, e) => ({
      name: `专家 ${e + 1}`,
      color: EXPERT_PALETTE[e % EXPERT_PALETTE.length],
      values: rows.map((r) => {
        const cell = r.meta.perExpertLoss[e]
        if (cell == null) return null
        if (Array.isArray(cell)) {
          const nums = cell.map(numOrNull).filter((v) => v != null)
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
        }
        return numOrNull(cell)
      }),
    })),
  }
}

/** 多系列折线图：viewBox 自适应宽度，风格同 OmissionChart */
function PolylineChart({ columns, series, expected, expectedLabel, height = 170, ariaLabel = '走势图' }) {
  const W = 640
  const pad = { l: 36, r: 14, t: 14, b: 24 }
  const vals = series.flatMap((s) => s.values).filter((v) => v != null)
  if (!vals.length || !columns.length) return null
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (expected != null) {
    min = Math.min(min, expected)
    max = Math.max(max, expected)
  }
  if (max === min) {
    min -= 0.5
    max += 0.5
  }
  const room = max - min
  min = Math.max(0, min - room * 0.1)
  max += room * 0.12
  const n = columns.length
  const x = (i) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1))
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b)
  const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = min + ((max - min) * i) / 4
    return { v, y: y(v) }
  })
  const tickStep = Math.max(1, Math.ceil(n / 6))
  const ticks = columns
    .map((id, i) => ({ i, id }))
    .filter((t) => (n - 1 - t.i) % tickStep === 0 || t.i === n - 1)

  return (
    <div className="learn-chart">
      <div className="kline-legend">
        {series.map((s) => (
          <span key={s.name} className="kline-legend-item">
            <i className="kline-dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        {expected != null && (
          <span className="kline-legend-item">
            <i className="kline-dot" style={{ background: 'var(--ink-40)' }} />
            {expectedLabel}
          </span>
        )}
      </div>
      <div className="kline-chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
        >
          {grid.map((g, i) => (
            <g key={`g${i}`}>
              <line x1={pad.l} x2={W - pad.r} y1={g.y} y2={g.y} stroke="var(--ink-08)" />
              <text x={4} y={g.y + 3} className="chart-tick">
                {fmt(+g.v.toFixed(2))}
              </text>
            </g>
          ))}
          {expected != null && (
            <>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(expected)}
                y2={y(expected)}
                stroke="var(--ink-40)"
                strokeDasharray="5 4"
              />
              <text x={W - pad.r} y={y(expected) - 4} textAnchor="end" className="chart-tick">
                {expectedLabel}
              </text>
            </>
          )}
          {series.map((s) => {
            let d = ''
            let started = false
            s.values.forEach((v, i) => {
              if (v == null) {
                started = false
                return
              }
              d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
              started = true
            })
            return (
              <g key={s.name}>
                <path d={d.trim()} fill="none" stroke={s.color} strokeWidth="1.5" />
                {s.values.map((v, i) =>
                  v == null ? null : (
                    <g key={i}>
                      <circle cx={x(i)} cy={y(v)} r="2.4" fill="var(--card)" stroke={s.color} strokeWidth="1.3" />
                      <title>{`第 ${columns[i]} 期 · ${s.name} ${fmt(v)}`}</title>
                    </g>
                  ),
                )}
              </g>
            )
          })}
          {ticks.map((t) => (
            <text key={`t${t.i}`} x={x(t.i)} y={height - 6} textAnchor="middle" className="chart-tick">
              {String(t.id).slice(-4)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

/** 权重当前值：每个 param_key 一组水平条形 */
function WeightsCard({ state, coldStart }) {
  return (
    <Card title="权重当前值" tag="learning_state">
      {state.length ? (
        <div className="learn-params">
          {state.map((row) => {
            const v = row.value || {}
            const keys = Array.isArray(v.keys) ? v.keys : []
            const weights = Array.isArray(v.weights) ? v.weights : []
            const defaults = Array.isArray(v.defaults) ? v.defaults : []
            const n = Number(v.n) || 0
            return (
              <div key={row.paramKey} className="learn-param">
                <div className="learn-param-head">
                  <strong>{paramLabel(row.paramKey)}</strong>
                  <span className="mono muted small">样本 {n}</span>
                  {n < 8 && <span className="learn-badge">样本积累中 {n}/8</span>}
                </div>
                {keys.length ? (
                  keys.map((k, i) => {
                    const w = Number(weights[i]) || 0
                    const dft = defaults.length ? numOrNull(defaults[i]) : null
                    return (
                      <div
                        key={k}
                        className="learn-bar-row"
                        title={dft != null ? `默认 ${(dft * 100).toFixed(0)}%` : undefined}
                      >
                        <span className="learn-bar-label">{k}</span>
                        <span className="learn-bar-track">
                          <span className="learn-bar-fill" style={{ width: `${Math.min(100, w * 100)}%` }} />
                        </span>
                        <span className="learn-bar-value mono">{(w * 100).toFixed(1)}%</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="muted small">该参数组暂无权重数据</div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Note>暂无学习状态：服务端每日推送打分后才会写入权重。</Note>
      )}
      {coldStart && state.length > 0 && (
        <Note tone="warn">冷启动阶段（样本不足 8 期）：推荐仍按内置默认权重执行，下列数值是学习过程值。</Note>
      )}
    </Card>
  )
}

/** 经验笔记卡片流 */
function NotesCard({ notes }) {
  return (
    <Card title="经验笔记" tag="ai_experience_notes">
      {notes.length ? (
        <div className="learn-notes">
          {notes.map((nt, idx) => {
            const drawId = nt.meta?.drawId ?? nt.meta?.draw_id ?? null
            return (
              <div key={nt.id ?? `${nt.createdAt}-${idx}`} className="learn-note-card">
                <div className="learn-note-head mono">
                  <span>{fmtTime(nt.createdAt)}</span>
                  <span className="learn-note-game">{GAME_LABEL[nt.game] || nt.game || '全站'}</span>
                  {drawId != null && <span className="learn-note-draw">第 {drawId} 期</span>}
                </div>
                <p className="learn-note-body">{nt.content}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <Note>暂无经验笔记：AI 自我复盘会随每日推送生成，每彩种最多保留 12 条 active。</Note>
      )}
    </Card>
  )
}

function LearningCenterInner({ game }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await readLearning(game)
      setData(res)
      setLoadErr(res?.error || '')
    } catch (e) {
      setData(null)
      setLoadErr(e?.message || '学习数据读取失败')
    } finally {
      setLoading(false)
    }
  }, [game])

  useEffect(() => {
    load()
  }, [load])

  const runs = useMemo(() => data?.runs || [], [data])
  const hitChart = useMemo(() => buildHitChart(runs, game), [runs, game])
  const expertChart = useMemo(() => buildExpertChart(runs), [runs])
  const isDigit = game === 'fc3d' || game === 'pl3' || game === 'pl5'

  return (
    <div className="page">
      <div className="learn-honest" role="note">
        学习循环调整的是各信号权重与 AI/算法配比，优化推荐一致性与可解释性；开奖是独立随机事件，本功能不提高中奖概率。
      </div>

      <div className="learn-toolbar">
        <span className="mono small muted">
          彩种：{GAME_LABEL[game] || game} · 数据源：{SOURCE_TEXT[data?.source || 'none']}
        </span>
        <button className="tab-btn" onClick={load} disabled={loading}>
          {loading ? '读取中…' : '刷新'}
        </button>
      </div>

      {loadErr && <Note tone="warn">学习数据读取异常：{loadErr}</Note>}

      {loading && !data ? (
        <Note>正在读取学习状态…</Note>
      ) : data?.source === 'none' ? (
        <Card title="学习中心">
          <Note>
            暂无学习数据：未配置 Neon 直连、服务端兜底接口也未返回。在「设置」页接入数据库，或服务端每日推送开始写入学习状态后，这里会展示权重演化、命中走势与经验笔记。
          </Note>
        </Card>
      ) : (
        <>
          <WeightsCard state={data.state} coldStart={data.coldStart} />

          <Card title="命中走势 · 近 30 期" tag="learning_predictions">
            {hitChart ? (
              <PolylineChart
                columns={hitChart.columns}
                series={hitChart.series}
                expected={hitChart.expected}
                expectedLabel={hitChart.expectedLabel}
                ariaLabel="AI 与算法命中走势"
              />
            ) : (
              <Note>暂无已打分的预测记录：服务端每日回填命中后即可绘制。</Note>
            )}
          </Card>

          {isDigit && (
            <Card title="专家损失曲线" tag="hedge:experts">
              {expertChart ? (
                <PolylineChart
                  columns={expertChart.columns}
                  series={expertChart.series}
                  ariaLabel="Hedge 各专家逐期对数损失（多位取均值）"
                />
              ) : (
                <Note>暂无专家损失记录：Hedge 打分回填 perExpertLoss 后自动绘制。</Note>
              )}
            </Card>
          )}

          <NotesCard notes={data.notes} />
        </>
      )}
    </div>
  )
}

// 局部兜底：学习中心渲染出错只影响本页签，不拖垮整站（全局边界见 main.jsx）
class LearningBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  componentDidCatch(err, info) {
    console.error('学习中心渲染出错：', err, info)
  }

  render() {
    if (this.state.err) {
      return (
        <div className="page">
          <Card title="学习中心">
            <div className="note note-warn">
              学习中心渲染出错：{String(this.state.err?.message || this.state.err)}
              <br />
              页面其他内容不受影响，可点刷新或切换页签后重试。
            </div>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}

export default function LearningCenter({ game }) {
  return (
    <LearningBoundary>
      <LearningCenterInner game={game} />
    </LearningBoundary>
  )
}
