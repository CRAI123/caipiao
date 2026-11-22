// 随机性检验 —— 用标准假设检验量化「历史开奖里是否存在可利用的序列依赖」
//
// 理论依据：茆诗松《概率论与数理统计教程》假设检验一章
//   · 拟合优度卡方检验：H0 为观测频数服从某理论分布
//   · 游程检验（Wald–Wolfowitz）：H0 为序列中两类事件的出现顺序相互独立
//   · 自相关 / Ljung–Box：H0 为滞后各期自相关系数同时为 0
//   · 间隙检验：H0 为某号码相邻两次出现的间隔服从几何分布（出现相互独立）
//
// 为什么要做这件事：
// 很多彩票「技巧」（杀号、冷热、和值预测）都隐含同一个前提——历史开奖存在可被利用的规律。
// 用卡方、游程、自相关等标准检验去量化这个前提，是诚实且有价值的：
// 如果检验显示没有偏离随机，就说明这些技巧缺乏统计基础。
//
// 措辞纪律：p 值大只能说「没有证据表明偏离随机」，绝不能说「证明了随机」。
// 同理，p 值小也不等于「找到了规律」——它可能是样本量、数据缺失或多重比较造成的。
//
// 本模块全部为纯函数，不依赖 React、不读写 DOM。

/** Lanczos 近似的 ln Γ(x)，Numerical Recipes 版本，x > 0 */
function gammln(x) {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** 不完全伽马函数 P(a,x) 的级数展开（x < a+1 时使用），返回下尾概率 */
function gser(a, x) {
  const ITMAX = 1000
  const EPS = 3.0e-14
  let ap = a
  let sum = 1 / a
  let del = sum
  let n = 0
  for (n = 1; n <= ITMAX; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * EPS) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammln(a))
}

/** 不完全伽马函数 Q(a,x) 的连分式（x >= a+1 时使用），返回上尾概率 */
function gcf(a, x) {
  const ITMAX = 1000
  const EPS = 3.0e-14
  const FPMIN = 1e-300
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return Math.exp(-x + a * Math.log(x) - gammln(a)) * h
}

/**
 * 卡方分布上尾概率 P(χ²_df > stat)。
 * 关系：Q(a=df/2, x=stat/2)；自己实现 gser/gcf，避免引入外部依赖。
 * 精度要求：df=9、stat=16.92 时约 0.05（±0.002）。
 */
export function chiSquarePValue(stat, df) {
  if (!Number.isFinite(df) || df <= 0) return NaN
  if (stat === Infinity) return 0
  if (!Number.isFinite(stat) || stat <= 0) return 1
  const a = df / 2
  const x = stat / 2
  // x < a+1 用级数求 P，再用 1-P 得上尾；否则直接用连分式求 Q
  return x < a + 1 ? 1 - gser(a, x) : gcf(a, x)
}

/**
 * 卡方拟合优度检验：观测频数 counts 与理论概率 expectedProb 比较。
 * @param {number[]} counts 各分类的实际观测次数
 * @param {number[]|number} [expectedProb] 各分类的理论概率；缺省为均匀分布
 * @returns {{stat:number, df:number, p:number, total:number}}
 */
export function chiSquareUniform(counts, expectedProb) {
  const k = counts.length
  if (!k) return { stat: 0, df: 0, p: 1, total: 0 }
  const obs = counts.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = obs.reduce((s, v) => s + v, 0)
  if (total <= 0) return { stat: 0, df: k - 1, p: 1, total: 0 }

  let probs
  if (Array.isArray(expectedProb) && expectedProb.length === k) probs = expectedProb.slice()
  else if (typeof expectedProb === 'number') probs = Array(k).fill(expectedProb)
  else probs = Array(k).fill(1 / k)

  // 概率归一化，避免调用方传入的概率和不为 1
  const sumP = probs.reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0)
  if (sumP <= 0) probs = Array(k).fill(1 / k)
  else probs = probs.map((v) => (Number.isFinite(v) && v > 0 ? v / sumP : 0))

  let stat = 0
  for (let i = 0; i < k; i++) {
    const e = total * probs[i]
    if (e > 0) stat += ((obs[i] - e) * (obs[i] - e)) / e
  }
  const df = k - 1
  return { stat, df, p: chiSquarePValue(stat, df), total }
}

