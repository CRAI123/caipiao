// ============================================================
// 学习中心 —— AI 自主学习体系可视化（只读，数据契约见 src/lib/learning.js）
// 内容：诚实声明 / 权重当前值 / 权重演化 / 命中走势 / 专家损失曲线 / 对战榜 / 健康度 / 经验笔记
// 图表为自绘 SVG（viewBox 自适应宽度），风格同 OmissionChart，不引图表库。
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import { readLearning, normEntropy } from '../lib/learning.js'
import { KL8_PLAY } from '../lib/kl8Math.js'

const GAME_LABEL = {
  kl8: '快乐8',
  fc3d: '福彩3D',
  pl3: '排列三',
  qxc: '七星彩',
  dlt: '大乐透',
}

const SOURCE_LABEL = {
  'algo:v7': '算法 v7',
  'algo:pool': '算法候选池',
  'algo:dlt': '算法预测',
  'ai:final': 'AI 终选',
  'ai:site': 'AI 站内',
  'mix:kl8': '混合推荐',
}

// 各彩种命中走势关注来源；查不到时回退为全部非 hedge 来源
const HIT_SOURCES = {
  kl8: ['algo:v7', 'ai:final', 'ai:site'],
  fc3d: ['ai:final', 'ai:site'],
  pl3: ['ai:final', 'ai:site'],
  qxc: ['ai:final', 'ai:site'],
  dlt: ['algo:dlt', 'ai:final', 'ai:site'],
}

const SOURCE_COLOR = {
  'algo:v7': '#24558f',
  'algo:pool': '#24558f',
  'algo:dlt': '#24558f',
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
  if (key === 'frontSignals') return '前区信号权重'
  if (key === 'backSignals') return '后区信号权重'
  const m = /^experts:p(\d+)$/.exec(key)
  if (m) return `第 ${Number(m[1]) + 1} 位专家权重`
  return key
}

/** 从已打分 meta 提取该来源的命中值 */
function hitValue(meta, game) {
  if (!meta) return null
  if (game === 'kl8') return numOrNull(meta.hits)
  if (game === 'dlt') return numOrNull(meta.frontHits)
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
  const kl8Expected = +(KL8_PLAY * 0.25).toFixed(2)
  const expected = game === 'kl8' ? kl8Expected : game === 'dlt' ? 0.71 : game === 'qxc' ? 0.67 : 0.3
  const expectedLabel =
    game === 'kl8'
      ? `随机期望 ${kl8Expected} 个`
      : game === 'dlt'
        ? '随机期望 0.71 前区'
        : game === 'qxc'
          ? '随机期望 0.67 位/注'
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

/** 历史快照按 param_key 分组；同一天多行只保留最后一条（与 learning_history 按天 upsert 语义一致） */
function groupHistory(history) {
  const groups = new Map()
  for (const h of history || []) {
    const v = h.value || {}
    if (!h.paramKey || !h.day || !Array.isArray(v.weights)) continue
    if (!groups.has(h.paramKey)) groups.set(h.paramKey, new Map())
    groups.get(h.paramKey).set(h.day, v)
  }
  return groups
}

/** 权重演化曲线：每族一个多系列折线（每 key 一条线，x 轴 day，截尾正好显示 MM-DD）；历史 <2 天的组跳过 */
function buildHistoryCharts(history) {
  const out = []
  for (const [paramKey, byDay] of groupHistory(history)) {
    const days = [...byDay.keys()].sort()
    if (days.length < 2) continue
    const latest = byDay.get(days[days.length - 1])
    const keys =
      Array.isArray(latest.keys) && latest.keys.length === latest.weights.length
        ? latest.keys.map(String)
        : latest.weights.map((_, i) => String(i))
    out.push({
      paramKey,
      columns: days,
      series: keys.map((k, i) => ({
        name: k,
        color: EXPERT_PALETTE[i % EXPERT_PALETTE.length],
        values: days.map((d) => {
          const w = byDay.get(d).weights
          return w.length === keys.length ? numOrNull(w[i]) : null
        }),
      })),
    })
  }
  return out
}

// 对战榜不统计的过程行（无独立命中口径）
const BATTLE_SKIP = ['hedge:experts', 'models:kl8', 'mix:kl8', 'signals:dlt']

/** 近 60 期对战榜：各来源 期数 / 近10、近30期平均命中 / 跑赢随机期望比例 / 累计 logLoss */
function buildBattleBoard(runs, game) {
  const expected =
    game === 'kl8' ? +(KL8_PLAY * 0.25).toFixed(2) : game === 'dlt' ? 0.71 : game === 'qxc' ? 0.67 : 0.3
  const bySource = new Map()
  for (const r of runs) {
    if (BATTLE_SKIP.includes(r.source)) continue
    const v = hitValue(r.meta, game)
    if (v == null || r.drawId == null) continue
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source).push({ id: Number(r.drawId), v, loss: numOrNull(r.meta?.logLoss) ?? 0 })
  }
  const rows = [...bySource.entries()].map(([src, list]) => {
    const sorted = [...list].sort((a, b) => a.id - b.id)
    const vs = sorted.map((x) => x.v)
    const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
    return {
      source: src,
      count: sorted.length,
      avg10: mean(vs.slice(-10)),
      avg30: mean(vs.slice(-30)),
      beat: vs.length ? vs.filter((v) => v > expected).length / vs.length : null,
      logLoss: sorted.reduce((a, x) => a + (x.loss || 0), 0),
    }
  })
  rows.sort((a, b) => (b.avg30 ?? -Infinity) - (a.avg30 ?? -Infinity))
  return { rows, expected }
}

