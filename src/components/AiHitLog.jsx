// AI 终选命中对照 —— 每期 AI 号码与真实开奖逐期对比（方法体检用）
// kind: 'digit'（3D/排三/排五）| 'kl8' | 'dlt'
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import { auditDigitAi, auditKl8Ai } from '../lib/api.js'

const LIMIT = 15

/** 两串等长号码逐位相同的个数 */
function posHits(a, b) {
  let n = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++
  return n
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : '—')

export default function AiHitLog({ game, kind = 'digit', draws, digitCount = 3, play = 10 }) {
  const [runs, setRuns] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setRuns(null)
    setErr('')
    const task = kind === 'kl8' ? auditKl8Ai({ play }) : auditDigitAi({ game })
    task
      .then((r) => {
        if (!alive) return
        if (r?.ok) setRuns(r.runs || [])
        else setErr(r?.error || '共享数据库不可用，暂无法读取 AI 记录')
      })
      .catch((e) => alive && setErr(e?.message || '读取 AI 记录失败'))
    return () => {
      alive = false
    }
  }, [game, kind, play])

  const rows = useMemo(() => {
    if (!Array.isArray(runs) || !Array.isArray(draws) || !draws.length) return []
    const byId = new Map(draws.map((d) => [Number(d.id), d]))
    const out = []
    for (const run of runs) {
      if (kind === 'kl8') {
        const d = byId.get(Number(run.drawId))
        if (!d) continue
        const set = new Set(d.nums || d.num || [])
        const hit = (run.final || []).filter((n) => set.has(n)).length
        const base = (run.algo || []).filter((n) => set.has(n)).length
        out.push({ id: Number(run.drawId), date: d.date, actual: d.nums || d.num, nums: run.final || [], hit, base })
        continue
      }
      if (kind === 'dlt') {
        const d = byId.get(Number(run.drawId) + 1)
        if (!d) continue
        const front = new Set(d.front || [])
        const back = new Set(d.back || [])
        const picks = run.picks || {}
        const hit = (picks.front || []).filter((n) => front.has(n)).length
        const backHit = (picks.back || []).filter((n) => back.has(n)).length
        out.push({
          id: Number(run.drawId) + 1,
          date: d.date,
          actual: d.front || [],
          backActual: d.back || [],
          nums: picks.front || [],
          backPicks: picks.back || [],
          hit,
          backHit,
        })
        continue
      }
      const d = byId.get(Number(run.drawId) + 1)
      if (!d) continue
      const is7 = digitCount === 7
      const arr = d.num || d.nums || []
      const actual = is7 ? arr.join(' ') : arr.join('')
      if (!is7 && actual.length !== digitCount) continue
      const picks = run.picks || {}
      const straight = picks.straight || []
      const key = [...arr].sort().join('')
      const uniq = new Set(arr).size
      const qxcHits = (a, b) => {
        const A = String(a).trim().split(/[\s,，]+/).map(Number)
        const B = String(b).trim().split(/[\s,，]+/).map(Number)
        let n = 0
        for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] === B[i]) n++
        return n
      }
      out.push({
        id: Number(run.drawId) + 1,
        date: d.date,
        actual,
        nums: straight,
        best: straight.reduce((m, x) => Math.max(m, is7 ? qxcHits(x, actual) : posHits(x, actual)), 0),
        straightHit: straight.includes(actual),
        groupHit: digitCount === 3 && uniq === 3 && (picks.group || []).some((x) => [...x].sort().join('') === key),
        group3Hit: digitCount === 3 && uniq === 2 && (picks.group3 || []).some((x) => [...x].sort().join('') === key),
      })
    }
    return out.slice(0, LIMIT)
  }, [runs, draws, kind, digitCount])

  const stat = useMemo(() => {
    const n = rows.length
    if (!n) return null
    if (kind === 'kl8') {
      const avg = rows.reduce((s, r) => s + r.hit, 0) / n
      const base = rows.reduce((s, r) => s + r.base, 0) / n
      const best = Math.max(...rows.map((r) => r.hit))
      return { n, avg, base, best }
    }
    if (kind === 'dlt') {
      const avg = rows.reduce((s, r) => s + r.hit, 0) / n
      const backs = rows.filter((r) => r.backHit === 2).length
      return { n, avg, backs }
    }
    const avg = rows.reduce((s, r) => s + r.best, 0) / n
    return {
      n,
      avg,
      straight: rows.filter((r) => r.straightHit).length,
      group: rows.filter((r) => r.groupHit).length,
      group3: rows.filter((r) => r.group3Hit).length,
    }
  }, [rows, kind])

  const title = kind === 'kl8' ? 'AI 深度分析 · 历史命中对照' : `AI 终选 · 历史命中对照（最近 ${LIMIT} 期）`

  return (
    <Card title={title} tag="AI 记录">
      {err && <Note tone="warn">{err}</Note>}
      {!err && runs === null && <div className="muted">正在读取 AI 历史记录…</div>}
      {!err && runs !== null && !rows.length && (
        <Note>
          还没有可对照的 AI 记录。在「下期推荐」里点一次 AI 分析后，这里会按开奖结果逐期对照 AI 是否命中。
        </Note>
      )}
      {stat && (
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="toolbar-label">已对照 {stat.n} 期</span>
          {kind === 'kl8' ? (
            <>
              <span className="toolbar-note">AI 平均命中 {stat.avg.toFixed(2)} / 10</span>
              <span className="toolbar-note">算法基准平均 {stat.base.toFixed(2)} / 10</span>
              <span className="toolbar-note">最好一次 {stat.best} / 10</span>
            </>
          ) : kind === 'dlt' ? (
            <>
              <span className="toolbar-note">平均命中前区 {stat.avg.toFixed(2)} / 5</span>
              <span className="toolbar-note">后区两号全中 {stat.backs} 期（{pct(stat.backs, stat.n)}）</span>
            </>
          ) : (
            <>
              <span className="toolbar-note">直选命中 {stat.straight} 期（{pct(stat.straight, stat.n)}）</span>
              {digitCount === 3 && (
                <>
                  <span className="toolbar-note">组六 {stat.group} 期</span>
                  <span className="toolbar-note">组三 {stat.group3} 期</span>
                </>
              )}
              <span className="toolbar-note">最佳一注平均命中 {stat.avg.toFixed(2)} / {digitCount} 位</span>
            </>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>日期</th>
                <th>开奖</th>
                <th>AI 号码</th>
                <th>命中</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.date || '—'}</td>
                  <td className="mono">
                    {kind === 'dlt' ? (
                      <>
                        {r.actual.join(' ')} <span className="muted">+</span> <b>{r.backActual.join(' ')}</b>
                      </>
                    ) : kind === 'kl8' ? (
                      r.actual.join(' ')
                    ) : (
                      r.actual
                    )}
                  </td>
                  <td className="mono">
                    {kind === 'dlt' ? (
                      <>
                        {r.nums.join(' ')} <span className="muted">+</span> <b>{r.backPicks.join(' ')}</b>
                      </>
                    ) : kind === 'kl8' ? (
                      r.nums.join(' ')
                    ) : r.nums.length ? (
                      r.nums.join(' / ')
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {kind === 'kl8' ? (
                      <span>
                        {r.hit} / 10 <span className="muted">（算法 {r.base}）</span>
                      </span>
                    ) : kind === 'dlt' ? (
                      <span>
                        前 {r.hit} / 5 · 后 {r.backHit} / 2
                      </span>
                    ) : r.straightHit || r.groupHit || r.group3Hit ? (
                      <span>
                        {r.straightHit ? '直选命中' : ''}
                        {r.groupHit ? ' 组六命中' : ''}
                        {r.group3Hit ? ' 组三命中' : ''}
                      </span>
                    ) : (
                      <span className="muted">
                        未中 · 最佳 {r.best} / {digitCount} 位
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Note>
        AI 只在算法候选池内终选，记录为该期开奖前生成的那一注；对照结果不改变任何一期的理论概率。
      </Note>
    </Card>
  )
}
