// ============================================================
// 本地设置 —— Neon 云数据库 / 大模型 API / 飞书多维表格
// ⚠️ 所有连接串与密钥只保存在当前浏览器的 localStorage 中，
//    属于个人本地使用方式；请勿把填好了密钥的本站部署到公网。
// ============================================================

const KEY = 'kl8_settings_v1'

// 构建期由 vite.config.js 从 .env.local 的 DATABASE_URL 注入（neon init/deploy 拉取）；
// 未注入时（如 node 单测、未执行 neon 流程）为 undefined，此处安全降级为空串。
const ENV_NEON_URL =
  typeof __NEON_DATABASE_URL__ !== 'undefined' ? String(__NEON_DATABASE_URL__) : ''

/** 构建期注入的 Neon 连接串（供设置页展示来源提示） */
export const envNeonUrl = ENV_NEON_URL

const DEFAULTS = {
  // Neon 云 Postgres 连接串（形如 postgres://user:pass@ep-xxx.region.aws.neon.tech/kl8db?sslmode=require）
  neonUrl: ENV_NEON_URL,
  // 大模型 API（OpenAI 兼容 /chat/completions，默认 DeepSeek）
  llmBaseUrl: 'https://api.deepseek.com',
  llmKey: '',
  llmModel: 'deepseek-chat',
  // 飞书多维表格（Base）
  feishuAppId: '',
  feishuAppSecret: '',
  feishuAppToken: '', // 多维表格链接里的 app_token
  feishuTableId: '', // 具体数据表的 table_id
}

/** localStorage 不可用时（如 node 单测）退化为内存存储 */
let memoryStore = null
function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* 隐私模式等场景下访问 localStorage 会抛错 */
  }
  if (!memoryStore) memoryStore = new Map()
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, v),
    removeItem: (k) => memoryStore.delete(k),
  }
}

export function loadSettings() {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

/** 保存（局部字段合并），返回完整设置 */
export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch }
  storage().setItem(KEY, JSON.stringify(next))
  return next
}

export function resetSettings() {
  storage().removeItem(KEY)
  return { ...DEFAULTS }
}

export const isNeonReady = (s) => !!(s && s.neonUrl && s.neonUrl.startsWith('postgres'))
export const isLlmReady = (s) => !!(s && s.llmKey && s.llmBaseUrl && s.llmModel)
export const isLarkReady = (s) =>
  !!(s && s.feishuAppId && s.feishuAppSecret && s.feishuAppToken && s.feishuTableId)

/** 生成给本地同步脚本用的 PowerShell 命令（内含密钥，注意保密） */
export function larkSyncCommand(s, file = 'journal-export.json') {
  return [
    `$env:LARK_APP_ID="${s.feishuAppId}"`,
    `$env:LARK_APP_SECRET="${s.feishuAppSecret}"`,
    `$env:LARK_APP_TOKEN="${s.feishuAppToken}"`,
    `$env:LARK_TABLE_ID="${s.feishuTableId}"`,
    `node scripts/sync-lark.mjs --file ${file}`,
  ].join('; ')
}
