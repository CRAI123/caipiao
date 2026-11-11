// 双色球 中奖计算 —— 按红球命中数与蓝球是否命中，查奖级与奖金
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { prizeLevel, PRIZE_TABLE } from '../lib/ssqPredict.js'

/** 各奖级的中奖组合数与概率（总组合 17,721,088） */
const ODDS = [
  { level: '一等奖', combos: 1 },
  { level: '二等奖', combos: 15 },
  { level: '三等奖', combos: 162 },
  { level: '四等奖', combos: 7695 },
  { level: '五等奖', combos: 137475 },
  { level: '六等奖', combos: 1043640 },
]
const TOTAL = 17721088

/** 展示用号码：0 个红球时给一个示意 */
const SAMPLE_RED = [4, 11, 17, 23, 28, 32]
const SAMPLE_BLUE = 9

export default function SSQPrize() {
  const [redHits, setRedHits] = useState(3)
  const [blueHit, setBlueHit] = useState(false)

  const level = prizeLevel(redHits, blueHit)
  const row = PRIZE_TABLE.find((p) => p.level === level)

  const winCombos = ODDS.reduce((s, o) => s + o.combos, 0)
  const winRate = ((winCombos / TOTAL) * 100).toFixed(2)

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
                const o = ODDS.find((x) => x.level === p.level)
                return (
                  <tr key={p.level}>
                    <td>{p.level}</td>
                    <td className="mono">{p.condition}</td>
                    <td className="mono">{p.money}</td>
                    <td className="mono">{o ? o.combos.toLocaleString('zh-CN') : '—'}</td>
                    <td className="mono">
                      {o ? `1 / ${Math.round(TOTAL / o.combos).toLocaleString('zh-CN')}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Note>
          任意一注双色球的中奖概率约 {winRate}%（约 1 / 15）。一等奖、二等奖为浮动奖，
          奖金取决于当期销量与中奖注数；三至六等奖为固定奖。返奖率长期约 50%。
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
