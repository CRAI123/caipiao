// ============================================================
// K 线 / 技术指标计算（纯函数，无第三方库）
//
// ⚠️ 彩票开奖没有真正的 OHLC。这里的 K 线是**合成**的：
//    收 = 本期指标值（和值 / 跨度 / 蓝球）
//    开 = 上期指标值
//    影线 = 本期跨度 × wickRatio，即用本期开奖号内部的离散度当作振幅
//    MA / BOLL / MACD 都只是同一条序列的平滑与偏离，不产生新信息，
//    也不能提高任何一期的中奖概率。
// ============================================================

export function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function stdev(values) {
  if (values.length < 2) return 0
  const m = mean(values)
  const v = values.reduce((a, x) => a + (x - m) ** 2, 0) / values.length
  return Math.sqrt(v)
}

export function round1(v) {
  return Math.round(v * 10) / 10
}

/** 简单移动平均，前 n-1 个位置返回 null */
export function movingAverage(values, n) {
  const out = Array(values.length).fill(null)
  let acc = 0
  for (let i = 0; i < values.length; i++) {
    acc += values[i]
    if (i >= n) acc -= values[i - n]
    if (i >= n - 1) out[i] = acc / n
  }
  return out
}

/** 指数移动平均（从首值起算，序列短时偏差大，仅作趋势参考） */
export function ema(values, n) {
  if (!values.length) return []
  const k = 2 / (n + 1)
  let prev = values[0]
  return values.map((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k)
    return prev
  })
}

/** 布林带：中轨 = MA(n)，上下轨 = 中轨 ± k × 标准差 */
export function boll(values, n = 20, k = 2) {
  const mid = movingAverage(values, n)
  return values.map((_, i) => {
    if (mid[i] == null) return { mid: null, upper: null, lower: null, std: null }
    let acc = 0
    for (let j = i - n + 1; j <= i; j++) acc += (values[j] - mid[i]) ** 2
    const std = Math.sqrt(acc / n)
    return { mid: mid[i], upper: mid[i] + k * std, lower: mid[i] - k * std, std }
  })
}

/**
 * KDJ：RSV = (C − LLV(n)) / (HHV(n) − LLV(n)) × 100
 *      K = ((kSmooth−1)K′ + RSV) / kSmooth，D 同法平滑 K，J = 3K − 2D
 * 口径与行情软件一致（默认 9,3,3），K/D/J 初值取 50。
 */
export function kdj(values, n = 9, kSmooth = 3, dSmooth = 3) {
  const k = []
  const d = []
  const j = []
  let prevK = 50
  let prevD = 50
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - n + 1)
    let hi = -Infinity
    let lo = Infinity
    for (let t = from; t <= i; t++) {
      hi = Math.max(hi, values[t])
      lo = Math.min(lo, values[t])
    }
    const rsv = hi === lo ? 50 : ((values[i] - lo) / (hi - lo)) * 100
    const kk = ((kSmooth - 1) * prevK + rsv) / kSmooth
    const dd = ((dSmooth - 1) * prevD + kk) / dSmooth
    k.push(kk)
    d.push(dd)
    j.push(3 * kk - 2 * dd)
    prevK = kk
    prevD = dd
  }
  return { k, d, j }
}

/**
 * 遗漏序列（按时间正序输出）：draws 最新在前。
 * 每项 { id, date, omission, hit }，omission 为该期开出前的遗漏期数，开出当期记 0。
 */
export function omissionSeries(draws, isHit, n = 60) {
  const chrono = draws.slice(0, Math.min(n, draws.length)).reverse()
  let omit = 0
  return chrono.map((d) => {
    const hit = !!isHit(d)
    const row = { id: d.id ?? d.drawId, date: d.date, omission: hit ? 0 : omit, hit }
    omit = hit ? 1 : omit + 1
    return row
  })
}

