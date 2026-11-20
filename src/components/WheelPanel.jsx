// 保底缩水器 —— 覆盖设计构造 + 穷举校验 + 命中分布
// 双色球与数字彩共用：只关心「号码池 + 每注个数 k + 目标保证 t」
import React, { useMemo, useState } from 'react'
import { Card, Note, pad2 } from './common.jsx'
import {
  combinationCount,
  greedyCover,
  verifyCover,
  hitDistribution,
  MAX_COMBOS,
} from '../lib/wheel.js'
import '../wheel.css'

/** 百分比展示：极小值不留 0.00% 的误导 */
function pct(rate) {
  const v = rate * 100
  if (v === 0) return '0%'
  if (v < 0.01) return '<0.01%'
  return `${v.toFixed(2)}%`
}

function fmt(n) {
  return Number(n).toLocaleString('zh-CN')
}

/**
 * 生成缩水方案。
 * 胆码等价性：整注命中 ≥ t ⟺ 拖码部分命中 ≥ t-d，因此构造与校验都在
 * (拖码池, k-d, t-d) 上完成（详见 lib/wheel.js 文件头注释）。
 */
function buildPlan({ pool, dan, k, t, maxTickets }) {
  const d = dan.length
  const need = k - d
  if (need < 1) {
    return { error: `胆码 ${d} 个已占满每注 ${k} 个号码，没有拖码空间，请减少胆码或调整 k。` }
  }
  if (pool.length < need) {
    return { error: `号码池（拖码）不足：当前 ${pool.length} 个，至少需要 ${need} 个。` }
  }
  if (t <= d) {
    return { trivial: true, d, k, t, need, poolSize: pool.length }
  }

  const tp = t - d // 拖码部分需要保证的命中数
  const candidateCount = combinationCount(pool.length, need)
  if (candidateCount > MAX_COMBOS) {
    return {
      error: `候选注 C(${pool.length},${need}) = ${fmt(candidateCount)} 超过 ${fmt(MAX_COMBOS)}，请缩小号码池或降低每注号码数。`,
    }
  }

  const started = Date.now()
  let cover
  try {
    cover = greedyCover(pool, need, tp, { maxTickets })
  } catch (e) {
    return { error: e.message }
  }
  if (!cover.tickets.length) {
    return { error: '未能构造出任何一注，请检查号码池与参数。' }
  }

  const verify = verifyCover(pool, cover.tickets, need, tp)
  const dist = hitDistribution(pool, cover.tickets, need)
  // 整注号码 = 胆码 + 拖码部分（升序）
  const tickets = cover.tickets.map((part) => [...dan, ...part].sort((a, b) => a - b))

  return {
    trivial: false,
    d,
    k,
    t,
    tp,
    need,
    poolSize: pool.length,
    tickets,
    total: tickets.length,
    cost: tickets.length * 2,
    coveredAll: cover.coveredAll,
    uncovered: cover.uncovered,
    lowerBound: cover.lowerBound,
    candidateCount,
    verify,
    dist,
    elapsedMs: Date.now() - started,
  }
}

