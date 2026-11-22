import fs from 'node:fs'
import { getSql } from './api/_lib/neon.js'
import { fetchKl8Draws } from './api/_lib/kl8.js'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim())
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sql = getSql()
await sql`DELETE FROM kl8_ai_deep_runs WHERE draw_id = 2026312 AND play = 6`
console.log('cache cleared')

const draws = await fetchKl8Draws(100)
const t0 = Date.now()
const res = await fetch('https://cai.rayzo.cn/api/ai-deep', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'run', play: 6, drawId: 2026312, deviceId: 'verify-probe-2', draws }),
})
const data = await res.json().catch(() => ({}))
console.log('status', res.status, 'elapsed', Math.round((Date.now() - t0) / 1000) + 's')
console.log('play', data.play, 'len', data.final10?.length, 'source', data.final10Source)
console.log('final', data.final10, 'algo', data.algo10)
console.log('note', data.final10Note || data.error)
