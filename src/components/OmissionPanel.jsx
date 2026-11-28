// 定位号码 K 线：按「单个号码」看走势（红柱=当期开出，绿柱=未开出，柱高=遗漏）
// 指标口径与行情软件一致：布林通道、KDJ(9,3,3)、MACD(12,26,9)
// 3D / 排列三：按 百 / 十 / 个 位切换 0–9；快乐8：1–80 任选；大乐透：前区 1–35 / 后区 1–12
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import OmissionChart from './OmissionChart.jsx'
import { omissionReading, omissionSeries, DEFAULT_PRESET } from '../lib/kline.js'

const POS_LABEL = ['百位', '十位', '个位']

const SORTS = [
  { key: 'default', label: '默认（0–9）' },
  { key: 'omit', label: '遗漏 ↓' },
  { key: 'k', label: 'K ↓' },
  { key: 'j', label: 'J ↓' },
]

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'high', label: '超买' },
  { key: 'low', label: '超卖' },
  { key: 'gold', label: '金叉' },
  { key: 'dead', label: '死叉' },
]

function matchFilter(r, key) {
  if (key === 'high') return (r.k ?? 0) > 80 || (r.j ?? 0) > 80
  if (key === 'low') return (r.k ?? 100) < 20
  if (key === 'gold') return (r.state || '').includes('金叉')
  if (key === 'dead') return (r.state || '').includes('死叉')
  return true
}

