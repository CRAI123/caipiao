// 访问门禁 —— 未获授权的访客看到的三态页面：申请 / 等待审核 / 已被拒绝
// 用户标识 = 设备识别码（device.js）+ 昵称；审核在「后台」由管理员操作。
import React, { useState } from 'react'
import { Note } from './common.jsx'
import { shortDevice } from '../lib/device.js'
import { loadSettings } from '../lib/settings.js'
import { getSql } from '../lib/neon.js'
import { submitRequest } from '../lib/access.js'

export default function AccessGate({ deviceId, request, onApproved, onStateChange, onAdminEntry }) {
  const [nickname, setNickname] = useState(request?.nickname || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function apply(e) {
    e.preventDefault()
    const name = nickname.trim()
    if (name.length < 1 || name.length > 20) return setMsg({ tone: 'warn', text: '昵称长度需在 1-20 个字符之间' })
    setBusy(true)
    try {
      const settings = loadSettings()
      const sql = getSql(settings.neonUrl)
      const next = await submitRequest(sql, { deviceId, nickname: name })
      onStateChange?.(next)
      setMsg({ tone: 'info', text: '申请已提交，等待管理员审核' })
    } catch (err) {
      setMsg({ tone: 'warn', text: `提交失败：${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="masthead-mark gate-mark">研</div>
        <h1 className="gate-title">研彩室 · 访问申请</h1>
        <p className="gate-sub">
          本站为个人研究工具，采用邀请制访问。填写昵称提交申请，管理员在后台同意后即可进入。
        </p>

        {!request && (
          <form onSubmit={apply} className="gate-form">
            <div className="field">
              <label className="field-label">你的昵称（后台用它区分用户，1-20 字符）</label>
              <input
                className="text-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如：小王 / 阿伟"
                maxLength={20}
                autoFocus
              />
            </div>
            <div className="gate-device">
              本机识别码：<code className="mono">{deviceId}</code>
              <span className="muted small">（由浏览器特征生成，同一电脑同一浏览器稳定不变；后台凭此区分不同用户）</span>
            </div>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? '提交中…' : '提交访问申请'}
            </button>
          </form>
        )}

        {request?.status === 'pending' && (
          <div className="gate-form">
            <div className="gate-status gate-status-pending">
              <b>申请审核中</b>
              <p>
                昵称「{request.nickname}」已于 {new Date(request.requested_at).toLocaleString('zh-CN')} 提交申请，
                请等待管理员在后台同意。你可以关掉页面，审核通过后重新打开即可进入。
              </p>
            </div>
            <div className="row-actions">
              <button className="tab-btn" onClick={onApproved} disabled={busy}>
                {busy ? '检查中…' : '刷新审核状态'}
              </button>
              <button
                className="tab-btn"
                onClick={() => onStateChange?.(null)}
              >
                修改昵称 / 重新申请
              </button>
            </div>
          </div>
        )}

        {request?.status === 'rejected' && (
          <div className="gate-form">
            <div className="gate-status gate-status-rejected">
              <b>申请未通过</b>
              {request.admin_note && <p>管理员备注：{request.admin_note}</p>}
              <p>你可以修改昵称后重新提交申请。</p>
            </div>
            <form onSubmit={apply} className="gate-form">
              <div className="field">
                <label className="field-label">昵称</label>
                <input
                  className="text-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  placeholder="换一个昵称或保持原样"
                />
              </div>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? '提交中…' : '重新提交申请'}
              </button>
            </form>
          </div>
        )}

        {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}

        <div className="gate-foot">
          <span className="muted small mono">device: {shortDevice(deviceId)}</span>
          <button className="tab-btn" onClick={onAdminEntry}>管理员入口</button>
        </div>
      </div>
    </div>
  )
}
