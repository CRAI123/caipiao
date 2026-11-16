// 走势 K 线 —— 四彩种通用的技术分析页：合成蜡烛图 + 均线 + 布林带 + MACD + 号码走势连线
import React, { useMemo, useState } from 'react'
import { Card, Note, ballKindByRange } from './common.jsx'
import KlineChart from './KlineChart.jsx'
import NumberTrend from './NumberTrend.jsx'
import OmissionPanel from './OmissionPanel.jsx'
import { buildCandles, projectNext, movingAverage, INDICATOR_PRESETS } from '../lib/kline.js'

const WINDOWS = [30, 60, 120]
const PRESET_KEYS = ['short', 'standard', 'long']
const POS_LABEL = ['百位', '十位', '个位']
const RANGE_COLOR = { red: '#c23a2b', blue: '#24558f', green: '#1d6f3e', amber: '#b7791f' }

const sumOf = (arr) => arr.reduce((a, b) => a + b, 0)
const spanOf = (arr) => Math.max(...arr) - Math.min(...arr)

/** 各彩种的 K 线序列定义：和值 / 跨度 / 蓝球 */
function buildSeries(lottery, chrono) {
  if (lottery === 'kl8') {
    return [
      {
        key: 'sum',
        title: '20 号总和 K 线',
        tag: '理论均值 810',
        unit: '',
        wick: 0.25,
        points: chrono.map((d) => ({ id: d.id, date: d.date, value: sumOf(d.nums), span: spanOf(d.nums) })),
        hint:
          '快乐8 每期开 20 个号，总和理论均值 810、标准差约 84。影线取本期 20 号跨度的 1/4，用来看单期离散度。',
      },
      {
        key: 'span',
        title: '跨度 K 线',
        tag: '最大号 − 最小号',
        unit: '',
        wick: 0,
        points: chrono.map((d) => ({ id: d.id, date: d.date, value: spanOf(d.nums), span: 0 })),
        hint: '20 个号里最大与最小的差值。跨度长期贴近 79（几乎必然出现两端号码），单看趋势意义有限。',
      },
    ]
  }

  if (lottery === 'ssq') {
    return [
      {
        key: 'redsum',
        title: '红球和值 K 线',
        tag: '理论均值 102',
        unit: '',
        wick: 0.35,
        points: chrono.map((d) => ({ id: d.id, date: d.date, value: sumOf(d.red), span: spanOf(d.red) })),
        hint:
          '6 个红球的和值近似正态，理论均值 102、标准差约 24。影线为红球跨度的 0.35 倍。',
      },
      {
        key: 'blue',
        title: '蓝球 K 线',
        tag: '1 – 16',
        unit: '',
        wick: 0.2,
        points: chrono.map((d) => ({ id: d.id, date: d.date, value: d.blue, span: 0 })),
        hint:
          '蓝球是单个号码，没有真正的开高低收，这里把「上期→本期」的变化画成实体，方便看连号与折返。',
      },
    ]
  }

  // 福彩3D / 排列三 / 排列五
  const isPl5 = lottery === 'pl5'
  return [
    {
      key: 'sum',
      title: '和值 K 线',
      tag: isPl5 ? '0 – 45' : '0 – 27',
      unit: '',
      wick: 0.5,
      points: chrono.map((d) => ({
        id: d.id ?? d.drawId,
        date: d.date,
        value: sumOf(d.num),
        span: spanOf(d.num),
      })),
      hint: isPl5
        ? '和值理论均值 22.5。开=上期和值、收=本期和值，影线取本期跨度的 0.5 倍，颜色红涨绿跌。'
        : '和值理论均值 13.5。开=上期和值、收=本期和值，影线取本期跨度的 0.5 倍，颜色红涨绿跌。',
    },
    {
      key: 'span',
      title: '跨度 K 线',
      tag: '0 – 9',
      unit: '',
      wick: 0,
      points: chrono.map((d) => ({
        id: d.id ?? d.drawId,
        date: d.date,
        value: spanOf(d.num),
        span: 0,
      })),
      hint: isPl5
        ? '跨度 = 最大号 − 最小号，取值 0 – 9。跨度序列本身波动大，均线只用于看区间漂移。'
        : '跨度 = 最大号 − 最小号，理论均值约 6.3。跨度序列本身波动大，均线只用于看区间漂移。',
    },
  ]
}

