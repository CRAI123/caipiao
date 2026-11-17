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
import { loadFeishuTarget, sendFeishuCard } from './_lib/feishu.js'

export const config = { maxDuration: 60 }

const PLAY = 10 // 快乐8 默认选十
const GAMES = ['kl8', 'fc3d', 'pl3', 'pl5', 'ssq']
const GAME_LABEL = { kl8: '快乐8', fc3d: '福彩3D', pl3: '排列三', pl5: '排列五', ssq: '双色球' }

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const isTest = req.method === 'POST' || req.query?.test === '1'
  const isDry = req.query?.dry === '1'

  // 配置了 CRON_SECRET 时，定时调用需带 Bearer；手动（POST/test）不受影响
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.method === 'GET' && !isTest && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const started = Date.now()
  try {
    const sql = getSql()
    await ensureTables(sql)

    // 1. 并发抓最新开奖（取 100 期，给打分学习的专家模型足够历史；单个彩种失败按空数据跳过）
    //    注意：排列三/排列五/双色球返回 { draws, source }，快乐8/福彩3D 直接返回数组
    const safeFetch = (fn) =>
      fn(100)
        .then((r) => (Array.isArray(r) ? r : Array.isArray(r?.draws) ? r.draws : []))
        .catch(() => [])
    const [kl8Draws, fc3dDraws, pl3Draws, pl5Draws, ssqDraws] = await Promise.all([
      safeFetch(fetchKl8Draws),
      safeFetch(fetchFc3dDraws),
      safeFetch(fetchPl3Draws),
      safeFetch(fetchPl5Draws),
      safeFetch(fetchSsqDraws),
    ])
    const drawMap = { kl8: kl8Draws, fc3d: fc3dDraws, pl3: pl3Draws, pl5: pl5Draws, ssq: ssqDraws }

    // 学习前快照（报告里对比权重用）
    const beforeOf = {}
    for (const g of GAMES) {
      try {
        beforeOf[g] = await loadLearning(sql, g)
      } catch {
        beforeOf[g] = null
      }
    }

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

    // 学习后权重（报告展示用）
    const afterOf = {}
    for (const g of GAMES) {
      try {
        afterOf[g] = await loadLearning(sql, g)
      } catch {
        afterOf[g] = null
      }
    }

    // 5. 飞书夜间学习报告（含 AI 改善建议）
    const card = buildLearningCard({
      dateText: beijingDateText(),
      learning,
      beforeOf,
      afterOf,
      note,
      review,
      elapsedMs: Date.now() - started,
    })
    let feishu = { ok: false, error: 'dry' }
    if (!isDry) {
      try {
        const target = await loadFeishuTarget(sql)
        feishu = await sendFeishuCard(target, card)
        if (!feishu.ok) console.error('[daily-review] 飞书报告发送失败：', feishu.error)
      } catch (e) {
        feishu = { ok: false, error: String(e?.message || e) }
      }
    }

    console.log(
      `[daily-review] 完成：打分 ${scoredGames.join(',') || '无'}；笔记 ${
        note ? '已生成' : '未触发'
      }；飞书 ${feishu.ok ? '已发送' : feishu.error}；历时 ${Date.now() - started}ms`,
    )
    return res.status(200).json({
      ok: true,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      learning,
      noteGenerated: Boolean(note),
      review,
      feishu,
      ...(isDry ? { card } : {}),
    })
  } catch (e) {
    console.error('daily-review error:', e)
    return res.status(500).json({ error: e.message })
  }
}