/**
 * 游程检验（Wald–Wolfowitz）。
 * 把序列按 binaryFn 映射为两类，统计连续同类的段数（游程数）。
 * 游程过少说明过度成串，过多说明过度交替。
 * @param {number[]} series
 * @param {{binaryFn?: (v:any)=>boolean}} [opts]
 * @returns {{runs:number, expected:number, z:number, p:number, n1:number, n2:number}|null}
 */
export function runsTest(series, { binaryFn } = {}) {
  if (!Array.isArray(series) || series.length < 2) return null
  const bits = series.map((v) => (binaryFn ? Boolean(binaryFn(v)) : Boolean(v)))
  const n = bits.length
  let n1 = 0
  for (const b of bits) if (b) n1++
  const n2 = n - n1
  if (n1 === 0 || n2 === 0) return null

  let runs = 1
  for (let i = 1; i < n; i++) if (bits[i] !== bits[i - 1]) runs++

  const expected = 1 + (2 * n1 * n2) / n
  const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1))
  if (!(variance > 0)) return null

  // 连续性校正：游程数比期望多/少时各向中心收缩 0.5
  let z = 0
  if (runs > expected) z = (runs - expected - 0.5) / Math.sqrt(variance)
  else if (runs < expected) z = (runs - expected + 0.5) / Math.sqrt(variance)

  // 双侧 p：z² 服从 df=1 的卡方，正好是 2 * (1 - Φ(|z|))
  return { runs, expected, z, p: chiSquarePValue(z * z, 1), n1, n2 }
}

/** 滞后 lag 期的样本自相关系数（Pearson 形式） */
export function autocorrelation(series, lag) {
  const arr = Array.isArray(series) ? series.filter((v) => Number.isFinite(v)) : []
  const n = arr.length
  if (lag <= 0 || n <= lag + 1) return NaN
  const mean = arr.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const d = arr[i] - mean
    den += d * d
    if (i + lag < n) num += d * (arr[i + lag] - mean)
  }
  if (!(den > 0)) return NaN
  return num / den
}

/**
 * Ljung–Box 联合检验：Q = n(n+2) Σ r_k²/(n-k)，H0 为前 maxLag 期自相关全为 0。
 * @returns {{stats: {lag:number, acf:number, p:number}[], qStat:number, df:number, p:number}|null}
 */
export function ljungBox(series, maxLag = 5) {
  const arr = Array.isArray(series) ? series.filter((v) => Number.isFinite(v)) : []
  const n = arr.length
  if (n <= maxLag + 2 || maxLag < 1) return null

  const stats = []
  let acc = 0
  for (let lag = 1; lag <= maxLag; lag++) {
    const acf = autocorrelation(arr, lag)
    if (!Number.isFinite(acf)) return null
    acc += (acf * acf) / (n - lag)
    // 单期也按 Ljung–Box 形式给出 p（df=1）
    const qk = (n * (n + 2) * acf * acf) / (n - lag)
    stats.push({ lag, acf, p: chiSquarePValue(qk, 1) })
  }
  const qStat = n * (n + 2) * acc
  return { stats, qStat, df: maxLag, p: chiSquarePValue(qStat, maxLag) }
}

/** ln C(n,k)，用 lnΓ 计算，避免大组合数溢出 */
function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity
  return gammln(n + 1) - gammln(k + 1) - gammln(n - k + 1)
}

/**
 * 把观测频数与理论概率做卡方拟合，尾部期望频数 <5 的分类自动合并（相邻尾部）。
 * 返回 { stat, df, p, bins }，df = 合并后的分类数 − 1。
 */
