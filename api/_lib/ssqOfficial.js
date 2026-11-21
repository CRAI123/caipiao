// ============================================================
// 双色球官方销售 / 中奖注数 → 真实“购买集中度”模型
//
// 背景：官方从不公布投注明细，唯一公开的全量真实信号是
//   一等奖注数  = 该期开奖那 1 注组合被买了多少注
//   二等奖注数 ≈ 该期 6 个红球（不管蓝球）被买了多少注
// 用二等奖注数除以“按销售额算出的理论注数”，就能反推每期 6 红组合被买的倍数；
// 再把 6 个红球展开成 33 个哑变量做对数岭回归，得到每个号码的购买偏好系数。
//
// 重要：这只影响“中奖后分多少钱”（浮动奖分摊），完全不影响开奖概率。
//
// 数据源：500 彩票历史数据页（GBK 编码，境外可访问）
//   列：期号 红1-6 蓝 [快乐星期天] 奖池 一等奖注数 一等奖单注 二等奖注数 二等奖单注 总投注额 日期
// ============================================================
import { readConfig, writeConfig } from './neon.js'

const HISTORY_URL = 'https://datachart.500.com/ssq/history/newinc/history.php'
const REFERER = 'https://datachart.500.com/ssq/history/history.shtml'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const COMB = 17721088 // C(33,6) × 16，双色球单注组合数
const RIDGE = 10 // 岭回归正则：抑制 33 个哑变量的共线性
const MIN_DRAWS = 150 // 样本少于此数不拟合（噪声大于信号）
const MODEL_KEY = 'ssq_crowd_model'

/** 5 位期号 → 应用内 7 位期号（26133 → 2026133） */
export function toDrawId(issue5) {
  const n = Number(issue5)
  return Number.isInteger(n) ? 2000000 + n : null
}

/** 7 位期号 → 5 位期号（2026133 → 26133） */
export function toIssue5(drawId) {
  return String(drawId).slice(2)
}

/** 解析 500 历史数据表格（传 GBK 解码后的 HTML） */
export function parseHistory(html) {
  const out = []
  for (const m of html.matchAll(/<tr[^>]*class="t_tr1"[\s\S]*?<\/tr>/g)) {
    const cells = [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) =>
      t[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim(),
    )
    const i = cells.findIndex((c) => /^\d{5}$/.test(c))
    if (i < 0) continue
    const nums = cells.slice(i + 1, i + 8).map(Number)
    if (nums.length !== 7 || !nums.every((n) => Number.isInteger(n) && n > 0)) continue
    const money = (offset) => {
      const n = Number(String(cells[i + offset] ?? '').replace(/,/g, ''))
      return Number.isFinite(n) ? n : null
    }
    const date = cells.slice(i + 9).find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) || null
    const drawId = toDrawId(cells[i])
    if (!drawId) continue
    out.push({
      issue5: cells[i],
      drawId,
      red: nums.slice(0, 6).sort((a, b) => a - b),
      blue: nums[6],
      pool: money(9),
      first: money(10),
      second: money(12),
      sales: money(14),
      date,
    })
  }
  return out
}

