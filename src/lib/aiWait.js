// 模拟 AI 分析进度
// 共享解析是首位用户真实调用大模型生成的，后续用户读缓存几乎瞬间返回；
// 为了让每个人都有「在分析」的体验，点按钮后按固定节奏走一遍进度（不影响结果）。

export const AI_STAGES = [
  '同步最新开奖数据',
  '清洗历史样本',
  '统计位置与形态分布',
  '核对遗漏与转会',
  '大模型解读',
  '交叉校验结论',
]

/**
 * 模拟分析等待
 * @param {{ seconds?: number, stages?: string[], onTick?: (s: {elapsed:number, pct:number, stage:string}) => void }} opts
 */
export function fakeAnalyze({ seconds = 26, stages = AI_STAGES, onTick } = {}) {
  const target = Math.max(1, seconds) * 1000
  const start = Date.now()
  return new Promise((resolve) => {
    let id = null
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(99, Math.round((elapsed / target) * 100))
      const stage = stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))]
      onTick?.({ elapsed: Math.floor(elapsed / 1000), pct, stage })
      if (elapsed >= target) {
        clearInterval(id)
        resolve()
      }
    }
    id = setInterval(tick, 400)
    tick()
  })
}

/** 随机 22–34 秒，用于「后看的人」的共享结果 */
export const sharedWaitSeconds = () => 22 + Math.floor(Math.random() * 13)