function SeriesCard({ series, showBoll, preset }) {
  const { candles, values, proj, ma10, hint, title, tag } = series
  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const diff = prev == null ? 0 : last - prev
  const trendText = proj.trend > 0.15 ? '向上' : proj.trend < -0.15 ? '向下' : '走平'

  return (
    <Card title={title} tag={tag}>
      <KlineChart candles={candles} showBoll={showBoll} preset={preset} />
      <div className="metric-grid" style={{ marginTop: 10 }}>
        <div className="metric-card">
          <div className="metric-name">最新值</div>
          <div className="metric-value">{last}</div>
          <div className="metric-sub">
            较上期 {diff > 0 ? '+' : ''}
            {diff}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-name">均线</div>
          <div className="metric-value">
            {proj.ma5} / {ma10 == null ? '—' : ma10}
          </div>
          <div className="metric-sub">MA5 / MA10</div>
        </div>
        <div className="metric-card">
          <div className="metric-name">布林带</div>
          <div className="metric-value">
            {Math.round(proj.lower)} – {Math.round(proj.upper)}
          </div>
          <div className="metric-sub">
            中轨 {proj.mid} · {proj.bollState}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-name">MACD</div>
          <div className="metric-value">
            {proj.hist > 0 ? '+' : ''}
            {proj.hist}
          </div>
          <div className="metric-sub">
            DIF {proj.dif} · DEA {proj.dea} · 趋势{trendText}
          </div>
        </div>
      </div>
      <Note>{hint} 以 MA5 与布林中轨的中点为中枢、按 80% 波动宽度给出的下一期参考区间为{' '}
        <b>
          {proj.lo} – {proj.hi}
        </b>
        ，这是历史波动范围，不是预测值。</Note>
    </Card>
  )
}