function chiSquareBins(observed, probs, total) {
  let bins = probs.map((p, i) => ({ o: observed[i] || 0, p: Math.max(p, 0) }))
  // 尾部合并：卡方近似要求每格期望频数不小于 5
  while (bins.length > 2 && bins[bins.length - 1].p * total < 5) {
    const last = bins.pop()
    bins[bins.length - 1].o += last.o
    bins[bins.length - 1].p += last.p
  }
  // 头部偶尔也会过小（重号 0 一般不会，这里仍做保护）
  while (bins.length > 2 && bins[0].p * total < 5) {
    const first = bins.shift()
    bins[0].o += first.o
    bins[0].p += first.p
  }
  let stat = 0
  for (const b of bins) {
    const e = b.p * total
    if (e > 0) stat += ((b.o - e) * (b.o - e)) / e
  }
  const df = bins.length - 1
  return { stat, df, p: chiSquarePValue(stat, df), bins }
}

/** 从一期数据里取出号码数组：大乐透用前区，数字彩用 num，快乐8用 nums */
function numbersOf(draw) {
  if (!draw) return null
  if (Array.isArray(draw.front)) return draw.front
  if (Array.isArray(draw.num)) return draw.num
  if (Array.isArray(draw.nums)) return draw.nums
  return null
}

/**
 * 相邻两期号码重合个数分布检验。
 * mode='set'：重合 = 两期号码集合的交集大小，理论分布为超几何分布
 *            （双色球 33 选 6 红、快乐8 80 选 20）。
 * mode='position'：重合 = 相同位置上号码相同的位数，理论分布为二项分布
 *            B(位数, 1/10)（数字彩按位独立）。
 * @param {object[]} draws
 * @param {{maxNum?:number, pick?:number, mode?:'set'|'position'}} [opts]
 */
export function pairTest(draws, { maxNum = 10, pick, mode } = {}) {
  // 既接受开奖对象（双色球 red / 数字彩 num / 快乐8 nums），也接受直接的号码数组
  const list = (draws || [])
    .map((d) => (Array.isArray(d) ? d : numbersOf(d)))
    .filter((a) => Array.isArray(a) && a.length > 0)
  if (list.length < 20) return null
  const useSet = mode ? mode === 'set' : pick != null

  if (useSet) {
    const k = Math.max(1, Math.min(maxNum, pick || Math.round(list[0].length)))
    const N = maxNum
    const sample = k
    const overlaps = []
    for (let i = 1; i < list.length; i++) {
      const prev = new Set(list[i - 1])
      overlaps.push(new Set(list[i].filter((x) => prev.has(x))).size)
    }
    const maxK = Math.min(k, sample)
    const obs = Array(maxK + 1).fill(0)
    for (const o of overlaps) if (o >= 0 && o <= maxK) obs[o]++

    // 超几何分布 P(X=x) = C(K,x) C(N-K,n-x) / C(N,n)
    const probs = []
    for (let x = 0; x <= maxK; x++) {
      const lp = logChoose(k, x) + logChoose(N - k, sample - x) - logChoose(N, sample)
      probs.push(Math.exp(lp))
    }
    const sum = probs.reduce((s, v) => s + v, 0) || 1
    const norm = probs.map((v) => v / sum)
    const r = chiSquareBins(obs, norm, overlaps.length)
    return { ...r, mode: 'set', n: overlaps.length }
  }

  // 按位重合：每一位独立均匀 → 重合格数 ~ B(位数, 1/10)
  const trials = Math.max(1, pick || Math.min(...list.map((a) => a.length)))
  const p = 1 / maxNum
  const overlaps = []
  for (let i = 1; i < list.length; i++) {
    const cur = list[i]
    const prev = list[i - 1]
    const len = Math.min(cur.length, prev.length)
    let hit = 0
    for (let j = 0; j < len; j++) if (cur[j] === prev[j]) hit++
    overlaps.push(hit)
  }
  const obs = Array(trials + 1).fill(0)
  for (const o of overlaps) if (o >= 0 && o <= trials) obs[o]++
  const probs = []
  for (let x = 0; x <= trials; x++) {
    const lp = logChoose(trials, x) + x * Math.log(p) + (trials - x) * Math.log(1 - p)
    probs.push(Math.exp(lp))
  }
  const r = chiSquareBins(obs, probs, overlaps.length)
  return { ...r, mode: 'position', n: overlaps.length }
}

