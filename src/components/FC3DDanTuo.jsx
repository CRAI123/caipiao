// 福彩3D 复式胆拖 —— 选胆码、拖码，自动计算注数与金额
import React, { useState, useMemo } from 'react'
import { Card, Note } from './common.jsx'
import WheelPanel from './WheelPanel.jsx'
import { DIGITS } from '../lib/fc3dStats.js'
import { QXC_POS, QXC_VALUES } from '../lib/qxcPredict.js'

const PLAY_TYPES = [
  { id: 'group6', name: '组六', desc: '三不同号，6种排列', combos: 6 },
  { id: 'group3', name: '组三', desc: '两同号，3种排列', combos: 3 },
  { id: 'direct', name: '直选', desc: '定位复式', combos: 1 },
]

/** 生成组合 */
function combinations(arr, k) {
  const result = []
  const fn = (start, combo) => {
    if (combo.length === k) { result.push([...combo]); return }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i])
      fn(i + 1, combo)
      combo.pop()
    }
  }
  fn(0, [])
  return result
}

export default function FC3DDanTuo({ label = '福彩3D', digitCount = 3 }) {
  const [dan, setDan] = useState([])
  const [tuo, setTuo] = useState([])
  const [posSel, setPosSel] = useState(() => Array.from({ length: 7 }, () => []))
  const [playType, setPlayType] = useState(digitCount === 5 ? 'direct' : 'group6')
  const playTypes = digitCount === 5 ? PLAY_TYPES.filter((p) => p.id === 'direct') : PLAY_TYPES

  const allSelected = [...dan, ...tuo]

  function toggle(list, setList, d) {
    if (list.includes(d)) setList(list.filter((x) => x !== d))
    else setList([...list, d])
  }

  // 计算注数
  const { count, cost, error } = useMemo(() => {
    if (dan.length === 0 && tuo.length === 0) return { count: 0, cost: 0, error: null }
    if (playType === 'direct' && digitCount === 5) {
      // 排列五只有直选：每位取同一个数字池做定位复式，n 个号码 → n^5 注
      const count = allSelected.length ** 5
      return { count, cost: count * 2, error: null }
    }
    if (dan.length + tuo.length < 3) return { count: 0, cost: 0, error: '胆码+拖码至少需要 3 个不同号码' }
    if (playType === 'group6') {
      // 组六：从所有号码中选3个不同的
      const need = 3 - dan.length
      if (tuo.length < need) return { count: 0, cost: 0, error: `组六需要拖码 ${need} 个` }
      const count = combinations(tuo, need).length
      return { count, cost: count * 2, error: null }
    }
    if (playType === 'group3') {
      // 组三：两同号 + 一不同号。简化：从拖码中选1个做对子，再选1个不同
      if (tuo.length < 2) return { count: 0, cost: 0, error: '组三至少需要 2 个拖码' }
      // 所有两两组合（含对子）
      let count = 0
      for (const t of tuo) {
        for (const other of tuo) {
          if (other !== t) count++
        }
      }
      return { count, cost: count * 2, error: null }
    }
    if (playType === 'direct') {
      // 直选定位复式：每位独立选择
      const digits = allSelected
      const count = digits.length ** 3
      return { count, cost: count * 2, error: null }
    }
    return { count: 0, cost: 0, error: null }
  }, [dan, tuo, playType, allSelected.length, digitCount])

  function clear() { setDan([]); setTuo([]) }

  // 七星彩没有胆拖：前 6 位 + 后区逐位复式，注数 = 各位置选中个数连乘
  if (digitCount === 7) {
    const counts = posSel.map((arr) => arr.length)
    const count = counts.every((n) => n > 0) ? counts.reduce((a, b) => a * b, 1) : 0
    const togglePos = (pos, d) => {
      setPosSel((prev) =>
        prev.map((arr, i) =>
          i === pos ? (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]) : arr,
        ),
      )
    }
    const selectAll = () => setPosSel(QXC_VALUES.map((vals) => [...vals]))
    const clearPos = () => setPosSel(Array.from({ length: 7 }, () => []))
    const randomOne = () =>
      setPosSel(QXC_VALUES.map((vals) => [vals[Math.floor(Math.random() * vals.length)]]))

    return (
      <div className="page">
        <Card title="复式选号" tag={label}>
          <Note>
            七星彩只有直选：前 6 位各选 0–9，后区选 0–14。注数 = 各位置选中个数连乘，
            每注 2 元。复式能覆盖更多组合，但成本按指数上升。
          </Note>
          {QXC_POS.map((name, pos) => (
            <div key={name} className="fc3d-dt-section">
              <div className="fc3d-dt-label">
                {name}位 <span className="muted">（已选 {posSel[pos].length} 个）</span>
              </div>
              <div className="fc3d-dt-digits">
                {QXC_VALUES[pos].map((d) => (
                  <button
                    key={d}
                    className={`dt-ball ${posSel[pos].includes(d) ? 'tuo' : ''}`}
                    onClick={() => togglePos(pos, d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="fc3d-dt-result">
            {count > 0 ? (
              <>
                <span>共 <b>{count.toLocaleString('zh-CN')}</b> 注</span>
                <span>金额 <b>¥{cost.toLocaleString('zh-CN')}</b></span>
              </>
            ) : (
              <span className="muted">每个位置至少选择 1 个号码</span>
            )}
            <button className="tab-btn" onClick={selectAll}>全选</button>
            <button className="tab-btn" onClick={randomOne}>每位随机 1 个</button>
            <button className="tab-btn" onClick={clearPos}>清空</button>
          </div>
          <Note tone="warn">
            七星彩单注中奖概率恒为 1 / 15,000,000，复式只是把更多组合买下来，不会改变任何一注的概率。
            全选会得到 10⁶ × 15 = 15,000,000 注、3,000 万元，请务必量力而行。
          </Note>
        </Card>
      </div>
    )
  }

  return (
    <div className="page">
      <Card title="复式胆拖选号" tag={label}>
        <div className="fc3d-dt-type">
          {playTypes.map((p) => (
            <button
              key={p.id}
              className={`tab-btn ${playType === p.id ? 'active' : ''}`}
              onClick={() => setPlayType(p.id)}
            >
              {p.name}
              <i>{p.desc}</i>
            </button>
          ))}
        </div>

        <div className="fc3d-dt-section">
          <div className="fc3d-dt-label">
            胆码 <span className="muted">（必出号码，{dan.length} 个）</span>
          </div>
          <div className="fc3d-dt-digits">
            {DIGITS.map((d) => {
              const inDan = dan.includes(d)
              const inTuo = tuo.includes(d)
              return (
                <button
                  key={d}
                  className={`dt-ball ${inDan ? 'dan' : ''} ${inTuo ? 'tuo' : ''}`}
                  disabled={inTuo}
                  onClick={() => toggle(dan, setDan, d)}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        <div className="fc3d-dt-section">
          <div className="fc3d-dt-label">
            拖码 <span className="muted">（搭配号码，{tuo.length} 个）</span>
          </div>
          <div className="fc3d-dt-digits">
            {DIGITS.map((d) => {
              const inDan = dan.includes(d)
              const inTuo = tuo.includes(d)
              return (
                <button
                  key={d}
                  className={`dt-ball ${inTuo ? 'tuo' : ''}`}
                  disabled={inDan}
                  onClick={() => toggle(tuo, setTuo, d)}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        <div className="fc3d-dt-result">
          {error ? (
            <span className="muted">{error}</span>
          ) : (
            <>
              <span>共 <b>{count}</b> 注</span>
              <span>金额 <b>¥{cost}</b></span>
              <button className="tab-btn" onClick={clear}>清空</button>
            </>
          )}
        </div>
        <Note>
          {digitCount === 5
            ? '排列五只有直选：n 个号码做定位复式，共 n⁵ 注（如 2 个号 32 注 64 元、3 个号 243 注 486 元）。复式能覆盖更多组合，但成本按指数上升。'
            : '组六/组三为组选玩法，直选为定位复式。胆拖可缩小选号范围、控制投注金额。'}
        </Note>
      </Card>

      {/* 保底缩水：复用上方的胆码/拖码选择 */}
      <WheelPanel
        kind="digit"
        pool={tuo}
        dan={dan}
        kOptions={digitCount === 5 ? [5] : [3]}
        tOptions={[2, 3]}
        defaultK={digitCount === 5 ? 5 : 3}
        defaultT={2}
      />
    </div>
  )
}