export default function KlinePage({ lottery, draws, positions = POS_LABEL }) {
  const [windowN, setWindowN] = useState(60)
  const [showBoll, setShowBoll] = useState(true)
  const [presetKey, setPresetKey] = useState('standard')
  const [pos, setPos] = useState(0)

  const preset = INDICATOR_PRESETS[presetKey]

  const n = Math.min(windowN, draws.length)

  const series = useMemo(() => {
    const chrono = draws.slice(0, n).reverse()
    return buildSeries(lottery, chrono).map((s) => {
      const candles = buildCandles(s.points, s.wick)
      const values = candles.map((c) => c.close)
      const proj = projectNext(values, { coverRate: 0.8 })
      const ma10 = movingAverage(values, 10)[values.length - 1]
      return {
        ...s,
        candles,
        values,
        proj,
        ma10: ma10 == null ? null : Math.round(ma10 * 10) / 10,
      }
    })
  }, [lottery, draws, n])

  const trendN = Math.min(n, 50)
  const trendPoints = useMemo(
    () => draws.slice(0, trendN).reverse(),
    [draws, trendN],
  )

  const isDigit = lottery === 'fc3d' || lottery === 'pl3' || lottery === 'pl5'

  const digitPoints = useMemo(
    () =>
      isDigit
        ? trendPoints.map((d) => ({
            id: d.id ?? d.drawId,
            date: d.date,
            label: d.id ?? d.drawId,
            hits: [d.num[pos]],
          }))
        : [],
    [trendPoints, pos, isDigit],
  )

  const kl8Points = useMemo(
    () => (lottery === 'kl8' ? trendPoints.map((d) => ({ id: d.id, date: d.date, label: d.id, hits: d.nums })) : []),
    [trendPoints, lottery],
  )

  const ssqRedPoints = useMemo(
    () => (lottery === 'ssq' ? trendPoints.map((d) => ({ id: d.id, date: d.date, label: d.id, hits: d.red })) : []),
    [trendPoints, lottery],
  )

  const ssqBluePoints = useMemo(
    () =>
      lottery === 'ssq'
        ? trendPoints.map((d) => ({ id: d.id, date: d.date, label: d.id, hits: [d.blue] }))
        : [],
    [trendPoints, lottery],
  )

  if (!draws.length) {
    return (
      <div className="page">
        <Note tone="warn">暂无开奖数据，先在「数据管理」里导入。</Note>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">窗口</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            className={`tab-btn ${windowN === w ? 'active' : ''}`}
            onClick={() => setWindowN(w)}
            disabled={w > draws.length}
          >
            近 {w} 期
          </button>
        ))}
        <span className="toolbar-sep" />
        <button className={`tab-btn ${showBoll ? 'active' : ''}`} onClick={() => setShowBoll((v) => !v)}>
          布林带 {showBoll ? '开' : '关'}
        </button>
        <span className="toolbar-sep" />
        <span className="toolbar-label">指标参数</span>
        {PRESET_KEYS.map((k) => (
          <button
            key={k}
            className={`tab-btn ${presetKey === k ? 'active' : ''}`}
            onClick={() => setPresetKey(k)}
          >
            {INDICATOR_PRESETS[k].label}
          </button>
        ))}
        <span className="toolbar-note">
          {preset.label}：KDJ({preset.kdj}) · MACD({preset.macd.fast},{preset.macd.slow},{preset.macd.signal}) · BOLL({preset.boll},2)
          —— 参数只改平滑速度
        </span>
        <span className="toolbar-note">
          K 线为合成蜡烛：开=上期值 · 收=本期值 · 影线=本期跨度折算；圆点=KDJ 金叉/死叉，顶/底=MACD 背离
        </span>
      </div>

      {series.map((s) => (
        <SeriesCard key={s.key} series={s} showBoll={showBoll} preset={preset} />
      ))}

      <OmissionPanel lottery={lottery} draws={draws} windowN={n} preset={preset} positions={positions} />

      {lottery === 'kl8' && (
        <Card title="号码走势连线（1 – 80）" tag={`近 ${trendN} 期`}>
          <NumberTrend
            rows={Array.from({ length: 80 }, (_, i) => i + 1)}
            points={kl8Points}
            colorFor={(num) => RANGE_COLOR[ballKindByRange(num)]}
            formatRow={(num) => String(num).padStart(2, '0')}
          />
          <Note>
            每行一个号码、每列一期：圆点=该期开出，横线=连续两期都开出，断档就是遗漏。竖向滚动看全部 80 个号，
            横向滚动看更早的期次。点住圆点可看到具体期号。
          </Note>
        </Card>
      )}

      {lottery === 'ssq' && (
        <>
          <Card title="红球走势连线（1 – 33）" tag={`近 ${trendN} 期`}>
            <NumberTrend
              rows={Array.from({ length: 33 }, (_, i) => i + 1)}
              points={ssqRedPoints}
              colorFor={() => RANGE_COLOR.red}
              formatRow={(num) => String(num).padStart(2, '0')}
            />
            <Note>红球 6 个号码的逐期连线。连号、重号、斜连在图上会表现为相邻行的连续点。</Note>
          </Card>
          <Card title="蓝球走势连线（1 – 16）" tag={`近 ${trendN} 期`}>
            <NumberTrend
              rows={Array.from({ length: 16 }, (_, i) => i + 1)}
              points={ssqBluePoints}
              colorFor={() => RANGE_COLOR.blue}
              formatRow={(num) => String(num).padStart(2, '0')}
            />
            <Note>蓝球只有 1 个号，单行上前后的连线反映的是相邻两期是否连号。</Note>
          </Card>
        </>
      )}

      {isDigit && (
        <Card title={`号码走势连线（${positions.join(' / ')}）`} tag={`近 ${trendN} 期`}>
          <div className="toolbar" style={{ marginBottom: 10 }}>
            {positions.map((label, i) => (
              <button key={label} className={`tab-btn ${pos === i ? 'active' : ''}`} onClick={() => setPos(i)}>
                {label}
              </button>
            ))}
            <span className="toolbar-note">换位置只需切换按钮，行 = 数字 0–9，列 = 期次</span>
          </div>
          <NumberTrend
            rows={Array.from({ length: 10 }, (_, i) => i)}
            points={digitPoints}
            colorFor={() => RANGE_COLOR.red}
          />
          <Note>
            每个位置单独成图：同一个数字在该位置出现即画点，相邻两期连续出现会连成横线，中间断档就是遗漏。
            「斜连」在图上表现为逐期上下移动的连续点，但斜连同样是随机噪声，不构成下期依据。
          </Note>
        </Card>
      )}

      <Note tone="warn">
        技术指标（MA / 布林带 / MACD / KDJ）都是对同一条和值、跨度或号码遗漏序列做的平滑与偏离计算，
        <b>不产生任何关于下一期的新信息，也不会提高命中率</b>。图上「突破上轨」「金叉」「超买超卖」之类的形态，
        在独立随机序列里同样会随机出现。此页仅用于把历史数据看得更直观。
      </Note>
    </div>
  )
}
