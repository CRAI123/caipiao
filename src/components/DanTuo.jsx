// 投注组合 —— 单式 / 复式 / 胆拖（含注数、金额、胆码说明）
import React, { useMemo, useState } from 'react'
import { Card, Ball, Note, pad2, yuan } from './common.jsx'
import {
  buildBet,
  ballFrequency,
  ballMissing,
  scoreBalls,
  range,
  comb,
  combinations,
  PLAY_LABEL,
  PRIZES,
  BALL_MAX,
  PRICE,
} from '../lib/stats.js'
import BetVerify from './BetVerify.jsx'

export default function DanTuo({ draws }) {
  const [play, setPlay] = useState(10)
  const [mode, setMode] = useState('dantuo') // single | multi | dantuo
  const [target, setTarget] = useState('dan') // 胆拖模式下点击写入的目标
  const [picks, setPicks] = useState([])
  const [dans, setDans] = useState([])
  const [tuos, setTuos] = useState([])

  const freq = useMemo(() => ballFrequency(draws, 30), [draws])
  const missing = useMemo(() => ballMissing(draws, 30), [draws])

  const bet = useMemo(() => {
    if (mode === 'dantuo') return buildBet('dantuo', play, dans, tuos, null)
    return buildBet(mode, play, [], [], picks)
  }, [mode, play, dans, tuos, picks])

  function resetNumbers() {
    setPicks([])
    setDans([])
    setTuos([])
  }

  function changeMode(m) {
    setMode(m)
    resetNumbers()
    setTarget('dan')
  }
  function changePlay(p) {
    setPlay(p)
    resetNumbers()
  }

  function clickBall(n) {
    if (mode === 'dantuo') {
      if (dans.includes(n)) setDans(dans.filter((x) => x !== n))
      else if (tuos.includes(n)) setTuos(tuos.filter((x) => x !== n))
      else if (target === 'dan') setDans([...dans, n].sort((a, b) => a - b))
      else setTuos([...tuos, n].sort((a, b) => a - b))
    } else {
      setPicks(picks.includes(n) ? picks.filter((x) => x !== n) : [...picks, n].sort((a, b) => a - b))
    }
  }

  /** 用评分最高的号码填充一个示例方案 */
  function quickFill() {
    const { scores } = scoreBalls(draws, { periods: 50, hotMode: 'mix' })
    const sorted = range(BALL_MAX)
      .map((n) => ({ n, s: scores[n] }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.n)
    if (mode === 'dantuo') {
      setDans(sorted.slice(0, 4).sort((a, b) => a - b))
      setTuos(sorted.slice(4, 12).sort((a, b) => a - b))
    } else if (mode === 'multi') {
      setPicks(sorted.slice(0, play + 2).sort((a, b) => a - b))
    } else {
      setPicks(sorted.slice(0, play).sort((a, b) => a - b))
    }
  }

  const exportable = bet.ok && bet.count <= 5000
  function exportTxt() {
    let combos = bet.combos
    if (!combos && bet.mode === 'multi') combos = combinations(picks, play)
    if (!combos) combos = [picks]
    const header = `# 快乐8 ${PLAY_LABEL[play]} ${mode === 'dantuo' ? '胆拖' : mode === 'multi' ? '复式' : '单式'}（仅供研究）\n`
    const meta =
      mode === 'dantuo'
        ? `# 胆: ${dans.map(pad2).join(' ')} | 拖: ${tuos.map(pad2).join(' ')}\n`
        : `# 号码: ${picks.map(pad2).join(' ')}\n`
    const body = combos.map((c) => c.map(pad2).join(' ')).join('\n')
    const blob = new Blob([`${header}${meta}${body}\n`], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kl8_${PLAY_LABEL[play]}_${mode}_${bet.count}doses.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 胆码固定时的拖码档位表（拖码数 → 注数 → 金额）
  const danCount = mode === 'dantuo' ? dans.length : 0
  const dragTable = useMemo(() => {
    if (!danCount || danCount >= play) return []
    const need = play - danCount
    const rows = []
    const maxTuo = 20 - danCount
    for (let t = need; t <= maxTuo; t++) {
      const c = comb(t, need)
      rows.push({ t, count: c, cost: c * PRICE })
    }
    return rows
  }, [danCount, play])

  const prizeList = Object.entries(PRIZES[play] || {})
    .map(([k, v]) => ({ hits: Number(k), money: v }))
    .sort((a, b) => b.hits - a.hits)

  return (
    <div className="page">
      <Card title="第一步 · 选择玩法" tag="快乐8 共 10 种玩法，每注 2 元">
        <div className="toolbar">
          {range(10).map((p) => (
            <button
              key={p}
              className={`tab-btn ${play === p ? 'active' : ''}`}
              onClick={() => changePlay(p)}
            >
              {PLAY_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="prize-strip">
          {prizeList.map((p) => (
            <span key={p.hits} className="prize-chip mono">
              中 {p.hits} 个 → {p.money} 元
            </span>
          ))}
        </div>
        <Note>
          当前为 <b>{PLAY_LABEL[play]}</b>：从 80 个号码中选 {play} 个成一注。上表为官方单注奖金，{play >= 7 && '其中「中 0 个」的 2 元保底奖是快乐8 特有规则。'}
        </Note>
      </Card>

      <Card title="第二步 · 选择投注方式" tag="单式 / 复式 / 胆拖">
        <div className="mode-row">
          <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => changeMode('single')}>
            单式
          </button>
          <button className={`mode-btn ${mode === 'multi' ? 'active' : ''}`} onClick={() => changeMode('multi')}>
            复式
          </button>
          <button className={`mode-btn ${mode === 'dantuo' ? 'active' : ''}`} onClick={() => changeMode('dantuo')}>
            胆拖
          </button>
          <span className="toolbar-sep" />
          <button className="tab-btn" onClick={quickFill}>🎲 按评分填充示例</button>
          <button className="tab-btn" onClick={resetNumbers}>清空号码</button>
        </div>
        <ul className="concept-list">
          <li><b>单式</b>：正好选 {play} 个号码，1 注。</li>
          <li><b>复式</b>：选多于 {play} 个号码（最多 20 个），任意 {play} 个组合各算 1 注，注数 = C(选号数, {play})。</li>
          <li><b>胆拖</b>：胆码必选、拖码任取凑满 {play} 个，注数 = C(拖码数, {play} − 胆码数)。胆码选错则全组失效。</li>
        </ul>
      </Card>

      <Card title="第三步 · 选择号码" tag={mode === 'dantuo' ? '先选写入目标，再点号码' : `需选 ${play} 个以上（单式正好 ${play} 个）`}>
        {mode === 'dantuo' && (
          <div className="mode-row">
            <button className={`mode-btn ${target === 'dan' ? 'active-dan' : ''}`} onClick={() => setTarget('dan')}>
              写入胆码
            </button>
            <button className={`mode-btn ${target === 'tuo' ? 'active-tuo' : ''}`} onClick={() => setTarget('tuo')}>
              写入拖码
            </button>
            <span className="muted small">当前点击写入：{target === 'dan' ? '胆码' : '拖码'}（再点一次移除）</span>
          </div>
        )}

        <div className="pick-grid">
          {range(BALL_MAX).map((n) => {
            const isDan = dans.includes(n)
            const isTuo = tuos.includes(n)
            const isPick = picks.includes(n)
            return (
              <button
                key={n}
                className={`pick-cell ${isDan ? 'picked-dan' : ''} ${isTuo ? 'picked-tuo' : ''} ${isPick ? 'picked-blue' : ''}`}
                onClick={() => clickBall(n)}
              >
                <Ball n={n} size="sm" dim={!isDan && !isTuo && !isPick} />
                <span className="pick-meta mono">
                  {freq[n]}/{missing[n].current}
                </span>
              </button>
            )
          })}
        </div>

        <div className="picked-summary">
          {mode === 'dantuo' ? (
            <>
              <div className="picked-line">
                <b>胆（{dans.length}）：</b>
                {dans.length ? dans.map((n) => <Ball key={n} n={n} size="sm" />) : <span className="muted">未选</span>}
              </div>
              <div className="picked-line">
                <b>拖（{tuos.length}）：</b>
                {tuos.length ? tuos.map((n) => <Ball key={n} n={n} size="sm" kind="blue" />) : <span className="muted">未选</span>}
              </div>
            </>
          ) : (
            <div className="picked-line">
              <b>已选（{picks.length}）：</b>
              {picks.length ? picks.map((n) => <Ball key={n} n={n} size="sm" />) : <span className="muted">未选</span>}
            </div>
          )}
        </div>
        <p className="muted small">号码下方小字为近 30 期出现次数 / 当前遗漏，仅供参照，不代表下期概率。</p>
      </Card>

      <Card title="第四步 · 注数与金额">
        {!bet.ok ? (
          <Note tone="warn">{bet.message}</Note>
        ) : (
          <>
            <div className="result-bar">
              <div>
                <span className="result-count mono">{bet.count}</span>
                <span className="result-unit">注 · 合计 {yuan(bet.cost)}</span>
              </div>
              <div className="result-actions">
                <button className="tab-btn" disabled={!exportable} onClick={exportTxt}>
                  导出全部注数（.txt）
                </button>
              </div>
            </div>
            <p className="muted small">
              {bet.mode === 'dantuo' && (
                <>
                  组合规则：C(拖码 {tuos.length} 个, {play} − 胆码 {dans.length} 个) = C({tuos.length}, {play - dans.length}) ={' '}
                  <b>{comb(tuos.length, play - dans.length)}</b> 注
                </>
              )}
              {bet.mode === 'multi' && (
                <>
                  组合规则：C(选号 {picks.length} 个, {play} 个) = <b>{comb(picks.length, play)}</b> 注
                </>
              )}
              {bet.mode === 'single' && <>单式固定 1 注。</>}
              {!exportable && bet.count > 5000 && ' · 注数超过 5000，为防卡顿已停用导出'}
            </p>
            {bet.combos && bet.combos.length > 0 && (
              <div className="combo-scroll">
                <ol className="combo-list">
                  {bet.combos.slice(0, 80).map((c, i) => (
                    <li key={i} className="mono">
                      {c.map(pad2).join(' ')}
                    </li>
                  ))}
                </ol>
                {bet.count > 80 && <p className="muted small">仅展示前 80 注…</p>}
              </div>
            )}
          </>
        )}
      </Card>

      {danCount > 0 && danCount < play && dragTable.length > 0 && (
        <Card title={`${danCount} 个胆码能拖几个？拖码数量 → 注数 / 金额`} tag={`${PLAY_LABEL[play]} · 胆码固定 ${danCount} 个`}>
          <div className="table-scroll">
            <table className="ledger-table drag-table">
              <thead>
                <tr>
                  <th>拖码个数</th>
                  <th>胆+拖合计</th>
                  <th>注数</th>
                  <th>金额</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {dragTable.map((r) => {
                  const isCurrent = r.t === tuos.length && mode === 'dantuo'
                  return (
                    <tr key={r.t} className={isCurrent ? 'row-active' : ''}>
                      <td className="mono">{r.t}</td>
                      <td className="mono">{r.t + danCount}</td>
                      <td className="mono">{r.count}</td>
                      <td className="mono">{yuan(r.cost)}</td>
                      <td className="muted small">
                        {r.t === play - danCount
                          ? '刚好凑满一注（等价单式）'
                          : r.count <= 200
                            ? '小额方案'
                            : '注数较多，注意成本'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Note tone="warn">
            <b>胆码必须全中才有高奖</b>：{PLAY_LABEL[play]} 中头奖要求命中 {play} 个号码，因此 {danCount} 个胆码必须全部命中、
            且拖码再中 {play - danCount} 个。任一胆码落空，包含它的每一注都与头奖无缘，只能寄望小奖。
            拖码越多，注数（成本）呈组合数增长，而不是中奖概率同比例增长。
          </Note>
        </Card>
      )}

      {bet.ok && bet.count <= 5000 && <BetVerify bet={bet} draws={draws} />}

      <Card className="disclaimer-card">
        <div className="disclaimer-inner">
          <div>
            <h4>⚠️ 理性提示</h4>
            <p>
              复式、胆拖只是把更多组合一次性买下，<b>单注中奖概率并未提高</b>，注数增加时花费线性增加。
              以选十为例，单注中十概率约 1/8,911,711；买 28 注也只是 28/8,911,711。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
