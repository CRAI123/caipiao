// 后台管理 —— 管理员令牌登录（首次可设置）+ 访问申请审核面板
// 身份判定：令牌正确，或本设备已在 admins 表中（App 已替你查过 isAdmin）。
import React, { useEffect, useState } from 'react'
import { Card, Note } from './common.jsx'
import { shortDevice } from '../lib/device.js'
import { loadSettings, isNeonReady } from '../lib/settings.js'
import { getSql } from '../lib/neon.js'
import {
  ensureAccessTables,
  hasAdminToken,
  setupAdmin,
  verifyAdminToken,
  addAdminDevice,
  listRequests,
  decideRequest,
  resetRequest,
  listAdmins,
  removeAdmin,
  countJournal,
} from '../lib/access.js'

const STATUS_LABEL = { pending: '待审核', approved: '已同意', rejected: '已拒绝' }

export default function Admin({ deviceId, isAdmin, onExit, onAdminStatus }) {
  const [phase, setPhase] = useState(isAdmin ? 'dashboard' : 'checking')
  const [token, setToken] = useState('')
  const [nickname, setNickname] = useState('管理员')
  const [tokenExists, setTokenExists] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [requests, setRequests] = useState([])
  const [admins, setAdmins] = useState([])
  const [journalCount, setJournalCount] = useState(0)
  const [notes, setNotes] = useState({})

  function sqlOrNull() {
    const settings = loadSettings()
    if (!isNeonReady(settings)) {
      setMsg({ tone: 'warn', text: '尚未配置 Neon 连接串，后台不可用（请到「设置」页完成接入）' })
      return null
    }
    return getSql(settings.neonUrl)
  }

  async function refresh() {
    const sql = sqlOrNull()
    if (!sql) return
    try {
      await ensureAccessTables(sql)
      const [reqs, ads, n] = await Promise.all([listRequests(sql), listAdmins(sql), countJournal(sql)])
      setRequests(reqs)
      setAdmins(ads)
      setJournalCount(n)
    } catch (e) {
      setMsg({ tone: 'warn', text: `加载失败：${e.message}` })
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (isAdmin) {
        if (alive) setPhase('dashboard')
        return
      }
      const sql = sqlOrNull()
      if (!sql || !alive) return
      try {
        await ensureAccessTables(sql)
        const exists = await hasAdminToken(sql)
        if (!alive) return
        setTokenExists(exists)
        setPhase(exists ? 'login' : 'setup')
      } catch (e) {
        if (alive) setMsg({ tone: 'warn', text: `连接后台失败：${e.message}` })
      }
    })()
    return () => {
      alive = false
    }
  }, [isAdmin])

  useEffect(() => {
    if (phase === 'dashboard') refresh()
  }, [phase])

  async function doSetup(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const sql = sqlOrNull()
      if (!sql) return
      await ensureAccessTables(sql)
      await setupAdmin(sql, { token, deviceId, nickname })
      onAdminStatus?.(true)
      setPhase('dashboard')
      setMsg({ tone: 'info', text: '管理员令牌已设置，本设备已成为管理员' })
    } catch (err) {
      setMsg({ tone: 'warn', text: `设置失败：${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function doLogin(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const sql = sqlOrNull()
      if (!sql) return
      const res = await verifyAdminToken(sql, token)
      if (!res.ok) {
        setMsg({ tone: 'warn', text: res.reason === 'not-setup' ? '尚未设置管理员令牌' : '令牌不正确' })
        return
      }
      await addAdminDevice(sql, { deviceId, nickname: '管理员' })
      onAdminStatus?.(true)
      setPhase('dashboard')
      setMsg({ tone: 'info', text: '登录成功，本设备已记住管理员身份' })
    } catch (err) {
      setMsg({ tone: 'warn', text: `登录失败：${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function decide(deviceId, status) {
    setBusy(true)
    try {
      const sql = sqlOrNull()
      if (!sql) return
      await decideRequest(sql, { deviceId, status, note: notes[deviceId] || '' })
      await refresh()
      setMsg({ tone: 'info', text: `已${status === 'approved' ? '同意' : '拒绝'} ${shortDevice(deviceId)}` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `操作失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function reset(deviceId) {
    setBusy(true)
    try {
      const sql = sqlOrNull()
      if (!sql) return
      await resetRequest(sql, deviceId)
      await refresh()
      setMsg({ tone: 'info', text: '已重置为待审核' })
    } catch (e) {
      setMsg({ tone: 'warn', text: `操作失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function remove(target) {
    if (!confirm(`移除管理员 ${shortDevice(target)}？该设备需要重新用令牌登录。`)) return
    setBusy(true)
    try {
      const sql = sqlOrNull()
      if (!sql) return
      await removeAdmin(sql, target)
      await refresh()
      if (target === deviceId) onAdminStatus?.(false)
    } catch (e) {
      setMsg({ tone: 'warn', text: `操作失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="page">
      <div className="toolbar">
        <span className="toolbar-label">后台管理</span>
        <span className="toolbar-note">device: {deviceId}</span>
        <span className="toolbar-sep" />
        <button className="tab-btn" onClick={onExit}>返回站点</button>
      </div>

      {phase === 'setup' && (
        <Card title="首次使用：设置管理员令牌" tag="全站仅可设置一次">
          <form onSubmit={doSetup}>
            <div className="field">
              <label className="field-label">管理员令牌（至少 4 位，建议 12 位以上；只存 SHA-256 哈希，忘了解不了）</label>
              <input
                className="text-input mono"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="例如：kl8-admin-2026"
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">管理员昵称</label>
              <input className="text-input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
            </div>
            <button className="btn-primary" type="submit" disabled={busy || token.length < 4}>
              {busy ? '设置中…' : '设置并进入后台'}
            </button>
          </form>
          <Note>
            令牌用于在任意设备登录后台（审核申请）。本设备会被记为管理员，之后打开本站点可直接进入后台。
            访客侧看不到任何后台入口数据——他们只会看到「申请 / 等待 / 被拒」页面。
          </Note>
        </Card>
      )}

      {phase === 'login' && (
        <Card title="管理员登录" tag={tokenExists === false ? '未设置令牌' : '输入令牌'}>
          <form onSubmit={doLogin}>
            <div className="field">
              <label className="field-label">管理员令牌</label>
              <input
                className="text-input mono"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn-primary" type="submit" disabled={busy || !token}>
              {busy ? '校验中…' : '登录后台'}
            </button>
          </form>
          <Note>令牌只以 SHA-256 哈希形式存放在 Neon 的 admin_config 表中，无法反推。</Note>
        </Card>
      )}

      {phase === 'dashboard' && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">待审核申请</div>
              <div className="stat-value">{pending}</div>
              <div className="stat-note">共 {requests.length} 条申请</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-label">已同意用户</div>
              <div className="stat-value">{requests.filter((r) => r.status === 'approved').length}</div>
              <div className="stat-note">按设备识别码区分</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-label">管理员设备</div>
              <div className="stat-value">{admins.length}</div>
              <div className="stat-note">免令牌直登后台</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">账本记录</div>
              <div className="stat-value">{journalCount}</div>
              <div className="stat-note">Neon kl8_journal 表</div>
            </div>
          </div>

          <Card title="访问申请" tag={`${requests.length} 条 · 最新在前`}>
            <div className="table-scroll tall">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>昵称</th>
                    <th>设备识别码</th>
                    <th>申请时间</th>
                    <th>状态</th>
                    <th>审核备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">还没有人提交申请</td>
                    </tr>
                  )}
                  {requests.map((r) => (
                    <tr key={r.device_id}>
                      <td>{r.nickname}</td>
                      <td className="mono small" title={r.device_id}>{r.device_id}</td>
                      <td className="mono small">{new Date(r.requested_at).toLocaleString('zh-CN')}</td>
                      <td>
                        <span className={`sync-badge ${r.status === 'approved' ? '' : 'badge-muted'}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                      <td className="small muted">{r.admin_note || '—'}</td>
                      <td>
                        <div className="record-actions">
                          <input
                            className="text-input mono"
                            style={{ width: 110, padding: '2px 6px', fontSize: 12 }}
                            placeholder="备注(可选)"
                            value={notes[r.device_id] || ''}
                            onChange={(e) => setNotes({ ...notes, [r.device_id]: e.target.value })}
                          />
                          {r.status !== 'approved' && (
                            <button className="tab-btn" onClick={() => decide(r.device_id, 'approved')} disabled={busy}>同意</button>
                          )}
                          {r.status !== 'rejected' && (
                            <button className="tab-btn" onClick={() => decide(r.device_id, 'rejected')} disabled={busy}>拒绝</button>
                          )}
                          {r.status !== 'pending' && (
                            <button className="tab-btn" onClick={() => reset(r.device_id)} disabled={busy}>重置</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="管理员设备" tag={`${admins.length} 台`}>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>设备识别码</th>
                    <th>昵称</th>
                    <th>添加时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.device_id}>
                      <td className="mono small">{a.device_id}{a.device_id === deviceId && <span className="sync-badge" style={{ marginLeft: 6 }}>本机</span>}</td>
                      <td>{a.nickname}</td>
                      <td className="mono small">{new Date(a.created_at).toLocaleString('zh-CN')}</td>
                      <td>
                        <button className="tab-btn" onClick={() => remove(a.device_id)} disabled={busy}>移除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              移除后该设备需重新输入令牌才能进后台。申请数据存放在 Neon 的 access_requests 表，
              与账本（kl8_journal）相互独立。
            </Note>
          </Card>
        </>
      )}

      {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
    </div>
  )
}
