import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 福彩官网未开放 CORS，通过本地代理转发（dev / preview 均生效）
const cwlProxy = {
  '/cwl-api': {
    target: 'https://www.cwl.gov.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/cwl-api/, ''),
    headers: {
      Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/kl8/',
    },
  },
}

// Neon：`neon init/deploy` 会把 DATABASE_URL 写进 .env.local（git 已忽略）。
// 本应用是纯浏览器端 Vite 应用（无服务端运行时），按 neon 技能指引，
// 数据库驱动选用 @neondatabase/serverless（浏览器走 WebSocket，服务端/边缘同样适用），
// 连接地址通过 define 在构建期注入为 __NEON_DATABASE_URL__，代码里作为默认值读取。
// ⚠️ 注入后连接串会进入浏览器包：仅限个人本地使用，请勿公开部署（设置页有相同警示）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const databaseUrl = env.VITE_DATABASE_URL || env.DATABASE_URL || ''
  return {
    plugins: [react()],
    define: {
      __NEON_DATABASE_URL__: JSON.stringify(databaseUrl),
    },
    server: { port: 5173, open: false, proxy: cwlProxy },
    preview: { proxy: cwlProxy },
  }
})
