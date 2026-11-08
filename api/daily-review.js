// GET /api/daily-review  (cron 触发，每天 10:00 CST = 02:00 UTC)
// 1. 抓取最新一期开奖
// 2. 查找该期预测号码（kl8_predictions）
// 3. 对比命中数与奖金
// 4. 调用 AI 总结：中了→总结方法；没中→总结上报
// 5. 存入 kl8_daily_reviews
import { getSql, ensureTables } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { resolveLlmSettings, callAi } from './_lib/ai.js'
import { prizeFor } from '../src/lib/stats.js'
import { applyCors } from './_lib/http.js'

const PLAY = 10 // 默认选十

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  try {
    const sql = getSql()
    await ensureTables(sql)

    // 1. 抓取最新开奖
    const draws = await fetchKl8Draws(3)
    if (!draws.length) throw new Error('未获取到开奖数据')
    const latest = draws[0]
    const date = latest.date || new Date().toISOString().slice(0, 10)

    // 2. 查找该期预测
    const predRows = await sql`SELECT * FROM kl8_predictions WHERE draw_id = ${latest.id}`
    const pred = predRows[0]
    if (!pred) {
      // 没有预测记录，跳过但记录日志
      console.log(`第 ${latest.id} 期无预测记录，跳过复盘`)
      return res.status(200).json({ ok: true, skipped: true, drawId: latest.id, reason: 'no_prediction' })
    }

    const picks = Array.isArray(pred.picks) ? pred.picks : JSON.parse(pred.picks || '[]')
    const hitSet = new Set(latest.nums)
    const hits = picks.filter((n) => hitSet.has(n)).length
    const prize = prizeFor(PLAY, hits)
    const won = prize > 0

    // 3. 检查是否已复盘过
    const existing = await sql`SELECT date FROM kl8_daily_reviews WHERE date = ${date}`
    if (existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: true, drawId: latest.id, reason: 'already_reviewed' })
    }

    // 4. AI 总结
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
    ].filter(Boolean).join('\n')

    const aiSummary = await callAi(llm, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ], { maxTokens: 600, temperature: 0.3 })

    // 5. 存入复盘表
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
    return res.status(200).json({ ok: true, drawId: latest.id, hits, won, prize, aiSummary })
  } catch (e) {
    console.error('daily-review error:', e)
    return res.status(500).json({ error: e.message })
  }
}
