// GET /api/daily-review  (cron 触发，每天 22:00 CST = 14:00 UTC)
// 夜间学习批次（当晚 21:15-21:30 开奖后立即运转）：
// 1. 并发抓取五个彩种最新开奖（单一彩种失败不影响其他）
// 2. 逐彩种打分学习：命中回填 + Hedge 增量更新权重（幂等，重复触发自动跳过）
// 3. AI 自我复盘：达到门槛时沉淀一条经验笔记，学习中心展示，并精简为方向提示注入首轮
// 4. 快乐8 当期复盘记录（预测 vs 开奖 + AI 总结，无预测或已复盘则跳过）

import { getSql, ensureTables, writeConfig } from './_lib/neon.js'
import { fetchKl8Draws } from './_lib/kl8.js'
import { fetchFc3dDraws } from './_lib/fc3d.js'
import { fetchPl3Draws } from './_lib/pl3.js'
import { fetchQxcDraws } from './_lib/qxc.js'
import { fetchDltDraws } from './_lib/dlt.js'
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
import { buildKl8, buildKl8Ai, buildDigitAi, KL8_SCHEMA } from './daily-push.js'
import { syncOfficialDlt, toIssue5 } from './_lib/dltOfficial.js'
import { KL8_PLAY, KL8_PLAY_LABEL } from '../src/lib/kl8Math.js'

export const config = { maxDuration: 60 }

