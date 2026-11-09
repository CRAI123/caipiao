// 福彩3D 下期推荐 —— 基于多维度术语评分的下期推算 + 上期回算验证
// 支持 v1（综合评分）与 v2（位置独立+马尔可夫+指数衰减）两种算法
import React, { useMemo, useState } from 'react'
import { predictFC3D, backtestFC3D, predictFC3Dv2, backtestFC3Dv2 } from '../lib/fc3dPredict.js'

function DigitBall({ d, hot, cold, omit }) {
  let cls = 'digit-ball'
  if (hot) cls += ' hot'
  if (cold) cls += ' cold'
  return (
    <span className={cls} title={`遗漏 ${omit} 期`}>
      {d}
      <em>{omit}</em>
    </span>
  )
}

const ALGO_INFO = {
  v1: { name: '经典综合评分', desc: '热冷+跨度+和值+奇偶+形态+遗漏 8 维度加权评分' },
  v2: { name: '精准模式', desc: '位置独立建模 + 马尔可夫转移 + 指数衰减 + 遗漏回补' },
}

export default function FC3D({ draws }) {
  const [algo, setAlgo] = useState('v2')
  const pred = useMemo(() => (algo === 'v2' ? predictFC3Dv2(draws) : predictFC3D(draws)), [draws, algo])
  const backtest = useMemo(() => (algo === 'v2' ? backtestFC3Dv2(draws) : backtestFC3D(draws)), [draws, algo])

  if (!pred) {
    return (
      <div className="page">
        <div className="note note-warn">数据不足，至少需要 5 期才能进行推算。</div>
      </div>
    )
  }

  return (
    <div className="fc3d">
      {/* 玩法简介 */}
      <div className="fc3d-intro">
        <h2>下期推荐推算</h2>
        <p>
          基于 {draws.length} 期历史数据推算下期参考号码。当前算法：
          <b style={{ margin: '0 4px' }}>{ALGO_INFO[algo].name}</b>
          <span className="muted">（{ALGO_INFO[algo].desc}）</span>
        </p>
        <div className="algo-toggle">
          {Object.entries(ALGO_INFO).map(([k, v]) => (
            <button
              key={k}
              className={`tab-btn ${algo === k ? 'active' : ''}`}
              onClick={() => setAlgo(k)}
            >
              {v.name}
              {k === 'v2' && <em style={{ color: 'var(--red)' }}> · 推荐</em>}
            </button>
          ))}
        </div>
      </div>

      {/* 上期开奖 */}
      <div className="predict-row">
        <div className="predict-label">上期开奖</div>
        <div className="predict-value">
          <span className="draw-num">{pred.lastDraw.num.join(' ')}</span>
          <span className="muted mono">
            {pred.lastDraw.id ?? pred.lastDraw.drawId} · 和值 {pred.lastAnalysis.sum} · 跨度 {pred.lastAnalysis.span} ·{' '}
            {pred.lastAnalysis.oddPattern} · {pred.lastAnalysis.form}
          </span>
        </div>
      </div>

      {/* 胆码 + 拖码 */}
      <div className="predict-row">
        <div className="predict-label">胆码（必出）</div>
        <div className="predict-value">
          {pred.dan.map((d) => (
            <DigitBall key={`dan-${d}`} d={d} omit={pred.omit[d]} />
          ))}
        </div>
      </div>

      <div className="predict-row">
        <div className="predict-label">拖码（搭配）</div>
        <div className="predict-value">
          {pred.tuo.map((d) => (
            <DigitBall key={`tuo-${d}`} d={d} omit={pred.omit[d]} />
          ))}
        </div>
      </div>

      {/* v2 定位推荐 */}
      {pred.posTop && (
        <div className="predict-row">
          <div className="predict-label">定位推荐</div>
          <div className="predict-value">
            {['百', '十', '个'].map((label, i) => (
              <span key={label} className="pos-rec">
                <b>{label}</b>
                {pred.posTop[i].map((d) => (
                  <span key={d} className="digit-ball small">{d}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 热号 / 冷号 */}
      <div className="predict-row">
        <div className="predict-label">热号 Top3</div>
        <div className="predict-value">
          {pred.hot.map((d) => (
            <DigitBall key={`hot-${d}`} d={d} hot omit={pred.omit[d]} />
          ))}
        </div>
      </div>

      <div className="predict-row">
        <div className="predict-label">冷号 Top3</div>
        <div className="predict-value">
          {pred.cold.map((d) => (
            <DigitBall key={`cold-${d}`} d={d} cold omit={pred.omit[d]} />
          ))}
        </div>
      </div>

      {/* 指标预测 */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-name">跨度</div>
          <div className="metric-value">
            {pred.spanRange[0]} – {pred.spanRange[1]}
          </div>
          <div className="metric-sub">均值 {pred.spanAvg} · 众数 {pred.spanMode}</div>
        </div>
        <div className="metric-card">
          <div className="metric-name">和值</div>
          <div className="metric-value">
            {pred.sumRange[0]} – {pred.sumRange[1]}
          </div>
          <div className="metric-sub">均值 {pred.sumAvg} · 众数 {pred.sumMode}</div>
        </div>
        <div className="metric-card">
          <div className="metric-name">奇偶形态</div>
          <div className="metric-value">{pred.recommendedOdd.slice(0, 2).join(' / ')}</div>
          <div className="metric-sub">主推 {pred.oddEven?.recommendedMacro || '—'} · 位置节奏加权</div>
        </div>
        <div className="metric-card">
          <div className="metric-name">推荐形态</div>
          <div className="metric-value">{pred.recommendedForms.join(' / ')}</div>
          <div className="metric-sub">近50期出现频率</div>
        </div>
      </div>

      {/* 奇偶专项 */}
      {pred.oddEven && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>奇偶专项</h3>
            <span className="muted small">形态遗漏回补 · 位置奇偶节奏 · 连出变盘</span>
          </div>

          {/* 位置奇偶节奏 */}
          <div className="odd-pos-row">
            {pred.oddEven.perPos.map((p) => (
              <div key={p.pos} className="odd-pos">
                <div className="odd-pos-label">{p.label}位倾向</div>
                <span className={`odd-bit ${p.recommend === '奇' ? 'odd' : 'even'}`}>{p.recommend}</span>
                <div className="odd-pos-sub">
                  当前{p.current} · 连 {p.streak} 期
                </div>
                <div className="odd-pos-reason">{p.reason}</div>
              </div>
            ))}
          </div>

          {/* 8 形态评分 */}
          <div className="odd-pattern-list">
            {pred.oddEven.ranked.map((p, i) => (
              <div key={p.pattern} className={`odd-pattern ${i < 3 ? 'top' : ''}`}>
                <span className="op-name">{p.pattern}</span>
                <span className="op-macro">{p.macro}</span>
                <span className="op-omit">漏 {p.omit}</span>
                <span className="op-score">{p.score}</span>
              </div>
            ))}
          </div>

          {/* 宏观形态分布 */}
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>宏观形态</th>
                  <th>近期次数</th>
                  <th>理论概率</th>
                  <th>遗漏</th>
                  <th>理论周期</th>
                  <th>评分</th>
                </tr>
              </thead>
              <tbody>
                {pred.oddEven.macro.map((m) => (
                  <tr key={m.macro}>
                    <td>{m.macro}</td>
                    <td className="mono">{m.count}</td>
                    <td className="mono">{(m.prob * 100).toFixed(1)}%</td>
                    <td className="mono">{m.omit}</td>
                    <td className="mono">{m.cycle}</td>
                    <td className="mono">{m.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note note-info" style={{ marginTop: 12 }}>
            两奇一偶 / 两偶一奇合计占 75%（理论周期 2.67 期），全奇 / 全偶合计 25%（理论周期 8 期）。
            遗漏越久标记回补关注，但开奖独立随机，形态不会“强制平衡”。
          </div>
        </div>
      )}

      {/* 全部数字评分 */}
      <div className="digit-scores">
        <div className="predict-label">0-9 综合评分（含遗漏期数）</div>
        <div className="digit-score-row">
          {pred.ranked.map((r) => (
            <div key={r.digit} className={`digit-score ${pred.hot.includes(r.digit) ? 'hot' : ''} ${pred.cold.includes(r.digit) ? 'cold' : ''}`}>
              <span className="ds-digit">{r.digit}</span>
              <span className="ds-score">{r.score}</span>
              <span className="ds-omit">漏{pred.omit[r.digit]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 回算验证 */}
      {backtest && (
        <div className="fc3d-backtest">
          <h2 className="section-title">上期回算验证</h2>
          <div className="backtest-card">
            <div className="backtest-row">
              <div className="backtest-label">预测期号</div>
              <div className="backtest-value mono">{backtest.actualDraw.id}</div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">实际开奖</div>
              <div className="backtest-value">
                <span className="draw-num big">{backtest.actualDraw.num.join(' ')}</span>
                <span className="muted mono">
                  和值 {backtest.actualAnalysis.sum} · 跨度 {backtest.actualAnalysis.span} ·{' '}
                  {backtest.actualAnalysis.oddPattern} · {backtest.actualAnalysis.form}
                </span>
              </div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">预测胆码</div>
              <div className="backtest-value">
                {backtest.prediction.dan.map((d) => (
                  <DigitBall key={`bt-dan-${d}`} d={d} omit={backtest.prediction.omit[d]} />
                ))}
                <span className="muted">命中 {backtest.danHits.length} 个</span>
              </div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">预测拖码</div>
              <div className="backtest-value">
                {backtest.prediction.tuo.map((d) => (
                  <DigitBall key={`bt-tuo-${d}`} d={d} omit={backtest.prediction.omit[d]} />
                ))}
                <span className="muted">命中 {backtest.tuoHits.length} 个</span>
              </div>
            </div>
            <div className="backtest-divider" />
            <div className="backtest-metrics">
              <div className={`bt-metric ${backtest.digitHitCount === 3 ? 'hit' : ''}`}>
                <div className="bt-name">组选命中</div>
                <div className="bt-val">{backtest.digitHitCount}/3</div>
              </div>
              <div className={`bt-metric ${backtest.spanHit ? 'hit' : ''}`}>
                <div className="bt-name">跨度</div>
                <div className="bt-val">{backtest.spanHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.sumHit ? 'hit' : ''}`}>
                <div className="bt-name">和值</div>
                <div className="bt-val">{backtest.sumHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.oddHit ? 'hit' : ''}`}>
                <div className="bt-name">奇偶</div>
                <div className="bt-val">{backtest.oddHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.formHit ? 'hit' : ''}`}>
                <div className="bt-name">形态</div>
                <div className="bt-val">{backtest.formHit ? '✓' : '✗'}</div>
              </div>
              <div className="bt-metric total">
                <div className="bt-name">综合评分</div>
                <div className="bt-val">{backtest.score}/100</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="note note-warn" style={{ marginTop: 16 }}>
        ⚠️ 彩票开奖号码完全随机，以上推算仅为历史数据的统计描述，无法预测中奖，请理性购彩！
      </div>
    </div>
  )
}
