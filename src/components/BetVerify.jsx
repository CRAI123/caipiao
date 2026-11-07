// 投注方案回测 —— 用最近 N 期开奖检验一组单式/复式/胆拖方案的命中与奖金
import React, { useState } from 'react'
import { Card, Note, yuan } from './common.jsx'
import { evaluateBet, takeLatest, PLAY_LABEL } from '../lib/stats.js'

const WINDOW_OPTIONS = [1, 5, 10, 20]

export default function BetVerify({ bet, draws }) {
  const [windowN, setWindowN] = useState(5)
  const sample = takeLatest(draws, windowN)

  const results = sample.map((d) => {
    const hitSet = new Set(d.nums)
    const ev = evaluateBet(bet, hitSet)
    const winCount = ev.rows.reduce((s, r) => s + (r.prize > 0 ? r.count : 0), 0)
    const danHit = bet.dans.filter((n) => hitSet.has(n)).length
    return { draw: d, ev, winCount, danHit }
  })

  const totalPrize = results.reduce((s, r) => s + r.ev.totalPrize, 0)
  const totalCost = bet.cost * results.length
  const totalWin = results.reduce((s, r) => s + r.winCount, 0)
  const totalNotes = bet.count * results.length

  return (
    <Card
      title={`回测 · ${PLAY_LABEL[bet.play]} 方案在最近 ${windowN} 期的表现`}
      tag={`每期成本 ${yuan(bet.cost)}`}
    >
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <span className="toolbar-label">回测期数</span>
        {WINDOW_OPTIONS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${windowN === n ? 'active' : ''}`}
            onClick={() => setWindowN(n)}
          >
            最近 {n} 期
          </button>
        ))}
        <span className="toolbar-note">
          中奖 {totalWin} / {totalNotes} 注 · 盈亏 {yuan(totalPrize - totalCost)}
        </span>
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>期号</th>
              <th>日期</th>
              {bet.dans.length > 0 && <th>胆码命中</th>}
              <th>中奖注数</th>
              <th>奖金</th>
              <th>盈亏</th>
              <th>最高命中</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ draw, ev, winCount, danHit }) => (
              <tr key={draw.id}>
                <td className="mono">{draw.id}</td>
                <td className="mono muted">{draw.date || '—'}</td>
                {bet.dans.length > 0 && (
                  <td className="mono">
                    {danHit} / {bet.dans.length}
                  </td>
                )}
                <td className="mono">{winCount}</td>
                <td className="mono">{yuan(ev.totalPrize)}</td>
                <td className="mono" style={{ color: ev.profit >= 0 ? 'var(--blue)' : 'var(--red)' }}>
                  {ev.profit >= 0 ? '+' : ''}
                  {yuan(ev.profit)}
                </td>
                <td className="mono">{ev.rows[0]?.hits ?? 0} 个</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bet.mode === 'dantuo' && (
        <Note tone="warn">
          <b>胆码是全组方案的「单点故障」</b>：本期胆码只命中 {results[0].danHit} / {bet.dans.length} 个。
          {bet.play >= 8
            ? ` 选${bet.play > 8 ? '九' : '八'}、选十的头奖要求命中 ${bet.play} 个号码，4 个胆码必须全部命中，否则包含它们的每一注都拿不到头奖。`
            : ''}
        </Note>
      )}

      <Note>
        回测只说明「这套号码在过去几期恰好中了多少」，<b>不代表未来表现</b>。任何方案每期都与随机机选中奖概率相同。
      </Note>
    </Card>
  )
}
