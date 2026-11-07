// ============================================================
// AI 分析 —— 调用 OpenAI 兼容 /chat/completions 接口，分析用户的真实购彩账本
// ⚠️ 边界写死在系统提示词里：只分析真实记录；严禁预测号码；严禁宣称发现规律；
//    必须给出回报率；必须提示购彩风险。提示词内容不接受外部覆盖。
// ============================================================

export const AI_SYSTEM_PROMPT = `你是「研彩室」的购彩账本分析助手，服务于一个快乐8（80选20）历史数据研究站点。你的唯一任务：分析用户自己记录的真实购彩账本，帮助他看清投入产出与行为模式。

【必须遵守】
1. 只能依据用户提供的账本数据说话，不得编造记录里没有的数据。
2. 快乐8每期从80个号码中开出20个，任何号码每期出现概率恒为25%，开奖是独立随机事件。你不得预测、推荐、暗示任何下一期号码，不得声称找到了任何「规律」「趋势」「必胜法」，不得鼓励加大投注金额或频率。
3. 分析中必须包含：累计投入、累计奖金、净盈亏、回报率（奖金÷投入）。
4. 必须把实际命中分布与理论概率（超几何分布/机选基准）对照，并明确指出样本内的波动属于正常随机波动。
5. 发现用户行为变化（如购买频率、金额上升）时，只作客观描述和温和提醒，不说教。
6. 结尾必须给出一句理性购彩提醒。

【输出结构】（用简体中文，Markdown）
1. 账本总览：天数/购买天数/投入/奖金/净盈亏/回报率
2. 命中分布对照：实际命中天数 vs 理论期望，一句话结论
3. 行为观察：购买频率与金额的变化、备注里的信息
4. 风险与建议：一句话即可，聚焦预算控制
5. 结论：一段话总结`

/** 组装发给大模型的 messages（纯函数，便于单测） */
export function buildMessages({ stats, records, latestDraw }) {
  const pct = (x) => `${(x * 100).toFixed(2)}%`
  const lines = [
    '以下是用户的购彩账本统计（由程序计算，真实数据）：',
    `- 打卡天数：${stats.days}，其中购买 ${stats.boughtDays} 天、未购买 ${stats.noBuyDays} 天`,
    `- 累计投入：${stats.spend} 元；累计奖金：${stats.prize} 元；净盈亏：${stats.net} 元；回报率：${pct(stats.roi)}`,
    `- 购买日均投入：${stats.avgSpend.toFixed(1)} 元`,
    '',
    '命中分布对照（实际天数 vs 按理论概率折算的期望天数）：',
    ...stats.hitRows
      .filter((r) => r.actual > 0 || r.expected >= 0.5)
      .map(
        (r) =>
          `- 中 ${r.k} 个：实际 ${r.actual} 天 / 理论期望 ${r.expected} 天（选十基准概率 ${pct(
            (stats.theory10[r.k] || { prob: 0 }).prob,
          )}）`,
      ),
    '',
    `最近 ${Math.min(records.length, 15)} 条记录（最新在前）：`,
    ...records.slice(0, 15).map((r) => {
      const picks = (r.picks || []).map((n) => String(n).padStart(2, '0')).join(' ')
      return r.bought
        ? `- ${r.date}（第${r.drawId ?? '?'}期）：投入 ${r.spend} 元，命中 ${r.hits ?? '?'} 个，奖金 ${r.prize} 元，号码 [${picks}]${r.note ? `，备注：${r.note}` : ''}`
        : `- ${r.date}（第${r.drawId ?? '?'}期）：未购买${r.note ? `，备注：${r.note}` : ''}`
    }),
  ]
  if (latestDraw) {
    lines.push('', `背景：最新一期为第 ${latestDraw.id} 期（${latestDraw.date || '日期未知'}），仅供定位时间，不要求你分析开奖号码。`)
  }
  lines.push('', '请按系统提示词的输出结构给出分析。')
  return [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

/**
 * 调用大模型分析账本。settings: { llmBaseUrl, llmKey, llmModel }
 * payload: { stats, records, latestDraw }
 * 返回 { text, model, at }
 */
export async function analyzeJournal(settings, payload) {
  if (!settings?.llmKey) throw new Error('尚未配置大模型 API Key，请先到「设置」页填写')
  const base = String(settings.llmBaseUrl || 'https://api.deepseek.com').replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel || 'deepseek-chat',
      messages: buildMessages(payload),
      temperature: 0.3,
      stream: false,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`大模型接口返回 HTTP ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('大模型接口返回内容为空')
  return { text: String(text).trim(), model: data.model || settings.llmModel, at: new Date().toISOString() }
}

/** 设置页「测试连接」用的最小请求 */
export async function pingLlm(settings) {
  const base = String(settings.llmBaseUrl || 'https://api.deepseek.com').replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel || 'deepseek-chat',
      messages: [{ role: 'user', content: '回复两个字：正常' }],
      max_tokens: 8,
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}：请检查 Base URL、API Key 与模型名`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || '(空回复，但接口连通)'
}
