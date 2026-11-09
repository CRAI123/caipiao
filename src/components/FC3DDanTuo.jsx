// 福彩3D 复式胆拖 —— 选胆码、拖码，自动计算注数与金额
import React, { useState, useMemo } from 'react'
import { Card, Note } from './common.jsx'
import { DIGITS } from '../lib/fc3dStats.js'

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

export default function FC3DDanTuo() {
  const [dan, setDan] = useState([])
  const [tuo, setTuo] = useState([])
  const [playType, setPlayType] = useState('group6')

  const allSelected = [...dan, ...tuo]

  function toggle(list, setList, d) {
    if (list.includes(d)) setList(list.filter((x) => x !== d))
    else setList([...list, d])
  }

  // 计算注数
  const { count, cost, error } = useMemo(() => {
    if (dan.length === 0 && tuo.length === 0) return { count: 0, cost: 0, error: null }
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
  }, [dan, tuo, playType])

  function clear() { setDan([]); setTuo([]) }

  return (
    <div className="page">
      <Card title="复式胆拖选号" tag="福彩3D">
        <div className="fc3d-dt-type">
          {PLAY_TYPES.map((p) => (
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
        <Note>组六/组三为组选玩法，直选为定位复式。胆拖可缩小选号范围、控制投注金额。</Note>
      </Card>
    </div>
  )
}
