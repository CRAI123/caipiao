// 飞书多维表格同步代理（浏览器端使用）
// 每个用户在前端填入自己的 App ID / App Secret / App Token / Table ID，
// 浏览器把凭证和记录 POST 到这里，由服务端转发飞书 OpenAPI（绕过浏览器 CORS）。
// 凭证只在本次请求内使用，不落库、不记录。
import { applyCors } from './_lib/http.js'

const LARK_API = 'https://open.feishu.cn/open-apis'

// 账本字段定义（名称, 飞书字段类型：1=文本 2=数字）
const FIELD_DEFS = [
  ['日期', 1],
  ['期号', 1],
  ['是否购买', 1],
  ['号码', 1],
  ['花费', 2],
  ['命中', 2],
  ['奖金', 2],
  ['备注', 1],
  ['AI分析', 1],
  ['同步时间', 1],
]

/** 把一条账本记录转成飞书字段 */
function recToFields(r) {
  const bought = !!r?.bought
  const picks = Array.isArray(r?.picks)
    ? r.picks.filter((n) => Number.isInteger(n)).map((n) => String(n).padStart(2, '0'))
    : []
  const ai =
    r?.aiReport && typeof r.aiReport === 'object'
      ? `${r.aiReport.text || ''}\n\n（${r.aiReport.model || ''} · ${r.aiReport.at || ''}）`
      : ''
  return {
    日期: r?.date || '',
    期号: r?.drawId != null ? String(r.drawId) : '',
    是否购买: bought ? '买了' : '没买',
    号码: picks.join(' '),
    花费: Number(r?.spend) || 0,
    命中: bought ? Number(r?.hits) || 0 : 0,
    奖金: Number(r?.prize) || 0,
    备注: r?.note || '',
    AI分析: ai,
    同步时间: new Date().toISOString(),
  }
}

async function larkFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    throw new Error(`飞书接口错误：${data.code ?? res.status} ${data.msg || ''}`)
  }
  return data
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  const { cfg, records } = body || {}
  const { appId, appSecret, appToken, tableId } = cfg || {}
  if (!appId || !appSecret || !appToken || !tableId) {
    res.status(400).json({ error: '缺少飞书配置（App ID / App Secret / App Token / Table ID）' })
    return
  }
  if (!Array.isArray(records)) {
    res.status(400).json({ error: 'records 必须是数组' })
    return
  }
  if (records.length === 0) {
    res.status(200).json({ updated: 0, created: 0, skipped: true })
    return
  }
  if (records.length > 2000) {
    res.status(400).json({ error: '单次同步记录过多（上限 2000 条）' })
    return
  }

  try {
    // 1. 获取 tenant_access_token
    const tokenRes = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    })
    const tokenData = await tokenRes.json().catch(() => ({}))
    if (tokenData.code !== 0 || !tokenData.tenant_access_token) {
      throw new Error(`获取飞书令牌失败：${tokenData.code} ${tokenData.msg || ''}`)
    }
    const token = tokenData.tenant_access_token

    // 2. 确保表字段存在
    const fieldsData = await larkFetch(
      token,
      `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`,
    )
    const existingFields = new Set((fieldsData.data?.items || []).map((f) => f.field_name))
    for (const [name, type] of FIELD_DEFS) {
      if (existingFields.has(name)) continue
      await larkFetch(token, `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        method: 'POST',
        body: JSON.stringify({ field_name: name, type }),
      })
    }

    // 3. 拉取已有记录，按「日期」建映射
    const existingByDate = new Map()
    let pageToken = ''
    do {
      const url = `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=100${
        pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
      }`
      const d = await larkFetch(token, url)
      for (const item of d.data?.items || []) {
        const date = item.fields?.日期
        const recId = item.record_id
        if (typeof date === 'string' && recId) existingByDate.set(date, recId)
      }
      pageToken = d.data?.page_token || ''
    } while (pageToken)

    // 4. 拆分更新 / 新建
    const toUpdate = []
    const toCreate = []
    for (const r of records) {
      const date = r?.date
      if (!date) continue
      const fields = recToFields(r)
      if (existingByDate.has(date)) {
        toUpdate.push({ record_id: existingByDate.get(date), fields })
      } else {
        toCreate.push({ fields })
      }
    }

    // 5. 批量更新（每批 100）
    for (let i = 0; i < toUpdate.length; i += 100) {
      await larkFetch(
        token,
        `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
        { method: 'POST', body: JSON.stringify({ records: toUpdate.slice(i, i + 100) }) },
      )
    }

    // 6. 批量新建（每批 100）
    for (let i = 0; i < toCreate.length; i += 100) {
      await larkFetch(
        token,
        `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
        { method: 'POST', body: JSON.stringify({ records: toCreate.slice(i, i + 100) }) },
      )
    }

    res.status(200).json({ updated: toUpdate.length, created: toCreate.length })
  } catch (e) {
    res.status(502).json({ error: e.message || '飞书同步失败' })
  }
}
