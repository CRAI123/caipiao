// 下期推荐 —— 近期加权频次 + 遗漏打分，输出结构均衡的研究用号码（多玩法 + 导出）
// ⚠️ 仅为历史数据的加权统计结果，不改变任何号码 25% 的开出概率
import React, { useMemo, useState } from 'react'
import { Card, Ball, Note, StatCard, pad2, yuan } from './common.jsx'
import {
  scoreBalls,
  pickBalanced,
  comb,
  PLAY_LABEL,
  BALL_MAX,
  PRICE,
  isOdd,
  isBig,
  road,
} from '../lib/stats.js'
import { aiDeep, storePrediction } from '../lib/api.js'
import { v7Recommend } from '../lib/kl8V7.js'
import { fmtPct } from '../lib/kl8Math.js'
import BetVerify from './BetVerify.jsx'

const MODES = [
  { id: 'hot', label: '偏热', desc: '只用近期加权频次' },
  { id: 'mix', label: '冷热兼顾', desc: '加权频次为主，叠加遗漏' },
  { id: 'cold', label: '偏冷', desc: '以当前遗漏期数为主' },
  { id: 'multi', label: '多尺度', desc: '用户模型：长期25% + 近50期30% + 近20期30% + 近10期15%' },
]
const PLAYS = [3, 4, 5, 6, 7, 8, 9, 10]

const bandOf = (n) => Math.min(3, Math.floor((n - 1) / 20))

function profile(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const odd = sorted.filter(isOdd).length
  const big = sorted.filter(isBig).length
  const r012 = [0, 0, 0]
  const bands = [0, 0, 0, 0]
  sorted.forEach((n) => {
    r012[road(n)]++
    bands[bandOf(n)]++
  })
  return {
    oddEven: `${odd}:${sorted.length - odd}`,
    bigSmall: `${big}:${sorted.length - big}`,
    r012: r012.join(' / '),
    bands: bands.join(' / '),
    sum: sorted.reduce((s, n) => s + n, 0),
    span: sorted[sorted.length - 1] - sorted[0],
  }
}

