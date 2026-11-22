import fs from 'node:fs'
import { resolveLlmSettings, callAi } from './api/_lib/ai.js'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim())
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const llm = await resolveLlmSettings()
console.log('model', llm?.llmModel, 'hasKey', Boolean(llm?.llmKey))
const cand = [4, 7, 12, 17, 19, 22, 25, 28, 31, 33, 35, 38, 42, 45, 48, 52, 57, 61, 68, 75]
const messages = [
  {
    role: 'system',
    content:
      '你是快乐8研究助手，现在做第 13 步终审。候选号已按「底层算法评分 × 12 轮模型投票」排好序。' +
      '任务：从这 20 个候选里挑出正好 6 个（可以放弃算法排名靠后的号）。' +
      '只输出一行 JSON，不要代码块、不要逐号理由、不要任何解释：' +
      '{"picks":[1,2,3,4,5,6],"summary":"60 字内"}。' +
      'picks 必须正好 6 个、不重复、且只能来自候选；不要承诺中奖。',
  },
  {
    role: 'user',
    content: `最近 10 期开奖：略\n\n终审候选（算法分/票分）：${cand.map((n) => `${n}(算法90/票3)`).join(' ')}\n\n请给出终审的 6 个号码。`,
  },
]
const t0 = Date.now()
const raw = await callAi(llm, messages, { maxTokens: 900, temperature: 0.3 })
console.log('elapsed', Date.now() - t0, 'ms')
console.log('RAW >>>', String(raw).slice(0, 800))