/**
 * 间隙检验：某号码相邻两次出现之间隔了多少期，与几何分布期望 1/p 比较。
 * values 可以是「每期一个号码」的数组，也可以是「每期一组号码」的数组。
 * @param {(number|number[])[]} values
 * @param {{k?:number, maxNum?:number, pAppear?:number}} [opts]
 *   k       只检验某个号码（缺省则合并所有出现过的号码）
 *   maxNum  号码取值个数（数字彩 10、双色球红 33、快乐8 80），用于缺省 p
 *   pAppear 某号码在单期内出现的概率；缺省按数组平均长度/取值个数推断
 * @returns {{gaps:number, meanGap:number, expectedGap:number, z:number,
 *            stat:number, df:number, p:number, pAppear:number}|null}
 */
export function gapTest(values, { k, maxNum = 10, pAppear } = {}) {
  const list = (values || []).filter((v) => Array.isArray(v) || Number.isFinite(v))
  const n = list.length
  if (n < 20) return null
  const isSet = Array.isArray(list[0])

  let candidates
  if (k != null) candidates = [k]
  else if (isSet) {
    const seen = new Set()
    for (const v of list) for (const x of v) if (Number.isFinite(x)) seen.add(x)
    candidates = [...seen].sort((a, b) => a - b)
  } else {
    candidates = [...new Set(list.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b)
  }
  if (!candidates.length) return null

  let p = pAppear
  if (!(p > 0 && p < 1)) {
    if (isSet) {
      const avgSize = list.reduce((s, v) => s + v.length, 0) / n
      p = avgSize / maxNum
    } else {
      p = 1 / maxNum
    }
  }
  if (!(p > 0 && p < 1)) return null

  const gaps = []
  for (const num of candidates) {
    let prev = -1
    for (let i = 0; i < n; i++) {
      const v = list[i]
      const has = Array.isArray(v) ? v.includes(num) : v === num
      if (has) {
        if (prev >= 0) gaps.push(i - prev)
        prev = i
      }
    }
  }
  if (gaps.length < 10) return null

  const meanGap = gaps.reduce((s, v) => s + v, 0) / gaps.length
  const expectedGap = 1 / p
  // 几何分布方差 (1-p)/p²；合并多个号码的间距后按近似正态处理
  const se = Math.sqrt((1 - p) / (p * p) / gaps.length)
  const z = (meanGap - expectedGap) / se
  return {
    gaps: gaps.length,
    meanGap,
    expectedGap,
    z,
    stat: z * z,
    df: 1,
    p: chiSquarePValue(z * z, 1),
    pAppear: p,
  }
}

/** 按 p 值给出结论：p>0.05 未见异常；0.01<p≤0.05 轻度偏离；p≤0.01 显著偏离 */
function verdictOf(p) {
  if (!Number.isFinite(p)) return 'warn'
  if (p > 0.05) return 'pass'
  if (p > 0.01) return 'warn'
  return 'fail'
}

function mk(id, name, stat, df, p, note) {
  return { id, name, stat, df, p, verdict: verdictOf(p), note }
}

const POS_LABELS = ['第1位', '第2位', '第3位', '第4位', '第5位']
const POS_LABELS_3 = ['百位', '十位', '个位']

function positionLabel(i, digitCount) {
  return digitCount === 3 ? POS_LABELS_3[i] : POS_LABELS[i] || `第${i + 1}位`
}

/** 中位数：游程检验用它把序列分成大致相等的两段，避免全部落在同侧导致退化 */
function medianOf(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 大乐透：前区 1–35 频次 + 后区 1–12 频次 + 和值序列 + 重号 + 间隙 */
function dltTests(draws) {
  const out = []
  const fronts = draws.map((d) => (Array.isArray(d?.front) ? d.front : null)).filter(Boolean)
  const n = fronts.length
  if (n < 20) return out

  // 前区频次：每期 5 个不重复号码，期望频数 = n * 5 / 35
  if (n >= 35) {
    const counts = Array(35).fill(0)
    for (const r of fronts) for (const x of r) if (x >= 1 && x <= 35) counts[x - 1]++
    if (counts.some((v) => v > 0)) {
      const t = chiSquareUniform(counts)
      out.push(
        mk(
          'dlt-front-freq',
          '前区号码频次 · 卡方拟合',
          t.stat,
          t.df,
          t.p,
          '35 个前区号各自的出现次数与均匀分布比较；df = 35 − 1',
        ),
      )
    }
  }

  // 后区频次：每期开 2 个，期望频数 = n * 2 / 12
  const backs = draws.map((d) => (Array.isArray(d?.back) ? d.back : null)).filter(Boolean)
  if (n >= 30 && backs.length) {
    const counts = Array(12).fill(0)
    for (const b of backs) for (const x of b) if (x >= 1 && x <= 12) counts[x - 1]++
    if (counts.some((v) => v > 0)) {
      const t = chiSquareUniform(counts)
      out.push(
        mk(
          'dlt-back-freq',
          '后区号码频次 · 卡方拟合',
          t.stat,
          t.df,
          t.p,
          '12 个后区号各自的出现次数与均匀分布比较；df = 12 − 1',
        ),
      )
    }
  }

  const sums = fronts.map((r) => r.reduce((s, x) => s + x, 0))
  const sumMedian = medianOf(sums)
  const run = runsTest(sums, { binaryFn: (v) => v >= sumMedian })
  if (run) {
    out.push(
      mk(
        'dlt-front-sum-runs',
        '前区和值 · 游程检验',
        run.stat ?? run.z * run.z,
        1,
        run.p,
        `以和值中位数 ${sumMedian} 分界；游程数 ${run.runs}，期望 ${run.expected.toFixed(1)}，z = ${run.z.toFixed(2)}`,
      ),
    )
  }

  const lb = ljungBox(sums, 5)
  if (lb) {
    out.push(
      mk(
        'dlt-front-sum-lb',
        '前区和值 · 自相关（Ljung–Box）',
        lb.qStat,
        lb.df,
        lb.p,
        `滞后 1–5 期自相关联合为 0 的检验；滞后 1 期 r = ${lb.stats[0].acf.toFixed(3)}，df = 5`,
      ),
    )
  }

  const pair = pairTest(draws, { maxNum: 35, pick: 5, mode: 'set' })
  if (pair) {
    out.push(
      mk(
        'dlt-pair',
        '相邻两期前区重号个数',
        pair.stat,
        pair.df,
        pair.p,
        `重合个数分布 vs 超几何分布（35 选 5 × 2 期）；尾部小期望格已合并，df = ${pair.df}`,
      ),
    )
  }

  const gap = gapTest(fronts, { maxNum: 35, pAppear: 5 / 35 })
  if (gap) {
    out.push(
      mk(
        'dlt-front-gap',
        '前区号码出现间隙',
        gap.stat,
        gap.df,
        gap.p,
        `平均间隔 ${gap.meanGap.toFixed(2)} 期，几何期望 ${gap.expectedGap.toFixed(2)} 期；z = ${gap.z.toFixed(2)}`,
      ),
    )
  }

  const backSums = backs.map((b) => b.reduce((s, x) => s + x, 0))
  const backRun = runsTest(backSums, { binaryFn: (v) => v >= medianOf(backSums) })
  if (backRun) {
    out.push(
      mk(
        'dlt-back-sum-runs',
        '后区和值 · 游程检验',
        backRun.stat ?? backRun.z * backRun.z,
        1,
        backRun.p,
        `后区两号之和的游程数 ${backRun.runs}，期望 ${backRun.expected.toFixed(1)}，z = ${backRun.z.toFixed(2)}`,
      ),
    )
  }

  return out
}

/** 数字彩（3D / 排三 / 排五）：每位 0–9 分开做频次卡方，再检验整期序列 */
function digitTests(draws, game) {
  const out = []
  const nums = draws.map((d) => (Array.isArray(d?.num) ? d.num : null)).filter(Boolean)
  const n = nums.length
  if (n < 20) return out
  const digitCount = game === 'pl5' ? 5 : nums[0]?.length || 3

  // 每位号码频次：10 个取值，期望频数 n/10，要求 ≥5
  if (n >= 50) {
    for (let pos = 0; pos < digitCount; pos++) {
      const counts = Array(10).fill(0)
      for (const arr of nums) {
        const x = arr[pos]
        if (x >= 0 && x <= 9) counts[x]++
      }
      if (!counts.some((v) => v > 0)) continue
      const t = chiSquareUniform(counts)
      out.push(
        mk(
          `digit-pos-${pos}`,
          `${positionLabel(pos, digitCount)}号码频次 · 卡方拟合`,
          t.stat,
          t.df,
          t.p,
          '0–9 的出现次数与均匀分布比较；df = 10 − 1',
        ),
      )
    }
  }

  const sums = nums.map((arr) => arr.reduce((s, x) => s + x, 0))
  const sumMedian = medianOf(sums)

  const run = runsTest(sums, { binaryFn: (v) => v >= sumMedian })
  if (run) {
    out.push(
      mk(
        'digit-sum-runs',
        '和值 · 游程检验',
        run.stat ?? run.z * run.z,
        1,
        run.p,
        `以和值中位数 ${sumMedian} 分界；游程数 ${run.runs}，期望 ${run.expected.toFixed(1)}，z = ${run.z.toFixed(2)}`,
      ),
    )
  }

  const lb = ljungBox(sums, 5)
  if (lb) {
    out.push(
      mk(
        'digit-sum-lb',
        '和值 · 自相关（Ljung–Box）',
        lb.qStat,
        lb.df,
        lb.p,
        `滞后 1–5 期自相关联合为 0 的检验；滞后 1 期 r = ${lb.stats[0].acf.toFixed(3)}，df = 5`,
      ),
    )
  }

  // 相邻两期同位置重号个数（二项分布 B(位数, 1/10)）
  const pair = pairTest(nums, { maxNum: 10, mode: 'position' })
  if (pair) {
    out.push(
      mk(
        'digit-pair',
        '相邻两期同位重号个数',
        pair.stat,
        pair.df,
        pair.p,
        `同一位上数字相同的个数 vs 二项分布 B(${digitCount}, 1/10)；尾部小期望格已合并，df = ${pair.df}`,
      ),
    )
  }

  // 号码出现间隙：任一位置出现该数字的概率 = 1 − (9/10)^位数
  const pAppear = 1 - Math.pow(0.9, digitCount)
  const gap = gapTest(nums, { maxNum: 10, pAppear })
  if (gap) {
    out.push(
      mk(
        'digit-gap',
        '号码出现间隙',
        gap.stat,
        gap.df,
        gap.p,
        `任一位置出现的平均间隔 ${gap.meanGap.toFixed(2)} 期，几何期望 ${gap.expectedGap.toFixed(2)} 期；z = ${gap.z.toFixed(2)}`,
      ),
    )
  }

  return out
}

/** 快乐8：1–80 频次卡方（每期开 20 个）+ 和值序列检验 + 重号 + 间隙 */
function kl8Tests(draws) {
  const out = []
  const nums = draws.map((d) => (Array.isArray(d?.nums) ? d.nums : null)).filter(Boolean)
  const n = nums.length
  if (n < 20) return out

  // 频次：每期 20 个不重复号码，期望频数 = n * 20 / 80 = n / 4
  if (n >= 20) {
    const counts = Array(80).fill(0)
    for (const arr of nums) for (const x of arr) if (x >= 1 && x <= 80) counts[x - 1]++
    if (counts.some((v) => v > 0)) {
      const t = chiSquareUniform(counts)
      out.push(
        mk(
          'kl8-freq',
          '1–80 号码频次 · 卡方拟合',
          t.stat,
          t.df,
          t.p,
          '80 个号码各自的出现次数与均匀分布比较；df = 80 − 1',
        ),
      )
    }
  }

  const sums = nums.map((arr) => arr.reduce((s, x) => s + x, 0))
  // 以样本中位数分界，避免理论均值在异常序列上退化
  const sumMedian = medianOf(sums)
  const run = runsTest(sums, { binaryFn: (v) => v >= sumMedian })
  if (run) {
    out.push(
      mk(
        'kl8-sum-runs',
        '和值 · 游程检验',
        run.stat ?? run.z * run.z,
        1,
        run.p,
        `以和值中位数 ${sumMedian} 分界；游程数 ${run.runs}，期望 ${run.expected.toFixed(1)}，z = ${run.z.toFixed(2)}`,
      ),
    )
  }

  const lb = ljungBox(sums, 5)
  if (lb) {
    out.push(
      mk(
        'kl8-sum-lb',
        '和值 · 自相关（Ljung–Box）',
        lb.qStat,
        lb.df,
        lb.p,
        `滞后 1–5 期自相关联合为 0 的检验；滞后 1 期 r = ${lb.stats[0].acf.toFixed(3)}，df = 5`,
      ),
    )
  }

  const pair = pairTest(nums, { maxNum: 80, pick: 20, mode: 'set' })
  if (pair) {
    out.push(
      mk(
        'kl8-pair',
        '相邻两期重号个数',
        pair.stat,
        pair.df,
        pair.p,
        `重合个数分布 vs 超几何分布（80 选 20 × 2 期）；尾部小期望格已合并，df = ${pair.df}`,
      ),
    )
  }

  const gap = gapTest(nums, { maxNum: 80, pAppear: 20 / 80 })
  if (gap) {
    out.push(
      mk(
        'kl8-gap',
        '号码出现间隙',
        gap.stat,
        gap.df,
        gap.p,
        `平均间隔 ${gap.meanGap.toFixed(2)} 期，几何期望 ${gap.expectedGap.toFixed(2)} 期；z = ${gap.z.toFixed(2)}`,
      ),
    )
  }

  return out
}

/**
 * 按彩种组织全部随机性检验。
 * 数据不足时（<20 期）返回空数组；单项检验也会按期望频数要求自动跳过，
 * 因此期数 <60 时结果会偏少，属于「检验效力有限」而非「没有偏离」。
 *
 * @param {object[]} draws 最新在前的开奖列表
 * @param {{game?: 'dlt'|'fc3d'|'pl3'|'pl5'|'kl8', maxNum?: number}} opts
 * @returns {{id:string, name:string, stat:number, df:number, p:number,
 *            verdict:'pass'|'warn'|'fail', note:string}[]}
 */
export function runAllTests(draws, { game = 'fc3d', maxNum } = {}) {
  const list = Array.isArray(draws) ? draws.filter(Boolean) : []
  if (list.length < 20) return []
  try {
    if (game === 'dlt') return dltTests(list)
    if (game === 'kl8') return kl8Tests(list)
    if (game === 'fc3d' || game === 'pl3' || game === 'pl5') return digitTests(list, game)
    return []
  } catch (err) {
    // 数据缺字段时不让整页崩掉，只返回已完成的检验
    console.error('随机性检验计算失败：', err)
    return []
  }
}
