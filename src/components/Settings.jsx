// 设置 —— Neon 云数据库 / 大模型 API / 飞书多维表格 / 本机访问身份
// ⚠️ 所有连接串与密钥只保存在本浏览器的 localStorage，属于个人本地使用方式，
//    请勿把填好了密钥的本站部署到公网或分享给他人。
import React, { useEffect, useState } from 'react'
import { Card, Note } from './common.jsx'
import { loadSettings, saveSettings, resetSettings, isNeonReady, isLlmReady, isLarkReady, larkSyncCommand, envNeonUrl } from '../lib/settings.js'
import { testConnection, getSql } from '../lib/neon.js'
import { pingLlm } from '../lib/ai.js'
import { getDeviceId } from '../lib/device.js'
import { ensureAccessTables, fetchMyRequest, listAdmins } from '../lib/access.js'

const ACCESS_LABEL = { pending: '待审核', approved: '已同意', rejected: '被拒绝' }

export default function Settings() {
  const [form, setForm] = useState(loadSettings)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

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
        const [req, admins] = await Promise.all([fetchMyRequest(sql, d.id), listAdmins(sql)])
        if (!alive) return
        setAccess({ mode: 'neon', req, isAdmin: admins.some((a) => a.device_id === d.id) })
      } catch (e) {
        if (alive) setAccess({ mode: 'error', message: e.message })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function save() {
    saveSettings(form)
    setMsg({ tone: 'info', text: '设置已保存到浏览器本地' })
  }

  async function testNeon() {
    setBusy(true)
    setMsg(null)
    try {
      saveSettings(form)
      await testConnection(form.neonUrl)
      setMsg({ tone: 'info', text: 'Neon 连接成功，账本表 kl8_journal 已就绪' })
    } catch (e) {
      setMsg({ tone: 'warn', text: `Neon 连接失败：${e.message}` })
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
      setMsg({ tone: 'info', text: `大模型接口连通，测试回复：${reply}` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `大模型接口测试失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Note tone="warn">
        本页所有内容（连接串、API Key、应用密钥）<b>只保存在当前浏览器的 localStorage 中</b>，
        不会上传到除你配置的 Neon / 大模型 / 飞书之外的任何地方。这是个人本地使用方式——
        请勿公开部署填好了密钥的站点，也不要把设置截图分享出去。
      </Note>

      <Card title="Neon 云数据库（后台）" tag={isNeonReady(form) ? '已配置' : '未配置'}>
        <div className="field">
          <label className="field-label">Postgres 连接串</label>
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
          <b>获取方式：</b>
          已通过 Neon CLI 接入：<code>neon init</code> 写入 <code>neon.ts</code>（声明 postgres 服务），
          <code>neon deploy</code> 应用到 production 分支并把 <code>DATABASE_URL</code>（pooled，应用流量首选）
          拉取到 <code>.env.local</code>；构建时由 <code>vite.config.js</code> 注入为默认值填入上方。
          手动获取：打开 <a href="https://console.neon.tech" target="_blank" rel="noreferrer">Neon 控制台</a> →
          创建/选择一个项目 → Dashboard 里的 <b>Connection Details</b> → 打开
          「Connection string」切换，复制形如 <code>postgres://…?sslmode=require</code> 的完整串（含密码）。
          点「测试连接并建表」会自动创建数据表 <code>kl8_journal</code>（date 主键 + jsonb payload）。
          打卡保存、AI 分析结果都会按日期 upsert 到这张表。
          <b>驱动：</b><code>@neondatabase/serverless</code>——浏览器端走 WebSocket 直连，服务端/边缘运行时同样适用，
          是 Neon 官方推荐的通用驱动。
        </div>
      </Card>

      <Card title="大模型 API（AI 分析）" tag={isLlmReady(form) ? '已配置' : '未配置'}>
        <div className="field-row">
          <div className="field">
            <label className="field-label">Base URL（OpenAI 兼容接口）</label>
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
          <b>获取方式：</b>默认填的是 DeepSeek（
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">platform.deepseek.com</a>
          → 创建 API Key，模型 <code>deepseek-chat</code>，充值 1 元起即可用很久）。
          任何 OpenAI 兼容接口都可以用：把 Base URL、模型名换成对应服务商的即可
          （如 Moonshot <code>https://api.moonshot.cn/v1</code> + <code>kimi-k2</code>，
          阿里百炼 <code>https://dashscope.aliyuncs.com/compatible-mode/v1</code> + <code>qwen-plus</code>）。
          <br />
          <b>分析边界（已写死在提示词中）：</b>AI 只分析你的真实账本（投入产出、命中分布对照理论概率、行为变化），
          <b>不允许预测号码、不允许宣称发现规律、不允许鼓励加大投注</b>。
        </div>
      </Card>

      <Card title="飞书多维表格（同步）" tag={isLarkReady(form) ? '已配置' : '未配置'}>
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
          <button className="tab-btn" onClick={save}>保存设置</button>
          <button
            className="tab-btn"
            onClick={async () => {
              save()
              try {
                await navigator.clipboard.writeText(larkSyncCommand(form))
                setMsg({ tone: 'info', text: '同步命令已复制（含密钥，勿外传）' })
              } catch {
                setMsg({ tone: 'warn', text: `复制失败，请手动复制：${larkSyncCommand(form)}` })
              }
            }}
          >
            复制同步命令
          </button>
        </div>
        <div className="settings-guide">
          <b>获取方式：</b>
          ① 新建一个飞书多维表格，浏览器地址栏链接形如{' '}
          <code>https://xxx.feishu.cn/base/&lt;app_token&gt;?table=&lt;table_id&gt;</code>，两段分别填入上方；
          ② 到<a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">飞书开放平台</a>创建企业自建应用，
          拿到 App ID / App Secret，并在「权限管理」中开通 <code>bitable:app</code> 读写权限、发布应用版本；
          ③ 在多维表格右上角「…」→ 更多 → 添加文档应用，把应用加为协作者（可编辑）。
          <br />
          <b>使用方式：</b>浏览器不允许直接携带应用密钥调飞书接口，所以同步由本地脚本完成：
          在「购彩账本」页点「导出 JSON」→「复制飞书同步命令」，在项目根目录的 PowerShell 中粘贴执行。
          脚本会按「日期」字段自动更新已有记录或新建，并补齐缺失字段（日期/期号/是否购买/号码/花费/命中/奖金/备注/AI分析/同步时间）。
        </div>
      </Card>

      <Card title="本机访问身份" tag="设备识别码 · 申请状态">
        <div className="field">
          <label className="field-label">本机识别码（后台凭此区分用户）</label>
          <div className="text-input mono" style={{ userSelect: 'all' }}>{dev?.id || '生成中…'}</div>
        </div>
        <div className="row-actions">
          {access?.mode === 'local' && <span className="sync-badge">本地模式（未配置 Neon，不启用门禁）</span>}
          {access?.mode === 'neon' && (
            <>
              <span className="sync-badge">
                申请状态：{access.req ? ACCESS_LABEL[access.req.status] || access.req.status : '未申请'}
              </span>
              {access.req && <span className="muted small">昵称：{access.req.nickname}</span>}
              {access.isAdmin && <span className="sync-badge">管理员设备</span>}
            </>
          )}
          {access?.mode === 'error' && <span className="muted small">查询失败：{access.message}</span>}
        </div>
        <div className="settings-guide">
          <b>说明：</b>访客首次打开站点会看到「访问申请」页——填昵称 + 自动生成的本机识别码提交申请；
          你在「后台」页同意后，对方刷新即可进入。识别码由浏览器特征（UA/屏幕/时区/硬件/Canvas/WebGL）
          加本地盐值生成，同一电脑同一浏览器稳定不变，清浏览器数据或换电脑会视为新设备需重新申请。
        </div>
      </Card>

      <Card title="数据管理" tag="账本导出 / 重置">
        <div className="row-actions">
          <button
            className="tab-btn"
            onClick={() => {
              resetSettings()
              setForm(loadSettings())
              setMsg({ tone: 'info', text: '已清空本地设置（账本记录不受影响）' })
            }}
          >
            清空全部设置
          </button>
        </div>
        <Note>
          账本记录本身保存在 localStorage 的 <code>kl8_journal_v1</code> 键中；删库前建议先在「购彩账本」页导出 JSON 备份。
        </Note>
      </Card>

      {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
    </div>
  )
}
