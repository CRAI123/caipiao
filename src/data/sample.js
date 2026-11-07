// ============================================================
// 数据层：真实历史数据（JSON）+ 演示数据 + 用户导入解析
// kl8_history.json 为从中国福彩官网抓取的最近 100 期真实开奖，
// 可在「数据管理」页一键刷新（刷新时整体覆盖，不追加）。
// 快乐8 每天开奖一期，每期开出 20 个号码（1-80）。
// ============================================================
import kl8History from './kl8_history.json'

// mulberry32 —— 可复现的伪随机数生成器
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function genNums(rand) {
  const pool = Array.from({ length: 80 }, (_, i) => i + 1)
  const picked = []
  for (let i = 0; i < 20; i++) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return picked.sort((a, b) => a - b)
}

// 快乐8 每天开奖。从今天往前回溯 N 期构造演示数据。
function buildSampleDraws(count = 150) {
  const rand = mulberry32(20260101)
  const draws = []
  const day = new Date()
  day.setHours(0, 0, 0, 0)
  const yearCounter = {}
  for (let i = 0; i < count; i++) {
    const y = day.getFullYear()
    yearCounter[y] = (yearCounter[y] || 0) + 1
    draws.push({
      id: y * 1000 + (365 - yearCounter[y]),
      date: `${y}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      nums: genNums(rand),
      sample: true,
    })
    day.setDate(day.getDate() - 1)
  }
  return draws
}

export const SAMPLE_DRAWS = buildSampleDraws(150)

export const SAMPLE_NOTE = '内置演示数据（确定性随机生成，非真实开奖）'

// 真实数据（中国福彩官网，最新在前）
export const HISTORY_DRAWS = kl8History
export const HISTORY_NOTE = '最近 100 期真实开奖数据（来源：中国福彩官网）'

/**
 * 解析用户粘贴的历史开奖文本（快乐8，每行一期，20 个号码）。
 * 支持格式（分隔符可为 空格/逗号/制表符/、）：
 *   2026296,2026-11-06,01,02,04,...,73,74
 *   2026296 01 02 04 07 ... 74
 * 返回 { draws, errors }
 */
export function parseDrawText(text) {
  const lines = String(text).split(/\r?\n/)
  const draws = []
  const errors = []
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const tokens = line.split(/[\s,，、;；|]+/).filter(Boolean)
    let id = null
    let date = null
    const nums = []
    for (const t of tokens) {
      if (/^\d{7}$/.test(t) && id === null && nums.length === 0) {
        id = Number(t)
        continue
      }
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(t) && !date) {
        date = t.replace(/\//g, '-')
        continue
      }
      const n = Number(t)
      if (Number.isInteger(n) && n >= 1 && n <= 80) {
        nums.push(n)
      } else {
        errors.push(`第 ${i + 1} 行：无法识别「${t}」`)
      }
    }
    if (nums.length !== 20) {
      errors.push(`第 ${i + 1} 行：需要 20 个号码，实际 ${nums.length} 个`)
      return
    }
    if (new Set(nums).size !== 20) {
      errors.push(`第 ${i + 1} 行：号码存在重复`)
      return
    }
    if (id === null && date) id = Number(date.replaceAll('-', '')) // 用日期兜底作期号
    if (id === null) {
      errors.push(`第 ${i + 1} 行：缺少期号或日期，无法排序`)
      return
    }
    draws.push({ id, date: date || null, nums: [...nums].sort((a, b) => a - b) })
  })
  draws.sort((a, b) => b.id - a.id) // 最新在前
  return { draws, errors }
}
