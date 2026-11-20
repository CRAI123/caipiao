// 双色球 中奖计算 —— 按红球命中数与蓝球是否命中，查奖级与奖金
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { prizeLevel, PRIZE_TABLE } from '../lib/ssqPredict.js'
import { SSQ_PRIZES, expectedReturn, fmtProb, fmtOneIn, fmtAmount } from '../lib/odds.js'
import '../odds.css'

/** 展示用号码：0 个红球时给一个示意 */
const SAMPLE_RED = [4, 11, 17, 23, 28, 32]
const SAMPLE_BLUE = 9

/** 单注 2 元口径的期望值（决定返奖率与每注期望亏损） */
const RET = expectedReturn(SSQ_PRIZES, 2)

export default function SSQPrize() {
  const [redHits, setRedHits] = useState(3)
  const [blueHit, setBlueHit] = useState(false)

  const level = prizeLevel(redHits, blueHit)
  const row = PRIZE_TABLE.find((p) => p.level === level)

  return (
    <div className="page">
      <Card title="中奖计算器" tag="红球命中数 + 蓝球是否命中">
        <div className="prize-step">
          <div className="prize-step-head">第 1 步 · 选择红球命中个数</div>
          <div className="ssq-pick-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <button
                key={k}
                className={`ssq-count-btn ${redHits === k ? 'active' : ''}`}
                onClick={() => setRedHits(k)}
              >
                {k} 个
              </button>
            ))}
          </div>
        </div>

        <div className="prize-step">
          <div className="prize-step-head">第 2 步 · 蓝球是否命中</div>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <button
              className={`ssq-count-btn ${blueHit ? 'active' : ''}`}
              onClick={() => setBlueHit(true)}
            >
              蓝球命中
            </button>
            <button
              className={`ssq-count-btn ${!blueHit ? 'active' : ''}`}
              onClick={() => setBlueHit(false)}
            >
              蓝球未中
            </button>
          </div>
        </div>

        <div className="prize-step">
          <div className="prize-step-head">第 3 步 · 结果</div>
          <div className="ssq-prize-result">
            <div className="ssq-prize-balls">
              {SAMPLE_RED.map((n, i) => (
                <Ball key={n} n={n} kind="red" size="sm" dim={i >= redHits} className={i < redHits ? 'ball-hit' : ''} />
              ))}
              <span className="ssq-divider" aria-hidden="true" />
              <Ball n={SAMPLE_BLUE} kind="blue" size="sm" className={blueHit ? 'ball-hit' : ''} />
            </div>
            <div className="ssq-prize-verdict">
              {level ? (
                <>
                  <span className="prize-badge prize-badge-win">{level}</span>
                  <span className="ssq-prize-money">{row?.money}</span>
                </>
              ) : (
                <>
                  <span className="prize-badge prize-badge-lose">未中奖</span>
                  <span className="muted small">
                    命中 {redHits} 红{blueHit ? ' + 蓝球' : ''}，未达到最低奖级（需蓝球命中或 4 红以上）
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Note>
          示意号码仅用于展示高亮效果。红球按你选择的命中个数点亮前 N 个，蓝球单独标记。
        </Note>
      </Card>

      <Card title="奖级与奖金" tag="现行双色球规则">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>奖级</th>
                <th>中奖条件</th>
                <th>奖金</th>
                <th>中奖组合数</th>
                <th>单注概率</th>
              </tr>
            </thead>
            <tbody>
              {PRIZE_TABLE.map((p) => {
                const o = SSQ_PRIZES.find((x) => x.level === p.level)
                return (
                  <tr key={p.level}>
                    <td>{p.level}</td>
                    <td className="mono">{p.condition}</td>
                    <td className="mono">{p.money}</td>
                    <td className="mono">{o ? o.combos.toLocaleString('zh-CN') : '—'}</td>
                    <td className="mono">{o ? fmtOneIn(o.prob) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Note>
          任意一注双色球的中奖概率为 {(RET.totalProb * 100).toFixed(4)}%（{fmtOneIn(RET.totalProb)}）。
          一等奖、二等奖为浮动奖，奖金取决于当期销量与中奖注数；三至六等奖为固定奖。返奖率长期约 50%。
        </Note>
      </Card>

      {/* 精确概率表：全部奖级由组合数学直接算出，可逐项验算 */}
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
              {SSQ_PRIZES.map((p) => (
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
                  <td className="mono">
                    {fmtAmount(p.prob * p.prize)} 元
                  </td>
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
              单注期望奖金 {RET.ev.toFixed(4)} 元 / 投入 2 元（浮动奖按 500 万、20 万估算）
            </i>
          </div>
          <div className="odds-summary-item odds-neutral">
            <span>每 2 元投注的期望亏损</span>
            <b>{RET.lossPerTicket.toFixed(4)} 元</b>
            <i className="odds-sub">每 1 元投入期望亏损 {RET.lossPerYuan.toFixed(4)} 元</i>
          </div>
        </div>

        <div className="odds-derive">
          <div>红球命中 k 个：C(6,k) · C(27,6−k) / C(33,6)，C(33,6) = 1,107,568</div>
          <div>蓝球与红球独立：命中 1/16，未中 15/16；全部单注 1,107,568 × 16 = 17,721,088</div>
          <div>四等奖 =（5 红且蓝未中）∪（4 红且蓝命中）；五等奖同理，互斥事件概率相加</div>
          <div>六等奖 = 蓝球命中 且 红球命中 0–2 个：C(6,0)C(27,6)+C(6,1)C(27,5)+C(6,2)C(27,4) = 1,043,640 注</div>
        </div>

        <Note tone="warn">
          精确概率由组合数学直接推导，可逐项验算；无论怎么选号，单注中奖概率不变；
          表中期望回报率长期为负（返奖率约 50%），这是彩票的设计属性。
        </Note>
      </Card>

      <Card title="为什么“6+1”这么难" tag="组合数学">
        <div className="ssq-base-grid mono">
          <div>红球组合：C(33,6) = 1,107,568</div>
          <div>蓝球：16 种</div>
          <div>全部单注：1,107,568 × 16 = 17,721,088</div>
          <div>一等奖概率：1 / 17,721,088 ≈ 0.0000056%</div>
          <div>连买 100 年（每年 150 期）：仍不足 0.1% 的命中机会</div>
        </div>
        <Note tone="warn">
          以上概率对任何选号方法都完全相同。所谓“提高准确率”只可能体现在
          “结构描述更贴近历史分布”，不可能提高中头奖的机会。
        </Note>
      </Card>
    </div>
  )
}