/** 某个号码的指标读数（K/D/J、DIF/DEA/柱、通道位置），口径同行情软件 */
export function omissionReading(rows) {
  if (!rows || rows.length < 2) return null
  const values = rows.map((r) => r.omission)
  const i = values.length - 1
  const kd = kdj(values)
  const m = macd(values)
  const band = boll(values, Math.min(20, values.length))
  const K = kd.k[i]
  const D = kd.d[i]
  const J = kd.j[i]
  const pK = kd.k[i - 1]
  const pD = kd.d[i - 1]
  const hist = m.hist[i]
  const pHist = m.hist[i - 1]
  const state = []
  if (K > 80 || J > 80) state.push('KDJ 高位')
  else if (K < 20) state.push('KDJ 低位')
  else state.push('KDJ 中位')
  if (K > D && pK <= pD) state.push('金叉')
  else if (K < D && pK >= pD) state.push('死叉')
  state.push(`MACD ${hist > 0 ? '红柱' : '绿柱'}${Math.abs(hist) < Math.abs(pHist) ? '收敛' : '放大'}`)
  if (band[i].mid != null) state.push(values[i] >= band[i].mid ? '通道上沿' : '通道下沿')
  return {
    omission: rows[i].omission,
    k: round1(K),
    d: round1(D),
    j: round1(J),
    dif: round2(m.dif[i]),
    dea: round2(m.dea[i]),
    hist: round2(hist),
    mid: band[i].mid == null ? null : round1(band[i].mid),
    upper: band[i].upper == null ? null : round1(band[i].upper),
    lower: band[i].lower == null ? null : round1(band[i].lower),
    state: state.join(' · '),
  }
}

/** MACD：DIF = EMA(fast) − EMA(slow)，DEA = EMA(DIF, signal)，柱 = (DIF − DEA) × 2 */
export function macd(values, { fast = 12, slow = 26, signal = 9 } = {}) {
  const f = ema(values, fast)
  const s = ema(values, slow)
  const dif = values.map((_, i) => f[i] - s[i])
  const dea = ema(dif, signal)
  const hist = dif.map((v, i) => (v - dea[i]) * 2)
  return { dif, dea, hist }
}

/**
 * 合成蜡烛。points 需按时间正序（旧 → 新），每项 { id, date, value, span }
 * wickRatio 越大，影线越长（跨度对振幅的折算比例）。
 */
export function buildCandles(points, wickRatio = 0.35) {
  return points.map((p, i) => {
    const open = i === 0 ? p.value : points[i - 1].value
    const close = p.value
    const half = Math.max(0, (p.span || 0) * wickRatio)
    return {
      ...p,
      open,
      close,
      high: Math.max(open, close) + half,
      low: Math.min(open, close) - half,
    }
  })
}

const Z_TABLE = { 0.7: 1.036, 0.75: 1.15, 0.8: 1.282, 0.85: 1.44, 0.9: 1.645 }

/**
 * 用 MA5 + 布林带 + MACD 投影下一期区间：
 *   中枢 = 0.5 × 布林中轨 + 0.5 × MA5，再按 MACD 柱的方向偏移 0.4σ
 *   宽度 = z × σ（z 由覆盖目标决定，80% → 1.282σ）
 * 这是对「历史波动范围」的描述，不是对下一期数值的预测。
 */
export function projectNext(values, { coverRate = 0.8, min = -Infinity, max = Infinity } = {}) {
  const n = values.length
  if (!n) return null
  const z = Z_TABLE[coverRate] || Z_TABLE[0.8]
  const last = n - 1
  const band = boll(values, Math.min(20, n))
  const maArr = movingAverage(values, Math.min(5, n))
  const m = macd(values)
  const mid = band[last].mid ?? mean(values)
  const sigma = band[last].std ?? stdev(values)
  const ma5 = maArr[last] ?? mean(values)
  const hist = m.hist[last] || 0
  // 柱体相对波动强度映射到 [-1, 1]，避免极端值失真
  const trend = sigma > 0 ? Math.max(-1, Math.min(1, hist / (sigma * 0.6))) : 0
  const center = 0.5 * mid + 0.5 * ma5 + trend * 0.4 * sigma
  const half = z * sigma
  const lo = Math.max(min, Math.floor(center - half))
  const hi = Math.min(max, Math.ceil(center + half))
  const close = values[last]
  return {
    center: round1(center),
    sigma: round1(sigma),
    lo: Math.min(lo, hi),
    hi: Math.max(lo, hi),
    trend: round2(trend),
    ma5: round1(ma5),
    mid: round1(mid),
    upper: round1(band[last].upper ?? mid),
    lower: round1(band[last].lower ?? mid),
    dif: round2(m.dif[last] || 0),
    dea: round2(m.dea[last] || 0),
    hist: round2(hist),
    bollState:
      close > (band[last].upper ?? Infinity)
        ? '突破上轨'
        : close < (band[last].lower ?? -Infinity)
          ? '跌破下轨'
          : close >= mid
            ? '中轨上方'
            : '中轨下方',
  }
}

function round2(v) {
  return Math.round(v * 100) / 100
}

/** 计算一张图需要的全部序列 */
export function computeIndicators(values) {
  return {
    ma5: movingAverage(values, 5),
    ma10: movingAverage(values, 10),
    band: boll(values, Math.min(20, values.length || 1)),
    macd: macd(values),
  }
}