export default function WheelPanel({
  kind = 'ssq',
  pool = [],
  dan = [],
  kOptions = [6],
  tOptions = [4, 5, 6],
  defaultK,
  defaultT,
  defaultMaxTickets = 600,
}) {
  const [kState, setKState] = useState(defaultK ?? kOptions[0])
  const [tState, setTState] = useState(defaultT ?? tOptions[0])
  const [maxTickets, setMaxTickets] = useState(defaultMaxTickets)
  const [run, setRun] = useState(null)

  const k = kOptions.includes(kState) ? kState : kOptions[0]
  const tList = tOptions.filter((x) => x <= k)
  const t = tList.includes(tState) ? tState : tList[0]

  const d = dan.length
  const need = k - d
  const candidateCount = need >= 1 ? combinationCount(pool.length, need) : 0

  let blockReason = ''
  if (need < 1) blockReason = `胆码 ${d} 个已占满每注 ${k} 个号码，没有拖码空间。`
  else if (pool.length < need) blockReason = `号码池（拖码）至少需要 ${need} 个，当前 ${pool.length} 个。`
  else if (candidateCount > MAX_COMBOS) {
    blockReason = `候选注 C(${pool.length},${need}) = ${fmt(candidateCount)} 超过 ${fmt(MAX_COMBOS)}，请缩小号码池或降低每注号码数。`
  }

  const tpPreview = t - d
  const lowerBound =
    tpPreview > 0 && need >= 1
      ? Math.ceil(combinationCount(pool.length, tpPreview) / combinationCount(need, tpPreview))
      : 1
  const slow = !blockReason && candidateCount > 20000

  // 只有点击按钮才计算，避免每次勾选号码都阻塞界面
  const plan = useMemo(() => {
    if (!run) return null
    return buildPlan(run)
  }, [run])

  const stale =
    !!run &&
    (run.pool.join(',') !== pool.join(',') ||
      run.dan.join(',') !== dan.join(',') ||
      run.k !== k ||
      run.t !== t)

  function handleRun() {
    if (blockReason) return
    const limit = Math.max(1, Math.min(2000, Math.floor(Number(maxTickets)) || 1))
    setMaxTickets(limit)
    setRun({
      pool: [...pool],
      dan: [...dan],
      k,
      t,
      maxTickets: limit,
      stamp: Date.now(),
    })
  }

  const fmtNum = kind === 'digit' ? (n) => String(n) : pad2

  return (
    <Card title="保底缩水" tag={`覆盖设计 · ${kind === 'ssq' ? '红球' : '组选口径'}`}>
      <Note tone="warn">
        <b>先读这句：</b>缩水不改变中奖概率。它只是把同样多的钱摊到更多组合上，换取
        「若开奖号码全部落在你的号码池内（且胆码全部开出），则至少有一注命中 t 个号」的
        确定性保证。注数减少的同时，命中总奖金的期望不变；中奖概率只由彩票规则决定，
        选号方式无法改变它。
      </Note>

      <div className="wheel-controls">
        <label className="wheel-field">
          每注号码数 k
          <select
            value={k}
            onChange={(e) => setKState(Number(e.target.value))}
            disabled={kOptions.length <= 1}
          >
            {kOptions.map((v) => (
              <option key={v} value={v}>
                {v} 个
              </option>
            ))}
          </select>
        </label>
        <label className="wheel-field">
          目标保证 t
          <select value={t} onChange={(e) => setTState(Number(e.target.value))}>
            {tList.map((v) => (
              <option key={v} value={v}>
                至少命中 {v} 个
              </option>
            ))}
          </select>
        </label>
        <label className="wheel-field">
          最大注数上限
          <input
            type="number"
            min="1"
            max="2000"
            step="1"
            value={maxTickets}
            onChange={(e) => setMaxTickets(e.target.value)}
          />
        </label>
        <button className="wheel-run" onClick={handleRun} disabled={!!blockReason}>
          生成缩水方案
        </button>
      </div>

      <p className="wheel-hint">
        号码池 {pool.length} 个{d > 0 ? '（拖码）' : '（复选）'} · 胆码 {d} 个 ·{' '}
        {need >= 1 ? (
          <>
            等价于「{pool.length} 选 {need}，保证命中 {tpPreview > 0 ? tpPreview : 0} 个」
          </>
        ) : (
          '拖码空间不足'
        )}
        {need >= 1 && candidateCount > 0 && (
          <>
            {' '}
            · 候选注 C({pool.length},{need}) = {fmt(candidateCount)} · 理论下界 {lowerBound} 注
          </>
        )}
      </p>

      {blockReason && <p className="wheel-warn">{blockReason}</p>}
      {slow && (
        <p className="wheel-warn">
          候选注较多（{fmt(candidateCount)}），点击生成后可能停顿数秒；号码池越大，覆盖构造与穷举校验越慢。
        </p>
      )}
      {stale && <p className="wheel-hint">上方选号或参数已变化，请重新点击「生成缩水方案」。</p>}

      {plan?.error && <p className="wheel-warn">{plan.error}</p>}

      {plan?.trivial && (
        <p className="wheel-hint">
          胆码已有 {plan.d} 个，任一注都天然至少命中 {plan.d} 个号（≥ 目标 {plan.t} 个），
          无需再做缩水；直接按原复式/胆拖方案投注即可。
        </p>
      )}

      {plan && !plan.trivial && !plan.error && (
        <>
          <div className="wheel-stats">
            <div className="wheel-stat">
              <div className="wheel-stat-label">缩水后注数</div>
              <div className="wheel-stat-value">
                {plan.total}
                <small>注</small>
              </div>
            </div>
            <div className="wheel-stat">
              <div className="wheel-stat-label">总成本</div>
              <div className="wheel-stat-value">
                ¥{fmt(plan.cost)}
                <small>{kind === 'ssq' ? '蓝球按 1 个计' : '每注 2 元'}</small>
              </div>
            </div>
            <div className="wheel-stat">
              <div className="wheel-stat-label">完整覆盖</div>
              <div className={`wheel-stat-value ${plan.coveredAll ? 'wheel-ok' : 'wheel-fail'}`}>
                {plan.coveredAll ? '是' : '否'}
                <small>{plan.coveredAll ? '全部组合已覆盖' : `剩余 ${fmt(plan.uncovered)} 个目标`}</small>
              </div>
            </div>
            <div className="wheel-stat">
              <div className="wheel-stat-label">理论下界 / 实际</div>
              <div className="wheel-stat-value">
                {plan.lowerBound}
                <small>/ {plan.total} 注</small>
              </div>
            </div>
          </div>

          {!plan.coveredAll && (
            <p className="wheel-warn">
              受最大注数上限限制，仍有 {fmt(plan.uncovered)} 个覆盖目标（t 子集）未被覆盖；
              可提高上限后重算，但注数与成本会同步增加。
            </p>
          )}

          <div className="wheel-verify">
            {plan.verify.skipped ? (
              <p className="wheel-warn">穷举校验已跳过：{plan.verify.reason}</p>
            ) : plan.verify.ok ? (
              <p className="wheel-verify-ok">
                穷举校验通过：模拟全部 {fmt(plan.verify.total)} 种开奖（池内 {plan.poolSize} 选{' '}
                {plan.need}），每种都至少有一注命中 {plan.t} 个号
                {plan.d > 0 ? `（已含 ${plan.d} 个胆码）` : ''}。
              </p>
            ) : (
              <p className="wheel-verify-fail">
                穷举校验未通过：{fmt(plan.verify.failsTotal)} 种开奖的最高命中低于 {plan.t} 个
                （含胆码）。最坏情况下最多命中 {plan.verify.minHits + plan.d} 个。
              </p>
            )}
            {!plan.verify.skipped && plan.verify.fails.length > 0 && (
              <ul className="wheel-fails">
                {plan.verify.fails.slice(0, 5).map((f) => (
                  <li key={f.draw.join('-')}>
                    开奖 {f.draw.map(fmtNum).join(' ')} → 最多命中 {f.hits + plan.d} 个
                  </li>
                ))}
              </ul>
            )}
            <p className="wheel-hint">
              生成用时约 {plan.elapsedMs} ms · 平均最好命中{' '}
              {plan.verify.skipped ? '—' : (plan.verify.avgHits + plan.d).toFixed(2)} 个
              {plan.d > 0 ? '（含胆码）' : ''}。
            </p>
          </div>

          {plan.dist.length > 0 && (
            <div className="table-scroll wheel-table-wrap">
              <table className="ledger-table wheel-table">
                <thead>
                  <tr>
                    <th>开奖最多命中{plan.d > 0 ? '（含胆码）' : ''}</th>
                    <th>情况数</th>
                    <th>占比</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.dist.map((row, i) => {
                    const hits = row.hits + plan.d
                    const isWorst = i === 0
                    const isBest = i === plan.dist.length - 1
                    return (
                      <tr key={row.hits} className={isWorst ? 'wheel-row-worst' : ''}>
                        <td className="mono">{hits} 个</td>
                        <td className="mono">{fmt(row.count)}</td>
                        <td className="mono">{pct(row.rate)}</td>
                        <td className="small muted">
                          {isWorst ? '最坏情况（保底）' : isBest && plan.dist.length > 1 ? '最好情况' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <details className="wheel-tickets">
            <summary>展开查看 {plan.total} 注号码（默认收起）</summary>
            <ol className="wheel-ticket-list">
              {plan.tickets.map((tk, i) => (
                <li key={i} className="wheel-ticket">
                  <span className="wheel-ticket-index">{String(i + 1).padStart(3, '0')}</span>
                  {tk.map((n) => (
                    <span
                      key={n}
                      className={`wheel-num ${dan.includes(n) ? 'wheel-num-dan' : 'wheel-num-tuo'}`}
                    >
                      {fmtNum(n)}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}

      <Note>
        保证是<b>条件保证</b>：前提是开奖号码全部落在号码池内、且胆码全部开出。
        若开奖含池外号码或胆码未全中，保证不成立。{kind === 'digit' ? ' 本卡片按组选（不定位）口径计算；若按直选投注，成本与覆盖含义需另行换算。' : ' 本卡片只统计红球，蓝球按每注 1 个计。'}
      </Note>
    </Card>
  )
}