export default function Predict({ draws }) {
  const [hotMode, setHotMode] = useState('mix')
  const [play, setPlay] = useState(10)
  const [showV7, setShowV7] = useState(false)
  const [deep, setDeep] = useState(null)
  const [deepBusy, setDeepBusy] = useState(false)
  const [deepErr, setDeepErr] = useState('')

  const { scores, weighted, missing, window } = useMemo(
    () => scoreBalls(draws, { periods: 100, halfLife: 20, hotMode }),
    [draws, hotMode],
  )

  const ranked = useMemo(
    () =>
      Array.from({ length: BALL_MAX }, (_, i) => i + 1)
        .map((n) => ({
          n,
          score: +(scores[n] * 100).toFixed(1),
          freq: +weighted[n].toFixed(2),
          miss: missing[n].current,
        }))
        .sort((a, b) => b.score - a.score),
    [scores, weighted, missing],
  )

  // 三张单式票：评分榜首段 + 两个错位段，均做结构约束
  const tickets = useMemo(
    () => [0, 3, 6].map((off) => pickBalanced(ranked.slice(off), play).map((x) => x.n).sort((a, b) => a - b)),
    [ranked, play],
  )
  const mainNums = tickets[0]
  const mainSet = new Set(mainNums)
  const backup = ranked.filter((x) => !mainSet.has(x.n)).slice(0, 10)

  const danCount = play >= 6 ? 4 : play >= 4 ? 2 : 1
  const dans = mainNums.slice(0, danCount)
  const need = play - danCount
  const tuos = [...mainNums.slice(danCount), ...backup.map((x) => x.n)].slice(0, need + 4)

  const p = profile(mainNums)
  const latest = draws[0]
  const nextId = latest ? latest.id + 1 : '—'
  const latestHit = new Set(latest?.nums || [])
  const danHitNow = dans.filter((n) => latestHit.has(n)).length

  // v7：按期号固定的四层统计选号，点按钮才计算
  const v7 = useMemo(
    () => (showV7 ? v7Recommend(draws, { play, nextId: latest ? latest.id + 1 : undefined }) : null),
    [showV7, draws, play, latest],
  )

  const deepVotes = deep?.votes || []
  const deepOverlap = deep ? deep.finalPicks.filter((n) => deep.v7.picks.includes(n)).length : 0

  const bet = useMemo(
    () => ({
      ok: true,
      mode: 'dantuo',
      play,
      dans,
      tuos,
      picks: null,
      count: comb(tuos.length, need),
      cost: comb(tuos.length, need) * PRICE,
      combos: null,
    }),
    [play, dans, tuos, need],
  )

  const costRows = Array.from({ length: 5 }, (_, i) => need + i).map((t) => ({
    t,
    count: comb(t, need),
    cost: comb(t, need) * PRICE,
  }))

  function exportTxt() {
    const lines = [
      `# 快乐8 研究推荐 · 第 ${nextId} 期 · ${PLAY_LABEL[play]}（仅供数据学习，非投注建议）`,
      `# 偏好：${MODES.find((m) => m.id === hotMode).label} · 样本 ${window} 期 · ${hotMode === 'multi' ? '四窗口加权 25/30/30/15' : '半衰期 20 期'}`,
      '',
      '单式票：',
      ...tickets.map((t, i) => `  票${i + 1}: ${t.map(pad2).join(' ')}`),
      '',
      `胆拖：${danCount} 胆 [${dans.map(pad2).join(' ')}] + ${tuos.length} 拖 [${tuos.map(pad2).join(' ')}]`,
      `  = ${bet.count} 注 · ${bet.cost} 元`,
    ]
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kl8_${nextId}_${PLAY_LABEL[play]}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** AI 深度分析：9 次独立分析 + 3 模型复核 + 60 期样本外回测 */
  async function doDeep() {
    setDeepBusy(true)
    setDeepErr('')
    try {
      const result = await aiDeep({ draws, play })
      setDeep(result)
      try {
        await storePrediction({
          drawId: result.nextId,
          play,
          mode: hotMode,
          picks: mainNums,
          dans,
          tuos,
          aiPicks: result.finalPicks,
        })
      } catch {
        /* 存档失败不影响展示 */
      }
    } catch (e) {
      setDeepErr(e.message || 'AI 深度分析失败')
    } finally {
      setDeepBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">玩法</span>
        {PLAYS.map((pp) => (
          <button key={pp} className={`tab-btn ${play === pp ? 'active' : ''}`} onClick={() => setPlay(pp)}>
            {PLAY_LABEL[pp]}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span className="toolbar-label">打分偏好</span>
        {MODES.map((m) => (
          <button key={m.id} className={`tab-btn ${hotMode === m.id ? 'active' : ''}`} onClick={() => setHotMode(m.id)}>
            {m.label}
          </button>
        ))}
        <span className="toolbar-note">样本 {window} 期 · {hotMode === 'multi' ? '四窗口加权 25/30/30/15' : '半衰期 20 期'}</span>
        <span className="toolbar-sep" />
        <button className="btn-primary" onClick={doDeep} disabled={deepBusy}>
          {deepBusy ? '🔬 深度分析中…' : '🔬 AI 深度分析'}
        </button>
        <button
          className={`tab-btn ${showV7 ? 'active' : ''}`}
          onClick={() => setShowV7((v) => !v)}
        >
          v7 算法推荐
        </button>
        <button className="tab-btn" onClick={exportTxt}>导出推荐方案（.txt）</button>
      </div>

      <Card title={`第 ${nextId} 期 · ${PLAY_LABEL[play]} 研究推荐`} tag="评分前列 + 结构约束 · 三张单式票">
        {tickets.map((t, i) => (
          <div key={i} className="predict-head" style={{ marginTop: i ? 12 : 0 }}>
            <div>
              <div className="predict-sub">
                票 {i + 1}
                {i === 0 && `（前 ${danCount} 个为胆码）`}
              </div>
              <span className="draw-balls predict-balls">
                {t.map((n, j) => (
                  <Ball
                    key={n}
                    n={n}
                    size={i === 0 ? 'md' : 'sm'}
                    kind="auto"
                    className={i === 0 && j < danCount ? 'ball-dan' : ''}
                  />
                ))}
              </span>
            </div>
          </div>
        ))}
        <div className="predict-head" style={{ marginTop: 12 }}>
          <div>
            <div className="predict-sub">备选 10 码（灰色）</div>
            <span className="draw-balls">
              {backup.map((x) => (
                <Ball key={x.n} n={x.n} size="sm" kind="plain" dim />
              ))}
            </span>
          </div>
        </div>

        <div className="range-legend mono">
          <span><i className="lg-dot lg-red" />01-20</span>
          <span><i className="lg-dot lg-blue" />21-40</span>
          <span><i className="lg-dot lg-green" />41-60</span>
          <span><i className="lg-dot lg-amber" />61-80</span>
          <span className="muted">深色描边 = 胆码（票 1 前 {danCount} 个）</span>
        </div>

        <div className="chip-row" style={{ marginTop: 14 }}>
          <span className="chip"><i>奇:偶 {p.oddEven}</i></span>
          <span className="chip"><i>大:小 {p.bigSmall}</i></span>
          <span className="chip"><i>012 路 {p.r012}</i></span>
          <span className="chip"><i>区间分布 {p.bands}</i></span>
          <span className="chip"><i>和值 {p.sum} · 跨度 {p.span}</i></span>
        </div>

        <Note>
          三张票取评分榜不同段位（第 1-10、4-13、7-16 名附近）并做结构约束：四区间各有号、单区间不超限、
          奇偶接近均衡。这让号码形态更像常见开奖，<b>但不提高中奖概率</b>。
        </Note>
      </Card>

      {deep && (
        <Card
          title={`🔬 AI 深度分析 · 第 ${deep.nextId} 期 · ${deep.stats.label}`}
          tag={`${deep.calls} 次调用 · 第一轮 ${deep.round1}/9 · 复核 ${deep.round2}/3 · ${(deep.elapsedMs / 1000).toFixed(1)} 秒`}
        >
          <div className="predict-head">
            <div>
              <div className="predict-sub">最终推荐 {deep.play} 码（3 模型 × 3 温度 + 复核轮加权聚合）</div>
              <span className="draw-balls predict-balls">
                {deep.finalPicks.map((n) => (
                  <Ball key={n} n={n} size="md" kind="auto" />
                ))}
              </span>
            </div>
          </div>

          <div className="predict-sub" style={{ marginTop: 12 }}>加权得票（第二轮 ×1.5）</div>
          <div className="chip-row" style={{ marginTop: 6 }}>
            {deepVotes.map((v) => (
              <span key={v.n} className="chip">
                <i>{pad2(v.n)} {v.score ? `权重 ${v.score}` : '结构补位'}{v.hits ? ` · ${v.hits}/12 张票` : ''}</i>
              </span>
            ))}
          </div>

          <div className="chip-row" style={{ marginTop: 12 }}>
            <span className="chip"><i>与 v7 推荐重合 {deepOverlap} 码</i></span>
            <span className="chip"><i>置信度 {deep.report.confidence}</i></span>
            <span className="chip"><i>单注期望 {deep.stats.ev} 元 · 返还 {deep.stats.returnRate}%</i></span>
            <span className="chip"><i>头奖 1 / {deep.stats.firstPrize.toLocaleString()}</i></span>
          </div>

          <div className="predict-sub" style={{ marginTop: 14 }}>
            样本外回测（近 {deep.backtest.n} 期，逐期只用该期之前的数据建池）
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>实际平均命中</th>
                  <th>随机期望</th>
                  <th>z 值</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>推荐池 30 码</td>
                  <td className="mono">{deep.backtest.poolMean}</td>
                  <td className="mono">{deep.backtest.poolExp}</td>
                  <td className="mono">{deep.backtest.z}</td>
                </tr>
                <tr>
                  <td>排除池 30 码</td>
                  <td className="mono">{deep.backtest.killMean}</td>
                  <td className="mono">{deep.backtest.poolExp}</td>
                  <td className="mono muted">—</td>
                </tr>
                <tr>
                  <td>结构选号 {deep.play} 码</td>
                  <td className="mono">{deep.backtest.pickMean}</td>
                  <td className="mono">{deep.backtest.pickExp}</td>
                  <td className="mono">{deep.backtest.zPick}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Note tone={deep.backtest.significant ? 'info' : 'warn'}>
            回测结论：推荐池平均命中 {deep.backtest.poolMean} 个，随机期望 {deep.backtest.poolExp} 个，z={deep.backtest.z}
            （|z| ≥ 1.96 才算 5% 显著）。{deep.backtest.significant
              ? '这一档达到显著，但连续多档检验时需警惕多重比较带来的假阳性。'
              : '当前与随机无显著差异，说明多轮 AI 分析不产生预测优势。'}
          </Note>

          <div className="predict-sub" style={{ marginTop: 14 }}>各模型给号</div>
          <div className="mono small" style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {`第一轮：\n${deep.round1Picks.map((r) => `${r.model}  ${r.picks.map(pad2).join(' ')}`).join('\n')}`}
            {deep.round2Picks.length ? `\n复核轮：\n${deep.round2Picks.map((r) => `${r.model}  ${r.picks.map(pad2).join(' ')}`).join('\n')}` : ''}
          </div>

          <div className="settings-guide" style={{ marginTop: 12 }}>
            <b>AI 分析要点</b>
            <ul style={{ margin: '6px 0 10px 18px' }}>
              {deep.report.key_points.map((t, i) => (
                <li key={i} className="small">{t}</li>
              ))}
            </ul>
            {deep.report.risks.length > 0 && (
              <>
                <b>风险与限制</b>
                <ul style={{ margin: '6px 0 10px 18px' }}>
                  {deep.report.risks.map((t, i) => (
                    <li key={i} className="small">{t}</li>
                  ))}
                </ul>
              </>
            )}
            {deep.report.review && <div className="small"><b>结论：</b>{deep.report.review}</div>}
          </div>

          {deep.calibration && (
            <div className="chip-row" style={{ marginTop: 10 }}>
              <span className="chip"><i>动态分组 log-loss {deep.calibration.logLossDyn}</i></span>
              <span className="chip"><i>恒定 25% {deep.calibration.logLossBase}</i></span>
              <span className="chip"><i>差值 {deep.calibration.diff > 0 ? '+' : ''}{deep.calibration.diff}</i></span>
            </div>
          )}

          <Note tone="warn">
            深度分析共调用 {deep.calls} 次大模型（3 模型 × 3 温度 + 3 次复核），并附 60 期严格前推回测。
            轮次和耗时增加的是<b>结论的稳定性与可核查性</b>，不是中奖概率；每期每号仍是 25%，
            {deep.stats.label}头奖概率仍是 1 / {deep.stats.firstPrize.toLocaleString()}。回测若显示无优势，就按无优势理解。
          </Note>
        </Card>
      )}

      {v7 && (
        <Card
          title={`v7 算法 · 第 ${v7.nextId} 期 · ${PLAY_LABEL[v7.play]} 推荐`}
          tag={`30 码推荐池 → 动态概率抽样 · 主窗口 ${v7.primaryWindow} 期`}
        >
          <div className="predict-head">
            <div>
              <div className="predict-sub">v7 推荐 {v7.play} 码（按期号固定，重复点击结果一致）</div>
              <span className="draw-balls predict-balls">
                {v7.picks.map((n) => (
                  <Ball key={n} n={n} size="md" kind="auto" />
                ))}
              </span>
            </div>
          </div>
          <div className="predict-head" style={{ marginTop: 12 }}>
            <div>
              <div className="predict-sub">备选 3 码（灰色）</div>
              <span className="draw-balls">
                {v7.backup.map((n) => (
                  <Ball key={n} n={n} size="sm" kind="plain" dim />
                ))}
              </span>
            </div>
          </div>

          <div className="chip-row" style={{ marginTop: 14 }}>
            <span className="chip"><i>推荐池 30 码 · 上期重号 {v7.lastHitInPool}</i></span>
            <span className="chip"><i>排除池 30 码 · 上期重号 {v7.lastHitInKill}</i></span>
            <span className="chip"><i>单注期望 {v7.stats.ev.toFixed(2)} 元</i></span>
            <span className="chip"><i>返还率 {fmtPct(v7.stats.returnRate, 1)}</i></span>
          </div>

          <div className="predict-sub" style={{ marginTop: 12 }}>推荐池（30 码）</div>
          <div className="mono small" style={{ lineHeight: 1.9 }}>
            {v7.pool.map((x) => pad2(x.n)).join(' ')}
          </div>
          <div className="predict-sub" style={{ marginTop: 12 }}>排除池（30 码）</div>
          <div className="mono small muted" style={{ lineHeight: 1.9 }}>
            {v7.kill.map((x) => pad2(x.n)).join(' ')}
          </div>

          <Note tone="warn">
            v7 = 组合概率层 + 100/50/30/20 期多窗口轮动 + 遗漏分档加权抽样，四个窗口权重（主窗口 55%，其余各 15%）
            和抽样过程写死在代码里，<b>没有用历史开奖拟合参数</b>。同一期号重复点击结果相同。
            它只是把统计偏好落成一张具体号码，<b>不提高中奖概率</b>；{PLAY_LABEL[v7.play]}头奖概率仍是
            1 / {Math.round(comb(BALL_MAX, v7.play) / comb(20, v7.play)).toLocaleString()}。
          </Note>
        </Card>
      )}

      {deepErr && <Note tone="warn">AI 深度分析失败：{deepErr}</Note>}

      <div className="stat-grid stat-grid-4">
        <StatCard label="参与打分号码" value={BALL_MAX} note="全部 80 个号码" />
        <StatCard label="单号每期理论概率" value="25" unit="%" tone="blue" note="20 / 80，固定不变" />
        <StatCard label={`${PLAY_LABEL[play]}中${play}概率`} value={`1 / ${Math.round(comb(BALL_MAX, play) / comb(20, play)).toLocaleString()}`} tone="red" note="任一组合等概率" />
        <StatCard label={`${danCount} 胆全中概率`} value={((comb(20, danCount) / comb(80, danCount)) * 100).toFixed(danCount === 4 ? 3 : 1)} unit="%" tone="amber" note={`C(20,${danCount})/C(80,${danCount})`} />
      </div>

      <Card title="评分明细 TOP20" tag={`${MODES.find((m) => m.id === hotMode).desc} · 分值 0-100`}>
        <div className="table-scroll">
          <table className="ledger-table score-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>号码</th>
                <th>加权频次</th>
                <th>当前遗漏</th>
                <th>综合评分</th>
                <th>角色</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 20).map((x, i) => (
                <tr key={x.n}>
                  <td className="mono muted">{i + 1}</td>
                  <td><Ball n={x.n} size="sm" /></td>
                  <td className="mono">{x.freq}</td>
                  <td className="mono">{x.miss} 期</td>
                  <td className="mono">{x.score}</td>
                  <td className="small">
                    {dans.includes(x.n) ? (
                      <b className="text-red">胆码</b>
                    ) : mainSet.has(x.n) ? (
                      '主推'
                    ) : (
                      '备选'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`${danCount} 胆 + N 拖 方案`} tag={`${PLAY_LABEL[play]} · 胆码 ${dans.map(pad2).join(' ')}`}>
        <div className="table-scroll">
          <table className="ledger-table drag-table">
            <thead>
              <tr>
                <th>方案</th>
                <th>拖码</th>
                <th>注数</th>
                <th>金额</th>
                <th>头奖条件</th>
              </tr>
            </thead>
            <tbody>
              {costRows.map((r) => (
                <tr key={r.t} className={r.t === tuos.length ? 'row-active' : ''}>
                  <td>{danCount} 胆 + {r.t} 拖</td>
                  <td className="mono">{tuos.slice(0, r.t).map(pad2).join(' ')}</td>
                  <td className="mono">{r.count}</td>
                  <td className="mono">{yuan(r.cost)}</td>
                  <td className="muted small">{danCount} 胆全中 + 拖码中 {need} 个</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="result-bar" style={{ marginTop: 12 }}>
          <div>
            <b>默认方案 {danCount} 胆 + {tuos.length} 拖：</b>
            <span className="result-count mono" style={{ marginLeft: 12 }}>{bet.count}</span>
            <span className="result-unit">注 · 合计 {yuan(bet.cost)}</span>
          </div>
        </div>
        <Note tone="warn">
          最近一期（{latest?.id}）开奖中，这 {danCount} 个胆码命中 <b>{danHitNow}/{danCount}</b> 个。
          {danHitNow < danCount && `按这组胆码生成的全部 ${bet.count} 注，当期都拿不到头奖——胆码全中才有高奖，一个不中全组失效。`}
        </Note>
      </Card>

      <BetVerify bet={bet} draws={draws} />
    </div>
  )
}
