// 服务端 AI 调用（Vercel Serverless Functions）
// 优先用 Neon admin_config 里的共享大模型配置；未配置则用默认 3hdmx 中转
import { getSql, readConfig } from './neon.js'

const DEFAULT_LLM = {
  llmBaseUrl: 'https://3hdmx.com/v1',
  llmKey: 'sk-MJ2pd89yHDkjYUo6jtJ5cskUPlnbMwhbaBkX7Pgm6G7k74W1',
  llmModel: 'claude-sonnet-5',
}

/** 解析大模型配置：共享配置 → 默认 */
export async function resolveLlmSettings() {
  try {
    const sql = getSql()
    const raw = await readConfig(sql, 'shared_llm_config')
    if (raw) {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (obj && obj.llmKey) {
        return {
          llmBaseUrl: obj.llmBaseUrl || DEFAULT_LLM.llmBaseUrl,
          llmKey: obj.llmKey,
          llmModel: obj.llmModel || DEFAULT_LLM.llmModel,
        }
      }
    }
  } catch {
    /* Neon 不可达，退回默认 */
  }
  return { ...DEFAULT_LLM }
}

/**
 * 调用大模型。settings: { llmBaseUrl, llmKey, llmModel }
 * messages: OpenAI 格式消息数组
 * 返回文本内容
 */
export async function callAi(settings, messages, { maxTokens = 2000, temperature = 0.3 } = {}) {
  const base = String(settings.llmBaseUrl).replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`大模型接口 HTTP ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('大模型返回内容为空')
  return String(text).trim()
}
