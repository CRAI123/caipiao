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
  let id = null
  let finish = null
  const promise = new Promise((resolve) => {
    finish = resolve
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(99, Math.round((elapsed / target) * 100))
      const stage = stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))]
      onTick?.({ elapsed: Math.floor(elapsed / 1000), pct, stage })
      if (elapsed >= target) {
        clearInterval(id)
        id = null
        resolve()
      }
    }
    id = setInterval(tick, 400)
    tick()
  })
  // 出错/走别的分支时提前收尾，避免计时器继续改写进度与阶段文案
  promise.cancel = () => {
    if (id) {
      clearInterval(id)
      id = null
    }
    finish?.()
  }
  return promise
}

/** 随机 55–80 秒（快乐8：9 次独立 + 3 次复核 + 终审），34–48 秒（数字彩/双色球多轮） */
export const sharedWaitSeconds = (kind = 'digit') =>
  kind === 'kl8'
    ? 55 + Math.floor(Math.random() * 26)
    : 34 + Math.floor(Math.random() * 15)
