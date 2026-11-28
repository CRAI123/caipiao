// 设置 —— Neon 云数据库 / 大模型 API / 飞书多维表格 / 本机访问身份
// ⚠️ 所有连接串与密钥只保存在本浏览器的 localStorage，属于个人本地使用方式，
//    请勿把填好了密钥的本站部署到公网或分享给他人。
import React, { useEffect, useState } from 'react'
import { Card, Note } from './common.jsx'
import { loadSettings, saveSettings, resetSettings, isNeonReady, isLlmReady, isLarkReady, envNeonUrl } from '../lib/settings.js'
import { testConnection, getSql } from '../lib/neon.js'
import { pingLlm } from '../lib/ai.js'
import { getDeviceId } from '../lib/device.js'
import { ensureAccessTables, fetchMyRequest, listAdmins, setSharedLarkConfig, getDailyPushConfig, setDailyPushConfig } from '../lib/access.js'
import { apiBase } from '../lib/api.js'

const ACCESS_LABEL = { pending: '待审核', approved: '已同意', rejected: '被拒绝' }

/**
 * 从飞书链接中自动提取 app_token 和 table_id。
 * 支持：
 *   https://xxx.feishu.cn/base/<app_token>?table=<table_id>
 *   https://xxx.feishu.cn/wiki/<node_token>?table=<table_id>（知识库内嵌表格，app_token 需另行解析）
 * 返回 { appToken, tableId, isWiki } ；解析失败返回 null。
 */
function parseLarkUrl(input) {
  const s = String(input || '').trim()
  if (!s) return null
  // 知识库链接：/wiki/<token>
  const wiki = s.match(/\/wiki\/([A-Za-z0-9]+)/)
  if (wiki) {
    const table = s.match(/[?&]table=([A-Za-z0-9]+)/)
    return { appToken: wiki[1], tableId: table ? table[1] : '', isWiki: true }
  }
  // 标准多维表格：/base/<token>
  const base = s.match(/\/base\/([A-Za-z0-9]+)/)
  if (base) {
    const table = s.match(/[?&]table=([A-Za-z0-9]+)/)
    return { appToken: base[1], tableId: table ? table[1] : '', isWiki: false }
  }
  // 纯 token（用户只粘了一段）：tbl 开头视为 table_id，否则视为 app_token
  if (/^tbl[A-Za-z0-9]+$/.test(s)) return { appToken: '', tableId: s, isWiki: false }
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return { appToken: s, tableId: '', isWiki: false }
  return null
}

