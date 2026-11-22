// 近 100 期统计 + 算法候选池 + AI 终选（福彩3D / 排列三共用）
// 与快乐8一致：算法先对直选 1000 注 / 组六 120 组 / 组三 90 组打分选池，AI 只在池内终选，失败回退算法前三。
//
// 点击分析时：
//   1. 先强制拉取最新开奖数据（不用页面上的旧数据）
//   2. 若还没有新一期开奖，直接用当前最新开奖数据生成解析（不拦截）
//   3. 本期解析全站共享：首位用户真实调用，后续用户读取并模拟一段分析等待
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Note } from './common.jsx'
import {
  summarizeDigit,
  buildDigitMessages,
  rankDigitCandidates,
  digitCandidatePool,
  summarizeDigit5,
  buildPL5Messages,
  rankPL5Candidates,
  pl5CandidatePool,
  summarizeQxc,
  buildQXCMessages,
  rankQXCCandidates,
  qxcCandidatePool,
} from '../lib/digitAi.js'
import { runDigitAi, peekDigitAi, auditDigitAi } from '../lib/api.js'
import { getDeviceId } from '../lib/device.js'
import { buildDigitReview } from '../lib/aiReview.js'
import { fakeAnalyze, sharedWaitSeconds } from '../lib/aiWait.js'
import { buildFunFacts } from '../lib/aiFunFacts.js'
import AiWaitTheater from './AiWaitTheater.jsx'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 与服务端 api/digit-ai.js 的 ROUNDS 一一对应
const ROUND_STAGES = [
  '第 1/4 轮 · 结构解读',
  '第 2/4 轮 · 反向质询',
  '第 3/4 轮 · 算法候选终选',
  '第 4/4 轮 · 终审校验',
]

// 等待剧场分步文案：desc 均为 api/digit-ai.js 四轮实际职责的事实描述
const WAIT_STAGES = ROUND_STAGES.map((label, i) => ({
  label,
  desc: [
    '通读位置频率、遗漏、和值与跨度统计，解读本期号码结构',
    '以质疑者身份审查第一轮结论，标记过度解读与样本不足',
    '只在算法候选池内终选号码，输出推荐与理由',
    '逐个校验注数、位数与候选池归属，不合规即替换为次优号',
  ][i],
}))

// 结果结构版本：与服务端 SCHEMA 对齐，旧版（候选池 / 自由推演 / 复核制）会重算
const SCHEMA = 7

const digitsOf = (s, digitCount = 3) => String(s).replace(/\D/g, '').slice(0, digitCount)

/** 校验 AI 给的号码格式：位数、去重、组六三不同、组三两同（是否在候选池内由服务端校验） */
function sanitizePicks(raw, digitCount = 3) {
  if (!raw) return null
  if (digitCount === 7) {
    const norm = (x) => {
      if (Array.isArray(x)) return x.map(Number)
      const s = String(x || '').trim()
      if (!s) return null
      const parts = s.split(/[\s,，]+/).filter(Boolean)
      if (parts.length === 7 && parts.every((p) => /^\d+$/.test(p))) return parts.map(Number)
      if (/^\d{8}$/.test(s)) {
        const a = s.split('').map(Number)
        return [a[0], a[1], a[2], a[3], a[4], a[5], a[6] * 10 + a[7]]
      }
      return null
    }
    const straight = (Array.isArray(raw.straight) ? raw.straight : [])
      .map(norm)
      .filter(
        (a) =>
          a &&
          a.length === 7 &&
          a.slice(0, 6).every((d) => d >= 0 && d <= 9) &&
          a[6] >= 0 &&
          a[6] <= 14,
      )
      .map((a) => a.join(' '))
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .slice(0, 8)
    if (!straight.length) return null
    return { straight, group: [], group3: [], reasons: raw.reasons || {}, summary: raw.summary || '', risk: raw.risk || '' }
  }
  const take = (arr, max, kinds) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => digitsOf(x, digitCount))
      .filter((n) => n.length === digitCount)
      .filter((n) => kinds.includes(new Set(n).size))
      .filter((n, i, a) => a.indexOf(n) === i)
      .slice(0, max)
  const straight = take(raw.straight, 8, [1, 2, 3, 4, 5])
  const group = digitCount === 3 ? take(raw.group, 5, [3]) : []
  const group3 = digitCount === 3 ? take(raw.group3, 3, [2]) : []
  if (!straight.length && !group.length && !group3.length) return null
  return { straight, group, group3, reasons: raw.reasons || {}, summary: raw.summary || '', risk: raw.risk || '' }
}

