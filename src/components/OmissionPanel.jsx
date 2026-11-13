// 定位号码 K 线：按「单个号码」看走势（红柱=当期开出，绿柱=未开出，柱高=遗漏）
// 指标口径与行情软件一致：布林通道、KDJ(9,3,3)、MACD(12,26,9)
// 3D / 排列三：按 百 / 十 / 个 位切换 0–9；快乐8：1–80 任选；双色球：红 1–33 / 蓝 1–16
import React, { useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import OmissionChart from './OmissionChart.jsx'
import { omissionReading, omissionSeries } from '../lib/kline.js'

const POS_LABEL = ['百位', '十位', '个位']

export default function OmissionPanel({ lottery, draws, windowN = 60 }) {
  const isDigit = lottery === 'fc3d' || lottery === 'pl3'
  const isSsq = lottery === 'ssq'
  const [pos, setPos] = useState(0)
  const [digit, setDigit] = useState(0)
  const [kind, setKind] = useState('red')
  const [num, setNum] = useState(1)

  const maxNum = isSsq ? (kind === 'red' ? 33 : 16) : 80
  const selNum = Math.min(num, maxNum)
  const selDigit = isDigit ? digit : selNum

  const hitFn = useMemo(() => {
    if (isDigit) return (d) => d.num[pos] === selDigit
    if (lottery === 'kl8') return (d) => d.nums.includes(selDigit)
    return kind === 'red' ? (d) => d.red.includes(selDigit) : (d) => d.blue === selDigit
  }, [isDigit, lottery, pos, selDigit, kind])

  const rows = useMemo(() => omissionSeries(draws, hitFn, windowN), [draws, hitFn, windowN])
  const reading = useMemo(() => omissionReading(rows), [rows])

  // 3D / 排列三：该位置 0–9 的读数总表（与讲义附录的表 2 同口径）
  const tableRows = useMemo(() => {
    if (!isDigit) return []
    return Array.from({ length: 10 }, (_, d) => {
      const r = omissionReading(omissionSeries(draws, (x) => x.num[pos] === d, windowN))
      return { digit: d, ...(r || {}) }
    })
  }, [isDigit, draws, pos, windowN])

  const title = isDigit
    ? `定位号码 K 线 · ${POS_LABEL[pos]}`
    : isSsq
      ? `号码 K 线 · ${kind === 'red' ? '红球' : '蓝球'} ${selNum}`
      : `号码 K 线 · ${selNum} 号`

  return (
    <Card title={title} tag={`近 ${windowN} 期`}>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        {isDigit &&
          POS_LABEL.map((label, i) => (
            <button key={label} className={`tab-btn ${pos === i ? 'active' : ''}`} onClick={() => setPos(i)}>
              {label}
            </button>
          ))}
        {isSsq && (
          <>
            <button className={`tab-btn ${kind === 'red' ? 'active' : ''}`} onClick={() => setKind('red')}>
              红球
            </button>
            <button className={`tab-btn ${kind === 'blue' ? 'active' : ''}`} onClick={() => setKind('blue')}>
              蓝球
            </button>
          </>
        )}
        <span className="toolbar-sep" />
        {isDigit ? (
          Array.from({ length: 10 }, (_, d) => (
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

      <OmissionChart rows={rows} />

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
            {POS_LABEL[pos]} 0–9 指标读数（截图时点口径，仅描述历史）
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
                {tableRows.map((r) => (
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
              </tbody>
            </table>
          </div>
          <Note>
            表中 K、D、J、DIF、MACD 柱都由「该号码的遗漏序列」算出，属于历史读数的客观归类。
            遗漏长短与下期是否开出没有因果关系，高位、低位、金叉、死叉都不改变每个号码的理论概率。
          </Note>
        </>
      )}
    </Card>
  )
}