export default function OmissionPanel({
  lottery,
  draws,
  windowN = 60,
  preset = DEFAULT_PRESET,
  positions = POS_LABEL,
}) {
  const isDigit = lottery === 'fc3d' || lottery === 'pl3' || lottery === 'qxc'
  const isDlt = lottery === 'dlt'
  const [pos, setPos] = useState(0)
  const [digit, setDigit] = useState(0)
  const [kind, setKind] = useState('front')
  const [num, setNum] = useState(1)
  const [sortKey, setSortKey] = useState('default')
  const [filterKey, setFilterKey] = useState('all')
  const digitMax = lottery === 'qxc' && pos === 6 ? 14 : 9
  // 切换彩种后位置数可能变少（七星彩 7 位 → 福彩3D 3 位），把越界的位置拉回 0
  useEffect(() => {
    if (pos >= positions.length) setPos(0)
  }, [pos, positions.length])

  const maxNum = isDlt ? (kind === 'front' ? 35 : 12) : 80
  const selNum = Math.min(num, maxNum)
  const selDigit = isDigit ? digit : selNum

  const hitFn = useMemo(() => {
    if (isDigit) return (d) => d.num[pos] === selDigit
    if (lottery === 'kl8') return (d) => d.nums.includes(selDigit)
    return kind === 'front' ? (d) => d.front.includes(selDigit) : (d) => d.back.includes(selDigit)
  }, [isDigit, lottery, pos, selDigit, kind])

  const rows = useMemo(() => omissionSeries(draws, hitFn, windowN), [draws, hitFn, windowN])
  const reading = useMemo(() => omissionReading(rows, preset), [rows, preset])

  // 3D / 排列三：该位置 0–9 的读数总表（与讲义附录的表 2 同口径）
  const tableRows = useMemo(() => {
    if (!isDigit) return []
    return Array.from({ length: digitMax + 1 }, (_, d) => {
      const r = omissionReading(omissionSeries(draws, (x) => x.num[pos] === d, windowN), preset)
      return { digit: d, ...(r || {}) }
    })
  }, [isDigit, draws, pos, windowN, preset, digitMax])

  // 排序 + 筛选只作用于展示，不改动任何数值
  const viewRows = useMemo(() => {
    const list = tableRows.filter((r) => matchFilter(r, filterKey))
    if (sortKey === 'omit') return [...list].sort((a, b) => (b.omission ?? -1) - (a.omission ?? -1))
    if (sortKey === 'k') return [...list].sort((a, b) => (b.k ?? -1) - (a.k ?? -1))
    if (sortKey === 'j') return [...list].sort((a, b) => (b.j ?? -1) - (a.j ?? -1))
    return list
  }, [tableRows, sortKey, filterKey])

  const exportCsv = () => {
    const head = ['号码', '遗漏', 'K', 'D', 'J', 'DIF', 'MACD柱', '图形状态']
    const lines = viewRows.map((r) =>
      [
        r.digit,
        r.omission ?? '',
        r.k ?? '',
        r.d ?? '',
        r.j ?? '',
        r.dif ?? '',
        r.hist ?? '',
        (r.state || '').replace(/,/g, '，'),
      ].join(','),
    )
    const csv = `\ufeff${[head.join(','), ...lines].join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${lottery}-${positions[pos]}-指标读数.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const title = isDigit
    ? `定位号码 K 线 · ${positions[pos]}`
    : isDlt
      ? `号码 K 线 · ${kind === 'front' ? '前区' : '后区'} ${selNum}`
      : `号码 K 线 · ${selNum} 号`

  return (
    <Card title={title} tag={`近 ${windowN} 期`}>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        {isDigit &&
          positions.map((label, i) => (
            <button
              key={label}
              className={`tab-btn ${pos === i ? 'active' : ''}`}
              onClick={() => {
                setPos(i)
                if (lottery !== 'qxc' || i !== 6) setDigit((d) => Math.min(d, 9))
              }}
            >
              {label}
            </button>
          ))}
        {isDlt && (
          <>
            <button className={`tab-btn ${kind === 'front' ? 'active' : ''}`} onClick={() => setKind('front')}>
              前区
            </button>
            <button className={`tab-btn ${kind === 'back' ? 'active' : ''}`} onClick={() => setKind('back')}>
              后区
            </button>
          </>
        )}
        <span className="toolbar-sep" />
        {isDigit ? (
          Array.from({ length: digitMax + 1 }, (_, d) => (
            <button key={d} className={`tab-btn ${digit === d ? 'active' : ''}`} onClick={() => setDigit(d)}>
              {d}
            </button>
          ))
        ) : (
          <>
            <span className="toolbar-label">号码</span>
            <select
              className="text-input"
              value={selNum}
              onChange={(e) => setNum(Number(e.target.value))}
              style={{ width: 90 }}
            >
              {Array.from({ length: maxNum }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>
                  {String(v).padStart(2, '0')}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <OmissionChart rows={rows} preset={preset} />

      {reading && (
        <div className="metric-grid" style={{ marginTop: 10 }}>
          <div className="metric-card">
            <div className="metric-name">当前遗漏</div>
            <div className="metric-value">{reading.omission}</div>
            <div className="metric-sub">距上次开出 {reading.omission} 期</div>
          </div>
          <div className="metric-card">
            <div className="metric-name">KDJ</div>
            <div className="metric-value">
              {reading.k} / {reading.d} / {reading.j}
            </div>
            <div className="metric-sub">K / D / J · 80 超买 20 超卖</div>
          </div>
          <div className="metric-card">
            <div className="metric-name">MACD</div>
            <div className="metric-value">
              {reading.hist > 0 ? '+' : ''}
              {reading.hist}
            </div>
            <div className="metric-sub">
              DIF {reading.dif} · DEA {reading.dea}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-name">通道</div>
            <div className="metric-value">
              {reading.lower ?? '—'} – {reading.upper ?? '—'}
            </div>
            <div className="metric-sub">中轨 {reading.mid ?? '—'}</div>
          </div>
        </div>
      )}

      <Note>
        读数状态：<b>{reading ? reading.state : '—'}</b>。红柱是开奖结果出来后的事后标注，
        指标全部由已开出的历史序列算出，开奖前看不到任何“下期会开出”的信号。
      </Note>

      {isDigit && tableRows.length > 0 && (
        <>
          <div className="predict-sub" style={{ marginTop: 14 }}>
            {positions[pos]} 0–9 指标读数（截图时点口径，仅描述历史）
          </div>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <span className="toolbar-label">排序</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                className={`tab-btn ${sortKey === s.key ? 'active' : ''}`}
                onClick={() => setSortKey(s.key)}
              >
                {s.label}
              </button>
            ))}
            <span className="toolbar-sep" />
            <span className="toolbar-label">筛选</span>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`tab-btn ${filterKey === f.key ? 'active' : ''}`}
                onClick={() => setFilterKey(f.key)}
              >
                {f.label}
              </button>
            ))}
            <span className="toolbar-sep" />
            <button className="tab-btn" onClick={exportCsv}>
              导出 CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>号码</th>
                  <th>遗漏</th>
                  <th>K</th>
                  <th>D</th>
                  <th>J</th>
                  <th>DIF</th>
                  <th>MACD 柱</th>
                  <th>图形状态</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((r) => (
                  <tr key={r.digit}>
                    <td>
                      <b>{r.digit}</b>
                    </td>
                    <td className="mono">{r.omission ?? '—'}</td>
                    <td className="mono">{r.k ?? '—'}</td>
                    <td className="mono">{r.d ?? '—'}</td>
                    <td className="mono">{r.j ?? '—'}</td>
                    <td className="mono">{r.dif ?? '—'}</td>
                    <td className="mono">{r.hist == null ? '—' : `${r.hist > 0 ? '+' : ''}${r.hist}`}</td>
                    <td className="muted small">{r.state ?? '数据不足'}</td>
                  </tr>
                ))}
                {!viewRows.length && (
                  <tr>
                    <td colSpan={8} className="muted small">
                      当前筛选下没有符合条件的号码。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Note>
            排序与筛选只改变展示顺序，不改变数值；表中 K、D、J、DIF、MACD 柱都由「该号码的遗漏序列」算出，
            属于历史读数的客观归类。遗漏长短与下期是否开出没有因果关系，高位、低位、金叉、死叉都不改变每个号码的理论概率。
          </Note>
        </>
      )}
    </Card>
  )
}