const PLAY = KL8_PLAY // 快乐8 默认玩法：选六（与每日推送同口径）
const GAMES = ['kl8', 'fc3d', 'pl3', 'qxc', 'dlt']
const GAME_LABEL = {
  kl8: '快乐8',
  fc3d: '福彩3D',
  pl3: '排列三',
  qxc: '七星彩',
  dlt: '大乐透',
}

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
    //    注意：排列三/大乐透返回 { draws, source }，快乐8/福彩3D 直接返回数组
    const safeFetch = (fn) =>
      fn(100)
        .then((r) => (Array.isArray(r) ? r : Array.isArray(r?.draws) ? r.draws : []))
        .catch(() => [])
    const [kl8Draws, fc3dDraws, pl3Draws, qxcDraws, dltDraws] = await Promise.all([
      safeFetch(fetchKl8Draws),
      safeFetch(fetchFc3dDraws),
      safeFetch(fetchPl3Draws),
      safeFetch(fetchQxcDraws),
      safeFetch(fetchDltDraws),
    ])
    const drawMap = {
      kl8: kl8Draws,
      fc3d: fc3dDraws,
      pl3: pl3Draws,
      qxc: qxcDraws,
      dlt: dltDraws,
    }

    // 快乐8 当期复盘提前并发（不依赖学习结果），否则串在末尾容易把整轮拖过 60s 上限
    const reviewTask = kl8Draws[0]
      ? reviewKl8(sql, kl8Draws[0]).catch((e) => ({ skipped: true, error: String(e?.message || e) }))
      : Promise.resolve({ skipped: true, reason: 'no_data' })

    // 大乐透官方销售/中奖注数同步（避挤模型的数据源；失败不影响夜间学习）
    const officialTask = dltDraws[0]
      ? syncOfficialDlt(sql, {
          start: toIssue5(dltDraws[0].id),
          end: toIssue5(dltDraws[0].id),
        }).catch(() => null)
      : Promise.resolve(null)

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
    //    ?advice=1 为手动测试开关：即使本期没有新打分也生成一次改善建议
    // 学习后权重（报告展示与建议输入共用）
    const afterOf = {}
    for (const g of GAMES) {
      try {
        afterOf[g] = await loadLearning(sql, g)
      } catch {
        afterOf[g] = null
      }
    }

    let llm = null
    try {
      llm = await resolveLlmSettings()
    } catch {
      llm = null
    }
    const hasLlm = Boolean(llm?.llmKey)

    // 预生成次日 AI 终选（14:00 推送直接读缓存）与经验笔记并行跑，避免夜间批次超时
    const prewarmTask = hasLlm ? prewarmNext(llm, sql, drawMap, afterOf) : Promise.resolve(null)

    const adviceGames = scoredGames.length ? scoredGames : req.query?.advice === '1' ? GAMES : []
    let note = null
    let adviceText = ''
    if (adviceGames.length && hasLlm) {
      try {
        if (scoredGames.length) {
          const learnedOf = {}
          for (const g of scoredGames) learnedOf[g] = await loadLearning(sql, g)
          const recentSummary = await buildRecentSummary(sql, scoredGames, learnedOf)
          note = await maybeGenerateNotes(sql, llm, {
            games: scoredGames,
            recentSummary,
            elapsedMs: Date.now() - started,
          })
        }
        // 经验笔记有门槛（每周最多一条），报告里的改善建议则每晚单独生成一份，不写入长期笔记
        if (!note) adviceText = await withTimeout(generateAdvice(llm, sql, learning), 15000, '')
      } catch (e) {
        console.error('[daily-review] 经验笔记/改善建议生成失败：', e?.message || e)
      }
    }
    // 报告必须赶在 60s 函数上限前发出：给尾部任务留预算，超时就先用已有内容发
    const tailBudget = Math.max(3000, 46000 - (Date.now() - started))
    const [prewarm, review] = await Promise.all([
      withTimeout(prewarmTask, tailBudget),
      withTimeout(reviewTask, tailBudget),
    ])
    // 官方数据同步不参与报告内容，超时就先放弃（接口端可手动回补）
    await withTimeout(officialTask, 8000)
    // 5. 飞书夜间学习报告（含 AI 改善建议）
    const card = buildLearningCard({
      dateText: beijingDateText(),
      learning,
      beforeOf,
      afterOf,
      note,
      adviceText,
      review,
      prewarm,
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
      // 落库上一次运行结果，便于排查“报告没收到”这类静默问题
      try {
        await writeConfig(
          sql,
          'daily_review_last',
          JSON.stringify({
            at: new Date().toISOString(),
            ok: feishu.ok,
            error: feishu.error || '',
            elapsedMs: Date.now() - started,
            scored: scoredGames,
          }),
        )
      } catch {
        /* 诊断记录失败不影响主流程 */
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
      advice: note?.note || adviceText || '',
      prewarm,
      review,
      feishu,
      ...(isDry ? { card } : {}),
    })
  } catch (e) {
    console.error('daily-review error:', e)
    return res.status(500).json({ error: e.message })
  }
}

