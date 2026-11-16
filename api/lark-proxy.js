// 飞书多维表格同步代理（浏览器端使用）
// 每个用户在前端填入自己的 App ID / App Secret / App Token / Table ID，
// 浏览器把凭证和记录 POST 到这里，由服务端转发飞书 OpenAPI（绕过浏览器 CORS）。
// 凭证只在本次请求内使用，不落库、不记录。
import { applyCors } from './_lib/http.js'
import { handleLarkEvent } from './_lib/larkBot.js'

const LARK_API = 'https://open.feishu.cn/open-apis'

// 账本字段定义（名称, 飞书字段类型：1=文本 2=数字）
const FIELD_DEFS = [
  ['日期', 1],
  ['彩种', 1],
  ['期号', 1],
  ['是否购买', 1],
  ['玩法', 1],
  ['号码', 1],
  ['注数', 2],
  ['花费', 2],
  ['命中', 2],
  ['奖金', 2],
  ['盈亏', 2],
  ['备注', 1],
  ['AI分析', 1],
  ['同步时间', 1],
]

const LOTTERY_NAME = { kl8: '快乐8', fc3d: '福彩3D', pl3: '排列三' }

/** 记录所属彩种（未知值按快乐8处理） */
function lotteryName(r) {
  return LOTTERY_NAME[r?.lottery] || LOTTERY_NAME.kl8
}

/** 把一条账本记录转成飞书字段（快乐8 与三位数彩票共用一套列） */
function recToFields(r) {
  const isFc3d = !!LOTTERY_NAME[r?.lottery] && r.lottery !== 'kl8'
  const bought = !!r?.bought
  const picks = Array.isArray(r?.picks)
    ? r.picks.filter((n) => Number.isInteger(n)).map((n) => String(n).padStart(2, '0'))
    : []
  const bets = Array.isArray(r?.bets) ? r.bets : []
  // 快乐8 号码是 10 选；3D 号码按每注三位连写，多注用「 / 」分隔
  const numbers = isFc3d
    ? bets.map((b) => (Array.isArray(b) ? b.join('') : String(b))).join(' / ')
    : picks.join(' ')
  const playLabel = isFc3d ? r?.playLabel || '' : r?.play ? `选${r.play}` : ''
  const betCount = isFc3d
    ? Number(r?.betCount ?? bets.length) || 0
    : Array.isArray(r?.tickets)
      ? r.tickets.length
      : 0
  const spend = Number(r?.spend) || 0
  const prize = Number(r?.prize) || 0
  const ai =
    r?.aiReport && typeof r.aiReport === 'object'
      ? `${r.aiReport.text || ''}\n\n（${r.aiReport.model || ''} · ${r.aiReport.at || ''}）`
      : ''
  return {
    日期: r?.date || '',
    彩种: lotteryName(r),
    期号: r?.drawId != null ? String(r.drawId) : '',
    是否购买: bought ? '买了' : '没买',
    玩法: playLabel,
    号码: numbers,
    注数: betCount,
    花费: spend,
    命中: bought ? Number(r?.hits) || 0 : 0,
    奖金: prize,
    盈亏: prize - spend,
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
  // 机器人事件订阅回调也走这个路由（Vercel 免费版函数数量有限，不再单开文件）
  if (body && (body.type === 'url_verification' || body.encrypt || body?.header?.event_type)) {
    return handleLarkEvent(req, res, body)
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

    // 1.5 若用户填的是知识库（wiki）节点 token，先解析成真正的多维表格 app_token
    let realAppToken = appToken
    try {
      const nodeRes = await fetch(
        `${LARK_API}/wiki/v2/spaces/get_node?token=${encodeURIComponent(appToken)}&obj_type=wiki`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const nodeData = await nodeRes.json().catch(() => ({}))
      if (nodeData.code === 0) {
        const node = nodeData.data?.node
        if (node?.obj_type === 'bitable' && node.obj_token) {
          realAppToken = node.obj_token
        } else if (node) {
          throw new Error(`该知识库节点不是多维表格（实际是 ${node.obj_type || '未知'}），请在知识库里新建「多维表格」类型的节点`)
        }
      }
    } catch (e) {
      if (e.message?.startsWith('该知识库节点')) throw e
      // 其他情况按普通 app_token 继续，后面 bitable 接口会给出更准确的报错
    }

    // 2. 确保表字段存在
    const fieldsData = await larkFetch(
      token,
      `${LARK_API}/bitable/v1/apps/${realAppToken}/tables/${tableId}/fields?page_size=100`,
    )
    const existingFields = new Set((fieldsData.data?.items || []).map((f) => f.field_name))
    for (const [name, type] of FIELD_DEFS) {
      if (existingFields.has(name)) continue
      await larkFetch(token, `${LARK_API}/bitable/v1/apps/${realAppToken}/tables/${tableId}/fields`, {
        method: 'POST',
        body: JSON.stringify({ field_name: name, type }),
      })
    }

    // 3. 拉取已有记录，按「日期 + 彩种」建映射（旧记录没有彩种列，按快乐8处理）
    const existingByKey = new Map()
    let pageToken = ''
    do {
      const url = `${LARK_API}/bitable/v1/apps/${realAppToken}/tables/${tableId}/records?page_size=100${
        pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
      }`
      const d = await larkFetch(token, url)
      for (const item of d.data?.items || []) {
        const date = item.fields?.日期
        const lot = item.fields?.彩种
        const recId = item.record_id
        if (typeof date === 'string' && recId) {
          existingByKey.set(`${date}|${typeof lot === 'string' ? lot : '快乐8'}`, recId)
        }
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
      const key = `${date}|${fields.彩种}`
      if (existingByKey.has(key)) {
        toUpdate.push({ record_id: existingByKey.get(key), fields })
      } else {
        toCreate.push({ fields })
      }
    }

    // 5. 批量更新（每批 100）
    for (let i = 0; i < toUpdate.length; i += 100) {
      await larkFetch(
        token,
        `${LARK_API}/bitable/v1/apps/${realAppToken}/tables/${tableId}/records/batch_update`,
        { method: 'POST', body: JSON.stringify({ records: toUpdate.slice(i, i + 100) }) },
      )
    }

    // 6. 批量新建（每批 100）
    for (let i = 0; i < toCreate.length; i += 100) {
      await larkFetch(
        token,
        `${LARK_API}/bitable/v1/apps/${realAppToken}/tables/${tableId}/records/batch_create`,
        { method: 'POST', body: JSON.stringify({ records: toCreate.slice(i, i + 100) }) },
      )
    }

    res.status(200).json({ updated: toUpdate.length, created: toCreate.length })
  } catch (e) {
    res.status(502).json({ error: e.message || '飞书同步失败' })
  }
}
