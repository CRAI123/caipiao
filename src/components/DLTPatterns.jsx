// 大乐透 形态走势 —— 和值/和尾/AC/跨度/连号/大小/单双/质合/三区/四区/012路/尾数/五行
import React, { useState } from 'react'
import { Card, Note, BarList } from './common.jsx'
import { patternSummary, analyzeDraw, WUXING, ZONE3, ZONE4 } from '../lib/dltPredict.js'

const WINDOWS = [10, 20, 30, 50, 100]

function toBars(list, labelFn) {
  return list.map((x) => ({
    key: String(x.v ?? x.label),
    label: labelFn ? labelFn(x) : String(x.v ?? x.label),
    value: x.count,
  }))
}

export default function DLTPatterns({ draws }) {
  const [windowN, setWindowN] = useState(30)
  const p = patternSummary(draws, windowN)
  const recent = draws.slice(0, 20)

  const zoneText = ZONE3.map(([a, b]) => `${a}-${b}`)
  const zone4Text = ZONE4.map(([a, b]) => `${a}-${b}`)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">统计窗口</span>
        {WINDOWS.map((n) => (
          <button
            key={n}
            className={`tab-btn ${windowN === n ? 'active' : ''}`}
            onClick={() => setWindowN(n)}
            disabled={n > draws.length}
          >
            近 {n} 期
          </button>
        ))}
      </div>

      <div className="two-col">
        <Card title="和值分布" tag={`均值 ${p.sumAvg} · ${p.sumMin}–${p.sumMax}`}>
          <BarList
            items={p.sumBuckets.map((b) => ({ key: b.label, label: b.label, value: b.count }))}
            color="red"
          />
          <Note>5 个前区号的和值理论均值 90，实际分布近似正态，两端极少出现。</Note>
        </Card>
        <Card title="和尾分布" tag="和值个位 0–9">
          <BarList items={toBars(p.sumTailDist, (x) => `尾 ${x.v}`)} color="amber" />
          <Note>和尾把 80 多种和值压缩成 10 类，每类理论占比约 10%。</Note>
        </Card>
      </div>

      <div className="two-col">
        <Card title="跨度分布" tag={`均值 ${p.spanAvg}`}>
          <BarList
            items={p.spanDist.filter((s) => s.count > 0).map((s) => ({ key: `s${s.v}`, label: `跨 ${s.v}`, value: s.count }))}
            color="blue"
          />
          <Note>跨度 = 最大前区号 − 最小前区号。5 个前区的跨度均值约 29，34 极少见。</Note>
        </Card>
        <Card title="AC 值分布" tag={`均值 ${p.acAvg}`}>
          <BarList
            items={p.acDist.filter((s) => s.count > 0).map((s) => ({ key: `a${s.v}`, label: `AC ${s.v}`, value: s.count }))}
            color="green"
          />
          <Note>AC 值 = 两两差值种类数 − 4，衡量号码的离散程度，越高越“散”。</Note>
        </Card>
      </div>

      <div className="two-col">
        <Card title="大小比" tag="大号 ≥18">
          <BarList items={toBars(p.bigDist, (x) => `${x.v} 大 : ${5 - x.v} 小`)} color="red" />
        </Card>
        <Card title="单双比" tag="奇数个数">
          <BarList items={toBars(p.oddDist, (x) => `${x.v} 单 : ${5 - x.v} 双`)} color="blue" />
        </Card>
      </div>

      <div className="two-col">
        <Card title="质合比" tag="质数 2/3/5/7/11/13/17/19/23/29/31">
          <BarList items={toBars(p.primeDist, (x) => `${x.v} 质 : ${5 - x.v} 合`)} color="amber" />
        </Card>
        <Card title="连号组数" tag="相邻号码成段">
          <BarList
            items={toBars(p.consecutiveDist, (x) => (x.v === 4 ? '4 组以上' : `${x.v} 组`))}
            color="green"
          />
          <Note>“连号”指 05-06 这类相邻号码，5 个前区里 0–1 组连号最常见。</Note>
        </Card>
      </div>

      <Card title="三区结构" tag={`${zoneText.join(' / ')} · 断区率 ${p.zone3.breakRate}%`}>
        <BarList items={p.zone3Dist.map((z) => ({ key: z.label, label: z.label, value: z.count }))} color="red" />
        <div className="ssq-zone-avg mono">
          区间平均出号：{p.zone3.avg.join(' / ')}　最长连续断区：{p.zone3.maxStreak} 期
        </div>
        <Note>三区即 01–12 / 13–24 / 25–35。2:2:1 之类的均衡结构最常见，但不是“必出结构”。</Note>
      </Card>

      <Card title="四区结构" tag={`${zone4Text.join(' / ')} · 断区率 ${p.zone4.breakRate}%`}>
        <BarList
          items={p.zone4Dist.slice(0, 12).map((z) => ({ key: z.label, label: z.label, value: z.count }))}
          color="blue"
        />
        <div className="ssq-zone-avg mono">
          区间平均出号：{p.zone4.avg.join(' / ')}　最长连续断区：{p.zone4.maxStreak} 期
        </div>
        <Note>四分法把 35 个号分成 01–09 / 10–18 / 19–27 / 28–35，用于判断“断区”。</Note>
      </Card>

      <Card title="012 路结构" tag="除 3 余数">
        <BarList
          items={p.road012Dist.slice(0, 10).map((z) => ({ key: z.label, label: z.label, value: z.count }))}
          color="amber"
        />
        <Note>
          0 路：03/06/09…33；1 路：01/04/07…34；2 路：02/05/08…35。
          三路号量接近，理想结构是 2:2:1 附近的均衡分布。
        </Note>
      </Card>

      <div className="two-col">
        <Card title="尾数分布" tag="号码个位 0–9">
          <BarList items={p.tailCounts.map((c, t) => ({ key: `t${t}`, label: `尾 ${t}`, value: c }))} color="red" />
          <Note>每个尾数对应 3–4 个前区号，长期应大致均匀。</Note>
        </Card>
        <Card title="尾号组数 & 尾和" tag={`尾和均值 ${p.tailSumAvg}`}>
          <BarList items={toBars(p.tailGroupDist, (x) => `${x.v} 组尾`)} color="blue" />
          <Note>5 个前区里“尾号组数”指个位不重复的个数，5 组（全不同尾）最常见。</Note>
        </Card>
      </div>

      <Card title="五行分布" tag="前区五行分组">
        <div className="ssq-wuxing-grid">
          {Object.entries(WUXING).map(([name, nums]) => (
            <div key={name} className="ssq-wuxing-item">
              <div className="ssq-wuxing-name">{name}</div>
              <div className="ssq-wuxing-count">{p.wuxingCounts[name] || 0}</div>
              <div className="ssq-wuxing-nums mono">{nums.map((n) => String(n).padStart(2, '0')).join(' ')}</div>
            </div>
          ))}
        </div>
        <Note>五行分组是民间分类法，每组 7 个号，横向比较时看出现次数即可。</Note>
      </Card>

      <Card title="近期结构走势" tag="最近 20 期">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>和值</th>
                <th>和尾</th>
                <th>跨度</th>
                <th>AC</th>
                <th>三区</th>
                <th>大小</th>
                <th>单双</th>
                <th>质合</th>
                <th>连号</th>
                <th>尾组</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => {
                const a = analyzeDraw(d)
                return (
                  <tr key={d.id}>
                    <td className="mono">{String(d.id).slice(-5)}</td>
                    <td className="mono">{a.sum}</td>
                    <td className="mono">{a.sumTail}</td>
                    <td className="mono">{a.span}</td>
                    <td className="mono">{a.ac}</td>
                    <td className="mono">{a.zone3.join(':')}</td>
                    <td className="mono">
                      {a.big}:{a.small}
                    </td>
                    <td className="mono">
                      {a.odd}:{a.even}
                    </td>
                    <td className="mono">
                      {a.prime}:{a.composite}
                    </td>
                    <td className="mono">{a.groups.length}</td>
                    <td className="mono">{a.tailGroups}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Note tone="warn">
        以上全部是历史分布统计。任何形态都不会因为“久未出现”而提高下期概率，开奖各期相互独立。
      </Note>
    </div>
  )
}