/** 权重波动率：逐日权重一阶差分绝对值均值，取全部参数族近 7 天平均；无数据返回 null */
function calcVolatility(history) {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const diffs = []
  for (const byDay of groupHistory(history).values()) {
    const days = [...byDay.keys()].filter((d) => d >= cutoff).sort()
    for (let i = 1; i < days.length; i++) {
      const a = byDay.get(days[i - 1]).weights
      const b = byDay.get(days[i]).weights
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !b.length) continue
      let acc = 0
      for (let k = 0; k < b.length; k++) acc += Math.abs((Number(b[k]) || 0) - (Number(a[k]) || 0))
      diffs.push(acc / b.length)
    }
  }
  if (!diffs.length) return null
  return diffs.reduce((a, b) => a + b, 0) / diffs.length
}

/** 专家集中度：当前 state 中 n≥8 族的归一化熵均值；无合格族返回 null */
function calcConcentration(state) {
  const ents = []
  for (const row of state || []) {
    const v = row.value || {}
    if (Number(v.n) >= 8 && Array.isArray(v.weights) && v.weights.length >= 2) ents.push(normEntropy(v.weights))
  }
  if (!ents.length) return null
  return ents.reduce((a, b) => a + b, 0) / ents.length
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

/** 权重演化曲线卡片：每参数族一个多系列折线（x 轴为日期，刻度截尾显示 MM-DD） */
function HistoryCard({ charts }) {
  return (
    <Card title="权重演化 · 近60天" tag="learning_history">
      {charts.length ? (
        <div className="learn-params">
          {charts.map((g) => (
            <div key={g.paramKey} className="learn-param">
              <div className="learn-param-head">
                <strong>{paramLabel(g.paramKey)}</strong>
                <span className="mono muted small">{g.columns.length} 天</span>
              </div>
              <PolylineChart
                columns={g.columns}
                series={g.series}
                ariaLabel={`${paramLabel(g.paramKey)}近60天权重演化`}
              />
            </div>
          ))}
        </div>
      ) : (
        <Note>暂无权重演化历史：每日打分快照积累满 2 天后自动绘制。</Note>
      )}
    </Card>
  )
}

/** AI vs 算法对战榜：近 60 期已打分记录的来源级历史统计（纯前端聚合） */
function BattleCard({ battle, game }) {
  return (
    <Card title="AI vs 算法对战榜" tag="近 60 期已打分记录">
      {battle.rows.length ? (
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>来源</th>
                <th>期数</th>
                <th>近10期平均命中</th>
                <th>近30期平均命中</th>
                <th>跑赢随机期望</th>
                <th>累计 logLoss</th>
              </tr>
            </thead>
            <tbody>
              {battle.rows.map((r) => (
                <tr key={r.source}>
                  <td>{SOURCE_LABEL[r.source] || r.source}</td>
                  <td className="mono">{r.count}</td>
                  <td className="mono">{r.avg10 == null ? '—' : r.avg10.toFixed(2)}</td>
                  <td className="mono">{r.avg30 == null ? '—' : r.avg30.toFixed(2)}</td>
                  <td className="mono">{r.beat == null ? '—' : `${(r.beat * 100).toFixed(0)}%`}</td>
                  <td className="mono">{r.logLoss.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Note>暂无对战数据：服务端每日打分回填命中记录后自动汇总。</Note>
      )}
      <Note>
        榜单为已打分期次与随机期望（{GAME_LABEL[game] || game} {battle.expected}）的历史对照，
        只反映过去记录的一致性；开奖独立随机，不代表未来表现、不提高中奖概率。
      </Note>
    </Card>
  )
}

/** 学习健康度：权重波动率 / 专家集中度 / 样本进度 + 一句综合结论 */
function HealthCard({ history, state }) {
  const vol = calcVolatility(history)
  const conc = calcConcentration(state)
  const ns = (state || []).map((r) => Number(r.value?.n ?? 0))
  const minN = ns.length ? Math.min(...ns) : 0
  const volText = vol == null ? '数据积累中' : vol > 0.05 ? '震荡中' : vol >= 0.01 ? '温和调整' : '已趋稳'
  const concText =
    conc == null ? '数据积累中' : conc >= 0.95 ? '接近均匀（学习尚未定型）' : conc >= 0.75 ? '有偏好' : '高度集中'
  const conclusion = [
    vol == null ? '波动率数据积累中' : `权重${volText}`,
    conc == null ? '集中度数据积累中' : `专家${concText}`,
    `样本进度 ${minN}/8`,
  ].join('，') + '。学习只优化推荐一致性与可解释性，不提高中奖概率。'
  return (
    <Card title="学习健康度" tag="派生指标">
      <div className="learn-health">
        <div className={`learn-metric${vol != null && vol > 0.05 ? ' learn-metric-warn' : ''}`}>
          <span className="learn-metric-label">权重波动率 · 近7天</span>
          <strong>{volText}</strong>
          <span className="mono muted small">{vol == null ? '—' : vol.toFixed(4)}</span>
        </div>
        <div className="learn-metric">
          <span className="learn-metric-label">专家集中度（归一化熵）</span>
          <strong>{conc == null ? '—' : conc.toFixed(3)}</strong>
          <span className="muted small">{concText}</span>
        </div>
        <div className="learn-metric">
          <span className="learn-metric-label">样本进度 min(n)/8</span>
          <strong>{minN}/8</strong>
          <span className="muted small">{minN >= 8 ? '全部参数族已过冷启动阈值' : '仍有参数族未达阈值'}</span>
        </div>
      </div>
      <Note>{conclusion}</Note>
    </Card>
  )
}

/** 每日学习日报：本彩种最新一条 digest 笔记置顶展示 */
function DigestCard({ note }) {
  if (!note) return null
  return (
    <Card title="今日学习日报" tag="learning_digest">
      <p className="learn-note-body">{note.content}</p>
      <div className="learn-note-head mono">
        <span>{fmtTime(note.createdAt)}</span>
        {note.meta?.drawId != null && <span className="learn-note-draw">第 {note.meta.drawId} 期</span>}
      </div>
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
            const kind = nt.meta?.kind
            return (
              <div key={nt.id ?? `${nt.createdAt}-${idx}`} className="learn-note-card">
                <div className="learn-note-head mono">
                  <span>{fmtTime(nt.createdAt)}</span>
                  <span className="learn-note-game">{GAME_LABEL[nt.game] || nt.game || '全站'}</span>
                  {kind === 'digest' && <span className="learn-note-game learn-note-kind">日报</span>}
                  {kind === 'weekly' && <span className="learn-note-game learn-note-kind">周报</span>}
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
  const history = useMemo(() => data?.history || [], [data])
  const hitChart = useMemo(() => buildHitChart(runs, game), [runs, game])
  const expertChart = useMemo(() => buildExpertChart(runs), [runs])
  const historyCharts = useMemo(() => buildHistoryCharts(history), [history])
  const battle = useMemo(() => buildBattleBoard(runs, game), [runs, game])
  const digestNote = useMemo(() => (data?.notes || []).find((n) => n.meta?.kind === 'digest') || null, [data])
  const isDigit = game === 'fc3d' || game === 'pl3' || game === 'qxc'

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
          <DigestCard note={digestNote} />

          <WeightsCard state={data.state} coldStart={data.coldStart} />

          <HistoryCard charts={historyCharts} />

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

          <BattleCard battle={battle} game={game} />

          <HealthCard history={history} state={data.state} />

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
