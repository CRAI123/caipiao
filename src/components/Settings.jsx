// 设置 —— Neon 云数据库 / 大模型 API / 飞书多维表格 / 本机访问身份
// ⚠️ 所有连接串与密钥只保存在本浏览器的 localStorage，属于个人本地使用方式，
//    请勿把填好了密钥的本站部署到公网或分享给他人。
import React, { useEffect, useState } from 'react'
import { Card, Note } from './common.jsx'
import { loadSettings, saveSettings, resetSettings, isNeonReady, isLlmReady, isLarkReady, envNeonUrl } from '../lib/settings.js'
import { testConnection, getSql } from '../lib/neon.js'
import { pingLlm } from '../lib/ai.js'
import { getDeviceId } from '../lib/device.js'
import { ensureAccessTables, fetchMyRequest, listAdmins, setSharedLarkConfig } from '../lib/access.js'

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
          <b>每个用户用自己的表格：</b>你在这里填的凭证只保存在你这台设备，同步时写入的是<b>你自己的</b>飞书多维表格，
          与其他人互不影响。未填写时会回退使用管理员配置的默认表格。
          <br />
          <b>三步搞定：</b>
          ① 新建一个飞书多维表格，从地址栏链接里复制 <code>app_token</code>（<code>/base/</code> 后面那段）
          和 <code>table_id</code>（<code>?table=</code> 后面那段），填到上方；
          ② 到<a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">飞书开放平台</a>创建企业自建应用，
          拿到 App ID / App Secret，开通 <code>bitable:app</code> 权限并发布；
          ③ 回到多维表格，右上角「…」→ 添加文档应用，把刚建的应用加为可编辑协作者。
          <br />
          <b>怎么同步：</b>到「购彩账本」页点「同步到飞书」，网页端和桌面端都会按「日期」自动更新或新建记录，
          缺的字段也会自动补上。
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
