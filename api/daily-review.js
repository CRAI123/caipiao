// GET /api/daily-review  (cron 触发，每天 22:00 CST = 14:00 UTC)
// 夜间学习批次（当晚 21:15-21:30 开奖后立即运转）：
// 1. 并发抓取五个彩种最新开奖（单一彩种失败不影响其他）
// 2. 逐彩种打分学习：命中回填 + Hedge 增量更新权重（幂等，重复触发自动跳过）
// 3. AI 自我复盘：达到门槛时沉淀一条经验笔记，注入后续分析
// 4. 快乐8 当期复盘记录（预测 vs 开奖 + AI 总结，无预测或已复盘则跳过）

import { getSql, ensureTables } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchPl5Draws } from './_lib/pl5.js'
import { fetchSsqDraws } from './_lib/ssq.js'
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { prizeFor } from '../src/lib/stats.js'
import { applyCors } from './_lib/http.js'
import {
  scoreAndLearn,
  loadLearning,
  buildRecentSummary,
  maybeGenerateNotes,
} from './_lib/learning.js'

export const config = { maxDuration: 60 }

const PLAY = 10 // 快乐8 默认选十
const GAMES = ['kl8', 'fc3d', 'pl3', 'pl5', 'ssq']

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const started = Date.now()
  try {
    const sql = getSql()
    await ensureTables(sql)

    // 1. 并发抓最新开奖（取 100 期，给打分学习的专家模型足够历史；单个彩种失败按空数据跳过）
    const safeFetch = (fn) => fn(100).catch(() => [])
    const [kl8Draws, fc3dDraws, pl3Draws, pl5Draws, ssqDraws] = await Promise.all([
      safeFetch(fetchKl8Draws),
      safeFetch(fetchFc3dDraws),
      safeFetch(fetchPl3Draws),
      safeFetch(fetchPl5Draws),
      safeFetch(fetchSsqDraws),
    ])
    const drawMap = { kl8: kl8Draws, fc3d: fc3dDraws, pl3: pl3Draws, pl5: pl5Draws, ssq: ssqDraws }

    // 2. 逐彩种打分学习（该期已打过分则 skipped，可安全重复触发）
    const learning = {}
    for (const g of GAMES) {
      const d = drawMap[g]
      if (!Array.isArray(d) || d.length < 2) {
        learning[g] = { skipped: true, reason: 'no_data' }
        continue
      }
      learning[g] = await scoreAndLearn(sql, g, d)
    }
    const scoredGames = GAMES.filter((g) => learning[g] && learning[g].skipped === false)

    // 3. AI 自我复盘：有新打分才尝试（内部有 7 天 / 5 期门槛与超时保护）
    let note = null
    if (scoredGames.length) {
      try {
        const llm = await resolveLlmSettings()
        if (llm?.llmKey) {
          const learnedOf = {}
          for (const g of scoredGames) learnedOf[g] = await loadLearning(sql, g)
          const recentSummary = await buildRecentSummary(sql, scoredGames, learnedOf)
          note = await maybeGenerateNotes(sql, llm, {
            games: scoredGames,
            recentSummary,
            elapsedMs: Date.now() - started,
          })
        }
      } catch (e) {
        console.error('[daily-review] 经验笔记生成失败：', e?.message || e)
      }
    }

    // 4. 快乐8 当期复盘记录
    const review = kl8Draws[0] ? await reviewKl8(sql, kl8Draws[0]) : { skipped: true, reason: 'no_data' }

    console.log(
      `[daily-review] 完成：打分 ${scoredGames.join(',') || '无'}；笔记 ${
        note ? '已生成' : '未触发'
      }；历时 ${Date.now() - started}ms`,
    )
    return res.status(200).json({
      ok: true,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      learning,
      noteGenerated: Boolean(note),
      review,
    })
  } catch (e) {
    console.error('daily-review error:', e)
    return res.status(500).json({ error: e.message })
  }
}

/** 快乐8 当期复盘：预测 vs 开奖 + AI 总结，写入 kl8_daily_reviews（已复盘则跳过） */
async function reviewKl8(sql, latest) {
  try {
    const date = latest.date || new Date().toISOString().slice(0, 10)

    const predRows = await sql`SELECT * FROM kl8_predictions WHERE draw_id = ${latest.id}`
    const pred = predRows[0]
    if (!pred) {
      console.log(`第 ${latest.id} 期无预测记录，跳过复盘`)
      return { skipped: true, reason: 'no_prediction', drawId: latest.id }
    }

    const picks = Array.isArray(pred.picks) ? pred.picks : JSON.parse(pred.picks || '[]')
    const hitSet = new Set(latest.nums)
    const hits = picks.filter((n) => hitSet.has(n)).length
    const prize = prizeFor(PLAY, hits)
    const won = prize > 0

    const existing = await sql`SELECT date FROM kl8_daily_reviews WHERE date = ${date}`
    if (existing.length > 0) {
      return { skipped: true, reason: 'already_reviewed', drawId: latest.id }
    }

    const llm = await resolveLlmSettings()
    const wonLabel = won ? '中奖' : '未中奖'
    const systemPrompt = won
      ? `你是购彩复盘助手。用户本期快乐8（选十）中奖了，请帮他总结这次选号方法为什么有效，以及哪些特征值得关注。务必在结尾提醒：开奖是独立随机事件，本次中奖纯属运气，不代表方法可复制。输出用简体中文，300字以内。`
      : `你是购彩复盘助手。用户本期快乐8（选十）未中奖，请客观总结本期选号与开奖的差异，给出温和的复盘建议。务必在结尾提醒：开奖是独立随机事件，任何选号方法都不能提高中奖概率，理性购彩。输出用简体中文，300字以内。`

    const userMsg = [
      `第 ${latest.id} 期（${date}）复盘：`,
      `- 预测号码：${picks.map((n) => String(n).padStart(2, '0')).join(' ')}`,
      `- 开奖号码：${latest.nums.map((n) => String(n).padStart(2, '0')).join(' ')}`,
      `- 命中 ${hits}/${picks.length} 个，命中号码：${picks.filter((n) => hitSet.has(n)).map((n) => String(n).padStart(2, '0')).join(' ') || '无'}`,
      `- 单注奖金：${prize} 元（${wonLabel}）`,
      pred.dans?.length ? `- 胆码：${pred.dans.join(' ')}` : '',
      pred.mode ? `- 选号模式：${pred.mode}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const aiSummary = await callAi(
      llm,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      { maxTokens: 600, temperature: 0.3 },
    )

    await sql`
      INSERT INTO kl8_daily_reviews (date, draw_id, predicted, actual, hits, won, prize, ai_summary)
      VALUES (${date}, ${latest.id}, ${JSON.stringify(picks)}::jsonb,
              ${JSON.stringify(latest.nums)}::jsonb, ${hits}, ${won}, ${prize}, ${aiSummary})
      ON CONFLICT (date) DO UPDATE SET
        draw_id = EXCLUDED.draw_id,
        predicted = EXCLUDED.predicted,
        actual = EXCLUDED.actual,
        hits = EXCLUDED.hits,
        won = EXCLUDED.won,
        prize = EXCLUDED.prize,
        ai_summary = EXCLUDED.ai_summary,
        created_at = now()`

    console.log(`第 ${latest.id} 期复盘完成：命中 ${hits}，奖金 ${prize} 元`)
    return { drawId: latest.id, hits, won, prize }
  } catch (e) {
    console.error('[daily-review] 快乐8 复盘失败：', e?.message || e)
    return { skipped: true, error: String(e?.message || e) }
  }
}
