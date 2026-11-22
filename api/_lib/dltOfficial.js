// ============================================================
// 大乐透官方销售 / 中奖注数 → 真实“购买集中度”模型
//
// 背景：官方从不公布投注明细，唯一公开的全量真实信号是
//   一等奖注数 = 该期开奖那 1 注组合（5 前区 + 2 后区）被买了多少注
//   二等奖注数 ≈ 该期 5 个前区 + 1 个后区（共 20 种组合）被买了多少注
// 用二等奖注数除以“按销售额算出的理论注数”，反推每期 5 前区组合被买的倍数；
// 再把 5 个前区展开成 35 个哑变量做对数岭回归，得到每个前区号的购买偏好系数，
// 最后用一等奖残差估计 12 个后区号的偏好。
//
// 重要：这只影响“中奖后分多少钱”（浮动奖分摊），完全不影响开奖概率。
//
// 数据源：500 彩票大乐透历史数据页（GBK 编码）
//   列：期号 前1-5 后1-2 奖池 一等奖注数 一等奖单注 二等奖注数 二等奖单注 总投注额 日期
// ============================================================
import { readConfig, writeConfig } from './neon.js'

const HISTORY_URL = 'https://datachart.500.com/dlt/history/newinc/history.php'
const REFERER = 'https://datachart.500.com/dlt/history/history.shtml'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const COMB = 21425712 // C(35,5) × C(12,2)，大乐透单注组合数
const SECOND_COMBOS = 20 // 二等奖（5+1）的组合数
const RIDGE = 10
const MIN_DRAWS = 150
const MODEL_KEY = 'dlt_crowd_model'

/** 5 位期号 → 应用内 7 位期号（26133 → 2026133） */
export function toDrawId(issue5) {
  const n = Number(issue5)
  return Number.isInteger(n) ? 2000000 + n : null
}

/** 期号 → 5 位期号（2026133 → 26133；本身就是 26133 时保持原样） */
export function toIssue5(drawId) {
  const s = String(drawId)
  return s.length > 5 ? s.slice(2) : s
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
      front: nums.slice(0, 5).sort((a, b) => a - b),
      back: nums.slice(5, 7).sort((a, b) => a - b),
      pool: money(8),
      first: money(9),
      second: money(11),
      sales: money(13),
      date,
    })
  }
  return out
}

