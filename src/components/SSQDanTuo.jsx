// 双色球 复式胆拖 —— 红球胆码/拖码 + 蓝球，自动算注数与金额
import React, { useMemo, useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import WheelPanel from './WheelPanel.jsx'
import { RED_NUMS, BLUE_NUMS, predictSSQ } from '../lib/ssqPredict.js'

function combinationCount(n, k) {
  if (k < 0 || k > n) return 0
  let v = 1
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1)
  return Math.round(v)
}

const MODES = [
  { id: 'dantuo', name: '胆拖复式', desc: '胆码必选，拖码补足 6 个红球' },
  { id: 'full', name: '普通复式', desc: '直接选 6 个以上红球全组合' },
]

export default function SSQDanTuo({ draws = [] }) {
  const [mode, setMode] = useState('dantuo')
  const [dan, setDan] = useState([])
  const [tuo, setTuo] = useState([])
  const [fullRed, setFullRed] = useState([])
  const [blues, setBlues] = useState([])

  function toggle(list, setList, n) {
    if (list.includes(n)) setList(list.filter((x) => x !== n))
    else setList([...list, n].sort((a, b) => a - b))
  }

  function clearAll() {
    setDan([])
    setTuo([])
    setFullRed([])
    setBlues([])
  }

  function fillByPredict() {
    const p = predictSSQ(draws)
    if (!p) return
    if (mode === 'dantuo') {
      setDan(p.red.slice(0, 2))
      setTuo(p.red.slice(2))
    } else {
      setFullRed(p.red)
    }
    setBlues([p.blue])
  }

  const { bets, cost, error } = useMemo(() => {
    const blueCount = Math.max(blues.length, 1) // 未选蓝球时按单蓝估算
    if (mode === 'full') {
      if (fullRed.length < 6) {
        return { bets: 0, cost: 0, error: `普通复式至少需要 6 个红球（当前 ${fullRed.length} 个）` }
      }
      const bets = combinationCount(fullRed.length, 6) * blueCount
      return { bets, cost: bets * 2, error: null }
    }
    if (!dan.length) return { bets: 0, cost: 0, error: '请至少选择 1 个胆码' }
    if (dan.length > 5) return { bets: 0, cost: 0, error: '胆码最多 5 个（否则凑不满 6 红）' }
    const need = 6 - dan.length
    if (tuo.length < need) {
      return { bets: 0, cost: 0, error: `还需 ${need} 个拖码（当前 ${tuo.length} 个）` }
    }
    const bets = combinationCount(tuo.length, need) * blueCount
    return { bets, cost: bets * 2, error: null }
  }, [mode, dan, tuo, fullRed, blues])

  const redSelected = mode === 'full' ? fullRed : [...dan, ...tuo]

  return (
    <div className="page">
      <Card title="复式胆拖选号" tag="双色球 · 红球 33 选 6 + 蓝球 16 选 1">
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
                红球胆码 <span className="muted">（必出，{dan.length}/5）</span>
              </div>
              <div className="ssq-pick-grid">
                {RED_NUMS.map((n) => {
                  const inDan = dan.includes(n)
                  const inTuo = tuo.includes(n)
                  return (
                    <button
                      key={n}
                      className={`ssq-pick ball-red ${inDan ? 'pick-dan' : ''} ${inTuo ? 'pick-dim' : ''}`}
                      disabled={inTuo || (dan.length >= 5 && !inDan)}
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
                红球拖码 <span className="muted">（搭配，{tuo.length} 个）</span>
              </div>
              <div className="ssq-pick-grid">
                {RED_NUMS.map((n) => {
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
              红球复式 <span className="muted">（至少 6 个，当前 {fullRed.length} 个）</span>
            </div>
            <div className="ssq-pick-grid">
              {RED_NUMS.map((n) => (
                <button
                  key={n}
                  className={`ssq-pick ball-red ${fullRed.includes(n) ? 'pick-tuo' : ''}`}
                  onClick={() => toggle(fullRed, setFullRed, n)}
                >
                  {String(n).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="fc3d-dt-section">
          <div className="fc3d-dt-label">
            蓝球 <span className="muted">（可多选，{blues.length || 1} 个）</span>
          </div>
          <div className="ssq-pick-grid ssq-pick-blue">
            {BLUE_NUMS.map((n) => (
              <button
                key={n}
                className={`ssq-pick ball-blue ${blues.includes(n) ? 'pick-blue' : ''}`}
                onClick={() => toggle(blues, setBlues, n)}
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
                红球 {redSelected.length} 个 · 蓝球 {Math.max(blues.length, 1)} 个
              </span>
            </>
          )}
          <button className="tab-btn" onClick={clearAll}>
            清空
          </button>
          <button className="tab-btn" onClick={fillByPredict} disabled={!draws.length}>
            按推荐填入
          </button>
        </div>

        <Note>
          注数 = C(拖码数, 6−胆码数) × 蓝球数（普通复式为 C(红球数,6) × 蓝球数），每注 2 元。
          胆拖只是把选号范围缩小、方便核对，并不改变每一注的中奖概率。
        </Note>
      </Card>

      <Card title="常用复式成本速查" tag="单蓝球 · 每注 2 元">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>红球个数</th>
                <th>组合注数</th>
                <th>单蓝成本</th>
                <th>两蓝成本</th>
                <th>6 红全覆盖概率</th>
              </tr>
            </thead>
            <tbody>
              {[6, 7, 8, 9, 10, 11, 12].map((k) => {
                const bets = combinationCount(k, 6)
                const rate = (bets / combinationCount(33, 6)) * 100
                return (
                  <tr key={k}>
                    <td className="mono">{k} 个</td>
                    <td className="mono">{bets.toLocaleString('zh-CN')}</td>
                    <td className="mono">{(bets * 2).toLocaleString('zh-CN')} 元</td>
                    <td className="mono">{(bets * 4).toLocaleString('zh-CN')} 元</td>
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
          {redSelected.map((n) => (
            <Ball key={`r${n}`} n={n} kind="red" size="sm" className={dan.includes(n) ? 'ball-dan' : ''} />
          ))}
          <span className="ssq-divider" aria-hidden="true" />
          {(blues.length ? blues : []).map((n) => (
            <Ball key={`b${n}`} n={n} kind="blue" size="sm" />
          ))}
        </div>
      </div>

      {/* 保底缩水：复用上方的胆码/拖码（普通复式则把红球复选当作号码池） */}
      <WheelPanel
        kind="ssq"
        pool={mode === 'full' ? fullRed : tuo}
        dan={mode === 'full' ? [] : dan}
        kOptions={[6]}
        tOptions={[4, 5, 6]}
        defaultK={6}
        defaultT={4}
      />
    </div>
  )
}
