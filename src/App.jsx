import React, { useCallback, useEffect, useMemo, useState } from 'react'
import logoImg from './assets/logo.webp'
import { HISTORY_DRAWS, SAMPLE_DRAWS } from './data/sample.js'
import Overview from './components/Overview.jsx'
import DailyCheckin from './components/DailyCheckin.jsx'
import HotCold from './components/HotCold.jsx'
import Patterns from './components/Patterns.jsx'
import Repeats from './components/Repeats.jsx'
import DanTuo from './components/DanTuo.jsx'
import Predict from './components/Predict.jsx'
import Audit from './components/Audit.jsx'
import Journal from './components/Journal.jsx'
import DataManager from './components/DataManager.jsx'
import Settings from './components/Settings.jsx'
import AccessGate from './components/AccessGate.jsx'
import Admin from './components/Admin.jsx'
import FC3D from './components/FC3D.jsx'
import { loadJournal, getRecord } from './lib/journal.js'
import { loadSettings, isNeonReady } from './lib/settings.js'
import { getSql } from './lib/neon.js'
import { ensureAccessTables, fetchMyRequest, listAdmins } from './lib/access.js'
import { getDeviceId } from './lib/device.js'

const TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'checkin', label: '每日打卡', en: 'CHECK-IN' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'repeats', label: '重号斜连', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
  { id: 'journal', label: '购彩账本', en: 'LEDGER' },
  { id: 'data', label: '数据管理', en: 'DATA' },
  { id: 'admin', label: '后台', en: 'ADMIN' },
  { id: 'settings', label: '设置', en: 'SETTINGS' },
]