/** 限时等待：超时返回 fallback（不中断已发出的请求，只是不再等它） */
function withTimeout(promise, ms, fallback = null) {
  let timer = null
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), Math.max(0, ms))
  })
  return Promise.race([Promise.resolve(promise).catch(() => fallback), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
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
  frontSignals: '前区信号',
  backSignals: '后区信号',
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
      for (const k of ['model', 'temp', 'frontSignals', 'backSignals']) {
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

/** 每晚单独生成一份报告用改善建议（不写入长期经验笔记，也不注入后续分析） */
async function generateAdvice(llm, sql, learning) {
  try {
    // 样本量按“已打分的不同期号”统计，比各参数族内的 n 更贴近实际积累进度
    const counts = {}
    for (const g of GAMES) {
      try {
        const r = await sql`
          SELECT count(DISTINCT draw_id)::int AS c FROM learning_predictions
          WHERE game = ${g} AND scored = true`
        counts[g] = Number(r[0]?.c) || 0
      } catch {
        counts[g] = 0
      }
    }

    const stateLines = GAMES.map((g) => {
      const r = learning[g] || {}
      const n = counts[g]
      const cold = n < 8
      const status = !r.skipped
        ? `本期已学习第 ${r.drawId} 期，更新 ${(r.updated || []).length} 组权重`
        : r.reason === 'already_scored'
          ? `本期无新开奖，已学到第 ${r.drawId} 期`
          : r.reason === 'no_data'
            ? '本期未抓到开奖数据'
            : '未参与本期学习'
      return `${GAME_LABEL[g]}：${status}；累计已打分 ${n} 期，${cold ? '冷启动（权重仍按默认值运行）' : '自适应权重已启用'}`
    }).join('\n')

    const text = await callAi(
      llm,
      [
        {
          role: 'system',
          content:
            '你是彩票选号系统的复盘助手。只根据用户给出的【学习状态】写建议，不得引入任何未提供的数字、比例或指标。请给出 2-3 条接下来可执行的改善建议，聚焦：样本积累节奏、该持续跟踪的对比指标（AI 与算法命中差异、专家损失）、当前阶段是否应保持保守。硬性要求：只允许使用给定文本中出现过的数字；禁止使用百分号；禁止描述权重分布、特征维度、方差或采样参数；不预测号码；不暗示能提高中奖概率；样本不足时明确说保持默认权重继续观察。第一行直接以「· 」开头，不要任何开场白或自我介绍，每行一条，每条不超过 40 个汉字。',
        },
        {
          role: 'user',
          content: `【学习状态】\n${stateLines}\n\n补充说明：系统每天开奖后按命中结果更新模型/专家/信号权重；某彩种累计样本不足 8 期时不启用自适应权重，继续用默认值。`,
        },
      ],
      { maxTokens: 300, temperature: 0.4 },
    )
    // 事实校验：只留「· 」开头的条目；丢弃含百分号、含未提供数字或越界指标的句子
    const allowedNums = new Set((`${stateLines} 8`).match(/\d+/g) || [])
    const banned = /%|百分|维度|方差|采样|温度|权重分布/
    const kept = String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((l) => /^[·•\-*]/.test(l))
      .filter((l) => !banned.test(l))
      .filter((l) => (l.match(/\d+/g) || []).every((x) => allowedNums.has(x)))
      .map((l) => `· ${l.replace(/^[·•\-*]\s*/, '')}`)
      .slice(0, 3)
    return kept.join('\n')
  } catch (e) {
    console.error('[daily-review] 改善建议生成失败：', e?.message || e)
    return ''
  }
}

/** 预生成次日 AI 终选（14:00 推送直接读缓存）；任何失败都静默降级，不影响学习主流程 */
async function prewarmNext(llm, sql, drawMap, afterOf) {
  const out = { kl8: null, fc3d: null, pl3: null, qxc: null }
  const failed = {}
  const tasks = []

  const kd = drawMap.kl8
  if (Array.isArray(kd) && kd.length > 1) {
    tasks.push({
      g: 'kl8',
      fn: async () => {
        const built = buildKl8(kd, afterOf?.kl8 || null)
        const ai = await buildKl8Ai({ draws: kd, built, sql, llm })
        // 只有 AI 真正给出完整号码才缓存，回退算法结果不缓存，留给 14:00 再试一次
        if (!ai?.nextId || ai.source !== 'ai' || !Array.isArray(ai.ten) || ai.ten.length !== PLAY) {
          failed.kl8 = ai?.note || 'AI 未给出有效结果'
          return
        }
        await writeConfig(
          sql,
          'push_prewarm_kl8',
          JSON.stringify({
            nextId: ai.nextId,
            schema: KL8_SCHEMA,
            ten: ai.ten,
            source: ai.source,
            note: ai.note || '',
            summary: ai.summary || '',
            at: new Date().toISOString(),
          }),
        )
        out.kl8 = { drawId: ai.nextId, source: ai.source }
        delete failed.kl8
      },
    })
  }

  for (const [g, label] of [
    ['fc3d', '福彩3D'],
    ['pl3', '排列三'],
    ['qxc', '七星彩'],
  ]) {
    const d = drawMap[g]
    if (!Array.isArray(d) || d.length < 2) continue
    tasks.push({
      g,
      fn: async () => {
        // 数字彩的结果由 buildDigitAi 自己写进 digit_ai_runs，14:00 推送按同版本直接复用
        const ai = await buildDigitAi({ game: g, label, draws: d, sql, llm })
        if (ai?.source !== 'ai') {
          failed[g] = ai?.note || 'AI 未给出有效结果'
          return
        }
        out[g] = { drawId: ai.drawId, source: ai.source }
        delete failed[g]
      },
    })
  }

  const run = (t) =>
    t.fn().catch((e) => {
      failed[t.g] = String(e?.message || e)
    })

  try {
    // 并发跑一轮，但整体限时 20s：夜间批次不能被上游模型拖过 60s 上限
    const all = Promise.all(tasks.map(run))
    let timer = null
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve('timeout'), 20000)
    })
    const result = await Promise.race([all, timeout])
    if (timer) clearTimeout(timer)
    if (result === 'timeout') {
      for (const t of tasks) {
        if (out[t.g] == null && !failed[t.g]) failed[t.g] = '预生成超时'
      }
    }
  } catch (e) {
    console.error('[daily-review] 次日 AI 预生成失败：', e?.message || e)
  }

  return { ...out, ...(Object.keys(failed).length ? { failed } : {}) }
}