/** 北京时间 MM-DD */
function beijingDateText() {
  const t = new Date(Date.now() + 8 * 3600 * 1000)
  return `${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** 权重数组按百分比展示（消除默认值未归一化的差异） */
function pct(arr) {
  if (!Array.isArray(arr) || !arr.length) return ''
  const s = arr.reduce((a, b) => a + (Number(b) || 0), 0) || 1
  return arr.map((v) => Math.round(((Number(v) || 0) / s) * 100)).join('/')
}

const FAM_LABEL = {
  model: '模型',
  temp: '温度',
  mix: 'AI/算法配比',
  windows: '窗口',
  redSignals: '红球信号',
  blueSignals: '蓝球信号',
}

/** 某彩种当前权重摘要（冷启动返回空） */
function weightSummary(st) {
  if (!st || st.coldStart) return ''
  if (st.experts) {
    return Object.entries(st.experts)
      .map(([p, w]) => `${p} ${pct(w)}`)
      .join('｜')
  }
  return Object.entries(FAM_LABEL)
    .filter(([k]) => st[k]?.weights)
    .map(([k, label]) => `${label} ${pct(st[k].weights)}`)
    .join('｜')
}

/** 规则型改善建议（不依赖 AI，保证报告里总有可执行内容） */
function ruleAdvice(learning, afterOf) {
  const out = []
  for (const g of GAMES) {
    const r = learning[g] || {}
    const st = afterOf[g]
    if (r.skipped && r.reason === 'no_data') {
      out.push(`${GAME_LABEL[g]}：本期没抓到新开奖，未参与学习`)
      continue
    }
    if (st?.coldStart) {
      out.push(`${GAME_LABEL[g]}：样本还不够，权重继续按默认值运行（不做过度调整）`)
      continue
    }
    // 权重是否过度集中（单族最大占比 ≥55% 且成员 ≥3）
    if (st?.experts) {
      for (const [p, w] of Object.entries(st.experts)) {
        const max = Math.max(...w)
        if (w.length >= 3 && max >= 0.55) {
          out.push(`${GAME_LABEL[g]} ${p} 专家权重集中在单个专家（${(max * 100).toFixed(0)}%），若连续跑输可考虑回退默认`)
        }
      }
    } else {
      for (const k of ['model', 'temp', 'redSignals', 'blueSignals']) {
        const w = st?.[k]?.weights
        if (!Array.isArray(w) || w.length < 3) continue
        const max = Math.max(...w)
        const sum = w.reduce((a, b) => a + b, 0) || 1
        if (max / sum >= 0.55) {
          out.push(`${GAME_LABEL[g]} 的${FAM_LABEL[k]}权重集中在单项（${((max / sum) * 100).toFixed(0)}%），注意跟踪其后续表现`)
        }
      }
    }
  }
  if (!out.length) out.push('五个彩种权重整体平稳，未发现异常集中，保持当前设置即可')
  return out.slice(0, 5)
}

/** 夜间学习报告卡片 */
function buildLearningCard({ dateText, learning, beforeOf, afterOf, note, review, elapsedMs }) {
  const line = (content) => ({ tag: 'div', text: { tag: 'lark_md', content } })
  const grey = (s) => `<font color='grey'>${s}</font>`
  const HR = { tag: 'hr' }

  const rows = GAMES.map((g) => {
    const r = learning[g] || {}
    if (!r.skipped) {
      const updated = Array.isArray(r.updated) ? r.updated.length : 0
      return line(`**${GAME_LABEL[g]}** 已学习第 ${r.drawId} 期 · 更新 ${updated} 组权重`)
    }
    const why =
      r.reason === 'already_scored'
        ? `已学过（第 ${r.drawId} 期）`
        : r.reason === 'no_data'
          ? '无新开奖'
          : r.reason || '跳过'
    return line(`${GAME_LABEL[g]} ${grey(why)}`)
  })

  const weightLines = GAMES.map((g) => {
    const now = weightSummary(afterOf[g])
    if (!now) return null
    const prev = weightSummary(beforeOf[g])
    const changed = prev && prev !== now
    return line(`${GAME_LABEL[g]}：${now}${changed ? grey('（本期有变动）') : grey('（未变动）')}`)
  }).filter(Boolean)

  const reviewLine =
    review && !review.skipped && review.hits != null
      ? line(`**快乐8 复盘** 第 ${review.drawId} 期命中 ${review.hits}/10，单注奖金 ${review.prize} 元`)
      : null

  const advice = ruleAdvice(learning, afterOf)

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'turquoise',
        title: { tag: 'plain_text', content: `夜间学习报告 · ${dateText}` },
      },
      elements: [
        line(grey(`开奖后自我学习 · 用时 ${(elapsedMs / 1000).toFixed(1)}s`)),
        ...rows,
        reviewLine,
        HR,
        ...(weightLines.length ? [line('**当前权重**（百分比，按族内归一）'), ...weightLines, HR] : []),
        line('**AI 复盘与改善建议**'),
        line(note?.note || grey('本期未生成新笔记（门槛：距上条 7 天或新增 5 期打分样本）')),
        HR,
        line('**本期检查结论**'),
        ...advice.map((a) => line(`· ${a}`)),
        HR,
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '自动学习只优化一致性与可解释性，不提高中奖概率；以上不构成投注建议。',
            },
          ],
        },
      ].filter(Boolean),
    },
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