export default function App() {
  const [draws, setDraws] = useState(HISTORY_DRAWS.length ? HISTORY_DRAWS : SAMPLE_DRAWS)
  const [tab, setTab] = useState('overview')
  const [lottery, setLottery] = useState('kl8') // 'kl8' | 'fc3d'
  const [tick, setTick] = useState(0) // 账本变化后刷新「待打卡」标记
  const usingSample = draws[0]?.sample

  // ---------- 访问控制 ----------
  // gate: loading(检查中) | open(已授权/本地模式) | gated(未授权，渲染门禁)
  const [gate, setGate] = useState('loading')
  const [device, setDevice] = useState(null) // { id }
  const [myReq, setMyReq] = useState(null) // 我的申请记录
  const [isAdmin, setIsAdmin] = useState(false)
  const [forceAdmin, setForceAdmin] = useState(false) // 门禁页直接打开后台

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  // 进入站点：取设备识别码 → 查 Neon 申请状态 / 管理员身份
  useEffect(() => {
    let alive = true
    ;(async () => {
      const dev = getDeviceId()
      if (!alive) return
      setDevice(dev)
      const settings = loadSettings()
      // 未配置 Neon：本地模式直接进入（不锁自己的站点）
      if (!isNeonReady(settings)) {
        setGate('open')
        return
      }
      try {
        const sql = getSql(settings.neonUrl)
        await ensureAccessTables(sql)
        const [req, admins] = await Promise.all([fetchMyRequest(sql, dev.id), listAdmins(sql)])
        if (!alive) return
        setMyReq(req)
        setIsAdmin(admins.some((a) => a.device_id === dev.id))
        setGate(req?.status === 'approved' ? 'open' : 'gated')
      } catch {
        // Neon 暂不可达时不锁死本地使用，进入本地模式
        if (alive) setGate('open')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // 门禁页点「刷新审核状态」：重新查一次，通过则放行
  const recheckAccess = useCallback(async () => {
    if (!device) return
    const settings = loadSettings()
    if (!isNeonReady(settings)) return setGate('open')
    try {
      const sql = getSql(settings.neonUrl)
      const req = await fetchMyRequest(sql, device.id)
      setMyReq(req)
      if (req?.status === 'approved') {
        setForceAdmin(false) // 自己的申请通过后回到主站，不再停留在后台
        setGate('open')
      }
    } catch {
      /* 保留当前门禁状态 */
    }
  }, [device])

  // 最新一期开奖后还没有打卡记录时，提醒用户去记录
  const pendingCheckin = useMemo(() => {
    const latest = draws[0]
    if (!latest?.date) return false
    return !getRecord(loadJournal(), latest.date)
  }, [draws, tick])

  // ---------- 门禁 / 后台优先渲染 ----------
  if (gate === 'loading') {
    return (
      <div className="gate">
        <div className="gate-card">
          <img className="masthead-mark gate-mark" src={logoImg} alt="研彩室" />
          <h1 className="gate-title">研彩室</h1>
          <p className="gate-sub">正在检查访问权限…</p>
        </div>
      </div>
    )
  }

  // 门禁页「管理员入口」直接打开后台（设置令牌 / 登录 / 审核）
  if (forceAdmin && device) {
    return (
      <Admin
        deviceId={device.id}
        isAdmin={isAdmin}
        onExit={() => setForceAdmin(false)}
        onAdminStatus={setIsAdmin}
      />
    )
  }

  if (gate === 'gated' && device) {
    return (
      <AccessGate
        deviceId={device.id}
        request={myReq}
        onApproved={recheckAccess}
        onStateChange={setMyReq}
        onAdminEntry={() => setForceAdmin(true)}
      />
    )
  }

  return (
    <div className="app">
      {/* 顶部警示条 */}
      <div className="warn-strip" role="alert">
        <span className="warn-strip-inner">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i}>
              ⚠️ 开奖为完全随机独立事件 · 本站所有统计仅供数据学习与复盘研究，不构成任何投注建议 · 理性购彩，量力而行，未满18周岁禁止购彩&nbsp;&nbsp;✦&nbsp;&nbsp;
            </span>
          ))}
        </span>
      </div>

      {/* 报头 */}
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-title">
            <img className="masthead-mark" src={logoImg} alt="研彩室" />
            <div>
              <h1>研彩室</h1>
              <p className="masthead-sub">
                {lottery === 'kl8' ? (
                  <>福彩快乐8 · 数据研究档案 <i>KUAILE 8 RESEARCH LEDGER</i></>
                ) : (
                  <>福彩3D · 术语参考 <i>FC3D REFERENCE</i></>
                )}
              </p>
            </div>
          </div>
          <div className="masthead-meta mono">
            {lottery === 'kl8' ? (
              <>
                <div>80 选 20 · 每期开出 20 个号码</div>
                <div>选十中十概率 1 / 8,911,711</div>
                <div className={usingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{usingSample ? '内置演示数据' : '真实开奖数据'}
                </div>
              </>
            ) : (
              <>
                <div>3 位数 · 000 – 999</div>
                <div>直选概率 1 / 1,000</div>
                <div className="meta-real">术语参考 · 理性购彩</div>
              </>
            )}
            {/* 彩票类型滑块 */}
            <div className="lottery-switch" role="tablist" aria-label="彩种切换">
              <button
                role="tab"
                aria-selected={lottery === 'kl8'}
                className={`lottery-tab ${lottery === 'kl8' ? 'active' : ''}`}
                onClick={() => setLottery('kl8')}
              >
                快乐8
              </button>
              <button
                role="tab"
                aria-selected={lottery === 'fc3d'}
                className={`lottery-tab ${lottery === 'fc3d' ? 'active' : ''}`}
                onClick={() => setLottery('fc3d')}
              >
                福彩3D
              </button>
              <span className={`lottery-indicator ${lottery}`} />
            </div>
          </div>
        </div>
      </header>

      {/* 导航 —— 仅快乐8 显示 */}
      {lottery === 'kl8' && (
        <nav className="tabs" aria-label="页面导航">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'checkin' && pendingCheckin && <em className="tab-dot" title="最新一期还没打卡" />}
              {t.id === 'admin' && isAdmin && <em className="tab-dot tab-dot-blue" title="管理员设备" />}
              <i>{t.en}</i>
            </button>
          ))}
        </nav>
      )}

      <main className="main">
        {lottery === 'fc3d' ? (
          <FC3D />
        ) : tab === 'admin' ? (
          <Admin
            deviceId={device?.id || ''}
            isAdmin={isAdmin}
            onExit={() => setTab('overview')}
            onAdminStatus={setIsAdmin}
          />
        ) : (
          <>
            {tab === 'overview' && (
              <>
                {pendingCheckin && <DailyCheckin draws={draws} onChanged={refresh} />}
                <Overview draws={draws} />
              </>
            )}
            {tab === 'checkin' && <DailyCheckin draws={draws} onChanged={refresh} />}
            {tab === 'hotcold' && <HotCold draws={draws} />}
            {tab === 'patterns' && <Patterns draws={draws} />}
            {tab === 'repeats' && <Repeats draws={draws} />}
            {tab === 'dantuo' && <DanTuo draws={draws} />}
            {tab === 'predict' && <Predict draws={draws} />}
            {tab === 'audit' && <Audit draws={draws} />}
            {tab === 'journal' && <Journal draws={draws} />}
            {tab === 'data' && <DataManager draws={draws} setDraws={setDraws} />}
            {tab === 'settings' && <Settings />}
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          本站为开源学习工具，与 中国福利彩票发行管理中心 无任何关联。历史数据统计不改变任何一期的开奖概率；购买彩票的唯一理性理由是娱乐。
        </p>
        <p className="mono">research · not betting advice · 18+ only</p>
      </footer>
    </div>
  )
}