export default function Settings() {
  const [form, setForm] = useState(loadSettings)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [larkLink, setLarkLink] = useState('')

  // 每日推荐推送（服务端 Cron 读取，保存在云数据库）
  const [push, setPush] = useState({
    webhook: '',
    secret: '',
    kl8: true,
    fc3d: true,
    pl3: true,
    qxc: true,
    dlt: true,
  })
  const [pushBusy, setPushBusy] = useState(false)

  /** 粘贴链接 → 自动识别并填入 app_token / table_id */
  function fillFromLink() {
    const p = parseLarkUrl(larkLink)
    if (!p) {
      return setMsg({ tone: 'warn', text: '没认出这个链接。请粘贴地址栏里以 /base/ 或 /wiki/ 开头的完整链接。' })
    }
    if (p.isWiki) {
      const next = { ...form, feishuAppToken: p.appToken }
      if (p.tableId) next.feishuTableId = p.tableId
      setForm(next)
      setLarkLink('')
      return setMsg({
        tone: 'warn',
        text: '已识别为知识库（/wiki/）里的表格并填入，同步时会自动解析出真正的 app_token。注意：你的应用需要额外开通「wiki:wiki」权限并发布一个新版本，否则会同步失败；嫌麻烦的话，新建一个独立多维表格（/base/ 链接）最省事。',
      })
    }
    const next = { ...form }
    if (p.appToken) next.feishuAppToken = p.appToken
    if (p.tableId) next.feishuTableId = p.tableId
    setForm(next)
    setLarkLink('')
    setMsg({ tone: 'info', text: `已识别并填入：app_token=${p.appToken || '（未变）'}，table_id=${p.tableId || '（未变）'}` })
  }

  // 本机访问身份（设备识别码 + 申请状态 + 是否管理员设备）
  const [dev, setDev] = useState(null)
  const [access, setAccess] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const d = getDeviceId()
      if (!alive) return
      setDev(d)
      const s = loadSettings()
      if (!isNeonReady(s)) {
        if (alive) setAccess({ mode: 'local' })
        return
      }
      try {
        const sql = getSql(s.neonUrl)
        await ensureAccessTables(sql)
        const [req, admins, pushCfg] = await Promise.all([
          fetchMyRequest(sql, d.id),
          listAdmins(sql),
          getDailyPushConfig(sql),
        ])
        if (!alive) return
        if (pushCfg)
          setPush({
            webhook: '',
            secret: '',
            kl8: true,
            fc3d: true,
            pl3: true,
            qxc: true,
            dlt: true,
            ...pushCfg,
          })
        setAccess({ mode: 'neon', req, isAdmin: admins.some((a) => a.device_id === d.id) })
      } catch (e) {
        if (alive) setAccess({ mode: 'error', message: e.message })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // 定时推送的最近一次结果（失败也留痕，避免被静默吞掉）
  const [lastPush, setLastPush] = useState(null)
  async function loadLastPush() {
    try {
      const r = await fetch(`${apiBase()}/api/daily-push?status=1`)
      const d = await r.json()
      setLastPush(d.last || null)
    } catch {
      /* 忽略：本地开发或接口未部署 */
    }
  }
  useEffect(() => {
    loadLastPush()
  }, [])

  // 是否可查看 / 修改系统级配置（云数据库、大模型）
  // 规则：本地模式（无 Neon）无门禁，视为管理员；Neon 模式下仅管理员设备可见
  const canEditSystem = access?.mode === 'local' || access?.isAdmin

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function save() {
    saveSettings(form)
    setMsg({ tone: 'info', text: '设置已保存' })
  }

  async function saveLarkToCloud() {
    const s = loadSettings()
    if (!isNeonReady(s)) {
      return setMsg({ tone: 'warn', text: '请先配置云数据库，才能把飞书配置同步到云端' })
    }
    setBusy(true)
    try {
      const sql = getSql(s.neonUrl)
      await ensureAccessTables(sql)
      await setSharedLarkConfig(sql, {
        feishuAppId: form.feishuAppId,
        feishuAppSecret: form.feishuAppSecret,
        feishuAppToken: form.feishuAppToken,
        feishuTableId: form.feishuTableId,
      })
      saveSettings(form)
      setMsg({ tone: 'info', text: '飞书配置已保存到云端，所有用户共用' })
    } catch (e) {
      setMsg({ tone: 'warn', text: `保存失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  /** 保存每日推送配置；test=true 时顺带让服务端立即发一条测试消息 */
  async function savePush(test) {
    const s = loadSettings()
    if (!isNeonReady(s)) {
      return setMsg({
        tone: 'warn',
        text: '每日推送由服务器定时执行，配置必须存在云数据库里。请先在上方配置 Neon 云数据库。',
      })
    }
    if (!push.webhook.trim()) {
      return setMsg({ tone: 'warn', text: '请先填写飞书机器人的 Webhook 地址' })
    }
    setPushBusy(true)
    setMsg(null)
    try {
      const sql = getSql(s.neonUrl)
      await ensureAccessTables(sql)
      await setDailyPushConfig(sql, push)
      if (!test) {
        return setMsg({ tone: 'info', text: '已保存，之后每天 14:00（北京时间）自动推送到飞书' })
      }
      const res = await fetch(`${apiBase()}/api/daily-push?test=1`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const skipped = [
        data.skipped?.kl8 && `快乐8：${data.skipped.kl8}`,
        data.skipped?.fc3d && `福彩3D：${data.skipped.fc3d}`,
        data.skipped?.pl3 && `排列三：${data.skipped.pl3}`,
        data.skipped?.qxc && `七星彩：${data.skipped.qxc}`,
        data.skipped?.dlt && `大乐透：${data.skipped.dlt}`,
      ]
        .filter(Boolean)
        .join('；')
      setMsg({
        tone: 'info',
        text: skipped ? `已保存并发送测试消息（部分彩种跳过：${skipped}）` : '已保存并发送测试消息，请到飞书群查看',
      })
    } catch (e) {
      setMsg({ tone: 'warn', text: `操作失败：${e.message}` })
    } finally {
      setPushBusy(false)
      loadLastPush()
    }
  }

  async function testNeon() {
    setBusy(true)
    setMsg(null)
    try {
      saveSettings(form)
      await testConnection(form.neonUrl)
      setMsg({ tone: 'info', text: 'Neon 连接成功，数据表已就绪' })
    } catch (e) {
      setMsg({ tone: 'warn', text: `连不上云数据库：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function testLlm() {
    setBusy(true)
    setMsg(null)
    try {
      saveSettings(form)
      const reply = await pingLlm(form)
      setMsg({ tone: 'info', text: `大模型连通成功，测试回复：${reply}` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `大模型连通失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Note tone="warn">
        这里填的连接串、API Key 等敏感信息<b>只保存在你这台设备上</b>，不会泄露给第三方。
        请勿把填好密钥的版本分享给别人，也不要截图外传。
      </Note>

      {canEditSystem ? (
        <>
      <Card title="云数据库（Neon）" tag={isNeonReady(form) ? '已配置' : '未配置'}>
        <div className="field">
          <label className="field-label">数据库连接串</label>
          <input
            className="text-input mono"
            type="password"
            value={form.neonUrl}
            onChange={set('neonUrl')}
            placeholder="postgres://user:password@ep-xxx.region.aws.neon.tech/kl8db?sslmode=require"
          />
        </div>
        <div className="row-actions">
          <button className="btn-primary" onClick={testNeon} disabled={busy || !form.neonUrl}>
            {busy ? '连接中…' : '测试连接并建表'}
          </button>
          <button className="tab-btn" onClick={save}>保存设置</button>
          {envNeonUrl && form.neonUrl === envNeonUrl && (
            <span className="sync-badge" title="构建期由 vite.config.js 从 .env.local 的 DATABASE_URL 注入">
              已从 .env.local 注入
            </span>
          )}
        </div>
        <div className="settings-guide">
          <b>怎么获取：</b>
          打开 <a href="https://console.neon.tech" target="_blank" rel="noreferrer">Neon 控制台</a> →
          选好项目 → 在 Dashboard 的 <b>Connection Details</b> 里复制完整的连接串
          （形如 <code>postgres://…?sslmode=require</code>，含密码）。
          如果用了 Neon CLI，<code>neon deploy</code> 会自动把连接串写入 <code>.env.local</code>，
          构建时自动填入上方，无需手动复制。
          <br />
          点「测试连接并建表」会自动建好账本表，之后打卡记录和 AI 分析结果都会自动同步上去。
        </div>
      </Card>

      <Card title="大模型（AI 分析）" tag={isLlmReady(form) ? '已配置' : '未配置'}>
        <div className="field-row">
          <div className="field">
            <label className="field-label">接口地址（OpenAI 兼容）</label>
            <input className="text-input mono" value={form.llmBaseUrl} onChange={set('llmBaseUrl')} />
          </div>
          <div className="field">
            <label className="field-label">模型名</label>
            <input className="text-input mono" value={form.llmModel} onChange={set('llmModel')} placeholder="deepseek-chat" />
          </div>
          <div className="field">
            <label className="field-label">API Key</label>
            <input
              className="text-input mono"
              type="password"
              value={form.llmKey}
              onChange={set('llmKey')}
              placeholder="sk-…"
            />
          </div>
        </div>
        <div className="row-actions">
          <button className="btn-primary" onClick={testLlm} disabled={busy || !form.llmKey}>
            {busy ? '测试中…' : '测试连通'}
          </button>
          <button className="tab-btn" onClick={save}>保存设置</button>
        </div>
        <div className="settings-guide">
          <b>推荐用 DeepSeek：</b>到
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer"> platform.deepseek.com</a>
          创建一个 API Key，模型填 <code>deepseek-chat</code> 即可（充 1 元能用很久）。
          也支持任何 OpenAI 兼容的接口，把 Base URL 和模型名换成对应的就行。
          <br />
          <b>AI 能做什么：</b>帮你复盘真实账本（投入产出、命中率对照理论概率、消费习惯变化）。
          <b>不会做什么：</b>绝不预测号码、不宣称有规律、不建议你多买。
        </div>
      </Card>

      <Card title="每日推荐推送（飞书机器人）" tag={push.webhook ? '已配置' : '未配置'}>
        <div className="field">
          <label className="field-label">飞书机器人 Webhook 地址</label>
          <input
            className="text-input mono"
            value={push.webhook}
            onChange={(e) => setPush({ ...push, webhook: e.target.value })}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx"
          />
        </div>
        <div className="field">
          <label className="field-label">签名校验密钥（机器人开了「签名校验」才填）</label>
          <input
            className="text-input mono"
            type="password"
            value={push.secret}
            onChange={(e) => setPush({ ...push, secret: e.target.value })}
            placeholder="留空表示不校验"
          />
        </div>
        <div className="row-actions">
          <label className="sync-badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={push.kl8}
              onChange={(e) => setPush({ ...push, kl8: e.target.checked })}
            />{' '}
            推送快乐8
          </label>
          <label className="sync-badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={push.fc3d}
              onChange={(e) => setPush({ ...push, fc3d: e.target.checked })}
            />{' '}
            推送福彩3D
          </label>
          <label className="sync-badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={push.pl3}
              onChange={(e) => setPush({ ...push, pl3: e.target.checked })}
            />{' '}
            推送排列三
          </label>
          <label className="sync-badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={push.qxc}
              onChange={(e) => setPush({ ...push, qxc: e.target.checked })}
            />{' '}
            推送七星彩
          </label>
          <label className="sync-badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={push.dlt}
              onChange={(e) => setPush({ ...push, dlt: e.target.checked })}
            />{' '}
            推送大乐透
          </label>
          <button className="tab-btn" onClick={() => savePush(false)} disabled={pushBusy}>保存</button>
          <button className="btn-primary" onClick={() => savePush(true)} disabled={pushBusy}>
            {pushBusy ? '发送中…' : '保存并发送测试'}
          </button>
        </div>

        {/* 最近一次定时推送的结果：成功/失败都留痕，不会被静默吞掉 */}
        <div className="note" style={{ marginTop: 10 }}>
          {!lastPush ? (
            <span className="muted">最近一次推送：暂无记录（每天 14:00 由 Vercel 自动执行，无需开电脑）</span>
          ) : lastPush.ok ? (
            <>
              <b>最近一次推送成功</b> · {new Date(lastPush.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
              {' · '}发出 {lastPush.sent ?? lastPush.messages ?? 0} 条
              {lastPush.fresh && Object.entries(lastPush.fresh).some(([, v]) => v?.state === 'stale') ? (
                <span style={{ color: 'var(--red)' }}>（当时有彩种数据未更新，卡片内已红字标注）</span>
              ) : null}
            </>
          ) : (
            <span style={{ color: 'var(--red)' }}>
              <b>最近一次推送失败</b> · {new Date(lastPush.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
              {' · '}{lastPush.error || '未知原因'}
            </span>
          )}
        </div>
        <div className="settings-guide">
          <b>怎么拿到 Webhook：</b>在飞书群里点右上角「…」→「设置」→「群机器人」→「添加机器人」→ 选「自定义机器人」，
          起个名字后复制它给出的 Webhook 地址粘贴到上方。如果勾选了「签名校验」，把密钥一起填进第二栏。
          <br />
          <b>什么时候发：</b>每天 <b>14:00（北京时间）</b>由 Vercel 定时任务自动计算推送，
          每个彩种发<b>一条卡片消息</b>：快乐8 蓝底（推荐十码 + 三注分注）、福彩3D 红底（位置推荐、双胆拖码、和值跨度、杀号）、
          排列三 橙底（v3 Pro 版：同上 + 覆盖档位的命中与成本）、大乐透 绿底（5 前区 + 2 后区、后区备选、杀号、和值三区结构），关键号码会标红。
          <br />
          <b>注意：</b>定时任务运行在服务器上，所以必须配置云数据库（配置保存在云端）；填好后点「保存并发送测试」可以先看效果。
          开奖为独立随机事件，推送内容仅为历史数据整理，不构成投注建议。
        </div>
      </Card>

        </>
      ) : (
        <Note tone="info">
          云数据库和大模型由管理员统一配置好了，大家共用同一套，你不需要填写。
          飞书表格请在下方的「我的飞书多维表格」里绑定你自己的。
        </Note>
      )}

      <Card title="我的飞书多维表格（同步到自己的表格）" tag={isLarkReady(form) ? '已绑定' : '未绑定'}>
        <div className="field-row">
          <div className="field">
            <label className="field-label">App ID（cli_ 开头）</label>
            <input className="text-input mono" value={form.feishuAppId} onChange={set('feishuAppId')} placeholder="cli_a1b2c3…" />
          </div>
          <div className="field">
            <label className="field-label">App Secret</label>
            <input className="text-input mono" type="password" value={form.feishuAppSecret} onChange={set('feishuAppSecret')} />
          </div>
        </div>
        <div className="field">
          <label className="field-label">粘贴表格链接，自动填好下面两项</label>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <input
              className="text-input mono"
              style={{ flex: 1 }}
              value={larkLink}
              onChange={(e) => setLarkLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fillFromLink() }}
              placeholder="https://xxx.feishu.cn/base/XXXX?table=tblXXXX"
            />
            <button className="tab-btn" onClick={fillFromLink} disabled={!larkLink.trim()}>识别并填入</button>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label">多维表格 app_token</label>
            <input
              className="text-input mono"
              value={form.feishuAppToken}
              onChange={set('feishuAppToken')}
              placeholder="多维表格链接 /base/XXXX 里的 XXXX"
            />
          </div>
          <div className="field">
            <label className="field-label">数据表 table_id（tbl 开头）</label>
            <input className="text-input mono" value={form.feishuTableId} onChange={set('feishuTableId')} placeholder="tblXXXX" />
          </div>
        </div>
        <div className="row-actions">
          <button className="tab-btn" onClick={save} disabled={busy}>保存到本机</button>
          {canEditSystem && (
            <button className="btn-primary" onClick={saveLarkToCloud} disabled={busy}>
              {busy ? '保存中…' : '保存为全员默认'}
            </button>
          )}
          <button
            className="tab-btn"
            onClick={() => {
              if (!form.feishuAppToken) return
              const url = `https://www.feishu.cn/base/${form.feishuAppToken}${form.feishuTableId ? `?table=${form.feishuTableId}` : ''}`
              window.open(url, '_blank', 'noopener')
            }}
            disabled={!form.feishuAppToken}
          >
            打开我的表格 ↗
          </button>
        </div>
        <div className="settings-guide">
          <b>每个用户用自己的表格：</b>这里填的凭证只保存在你这台设备，同步时写入的是<b>你自己的</b>飞书多维表格，
          与其他人互不影响。未填写时会回退使用管理员配置的默认表格。
          <br />
          <b>第一次配置？按下面 5 步照做（约 5 分钟）：</b>
          <ol className="settings-steps">
            <li>
              <b>新建表格，把链接粘贴过来即可。</b>在飞书里新建一个「多维表格」，然后直接把地址栏整个链接
              粘贴到上面的「粘贴表格链接」框，点「识别并填入」，会自动拆出
              <code>app_token</code>（<code>/base/</code> 后面那段）和 <code>table_id</code>（<code>?table=</code> 后面那段）。
              <br />
              <b>表格建在知识库里（链接是 /wiki/ 开头）也能用</b>，同步时会自动解析出真正的 app_token；
              但应用要多开一个 <code>wiki:wiki</code> 权限（下面第 3 步一起勾上）并发布，所以建议能建独立表格就建独立的。
            </li>
            <li>
              <b>建一个应用，拿到钥匙。</b>打开
              <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">飞书开放平台 → 开发者后台</a>，
              点右上角「创建企业自建应用」，名字随便起（例如「研彩室同步」）。
              进入应用后左侧「凭证与基础信息」里复制 <code>App ID</code>（<code>cli_</code> 开头）和
              <code>App Secret</code>，填到上面最前面两个框。
            </li>
            <li>
              <b>开通权限并发布（最常漏的一步）。</b>同一个应用里点左侧「权限管理」→ 搜索 <code>bitable</code>
              → 勾选 <code>bitable:app</code>（查看、评论、编辑和管理多维表格）。
              如果你的表格在知识库里（/wiki/ 链接），再搜 <code>wiki</code> 勾上 <code>wiki:wiki</code>。
              然后到左侧「版本管理与发布」→「创建版本」→ 保存并发起发布。
              如果你不是企业管理员，需要管理员在飞书「审批」里点通过，权限才会真正生效。
            </li>
            <li>
              <b>把应用加进表格（第二常漏的一步）。</b>回到你刚才建的多维表格页面 →
              右上角「…」（更多）→「添加文档应用」→ 搜索第 2 步那个应用名 →
              权限选<b>可编辑</b> → 添加。少了这一步，同步一定会报 91403 无权限。
            </li>
            <li>
              <b>保存并试一次同步。</b>点上面的「保存到本机」→ 切到「购彩账本」页点「同步到飞书」。
              第一次同步会自动把缺的列补上，共 14 列：日期、彩种、期号、是否购买、玩法、号码、注数、
              花费、命中、奖金、盈亏、备注、AI分析、同步时间。之后再同步，会按「日期 + 彩种」更新原行，不会重复新建。
            </li>
          </ol>
          <b>常见报错对照：</b>
          <ul className="settings-errs">
            <li><code>91403 Forbidden</code>／提示无权限：应用没被加为表格协作者 → 做第 4 步。</li>
            <li><code>app_token</code> 或 <code>table_id</code> 相关报错：复制时带上了空格或问号，或把 <code>/base/</code> 和 <code>?table=</code> 一起抄进去了。</li>
            <li><code>app secret invalid</code>：Secret 没复制全，或已在后台重置过，回第 2 步重新复制。</li>
            <li>权限明明勾了还是报错：第 3 步的版本还没发布，或管理员还没审批通过。</li>
            <li>表格里字段类型冲突：请不要手动把「日期」列改成日期类型，留作纯文本最稳。</li>
          </ul>
        </div>
      </Card>

      <Card title="我的设备身份" tag="识别码 · 申请状态">
        <div className="field">
          <label className="field-label">本机识别码</label>
          <div className="text-input mono" style={{ userSelect: 'all' }}>{dev?.id || '生成中…'}</div>
        </div>
        <div className="row-actions">
          {access?.mode === 'local' && <span className="sync-badge">本地模式：未连接云数据库，数据只存本机</span>}
          {access?.mode === 'neon' && (
            <>
              <span className="sync-badge">
                申请状态：{access.req ? ACCESS_LABEL[access.req.status] || access.req.status : '未申请'}
              </span>
              {access.req && <span className="muted small">昵称：{access.req.nickname}</span>}
              {access.isAdmin && <span className="sync-badge">管理员设备</span>}
            </>
          )}
          {access?.mode === 'error' && <span className="muted small">暂时连不上云数据库：{access.message}</span>}
        </div>
        <div className="settings-guide">
          <b>这串码是干嘛的：</b>系统靠它认出「你是谁」。第一次打开站点时会让你填昵称、提交申请，
          管理员在后台同意后，你刷新页面就能正常使用了。
          同一台电脑、同一个浏览器，这串码是固定不变的；如果清理了浏览器数据或换了电脑，
          就会被当成新设备，需要重新申请一次。
        </div>
      </Card>

      <Card title="数据管理" tag="账本导出 / 重置">
        <div className="row-actions">
          <button
            className="tab-btn"
            onClick={() => {
              resetSettings()
              setForm(loadSettings())
              setMsg({ tone: 'info', text: '已清空所有设置（账本记录不受影响）' })
            }}
          >
            清空全部设置
          </button>
        </div>
        <Note>
          账本记录单独保存在本地，不会被清空。清空设置前建议先到「购彩账本」页导出 JSON 备份一份。
        </Note>
      </Card>

      {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
    </div>
  )
}