function DigitAIInner({ draws, label = '福彩3D', game = 'fc3d', onRefreshData, digitCount = 3 }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [pct, setPct] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [stale, setStale] = useState(false)

  const is5 = digitCount === 5
  const is7 = digitCount === 7
  const waitFacts = useMemo(() => buildFunFacts(game, draws), [game, draws])
  const summary = useMemo(() => {
    if (!Array.isArray(draws) || !draws.length) return null
    return (is7 ? summarizeQxc : is5 ? summarizeDigit5 : summarizeDigit)(draws, 100)
  }, [draws, is5, is7])
  const busyRef = useRef(false)
  const latestId = Number(draws?.[0]?.id) || 0

  // 挂载时不自动从共享缓存恢复解析：结果只在用户点击「AI 分析」后展示；来了新一期回到空态
  useEffect(() => {
    setText('')
    setMeta(null)
    setStale(false)
    setError('')
  }, [latestId])

  const picks = useMemo(() => sanitizePicks(meta?.picks, digitCount), [meta, digitCount])

  // 算法层：全盘评分排序（3 位：直选 1000 / 组六 120 / 组三 90；5 位：直选 10 万）
  const algo = useMemo(
    () =>
      summary
        ? is7
          ? rankQXCCandidates(summary)
          : is5
            ? rankPL5Candidates(summary)
            : rankDigitCandidates(summary)
        : null,
    [summary, is5, is7],
  )
  const algoTop = useMemo(
    () => ({
      straight: (algo?.straight || []).slice(0, is7 ? 5 : is5 ? 5 : 3),
      group: (algo?.group || []).slice(0, 2),
      group3: (algo?.group3 || []).slice(0, 1),
    }),
    [algo, is5, is7],
  )
  // 算法候选池：3 位为直选 24 注 / 组六 12 组 / 组三 8 组；5 位为直选 20 注；7 位为直选 24 注
  const pool = useMemo(
    () =>
      summary
        ? is7
          ? qxcCandidatePool(summary)
          : is5
            ? pl5CandidatePool(summary)
            : digitCandidatePool(summary)
        : null,
    [summary, is5, is7],
  )
  /** 号码在全盘算法里的名次（1 起），找不到返回 null */
  const algoRank = (kind, num) => {
    const i = (algo?.[kind] || []).findIndex(
      (x) => (Array.isArray(x.num) ? x.num.join(' ') : x.num) === num,
    )
    return i >= 0 ? i + 1 : null
  }
  const fmtNum = (n) => (Array.isArray(n) ? n.join(' ') : n)

  const [audit, setAudit] = useState(null)

  // 历史 AI 推荐回测：拿已生成的历史推荐对照实际开奖期
  useEffect(() => {
    let alive = true
    auditDigitAi({ game })
      .then((r) => {
        if (alive && r?.ok) setAudit(r.runs || [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [game])

  // 上期复盘：上期 AI 号码 vs 实际开奖，既用于本轮提示，也直接展示在卡片上
  const review = useMemo(
    () => buildDigitReview(audit || [], draws || [], digitCount),
    [audit, draws, digitCount],
  )

  // 回测同时算「纯算法基准」：用同一期当时的历史数据做全盘评分，公平对照 AI 是否更好
  const backtest = useMemo(() => {
    if (!Array.isArray(audit) || !Array.isArray(draws)) return null
    const idxById = new Map(draws.map((d, i) => [Number(d.id), i]))
    let n = 0
    let sHit = 0
    let gHit = 0
    let g3Hit = 0
    let an = 0
    let aS = 0
    let aG = 0
    let aG3 = 0
    for (const run of audit) {
      const i = idxById.get(Number(run.drawId))
      if (i === undefined || i < 1) continue
      const arr = draws[i - 1]?.num || draws[i - 1]?.nums || []
      const actual = is7 ? arr.join(' ') : arr.join('')
      if (!is7 && actual.length !== digitCount) continue
      const key = [...arr].sort().join('')
      const uniq = new Set(arr).size
      if (run.picks) {
        n++
        if ((run.picks.straight || []).includes(actual)) sHit++
        if (!is7 && digitCount === 3 && uniq === 3 && (run.picks.group || []).some((x) => [...x].sort().join('') === key)) gHit++
        if (!is7 && digitCount === 3 && uniq === 2 && (run.picks.group3 || []).some((x) => [...x].sort().join('') === key)) g3Hit++
      }
      // 纯算法基准：只用该期及更早的数据建评分（严格前推，不用未来数据）
      const histSum = (is7 ? summarizeQxc : is5 ? summarizeDigit5 : summarizeDigit)(draws.slice(i, i + 100), 100)
      const rk = histSum
        ? is7
          ? rankQXCCandidates(histSum)
          : is5
            ? rankPL5Candidates(histSum)
            : rankDigitCandidates(histSum)
        : null
      if (rk) {
        an++
        if (rk.straight.slice(0, is7 ? 5 : is5 ? 5 : 3).some((x) => (Array.isArray(x.num) ? x.num.join(' ') : x.num) === actual)) aS++
        if (!is7 && digitCount === 3 && uniq === 3 && rk.group.slice(0, 2).some((x) => x.num === key)) aG++
        if (!is7 && digitCount === 3 && uniq === 2 && rk.group3.slice(0, 1).some((x) => x.num === key)) aG3++
      }
    }
    return { n, sHit, gHit, g3Hit, an, aS, aG, aG3 }
  }, [audit, draws, digitCount, is5, is7])

  if (!summary || summary.total < 10) return null

  const onTick = ({ elapsed: s, pct: p, stage }) => {
    setElapsed(s)
    setPct(p)
    setPhase(stage)
  }

  const run = async ({ force = false } = {}) => {
    if (busy) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setText('')
    setMeta(null)
    setStale(false)
    setPhase('正在同步最新开奖数据…')
    setPct(3)
    setElapsed(0)
    let waitTimer = null
    try {
      // 1. 强制刷新开奖数据
      let fresh = draws
      if (onRefreshData) {
        try {
          fresh = await onRefreshData()
        } catch (e) {
          throw new Error(`开奖数据更新失败：${e.message || e}`)
        }
      }
      const latestFresh = Array.isArray(fresh) ? fresh[0] : null
      if (!latestFresh) throw new Error('没有取到开奖数据，请稍后重试')
      const freshSummary = (is7 ? summarizeQxc : is5 ? summarizeDigit5 : summarizeDigit)(fresh, 100)
      if (!freshSummary) throw new Error('最新数据不足 10 期，无法分析')

      const drawId = Number(latestFresh.id)

      // 2. 上期复盘：重新读取历史 AI 记录，对照上期实际开奖后作为本轮提示
      let runs = audit || []
      try {
        const a = await auditDigitAi({ game })
        if (a?.ok) {
          runs = a.runs || []
          setAudit(runs)
        }
      } catch {
        /* 读取失败时沿用已加载的记录，没有记录就跳过复盘 */
      }
      const reviewNow = buildDigitReview(runs, fresh, digitCount)

      // 3. 本期是否已有共享解析（旧版结构没有号码，视为需要重算）
      let cached = null
      let old = null
      try {
        const p = await peekDigitAi({ game, drawId })
        if (p?.exists && p.status === 'done' && p.result?.text) {
          if (p.result.schema === SCHEMA) cached = p
          else old = p
        }
      } catch {
        /* 数据库不可用时继续走实时分析 */
      }

      // 没有新一期开奖时，直接用当前最新数据生成解析（不再拦截）

      // 4. 已有共享结果：模拟一段分析等待，让后面看的人也有体验
      if (cached) {
        setPhase(ROUND_STAGES[0])
        await fakeAnalyze({ seconds: sharedWaitSeconds(), stages: ROUND_STAGES, onTick })
        setText(cached.result.text)
        setMeta({
          model: cached.result.model,
          at: cached.result.at,
          cached: true,
          owner: cached.owner,
          rounds: cached.result.rounds,
          roundCount: cached.result.roundCount || cached.result.rounds?.length || 4,
          picks: cached.result.picks,
          finalSource: cached.result.finalSource,
          finalNote: cached.result.finalNote,
        })
        setPct(100)
        setPhase('分析完成')
        return
      }

      // 5. 首位用户：真实多轮分析（进度按轮次推进；至少走满模拟时长，避免「秒出」显得不真实）
      setPhase(ROUND_STAGES[0])
      const timer = fakeAnalyze({ seconds: 55, stages: ROUND_STAGES, onTick })
      waitTimer = timer
      try {
        const r = await runDigitAi({
          game,
          drawId,
          label,
          messages: (is7 ? buildQXCMessages : is5 ? buildPL5Messages : buildDigitMessages)(
            freshSummary,
            label,
            reviewNow?.text || '',
          ),
          algo: is7
            ? qxcCandidatePool(freshSummary)
            : is5
              ? pl5CandidatePool(freshSummary)
              : digitCandidatePool(freshSummary),
          deviceId: getDeviceId()?.id || '',
        })
        await timer
        setText(r.text)
        setMeta({
          model: r.model,
          at: r.at,
          cached: Boolean(r.cached),
          owner: r.owner,
          rounds: r.rounds,
          roundCount: r.roundCount || r.rounds?.length || 4,
          picks: r.picks,
          finalSource: r.finalSource,
          finalNote: r.finalNote,
        })
        if (r.schema !== SCHEMA) setStale(true)
        setPct(100)
        setPhase('分析完成')
      } catch (e) {
        // 别人正在分析：等待并轮询共享结果
        if (e.status === 409) {
          setPhase('本期已有用户在分析，等待结果同步…')
          for (let i = 0; i < 12; i++) {
            await sleep(5000)
            const p = await peekDigitAi({ game, drawId }).catch(() => null)
            if (p?.exists && p.status === 'done' && p.result?.text) {
              setText(p.result.text)
              setMeta({
                model: p.result.model,
                at: p.result.at,
                cached: true,
                owner: p.owner,
                rounds: p.result.rounds,
                roundCount: p.result.roundCount || p.result.rounds?.length || 4,
                picks: p.result.picks,
                finalSource: p.result.finalSource,
                finalNote: p.result.finalNote,
              })
              if (p.result.schema !== SCHEMA) setStale(true)
              waitTimer?.cancel?.()
              setPct(100)
              setPhase('分析完成')
              return
            }
            setPct(Math.min(96, 20 + i * 7))
          }
          waitTimer?.cancel?.()
          throw new Error('本期分析仍在进行中，请过一会儿再点一次查看')
        }
        waitTimer?.cancel?.()
        throw e
      }
    } catch (e) {
      waitTimer?.cancel?.()
      setError(e?.message || String(e))
      setPhase('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Card title={`AI 推算下期号码 · ${label}`} tag={meta?.cached ? '全站共享' : 'AI'}>
      <div className="predict-sub" style={{ marginTop: 2, marginBottom: 4 }}>
        流程和快乐8一致：<b>算法先选 → AI 终选</b>。底层算法按频率 / 遗漏 / 同位转移对全盘打分
        {is7
          ? '（前 6 位 0–9 + 后区 0–14），每位取前列候选交叉成 24 注候选池，由 AI 只在池内终选 5 注直选。'
          : is5
            ? '（直选 10 万注），选出直选 20 注候选池后由 AI 只在池内终选 5 注直选。'
            : '（直选 1000 注、组六 120 组、组三 90 组），选出候选池后由 AI 只在池内终选 3 注直选 + 2 注组六 + 1 注组三。'}
      </div>
      <div className="predict-row">
        <div className="predict-label">算法候选 · 直选</div>
        <div className="predict-value">
          {(pool?.straight || []).slice(0, 12).map((n) => (
            <span key={fmtNum(n)} className="draw-num">
              {fmtNum(n)}
            </span>
          ))}
          <span className="muted small">
            共 {(pool?.straight || []).length} 注
            {(pool?.straight || []).length > 12 ? '（显示前 12）' : ''}
          </span>
        </div>
      </div>
      {!is5 && !is7 && (
        <>
          <div className="predict-row">
            <div className="predict-label">算法候选 · 组六</div>
            <div className="predict-value">
              {(pool?.group || []).slice(0, 8).map((n) => (
                <span key={n} className="draw-num">
                  {n}
                </span>
              ))}
              <span className="muted small">
                共 {(pool?.group || []).length} 组
                {(pool?.group || []).length > 8 ? '（显示前 8）' : ''}
              </span>
            </div>
          </div>
          <div className="predict-row">
            <div className="predict-label">算法候选 · 组三</div>
            <div className="predict-value">
              {(pool?.group3 || []).slice(0, 8).map((n) => (
                <span key={n} className="draw-num">
                  {n}
                </span>
              ))}
              <span className="muted small">共 {(pool?.group3 || []).length} 组</span>
            </div>
          </div>
        </>
      )}

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className={text ? 'btn-ai-ghost' : 'btn-ai-hero'} onClick={() => run()} disabled={busy}>
          {busy ? 'AI 分析中…' : text ? '重新分析' : '✦ AI 分析'}
        </button>
        <span className="muted small">
          4 轮 AI 分析（结构解读 → 反向质询 → 算法候选终选 → 终审校验），结果全站共享；点击会先同步最新开奖数据
        </span>
      </div>

      {review && (
        <div className="note note-info" style={{ marginTop: 10 }}>
          <b>上期复盘 · 第 {review.drawId} 期（AI 上期号码 vs 实际开奖）</b>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{review.text}</div>
        </div>
      )}

      {busy && (
        <AiWaitTheater stages={WAIT_STAGES} facts={waitFacts} pct={pct} elapsedSec={elapsed} />
      )}

      {error && <div className="note note-warn">{error}</div>}

      {!text && !busy && (
        <div className="ai-empty">
          <div className="ai-empty-mark">✦ ✦ ✦</div>
          <div className="ai-empty-title">AI 尚未分析本期</div>
          <div className="ai-empty-sub">
            点击上方「✦ AI 分析」，4 轮分析（结构解读 → 反向质询 → 算法候选终选 → 终审校验）完成后揭晓结果
          </div>
        </div>
      )}

      {text && (
        <>
          <div className="predict-sub" style={{ marginTop: 12 }}>
            {meta?.roundCount || 4} 轮 AI 分析 · {meta?.model} ·{' '}
            {meta?.at ? new Date(meta.at).toLocaleString('zh-CN') : ''}
            {meta?.cached ? ' · 本期共享解析' : ' · 本期首位生成'}
          </div>

          {stale && !picks && (
            <div className="note note-warn" style={{ marginTop: 8 }}>
              这一版解析只有文字、没有推荐号码。
              <button
                className="tab-btn active"
                style={{ marginLeft: 8 }}
                onClick={() => run({ force: true })}
                disabled={busy}
              >
                重新生成号码
              </button>
            </div>
          )}

          {picks && (
            <div style={{ marginTop: 8 }}>
              <div className="predict-sub" style={{ marginTop: 0, marginBottom: 6 }}>
                {meta?.finalSource === 'algo'
                  ? `⚠️ AI 终选未通过校验，已回退到算法前${is5 || is7 ? '五' : '三'}`
                  : '✅ 算法候选 → AI 终选已完成'}
                {meta?.finalNote ? ` · ${meta.finalNote}` : ''}
              </div>
              {[
                [
                  '直选推荐',
                  picks.straight,
                  is7 ? '每注 1/15000000' : is5 ? '每注 1/100000' : '每注 1/1000',
                  'straight',
                ],
                ...(is5 || is7
                  ? []
                  : [
                      ['组选推荐 · 组六', picks.group, '约 1/167', 'group'],
                      ['组三推荐', picks.group3, '约 1/333', 'group3'],
                    ]),
              ].map(([name, list, odds, kind]) =>
                list.length ? (
                  <div className="predict-row" key={name}>
                    <div className="predict-label">{name}</div>
                    <div className="predict-value">
                      {list.map((n) => (
                        <span key={n} className="draw-num" title={String(picks.reasons?.[n] || '')}>
                          {fmtNum(n)}
                          <i style={{ fontStyle: 'normal', fontSize: 10, color: '#9b8f7d', marginLeft: 2 }}>
                            #{algoRank(kind, n) ?? '—'}
                          </i>
                        </span>
                      ))}
                      <span className="muted small">{list.length} 注 · {odds}</span>
                    </div>
                  </div>
                ) : null,
              )}

              {(() => {
                const all = [...picks.straight, ...picks.group, ...picks.group3].filter(
                  (n) => picks.reasons?.[n],
                )
                if (!all.length) return null
                return (
                  <ul className="small muted" style={{ margin: '4px 0 0 18px', lineHeight: 1.8 }}>
                    {all.map((n) => (
                      <li key={n}>
                        <b className="mono">{fmtNum(n)}</b> {String(picks.reasons[n])}
                      </li>
                    ))}
                  </ul>
                )
              })()}

              {algoTop.straight.length > 0 && (
                <div className="note note-info" style={{ marginTop: 10 }}>
                  <b>纯算法基准</b>（不加 AI，直接取全盘评分最高）：直选{' '}
                  {algoTop.straight.map((x) => fmtNum(x.num)).join(' ')}
                  {!is5 && !is7 && (
                    <>
                      {' '}· 组六 {algoTop.group.map((x) => x.num).join(' ')} · 组三{' '}
                      {algoTop.group3.map((x) => x.num).join(' ')}
                    </>
                  )}
                  <br />
                  与 AI 定稿重合：直选{' '}
                  {picks.straight.filter((n) => algoTop.straight.some((x) => fmtNum(x.num) === n)).length}/
                  {picks.straight.length}
                  {!is5 && !is7 && (
                    <>
                      {' '}· 组六 {picks.group.filter((n) => algoTop.group.some((x) => x.num === n)).length}/
                      {picks.group.length} · 组三{' '}
                      {picks.group3.filter((n) => algoTop.group3.some((x) => x.num === n)).length}/{picks.group3.length}
                    </>
                  )}
                  （号码后的 #N 是它在本期全盘算法评分里的名次）
                </div>
              )}

              {picks.summary && (
                <div className="note note-info" style={{ marginTop: 10 }}>{String(picks.summary)}</div>
              )}
              {picks.risk && (
                <div className="note note-warn" style={{ marginTop: 8 }}>{String(picks.risk)}</div>
              )}
            </div>
          )}

          {!picks && <div className="ai-report-body">{text}</div>}

          {meta?.rounds?.length > 1 && (
            <details style={{ marginTop: 10 }}>
              <summary className="small muted" style={{ cursor: 'pointer' }}>
                查看 {meta.rounds.length} 轮分析过程
              </summary>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {meta.rounds.map((r, i) => (
                  <div key={i} className="note">
                    <b>
                      第 {i + 1} 轮 · {r.name}
                    </b>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.text}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {backtest && (backtest.n > 0 || backtest.an > 0) && (
        <div className="note note-info" style={{ marginTop: 12 }}>
          历史回测（同期对照，样本 {Math.max(backtest.n, backtest.an)} 期）：
          {backtest.n > 0 && (
            <>
              AI 推荐命中 直选 <b>{backtest.sHit}/{backtest.n}</b>
              {!is5 && !is7 && (
                <>、组六 <b>{backtest.gHit}/{backtest.n}</b>、组三 <b>{backtest.g3Hit}/{backtest.n}</b></>
              )}；
            </>
          )}
          {backtest.an > 0 && (
            <>
              纯算法基准命中 直选 <b>{backtest.aS}/{backtest.an}</b>
              {!is5 && !is7 && (
                <>、组六 <b>{backtest.aG}/{backtest.an}</b>、组三 <b>{backtest.aG3}/{backtest.an}</b></>
              )}。
            </>
          )}
          {Math.max(backtest.n, backtest.an) < 5
            ? '样本太少，还看不出真实水平。'
            : is5
              ? '这是实际命中记录，不是估计值；概率仍是直选 1/100000。'
              : '这是实际命中记录，不是估计值；概率仍是直选 1/1000、组六 1/167、组三 1/333。'}
        </div>
      )}

      <Note>
        {is5
          ? '流程与快乐8一致：底层算法对全盘 10 万注打分，选出直选 20 注候选池，AI 只在池内终选 5 注并给出理由；终选不合规自动回退算法前五。概率仍是直选 1/100000，选号方式不会改变这一点。'
          : '流程与快乐8一致：底层算法对全盘打分（直选 1000 注、组六 120 组、组三 90 组），选出直选 12 注 / 组六 8 组 / 组三 5 组的候选池，AI 只在池内终选 3 + 2 + 1 注并给出理由；终选不合规自动回退算法前三。概率仍是直选 1/1000、组六 1/167、组三 1/333，选号方式不会改变这一点。'}
      </Note>
    </Card>
  )
}

// 局部兜底：AI 卡片自身渲染出错时只影响这张卡，不会让整页白屏
class DigitAIBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  componentDidCatch(err, info) {
    console.error('AI 卡片渲染出错：', err, info)
  }

  render() {
    if (this.state.err) {
      return (
        <Card title="AI 推算">
          <div className="note note-warn">
            AI 卡片渲染出错：{String(this.state.err?.message || this.state.err)}
            <br />
            页面其他内容不受影响，可刷新后重试。
          </div>
        </Card>
      )
    }
    return this.props.children
  }
}

export default function DigitAI(props) {
  return (
    <DigitAIBoundary>
      <DigitAIInner {...props} />
    </DigitAIBoundary>
  )
}