/** 夜晚学习报告卡片 */
function buildLearningCard({ dateText, learning, beforeOf, afterOf, note, adviceText, review, prewarm, elapsedMs }) {
  const line = (content) => ({ tag: 'div', text: { tag: 'lark_md', content } })
  const grey = (s) => `<font color='grey'>${s}</font>`
  const HR = { tag: 'hr' }

  const rows = GAMES.map((g) => {
    const r = learning[g] || {}
    if (!r.skipped) {
      const updated = Array.isArray(r.updated) ? r.updated.length : 0
      if (!updated) return line(`${GAME_LABEL[g]} ${grey(`第 ${r.drawId} 期没有待打分的预测行，权重未变`)}`)
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
      ? line(`**快乐8 复盘** 第 ${review.drawId} 期命中 ${review.hits}/${PLAY}，单注奖金 ${review.prize} 元`)
      : null

  const prewarmed = prewarm ? GAMES.filter((g) => prewarm[g]) : []
  const prewarmFailed = prewarm?.failed ? Object.keys(prewarm.failed).map((g) => GAME_LABEL[g] || g) : []
  const prewarmLine = prewarmed.length
    ? line(
        `${grey('次日 AI 终选已预生成：')}${prewarmed.map((g) => GAME_LABEL[g]).join('、')}${grey('（14:00 推送直接复用）')}`,
      )
    : null
  const prewarmFailLine = prewarmFailed.length
    ? line(grey(`预生成失败：${prewarmFailed.join('、')}（14:00 推送时会重试）`))
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
        prewarmLine,
        prewarmFailLine,
        HR,
        ...(weightLines.length ? [line('**当前权重**（百分比，按族内归一）'), ...weightLines, HR] : []),
        line('**AI 复盘与改善建议**'),
        line(
          note?.note ||
            adviceText ||
            grey('模型未就绪或调用失败，本期只有下方规则检查结论（下次会重试）'),
        ),
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
      ? `你是购彩复盘助手。用户本期快乐8（${KL8_PLAY_LABEL[PLAY]}）中奖了，请帮他总结这次选号方法为什么有效，以及哪些特征值得关注。务必在结尾提醒：开奖是独立随机事件，本次中奖纯属运气，不代表方法可复制。输出用简体中文，300字以内。`
      : `你是购彩复盘助手。用户本期快乐8（${KL8_PLAY_LABEL[PLAY]}）未中奖，请客观总结本期选号与开奖的差异，给出温和的复盘建议。务必在结尾提醒：开奖是独立随机事件，任何选号方法都不能提高中奖概率，理性购彩。输出用简体中文，300字以内。`

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