/** 抓取历史数据（默认从 2003 年首期开始，单次请求可取全部 3500+ 期） */
export async function fetchHistory({ start = '03001', end = '' } = {}) {
  const url = `${HISTORY_URL}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: REFERER } })
  if (!res.ok) throw new Error(`500历史数据 HTTP ${res.status}`)
  const html = new TextDecoder('gbk').decode(await res.arrayBuffer())
  const rows = parseHistory(html)
  if (!rows.length) throw new Error('500历史数据解析为空')
  return rows
}

/** 批量入库（幂等），随后重拟合模型 */
export async function syncOfficialSsq(sql, range) {
  const rows = await fetchHistory(range)
  const payload = rows.map((r) => ({
    drawId: r.drawId,
    issue5: r.issue5,
    date: r.date,
    red: r.red,
    blue: r.blue,
    sales: r.sales,
    first: r.first,
    second: r.second,
    pool: r.pool,
  }))
  await sql`
    INSERT INTO ssq_draw_stats (draw_id, issue5, date, red, blue, sales, first_prize, second_prize, pool)
    SELECT (x->>'drawId')::int,
           x->>'issue5',
           (x->>'date')::date,
           (x->'red'),
           (x->>'blue')::int,
           (x->>'sales')::bigint,
           (x->>'first')::int,
           (x->>'second')::int,
           (x->>'pool')::bigint
    FROM jsonb_array_elements(${JSON.stringify(payload)}::jsonb) AS x
    ON CONFLICT (draw_id) DO UPDATE SET
      sales = EXCLUDED.sales,
      first_prize = EXCLUDED.first_prize,
      second_prize = EXCLUDED.second_prize,
      pool = EXCLUDED.pool,
      updated_at = now()`
  const model = await fitCrowdModel(sql)
  return { upserted: rows.length, model }
}

/** 读取已保存的模型（早于首次回补时为 null） */
export async function loadCrowdModel(sql) {
  const raw = await readConfig(sql, MODEL_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 高斯消元解线性方程组（部分主元） */
function solveLinear(A, b) {
  const n = b.length
  const M = A.map((row, i) => Float64Array.from([...row, b[i]]))
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) continue
    if (p !== c) {
      const t = M[p]
      M[p] = M[c]
      M[c] = t
    }
    const piv = M[c][c]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv
      if (!f) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k]
    x[i] = Math.abs(M[i][i]) < 1e-12 ? 0 : s / M[i][i]
  }
  return x
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0
}

/**
 * 拟合每号购买偏好：
 *   log(二等奖注数 / 理论注数) ≈ c + Σ β_i·1[i∈红球]
 * 理论注数 = (销售额/2) × 15 / 组合数
 * 蓝球偏好 = 一等奖残差的期望（一等奖 = 6 红 + 指定蓝）
 */
export async function fitCrowdModel(sql) {
  const rows = await sql`
    SELECT draw_id, red, blue, sales, first_prize, second_prize
    FROM ssq_draw_stats
    WHERE second_prize >= 8 AND sales IS NOT NULL AND sales > 0
    ORDER BY draw_id`
  if (rows.length < MIN_DRAWS) return null

  const dim = 34 // 0 = 截距，1..33 = 红球
  const A = Array.from({ length: dim }, () => new Float64Array(dim))
  const b = new Float64Array(dim)
  const redCount = new Float64Array(33)
  const blueCount = new Float64Array(16)

  for (const r of rows) {
    const red = Array.isArray(r.red) ? r.red : JSON.parse(r.red || '[]')
    const sales = Number(r.sales)
    const second = Number(r.second_prize)
    const blue = Number(r.blue)
    if (!(sales > 0) || !(second > 0) || !(blue >= 1 && blue <= 16)) continue
    const expected = ((sales / 2) * 15) / COMB
    // 加权最小二乘：泊松噪声下 Var(log x) ≈ 1/E，故权重取 √E；同时截尾抑制倍投造成的极端值
    const w = Math.sqrt(Math.max(expected, 1))
    const y = Math.max(-2.5, Math.min(2.5, Math.log(second / expected)))
    const x = new Float64Array(dim)
    x[0] = w
    for (const num of red) {
      if (num >= 1 && num <= 33) {
        x[num] = w
        redCount[num - 1] += 1
      }
    }
    blueCount[blue - 1] += 1
    for (let i = 0; i < dim; i++) {
      if (!x[i]) continue
      b[i] += x[i] * y
      for (let j = 0; j < dim; j++) A[i][j] += x[i] * x[j]
    }
  }

  for (let i = 1; i < dim; i++) A[i][i] += RIDGE
  A[0][0] += 1e-6
  const beta = solveLinear(A, b)

  const meanBeta = beta.slice(1).reduce((s, v) => s + v, 0) / 33
  const redMult = Array.from({ length: 33 }, (_, i) => Math.exp(beta[i + 1] - meanBeta))

  // 蓝球：一等奖残差（6 红偏好已扣除）按蓝球求均值
  const blueSum = new Float64Array(16)
  const blueN = new Float64Array(16)
  for (const r of rows) {
    const first = Number(r.first_prize)
    if (!(first >= 3)) continue
    const red = Array.isArray(r.red) ? r.red : JSON.parse(r.red || '[]')
    const sales = Number(r.sales)
    const blue = Number(r.blue)
    if (!(sales > 0) || !(blue >= 1 && blue <= 16)) continue
    const expected = (sales / 2) / COMB
    const base = beta[0] + red.reduce((s, num) => s + (beta[num] || 0), 0)
    blueSum[blue - 1] += Math.log(first / expected) - base
    blueN[blue - 1] += 1
  }
  const blueLog = Array.from({ length: 16 }, (_, i) => (blueN[i] >= 20 ? blueSum[i] / blueN[i] : 0))
  const meanBlue = blueLog.reduce((s, v) => s + v, 0) / 16
  const blueMult = blueLog.map((v) => Math.exp(v - meanBlue))

  // 自查：购买偏好 vs 历史开出频率，理应接近 0（开奖与销量无关）
  const n = rows.length
  const redR = pearson(
    Array.from(redCount, (c) => c / n),
    Array.from({ length: 33 }, (_, i) => beta[i + 1] - meanBeta),
  )
  const blueR = pearson(
    Array.from(blueCount, (c) => c / n),
    blueLog.map((v) => v - meanBlue),
  )

  const model = {
    at: new Date().toISOString(),
    n,
    from: rows[0].draw_id,
    to: rows[rows.length - 1].draw_id,
    red: redMult.map((v) => +v.toFixed(3)),
    blue: blueMult.map((v) => +v.toFixed(3)),
    check: { redR: +redR.toFixed(3), blueR: +blueR.toFixed(3), draws: n },
  }
  await writeConfig(sql, MODEL_KEY, JSON.stringify(model))
  return model
}

/** 最近若干期官方数据 + 实际购买倍数（倍数为 1 即等于平均票） */
export function recentWithRatios(rows) {
  return rows
    .map((r) => {
      const sales = Number(r.sales)
      const first = Number(r.first_prize)
      const second = Number(r.second_prize)
      const e1 = sales > 0 ? sales / 2 / COMB : 0
      const e2 = sales > 0 ? ((sales / 2) * 15) / COMB : 0
      return {
        drawId: r.draw_id,
        date: r.date,
        red: Array.isArray(r.red) ? r.red : JSON.parse(r.red || '[]'),
        blue: Number(r.blue),
        sales,
        first,
        second,
        ratio1: e1 > 0 && Number.isFinite(first) ? +(first / e1).toFixed(2) : null,
        ratio2: e2 > 0 && Number.isFinite(second) ? +(second / e2).toFixed(2) : null,
      }
    })
    .filter((r) => r.sales > 0)
}
