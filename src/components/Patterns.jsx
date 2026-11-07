// 形态分析 —— 奇偶 / 大小 / 012路 / 连号 / 和值 / 跨度（20 个开奖号）
import React, { useState } from 'react'
import { Card, StatCard, BarList, LineChart, Note, DrawBalls, pad2 } from './common.jsx'
import { drawShapes, shapeStats, takeLatest, tailCount, acValue, zoneCount, SMALL_MAX, PER_DRAW } from '../lib/stats.js'

const WINDOW_OPTIONS = [20, 50, 100]

export default function Patterns({ draws }) {
  const [windowN, setWindowN] = useState(100)
  const shapes = shapeStats(draws, windowN)
  const ledger = takeLatest(draws, 15).map((d) => ({
    draw: d,
    s: drawShapes(d),
    tail: tailCount(d.nums),
    ac: acValue(d.nums),
    zone: zoneCount(d.nums),
  }))
  const sumsNewFirst = ledger.map((l) => l.s.sum).slice().reverse()
  const spansNewFirst = ledger.map((l) => l.s.span).slice().reverse()
  const labels = ledger.map((l) => String(l.draw.id).slice(-3)).slice().reverse()

  const win = takeLatest(draws, windowN)
  const tailAvg = new Array(10).fill(0)
  const zoneAvg = [0, 0, 0]
  let acSum = 0
  win.forEach((d) => {
    tailCount(d.nums).forEach((c, i) => (tailAvg[i] += c))
    zoneCount(d.nums).forEach((c, i) => (zoneAvg[i] += c))
    acSum += acValue(d.nums)
  })
  const nn = win.length || 1

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOW_OPTIONS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${windowN === n ? 'active' : ''}`}
            onClick={() => setWindowN(n)}
          >
            近 {n} 期
          </button>
        ))}
        <span className="toolbar-note">样本 {shapes.sample} 期</span>
      </div>

      <div className="stat-grid stat-grid-4">
        <StatCard label="平均和值" value={shapes.avgSum} note="20 号理论均值约 810" />
        <StatCard label="平均跨度" value={shapes.avgSpan} tone="blue" note="最大号 − 最小号" />
        <StatCard label="含连号期占比" value={shapes.consecutiveRate} unit="%" tone="amber" />
        <StatCard label="012路总量" value={shapes.roadDist.join(' / ')} tone="red" note="余0 / 余1 / 余2" />
      </div>

      <div className="grid-2">
        <Card title="奇偶比分布" tag={`近 ${windowN} 期 · 奇:偶`}>
          <BarList
            items={shapes.oddDist.map(([k, v]) => ({ key: k, label: `${k}（奇:偶）`, value: v }))}
            color="red"
          />
          <Note>
            80 个号码中奇偶各 40 个，每期开出 20 个，因此奇数个数呈对称分布，最常见的是 10:10。
          </Note>
        </Card>
        <Card title="大小比分布" tag={`近 ${windowN} 期 · 1-${SMALL_MAX} 小 / ${SMALL_MAX + 1}-80 大`}>
          <BarList
            items={shapes.bigDist.map(([k, v]) => ({ key: k, label: `${k}（大:小）`, value: v }))}
            color="blue"
          />
          <Note>大小划分是人为区间，摇奖机并无「大小」概念。</Note>
        </Card>
      </div>

      <Card title="连号组数分布" tag={`近 ${windowN} 期 · 每期 20 个号码`}>
        <BarList
          items={shapes.runCountDist.map(([k, v]) => ({ key: k, label: `${k} 组`, value: v }))}
          color="red"
        />
        <Note>
          20 个号码密集分布在 1-80 内，出现连号（如 05、06）属于正常现象；连号本身不会改变任何一个号码的命中概率。
        </Note>
      </Card>

      <div className="grid-2">
        <Card title="尾数分布" tag={`近 ${windowN} 期 · 每期 20 个号码的平均值`}>
          <BarList
            items={tailAvg.map((v, i) => ({ key: i, label: `${i} 尾`, value: +(v / nn).toFixed(2) }))}
            color="blue"
          />
          <Note>0-9 尾各 8 个号码，理论平均每期每尾 2.0 个；偏离是随机波动。</Note>
        </Card>
        <Card title="三区与 AC 值" tag={`近 ${windowN} 期 · 1-27 / 28-54 / 55-80`}>
          <BarList
            items={zoneAvg.map((v, i) => ({ key: i, label: ['一区', '二区', '三区'][i], value: +(v / nn).toFixed(2) }))}
            color="red"
          />
          <div className="stat-grid stat-grid-2" style={{ marginTop: 12 }}>
            <StatCard label="平均 AC 值" value={+(acSum / nn).toFixed(1)} tone="amber" note="两两差值多样性 − 19" />
            <StatCard label="三区理论均值" value="6.75 / 6.75 / 6.5" tone="blue" note="27 / 27 / 26 个号 × 20/80" />
          </div>
        </Card>
      </div>

      <Card title="和值走势" tag="最近 15 期 · 虚线为窗口平均">
        <LineChart
          values={sumsNewFirst}
          labels={labels}
          guide={{ value: Math.round(shapes.avgSum) }}
          height={170}
        />
        <Note tone="warn">
          20 个号码和值范围 210-1410，理论均值约 810。和值围绕均值波动是随机序列的自然表现，用和值「预测区间」没有预测效力。
        </Note>
      </Card>

      <Card title="跨度走势" tag="最近 15 期">
        <LineChart
          values={spansNewFirst}
          labels={labels}
          guide={{ value: Math.round(shapes.avgSpan) }}
          color="var(--blue)"
          height={150}
        />
      </Card>

      <Card title="逐期形态台账" tag="最近 15 期">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>20 个开奖号</th>
                <th>奇:偶</th>
                <th>大:小</th>
                <th>012路</th>
                <th>连号</th>
                <th>和值</th>
                <th>跨度</th>
                <th>热尾</th>
                <th>AC</th>
                <th>三区</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(({ draw, s, tail, ac, zone }) => (
                <tr key={draw.id}>
                  <td className="mono">{draw.id}</td>
                  <td>
                    <DrawBalls draw={draw} size="xs" />
                  </td>
                  <td className="mono">{s.odd}:{s.even}</td>
                  <td className="mono">{s.big}:{s.small}</td>
                  <td className="mono">{s.r012.join('-')}</td>
                  <td>
                    {s.hasConsecutive ? (
                      <span className="tag-run">
                        {s.runs.map((r) => r.map((n) => pad2(n)).join(',')).join(' / ')}
                      </span>
                    ) : (
                      <span className="muted">无</span>
                    )}
                  </td>
                  <td className="mono">{s.sum}</td>
                  <td className="mono">{s.span}</td>
                  <td className="mono">{tail.indexOf(Math.max(...tail))} 尾 ×{Math.max(...tail)}</td>
                  <td className="mono">{ac}</td>
                  <td className="mono">{zone.join('-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          每期固定开出 {PER_DRAW} 个号码，因此「奇:偶」「大:小」两列之和恒为 {PER_DRAW}。
        </Note>
      </Card>
    </div>
  )
}
