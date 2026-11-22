// 随机性检验卡片 —— 用卡方 / 游程 / 自相关等标准检验，量化「历史开奖是否存在可利用的序列依赖」
// 结论措辞严格遵循统计口径：p 值大 = 没有证据表明偏离随机，不等于证明了随机。
import React, { useMemo } from 'react'
import { Card, Note } from './common.jsx'
import { runAllTests } from '../lib/randomness.js'
import '../randomness.css'

const GAME_LABEL = {
  dlt: '大乐透',
  fc3d: '福彩3D',
  pl3: '排列三',
  pl5: '排列五',
  kl8: '快乐8',
}

const VERDICT_LABEL = {
  pass: '未见异常',
  warn: '轻度偏离',
  fail: '显著偏离',
}

function fmtStat(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1000) return v.toFixed(0)
  return v.toFixed(2)
}

function fmtP(p) {
  if (!Number.isFinite(p)) return '—'
  if (p < 1e-6) return '<1e-6'
  if (p < 1e-4) return '<0.0001'
  return p.toFixed(4)
}

export default function RandomnessCard({ draws = [], game = 'fc3d', maxNum = 10 }) {
  const n = Array.isArray(draws) ? draws.length : 0
  const tests = useMemo(() => {
    try {
      return runAllTests(draws, { game, maxNum })
    } catch (err) {
      console.error('随机性检验计算失败：', err)
      return []
    }
  }, [draws, game, maxNum])

  const passCount = tests.filter((t) => t.verdict === 'pass').length
  const warnCount = tests.filter((t) => t.verdict === 'warn').length
  const failCount = tests.filter((t) => t.verdict === 'fail').length
  const sampleShort = n > 0 && n < 60

  return (
    <Card title="随机性检验" tag={`${GAME_LABEL[game] || ''} · 假设检验 · ${n} 期`}>
      {tests.length === 0 ? (
        <Note tone="warn">
          当前样本 {n} 期，暂不足以进行随机性检验（至少需要 20 期，且期望频数要达到卡方近似的要求）。
          样本不足时检验效力有限，不能据此下结论。
        </Note>
      ) : (
        <>
          <div className="rnd-summary">
            共 <b>{tests.length}</b> 项检验，<b>{passCount}</b> 项未见异常，
            <b>{warnCount}</b> 项轻度偏离
            {failCount > 0 ? (
              <>
                ，<b className="rnd-verdict-fail">{failCount}</b> 项显著偏离
              </>
            ) : null}
            。
          </div>

          {sampleShort && (
            <Note tone="warn">
              样本不足（当前 {n} 期），检验效力有限：卡方近似需要足够的期望频数，p 值偏大并不代表
              「证明随机」，只是没有足够的证据。
            </Note>
          )}

          {failCount > 0 && (
            <Note tone="warn">
              出现显著偏离时请注意：偏离通常来自样本量偏小、数据缺失（期号不连续）或多重比较的偶然结果，
              不代表号码可预测。单次检验的 p 值也不能代替对方法的独立验证。
            </Note>
          )}

          <div className="rnd-table-wrap">
            <table className="rnd-table">
              <thead>
                <tr>
                  <th scope="col">检验项</th>
                  <th scope="col">统计量</th>
                  <th scope="col">自由度</th>
                  <th scope="col">p 值</th>
                  <th scope="col">结论</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td className="rnd-name">
                      {t.name}
                      {t.note && <small>{t.note}</small>}
                    </td>
                    <td className="mono rnd-stat">{fmtStat(t.stat)}</td>
                    <td className="mono">{t.df}</td>
                    <td className="mono rnd-p">{fmtP(t.p)}</td>
                    <td>
                      <span className={`rnd-badge rnd-verdict-${t.verdict}`}>
                        {VERDICT_LABEL[t.verdict] || t.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="rnd-footnote">
        说明：p 值大于 0.05 只能说明「没有证据表明历史开奖偏离随机」，并不等于「证明了开奖随机」。
        「杀号」「冷热」「和值预测」等技巧都隐含「历史存在可利用规律」这一前提；上述检验未发现该前提成立的
        统计证据。每期开奖相互独立，历史统计不能改变下一期的中奖概率。
      </p>
    </Card>
  )
}
