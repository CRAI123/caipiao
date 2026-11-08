// POST /api/ai-predict
// 底层逻辑（加权频次 + 遗漏打分）之后，调用 AI 进行选号分析
// body: { draws: [{id, date, nums}], play: 10, mode: 'mix' }
// 返回: { basePicks, aiPicks, aiReasoning }
import { scoreBalls, pickBalanced, range, BALL_MAX } from '../src/lib/stats.js'
import { resolveLlmSettings, callAi } from './lib/ai.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { draws = [], play = 10, mode = 'mix' } = req.body || {}
    if (!Array.isArray(draws) || draws.length < 10) {
      return res.status(400).json({ error: '至少需要 10 期历史数据' })
    }

    // 1. 底层逻辑：统计打分 + 结构约束选号
    const { scores, weighted, missing } = scoreBalls(draws, { periods: 100, halfLife: 20, hotMode: mode })
    const ranked = range(BALL_MAX)
      .map((n) => ({ n, score: +(scores[n] * 100).toFixed(1), freq: +weighted[n].toFixed(2), miss: missing[n].current }))
      .sort((a, b) => b.score - a.score)
    const basePicks = pickBalanced(ranked, play).map((x) => x.n).sort((a, b) => a - b)

    // 2. 准备 AI 分析上下文（最近 20 期 + 评分前 20 名）
    const recent20 = draws.slice(0, 20)
    const top20 = ranked.slice(0, 20).map((r) => `${String(r.n).padStart(2, '0')}(分${r.score},遗${r.miss})`).join('，')

    const systemPrompt = `你是快乐8（80选20）数据研究助手。你的任务：基于近期开奖走势和统计评分，辅助选号。
严格规则：
1. 每期20个号码从80个中开出，每个号码每期出现概率恒为25%，开奖是独立随机事件。
2. 你不得声称发现了必胜规律，不得保证中奖。
3. 你只能给出"研究参考"性质的号码建议，必须明确说明这只是历史数据统计的参考，不构成投注建议。
4. 从评分前列的号码中挑选 ${play} 个，要求四区间(1-20/21-40/41-60/61-80)各有分布、奇偶大致均衡。
5. 输出格式：第一行只输出 ${play} 个两位数号码，空格分隔；第二行起用简短理由说明为什么选这些号（结合近期冷热、遗漏）。`

    const userMsg = [
      `最近 ${recent20.length} 期开奖号码：`,
      ...recent20.map((d) => `第${d.id}期：${d.nums.map((n) => String(n).padStart(2, '0')).join(' ')}`),
      '',
      `综合评分前 20 名（号码(评分,遗漏期数)）：`,
      top20,
      '',
      `请从中挑选 ${play} 个号码作为研究参考。`,
    ].join('\n')

    const llm = await resolveLlmSettings()
    const aiRaw = await callAi(llm, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ], { maxTokens: 400, temperature: 0.4 })

    // 解析 AI 输出的号码（第一行）
    const firstLine = aiRaw.split('\n')[0] || ''
    const aiPicks = Array.from(firstLine.matchAll(/\b(\d{1,2})\b/g))
      .map((m) => Number(m[1]))
      .filter((n) => n >= 1 && n <= 80)
      .slice(0, play)
      .sort((a, b) => a - b)

    // 如果 AI 没输出有效号码，用底层逻辑结果兜底
    const finalAiPicks = aiPicks.length >= play ? aiPicks.slice(0, play) : basePicks
    const reasoning = aiRaw.split('\n').slice(1).join('\n').trim() || '(AI 未给出额外理由，已使用统计评分结果)'

    return res.status(200).json({
      basePicks,
      aiPicks: finalAiPicks,
      aiReasoning: reasoning,
      top20: ranked.slice(0, 20),
    })
  } catch (e) {
    console.error('ai-predict error:', e)
    return res.status(500).json({ error: e.message })
  }
}
