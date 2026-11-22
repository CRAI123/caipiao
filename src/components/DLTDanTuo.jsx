// 大乐透 复式胆拖 —— 前区胆码/拖码 + 后区，自动算注数与金额（支持追加）
import React, { useMemo, useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import WheelPanel from './WheelPanel.jsx'
import { FRONT_NUMS, BACK_NUMS, predictDLT, FRONT_PICK, BACK_PICK } from '../lib/dltPredict.js'

function combinationCount(n, k) {
  if (k < 0 || k > n) return 0
  let v = 1
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1)
  return Math.round(v)
}

const MODES = [
  { id: 'dantuo', name: '胆拖复式', desc: '胆码必选，拖码补足 5 个前区' },
  { id: 'full', name: '普通复式', desc: '直接选 5 个以上前区全组合' },
]

export default function DLTDanTuo({ draws = [] }) {
  const [mode, setMode] = useState('dantuo')
  const [dan, setDan] = useState([])
  const [tuo, setTuo] = useState([])
  const [fullFront, setFullFront] = useState([])
  const [backs, setBacks] = useState([])
  const [addon, setAddon] = useState(false)

  function toggle(list, setList, n) {
    if (list.includes(n)) setList(list.filter((x) => x !== n))
    else setList([...list, n].sort((a, b) => a - b))
  }

  function clearAll() {
    setDan([])
    setTuo([])
    setFullFront([])
    setBacks([])
  }

  function fillByPredict() {
    const p = predictDLT(draws)
    if (!p) return
    if (mode === 'dantuo') {
      setDan(p.front.slice(0, 2))
      setTuo(p.front.slice(2))
    } else {
      setFullFront(p.front)
    }
    setBacks(p.back)
  }

  const { bets, cost, error } = useMemo(() => {
    const backCount = backs.length >= BACK_PICK ? combinationCount(backs.length, BACK_PICK) : 1
    const unit = addon ? 3 : 2
    if (mode === 'full') {
      if (fullFront.length < FRONT_PICK) {
        return { bets: 0, cost: 0, error: `普通复式至少需要 5 个前区号（当前 ${fullFront.length} 个）` }
      }
      const bets = combinationCount(fullFront.length, FRONT_PICK) * backCount
      return { bets, cost: bets * unit, error: null }
    }
    if (!dan.length) return { bets: 0, cost: 0, error: '请至少选择 1 个胆码' }
    if (dan.length > 4) return { bets: 0, cost: 0, error: '胆码最多 4 个（否则凑不满 5 个前区）' }
    const need = FRONT_PICK - dan.length
    if (tuo.length < need) {
      return { bets: 0, cost: 0, error: `还需 ${need} 个拖码（当前 ${tuo.length} 个）` }
    }
    if (backs.length < BACK_PICK) {
      return { bets: 0, cost: 0, error: `后区至少选 2 个号（当前 ${backs.length} 个）` }
    }
    const bets = combinationCount(tuo.length, need) * backCount
    return { bets, cost: bets * unit, error: null }
  }, [mode, dan, tuo, fullFront, backs, addon])

  const frontSelected = mode === 'full' ? fullFront : [...dan, ...tuo]

  return (
    <div className="page">
      <Card title="复式胆拖选号" tag="大乐透 · 前区 35 选 5 + 后区 12 选 2">
        <div className="fc3d-dt-type">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`tab-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.name}
              <i>{m.desc}</i>
            </button>
          ))}
        </div>

        {mode === 'dantuo' ? (
          <>
            <div className="fc3d-dt-section">
              <div className="fc3d-dt-label">
                前区胆码 <span className="muted">（必出，{dan.length}/4）</span>
              </div>
              <div className="ssq-pick-grid">
                {FRONT_NUMS.map((n) => {
                  const inDan = dan.includes(n)
                  const inTuo = tuo.includes(n)
                  return (
                    <button
                      key={n}
                      className={`ssq-pick ball-red ${inDan ? 'pick-dan' : ''} ${inTuo ? 'pick-dim' : ''}`}
                      disabled={inTuo || (dan.length >= 4 && !inDan)}
                      onClick={() => toggle(dan, setDan, n)}
                    >
                      {String(n).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="fc3d-dt-section">
              <div className="fc3d-dt-label">
                前区拖码 <span className="muted">（搭配，{tuo.length} 个）</span>
              </div>
              <div className="ssq-pick-grid">
                {FRONT_NUMS.map((n) => {
                  const inDan = dan.includes(n)
                  const inTuo = tuo.includes(n)
                  return (
                    <button
                      key={n}
                      className={`ssq-pick ball-red ${inTuo ? 'pick-tuo' : ''} ${inDan ? 'pick-dim' : ''}`}
                      disabled={inDan}
                      onClick={() => toggle(tuo, setTuo, n)}
                    >
                      {String(n).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="fc3d-dt-section">
            <div className="fc3d-dt-label">
              前区复式 <span className="muted">（至少 5 个，当前 {fullFront.length} 个）</span>
            </div>
            <div className="ssq-pick-grid">
              {FRONT_NUMS.map((n) => (
                <button
                  key={n}
                  className={`ssq-pick ball-red ${fullFront.includes(n) ? 'pick-tuo' : ''}`}
                  onClick={() => toggle(fullFront, setFullFront, n)}
                >
                  {String(n).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="fc3d-dt-section">
          <div className="fc3d-dt-label">
            后区 <span className="muted">（可多选，{backs.length || 2} 个）</span>
          </div>
          <div className="ssq-pick-grid ssq-pick-blue">
            {BACK_NUMS.map((n) => (
              <button
                key={n}
                className={`ssq-pick ball-blue ${backs.includes(n) ? 'pick-blue' : ''}`}
                onClick={() => toggle(backs, setBacks, n)}
              >
                {String(n).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>

        <div className="fc3d-dt-result">
          {error ? (
            <span className="muted">{error}</span>
          ) : (
            <>
              <span>
                共 <b>{bets}</b> 注
              </span>
              <span>
                金额 <b>¥{cost}</b>
              </span>
              <span className="muted small">
                前区 {frontSelected.length} 个 · 后区 {backs.length || 2} 个 · 每注 {addon ? 3 : 2} 元
              </span>
            </>
          )}
          <label className="muted small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={addon} onChange={(e) => setAddon(e.target.checked)} />
            追加投注（每注 +1 元）
          </label>
          <button className="tab-btn" onClick={clearAll}>
            清空
          </button>
          <button className="tab-btn" onClick={fillByPredict} disabled={!draws.length}>
            按推荐填入
          </button>
        </div>

        <Note>
          注数 = C(拖码数, 5−胆码数) × C(后区数,2)（普通复式为 C(前区数,5) × C(后区数,2)），每注 2 元。
          追加投注每注多花 1 元，中一至六等奖时追加奖金为基本奖金的 80%。
          胆拖只是把选号范围缩小、方便核对，并不改变每一注的中奖概率。
        </Note>
      </Card>

      <Card title="常用复式成本速查" tag="后区 2 个 · 每注 2 元">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>前区个数</th>
                <th>组合注数</th>
                <th>基本投注成本</th>
                <th>追加投注成本</th>
                <th>5 前区全覆盖概率</th>
              </tr>
            </thead>
            <tbody>
              {[5, 6, 7, 8, 9, 10, 11, 12].map((k) => {
                const bets = combinationCount(k, FRONT_PICK)
                const rate = (bets / combinationCount(35, FRONT_PICK)) * 100
                return (
                  <tr key={k}>
                    <td className="mono">{k} 个</td>
                    <td className="mono">{bets.toLocaleString('zh-CN')}</td>
                    <td className="mono">{(bets * 2).toLocaleString('zh-CN')} 元</td>
                    <td className="mono">{(bets * 3).toLocaleString('zh-CN')} 元</td>
                    <td className="mono">{rate < 0.01 ? rate.toFixed(4) : rate.toFixed(2)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="ssq-preview">
        <span className="muted small">当前选号预览</span>
        <div className="ssq-ball-row">
          {frontSelected.map((n) => (
            <Ball key={`r${n}`} n={n} kind="red" size="sm" className={dan.includes(n) ? 'ball-dan' : ''} />
          ))}
          <span className="ssq-divider" aria-hidden="true" />
          {backs.map((n) => (
            <Ball key={`b${n}`} n={n} kind="blue" size="sm" />
          ))}
        </div>
      </div>

      {/* 保底缩水：复用上方的胆码/拖码（普通复式则把前区复选当作号码池） */}
      <WheelPanel
        kind="dlt"
        pool={mode === 'full' ? fullFront : tuo}
        dan={mode === 'full' ? [] : dan}
        kOptions={[FRONT_PICK]}
        tOptions={[4, 5]}
        defaultK={FRONT_PICK}
        defaultT={4}
      />
    </div>
  )
}
