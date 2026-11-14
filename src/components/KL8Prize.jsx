// 快乐8 概率与奖金：严格组合数学 + 统计分组的样本外校准
// 算法部分只做概率、期望、注数展开；不做“预测”承诺
import React, { useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import {
  KL8_PLAY_LABEL,
  kl8PlayStats,
  kl8Fushi,
  kl8Dantuo,
  fmtMoney,
  fmtPct,
  fmtTickets,
} from '../lib/kl8Math.js'
import { kl8Calibration } from '../lib/kl8Calib.js'

export default function KL8Prize({ draws }) {
  const [play, setPlay] = useState(10)
  const [fushiN, setFushiN] = useState(11)
  const [dan, setDan] = useState(0)
  const [tuo, setTuo] = useState(0)

  const table = useMemo(() => Array.from({ length: 10 }, (_, i) => kl8PlayStats(i + 1)), [])
  const calib = useMemo(() => kl8Calibration(draws), [draws])

  const fushi = kl8Fushi(play, Math.max(play, Math.min(20, fushiN)))
  const dantuo = kl8Dantuo(play, Math.min(dan, play), tuo)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="各玩法概率与期望回报" tag="严格组合数学">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>玩法</th>
                <th>单注回报</th>
                <th>中任意奖</th>
                <th>返还率</th>
                <th>最低中奖</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.k}>
                  <td>
                    <b>{r.label}</b>
                  </td>
                  <td className="mono">{fmtMoney(r.ev)} 元</td>
                  <td className="mono">{fmtPct(r.anyWin)}</td>
                  <td className="mono">{fmtPct(r.returnRate)}</td>
                  <td className="muted small">中 {r.minHit} 个</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          单注 2 元，返还率 = 单注期望回报 ÷ 2。全部玩法都低于 100%，长期期望为负；
          这些数字来自超几何分布 C(k,m)×C(80−k,20−m)/C(80,20)，与选号方法无关。
        </Note>
      </Card>

      <Card title="复式 / 胆拖注数与金额" tag="组合计数">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="toolbar-label">玩法</span>
          <select className="text-input" value={play} onChange={(e) => setPlay(Number(e.target.value))} style={{ width: 100 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {KL8_PLAY_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="predict-row">
          <div className="predict-label">复式</div>
          <div className="predict-value">
            <span className="muted small">选</span>
            <input
              className="text-input"
              type="number"
              min={play}
              max={20}
              value={Math.max(play, Math.min(20, fushiN))}
              onChange={(e) => setFushiN(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <span className="muted small">个号</span>
            <span className="draw-num">{fmtTickets(fushi.tickets)} 注</span>
            <span className="muted small">金额 {fmtMoney(fushi.cost)} 元</span>
          </div>
        </div>

        <div className="predict-row">
          <div className="predict-label">胆拖</div>
          <div className="predict-value">
            <span className="muted small">胆</span>
            <input
              className="text-input"
              type="number"
              min={0}
              max={play}
              value={Math.min(dan, play)}
              onChange={(e) => setDan(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <span className="muted small">拖</span>
            <input
              className="text-input"
              type="number"
              min={0}
              max={20}
              value={tuo}
              onChange={(e) => setTuo(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <span className="draw-num">{fmtTickets(dantuo.tickets)} 注</span>
            <span className="muted small">
              {dantuo.invalid ? dantuo.invalid : `金额 ${fmtMoney(dantuo.cost)} 元`}
            </span>
          </div>
        </div>
        <Note>
          复式注数 = C(选号个数, 玩法)；胆拖注数 = C(拖码个数, 玩法 − 胆码个数)。
          注数只决定覆盖范围与成本，不改变每一注的命中概率。
        </Note>
      </Card>

      <Card title="冷热分组的样本外校准" tag={calib ? `近 ${calib.periods} 期` : '数据不足'}>
        {!calib ? (
          <Note>至少需要 20 期开奖数据才能做前推校准。</Note>
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>遗漏档位</th>
                    <th>样本（期×号）</th>
                    <th>命中率</th>
                    <th>相对 25% 基线</th>
                  </tr>
                </thead>
                <tbody>
                  {calib.buckets.map((b) => (
                    <tr key={b.name}>
                      <td>
                        <b>{b.name}</b>
                        <span className="muted small">
                          {b.name === '刚开'
                            ? '（遗漏 0）'
                            : b.name === '温'
                              ? '（1–3 期）'
                              : b.name === '冷'
                                ? '（4–7 期）'
                                : '（≥8 期）'}
                        </span>
                      </td>
                      <td className="mono">{fmtTickets(b.n)}</td>
                      <td className="mono">{b.rate == null ? '—' : fmtPct(b.rate)}</td>
                      <td className="mono" style={{ color: b.rate > 0.25 ? '#c23a2b' : '#1d6f3e' }}>
                        {b.rate == null ? '—' : `${b.rate >= 0.25 ? '+' : ''}${((b.rate - 0.25) * 100).toFixed(2)} pt`}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>近 10 期热号池</b>
                      <span className="muted small">（前 20 名）</span>
                    </td>
                    <td className="mono">{fmtTickets(calib.hot.n)}</td>
                    <td className="mono">{fmtPct(calib.hot.rate)}</td>
                    <td className="mono" style={{ color: calib.hot.rate > 0.25 ? '#c23a2b' : '#1d6f3e' }}>
                      {`${calib.hot.rate >= 0.25 ? '+' : ''}${((calib.hot.rate - 0.25) * 100).toFixed(2)} pt`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="metric-grid" style={{ marginTop: 10 }}>
              <div className="metric-card">
                <div className="metric-name">动态分组 log-loss</div>
                <div className="metric-value">{calib.logLossDyn.toFixed(6)}</div>
                <div className="metric-sub">用上文各档命中率逐期前推</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">恒定 25% 基线</div>
                <div className="metric-value">{calib.logLossBase.toFixed(6)}</div>
                <div className="metric-sub">不做任何分组判断</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">差值</div>
                <div className="metric-value" style={{ color: calib.diff < 0 ? '#c23a2b' : '#1d6f3e' }}>
                  {calib.diff >= 0 ? '+' : ''}
                  {calib.diff.toFixed(6)}
                </div>
                <div className="metric-sub">负数才代表分组有信息量</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">动态更优占比</div>
                <div className="metric-value">{fmtPct(calib.dynWinRate, 1)}</div>
                <div className="metric-sub">{fmtTickets(calib.samples)} 个样本</div>
              </div>
            </div>

            <Note>
              这段校准严格前推：每一期只使用它之前的数据估计分档命中率，再与「一律按 25%」比较。
              各档命中率通常围绕 25% 上下波动 0.1–0.5 个百分点，log-loss 差值接近 0 甚至为正——
              也就是说，冷热分组能区分样本，但不能预测下一期。这与公开复现的同类程序结论一致：
              动态概率只是有区分度的统计分组值，不构成提高中奖率的依据。
            </Note>
          </>
        )}
      </Card>
    </div>
  )
}