/** 抓取历史数据（默认从 2007 年首期开始，单次请求可取全部 2900+ 期） */
export async function fetchHistory({ start = '07001', end = '' } = {}) {
  const url = `${HISTORY_URL}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: REFERER } })
  if (!res.ok) throw new Error(`500历史数据 HTTP ${res.status}`)
  const html = new TextDecoder('gbk').decode(await res.arrayBuffer())
  const rows = parseHistory(html)
  if (!rows.length) throw new Error('500历史数据解析为空')
  return rows
}

/** 批量入库（幂等），随后重拟合模型 */
export async function syncOfficialDlt(sql, range) {
  const rows = await fetchHistory(range)
  const payload = rows.map((r) => ({
    drawId: r.drawId,
    issue5: r.issue5,
    date: r.date,
    front: r.front,
    back: r.back,
    sales: r.sales,
    first: r.first,
    second: r.second,
    pool: r.pool,
  }))
  await sql`
    INSERT INTO dlt_draw_stats (draw_id, issue5, date, front, back, sales, first_prize, second_prize, pool)
    SELECT (x->>'drawId')::int,
           x->>'issue5',
           NULLIF(x->>'date', 'null')::date,
           (x->'front'),
           (x->'back'),
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
 *   log(二等奖注数 / 理论注数) ≈ c + Σ β_i·1[i∈前区]
 * 理论注数 = (销售额/2) × 20 / 组合数
 * 后区偏好 = 一等奖残差的期望
 */
export async function fitCrowdModel(sql) {
  const rows = await sql`
    SELECT draw_id, front, back, sales, first_prize, second_prize
    FROM dlt_draw_stats
    WHERE second_prize >= 8 AND sales IS NOT NULL AND sales > 0
    ORDER BY draw_id`
  if (rows.length < MIN_DRAWS) return null

  const dim = 36 // 0 = 截距，1..35 = 前区
  const A = Array.from({ length: dim }, () => new Float64Array(dim))
  const b = new Float64Array(dim)
  const frontCount = new Float64Array(35)
  const backCount = new Float64Array(12)

  for (const r of rows) {
    const front = Array.isArray(r.front) ? r.front : JSON.parse(r.front || '[]')
    const sales = Number(r.sales)
    const second = Number(r.second_prize)
    const back = Array.isArray(r.back) ? r.back : JSON.parse(r.back || '[]')
    if (!(sales > 0) || !(second > 0) || !back.length) continue
    const expected = ((sales / 2) * SECOND_COMBOS) / COMB
    const w = Math.sqrt(Math.max(expected, 1))
    const y = Math.max(-2.5, Math.min(2.5, Math.log(second / expected)))
    const x = new Float64Array(dim)
    x[0] = w
    for (const num of front) {
      if (num >= 1 && num <= 35) {
        x[num] = w
        frontCount[num - 1] += 1
      }
    }
    for (const num of back) if (num >= 1 && num <= 12) backCount[num - 1] += 1
    for (let i = 0; i < dim; i++) {
      if (!x[i]) continue
      b[i] += x[i] * y
      for (let j = 0; j < dim; j++) A[i][j] += x[i] * x[j]
    }
  }

  for (let i = 1; i < dim; i++) A[i][i] += RIDGE
  A[0][0] += 1e-6
  const beta = solveLinear(A, b)

  const meanBeta = beta.slice(1).reduce((s, v) => s + v, 0) / 35
  const frontMult = Array.from({ length: 35 }, (_, i) => Math.exp(beta[i + 1] - meanBeta))

  // 后区：一等奖残差（5 前区偏好已扣除）按后区号求均值
  const backSum = new Float64Array(12)
  const backN = new Float64Array(12)
  for (const r of rows) {
    const first = Number(r.first_prize)
    if (!(first >= 3)) continue
    const front = Array.isArray(r.front) ? r.front : JSON.parse(r.front || '[]')
    const back = Array.isArray(r.back) ? r.back : JSON.parse(r.back || '[]')
    const sales = Number(r.sales)
    if (!(sales > 0) || !back.length) continue
    const expected = sales / 2 / COMB
    const base = beta[0] + front.reduce((s, num) => s + (beta[num] || 0), 0)
    const residual = Math.log(first / expected) - base
    for (const num of back) {
      if (num >= 1 && num <= 12) {
        backSum[num - 1] += residual
        backN[num - 1] += 1
      }
    }
  }
  const backLog = Array.from({ length: 12 }, (_, i) => (backN[i] >= 20 ? backSum[i] / backN[i] : 0))
  const meanBack = backLog.reduce((s, v) => s + v, 0) / 12
  const backMult = backLog.map((v) => Math.exp(v - meanBack))

  // 自查：购买偏好 vs 历史开出频率，理应接近 0（开奖与销量无关）
  const n = rows.length
  const frontR = pearson(
    Array.from(frontCount, (c) => c / n),
    Array.from({ length: 35 }, (_, i) => beta[i + 1] - meanBeta),
  )
  const backR = pearson(
    Array.from(backCount, (c) => c / n),
    backLog.map((v) => v - meanBack),
  )

  const model = {
    at: new Date().toISOString(),
    n,
    from: rows[0].draw_id,
    to: rows[rows.length - 1].draw_id,
    front: frontMult.map((v) => +v.toFixed(3)),
    back: backMult.map((v) => +v.toFixed(3)),
    check: { frontR: +frontR.toFixed(3), backR: +backR.toFixed(3), draws: n },
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
      const e2 = sales > 0 ? ((sales / 2) * SECOND_COMBOS) / COMB : 0
      return {
        drawId: r.draw_id,
        date: r.date,
        front: Array.isArray(r.front) ? r.front : JSON.parse(r.front || '[]'),
        back: Array.isArray(r.back) ? r.back : JSON.parse(r.back || '[]'),
        sales,
        first,
        second,
        ratio1: e1 > 0 && Number.isFinite(first) ? +(first / e1).toFixed(2) : null,
        ratio2: e2 > 0 && Number.isFinite(second) ? +(second / e2).toFixed(2) : null,
      }
    })
    .filter((r) => r.sales > 0)
}
