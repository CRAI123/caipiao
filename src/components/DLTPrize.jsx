// 大乐透 中奖计算 —— 按前区命中数 + 后区命中数查奖级与奖金（含追加投注）
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { prizeLevel, PRIZE_TABLE } from '../lib/dltPredict.js'
import { DLT_PRIZES, expectedReturn, fmtProb, fmtOneIn, fmtAmount } from '../lib/odds.js'
import '../odds.css'

/** 展示用号码：0 个命中时给一个示意 */
const SAMPLE_FRONT = [3, 11, 17, 24, 31]
const SAMPLE_BACK = [4, 9]

/** 单注 2 元口径的期望值 */
const RET = expectedReturn(DLT_PRIZES, 2)

/** 追加投注：一至六等奖按基本奖金 80% 追加（多花 1 元/注） */
export const ADDON_LEVELS = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖']

export default function DLTPrize() {
  const [frontHits, setFrontHits] = useState(2)
  const [backHits, setBackHits] = useState(0)

  const level = prizeLevel(frontHits, backHits)
  const row = PRIZE_TABLE.find((p) => p.level === level)
  const odds = DLT_PRIZES.find((p) => p.level === level)
  const addon = ADDON_LEVELS.includes(level)

  return (
    <div className="page">
      <Card title="中奖计算器" tag="前区命中数 + 后区命中数">
        <div className="prize-step">
          <div className="prize-step-head">第 1 步 · 前区命中个数（0–5）</div>
          <div className="ssq-pick-grid">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <button
                key={k}
                className={`ssq-count-btn ${frontHits === k ? 'active' : ''}`}
                onClick={() => setFrontHits(k)}
              >
                {k} 个
              </button>
            ))}
          </div>
        </div>

        <div className="prize-step">
          <div className="prize-step-head">第 2 步 · 后区命中个数（0–2）</div>
          <div className="row-actions" style={{ marginTop: 0 }}>
            {[0, 1, 2].map((k) => (
              <button
                key={k}
                className={`ssq-count-btn ${backHits === k ? 'active' : ''}`}
                onClick={() => setBackHits(k)}
              >
                中 {k} 个
              </button>
            ))}
          </div>
        </div>

        <div className="prize-step">
          <div className="prize-step-head">第 3 步 · 结果</div>
          <div className="ssq-prize-result">
            <div className="ssq-prize-balls">
              {SAMPLE_FRONT.map((n, i) => (
                <Ball
                  key={n}
                  n={n}
                  kind="red"
                  size="sm"
                  dim={i >= frontHits}
                  className={i < frontHits ? 'ball-hit' : ''}
                />
              ))}
              <span className="ssq-divider" aria-hidden="true" />
              {SAMPLE_BACK.map((n, i) => (
                <Ball
                  key={n}
                  n={n}
                  kind="blue"
                  size="sm"
                  dim={i >= backHits}
                  className={i < backHits ? 'ball-hit' : ''}
                />
              ))}
            </div>
            <div className="ssq-prize-verdict">
              {level ? (
                <>
                  <span className="prize-badge prize-badge-win">{level}</span>
                  <span className="ssq-prize-money">{row?.money}</span>
                  {addon && (
                    <span className="muted small">
                      追加投注可再得基本奖金的 80%（约 {odds ? Math.round(odds.prize * 0.8).toLocaleString('zh-CN') : '—'} 元）
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="prize-badge prize-badge-lose">未中奖</span>
                  <span className="muted small">
                    命中 {frontHits} 前区 + {backHits} 后区，未达到最低奖级（九等奖需 3 前区或 2 后区等）
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Note>
          示意号码仅用于展示高亮效果。前区按你选择的命中个数点亮前 N 个，后区单独标记。
        </Note>
      </Card>

      <Card title="奖级与奖金" tag="现行大乐透规则（九奖级）">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>奖级</th>
                <th>中奖条件</th>
                <th>基本奖金</th>
                <th>追加奖金</th>
                <th>中奖组合数</th>
                <th>单注概率</th>
              </tr>
            </thead>
            <tbody>
              {PRIZE_TABLE.map((p) => {
                const o = DLT_PRIZES.find((x) => x.level === p.level)
                return (
                  <tr key={p.level}>
                    <td>{p.level}</td>
                    <td className="mono">{p.condition}</td>
                    <td className="mono">{p.money}</td>
                    <td className="mono">
                      {ADDON_LEVELS.includes(p.level) ? `${Math.round(o.prize * 0.8).toLocaleString('zh-CN')} 元` : '—'}
                    </td>
                    <td className="mono">{o ? o.combos.toLocaleString('zh-CN') : '—'}</td>
                    <td className="mono">{o ? fmtOneIn(o.prob) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Note>
          任意一注大乐透的中奖概率为 {(RET.totalProb * 100).toFixed(4)}%（{fmtOneIn(RET.totalProb)}）。
          一、二等奖为浮动奖，奖金取决于当期销量与中奖注数；三至九等奖为固定奖。
          追加投注每注多花 1 元，一至六等奖可额外获得基本奖金的 80%，七至九等奖没有追加奖金。
        </Note>
      </Card>

      <Card title="精确概率表" tag="超几何分布 · 逐项可验算">
        <div className="table-scroll">
          <table className="ledger-table odds-table">
            <thead>
              <tr>
                <th>奖级</th>
                <th>中奖条件</th>
                <th>中奖概率</th>
                <th>单注奖金</th>
                <th>期望值贡献</th>
              </tr>
            </thead>
            <tbody>
              {DLT_PRIZES.map((p) => (
                <tr key={p.level}>
                  <td>
                    <b>{p.level}</b>
                  </td>
                  <td className="mono small">{p.condition}</td>
                  <td>
                    <span className="odds-prob">{fmtProb(p.prob)}</span>
                    <span className="odds-onein">{fmtOneIn(p.prob)}</span>
                  </td>
                  <td className="mono">
                    {p.prize.toLocaleString('zh-CN')} 元
                    {p.prizeNote && <span className="odds-sub">{p.prizeNote}</span>}
                  </td>
                  <td className="mono">{fmtAmount(p.prob * p.prize)} 元</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="odds-summary">
          <div className="odds-summary-item">
            <span>合计中奖概率</span>
            <b>{(RET.totalProb * 100).toFixed(4)}%</b>
            <i className="odds-sub">{fmtOneIn(RET.totalProb)}（任一奖级）</i>
          </div>
          <div className="odds-summary-item">
            <span>总期望回报率</span>
            <b>{(RET.returnRate * 100).toFixed(2)}%</b>
            <i className="odds-sub">
              单注期望奖金 {RET.ev.toFixed(4)} 元 / 投入 2 元（浮动奖按 800 万、15 万估算）
            </i>
          </div>
          <div className="odds-summary-item odds-neutral">
            <span>每 2 元投注的期望亏损</span>
            <b>{RET.lossPerTicket.toFixed(4)} 元</b>
            <i className="odds-sub">每 1 元投入期望亏损 {RET.lossPerYuan.toFixed(4)} 元</i>
          </div>
        </div>

        <div className="odds-derive">
          <div>前区命中 k 个：C(5,k) · C(30,5−k) / C(35,5)，C(35,5) = 324,632</div>
          <div>后区命中 j 个：C(2,j) · C(10,2−j) / C(12,2)，C(12,2) = 66</div>
          <div>全部单注：324,632 × 66 = 21,425,712</div>
          <div>八、九等奖是多个命中形态的并集，互斥事件概率直接相加</div>
        </div>

        <Note tone="warn">
          精确概率由组合数学直接推导，可逐项验算；无论怎么选号，单注中奖概率不变；
          表中期望回报率长期低于 100%，这是彩票的设计属性。
        </Note>
      </Card>

      <Card title="为什么“5+2”这么难" tag="组合数学">
        <div className="ssq-base-grid mono">
          <div>前区组合：C(35,5) = 324,632</div>
          <div>后区组合：C(12,2) = 66</div>
          <div>全部单注：324,632 × 66 = 21,425,712</div>
          <div>一等奖概率：1 / 21,425,712 ≈ 0.0000047%</div>
          <div>连买 100 年（每年约 150 期）：仍不足 0.1% 的命中机会</div>
        </div>
        <Note tone="warn">
          以上概率对任何选号方法都完全相同。所谓“提高准确率”只可能体现在
          “结构描述更贴近历史分布”，不可能提高中头奖的机会。
        </Note>
      </Card>
    </div>
  )
}
