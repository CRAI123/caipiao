import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import logoImg from './assets/logo.webp'
import { HISTORY_DRAWS, SAMPLE_DRAWS } from './data/sample.js'
import Overview from './components/Overview.jsx'
import DailyCheckin from './components/DailyCheckin.jsx'
import HotCold from './components/HotCold.jsx'
import Patterns from './components/Patterns.jsx'
import KlinePage from './components/KlinePage.jsx'
import Repeats from './components/Repeats.jsx'
import DanTuo from './components/DanTuo.jsx'
import Predict from './components/Predict.jsx'
import Audit from './components/Audit.jsx'
import LearningCenter from './components/LearningCenter.jsx'
import KL8Prize from './components/KL8Prize.jsx'
import Journal from './components/Journal.jsx'
import DataManager from './components/DataManager.jsx'
import Settings from './components/Settings.jsx'
import ChangelogDialog from './components/ChangelogDialog.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'
import { CHANGELOG } from './data/changelog.js'
import AccessGate from './components/AccessGate.jsx'
import Admin from './components/Admin.jsx'
import FC3D from './components/FC3D.jsx'
import FC3DOverview from './components/FC3DOverview.jsx'
import FC3DHotCold from './components/FC3DHotCold.jsx'
import FC3DPatterns from './components/FC3DPatterns.jsx'
import FC3DRepeats from './components/FC3DRepeats.jsx'
import FC3DDanTuo from './components/FC3DDanTuo.jsx'
import FC3DPrize from './components/FC3DPrize.jsx'
import FC3DAudit from './components/FC3DAudit.jsx'
import FC3DTerms from './components/FC3DTerms.jsx'
import FC3DDataManager from './components/FC3DDataManager.jsx'
import DLTOverview from './components/DLTOverview.jsx'
import DLTHotCold from './components/DLTHotCold.jsx'
import DLTPatterns from './components/DLTPatterns.jsx'
import DLTRepeats from './components/DLTRepeats.jsx'
import DLTDanTuo from './components/DLTDanTuo.jsx'
import DLTCrowding from './components/DLTCrowding.jsx'
import DLTPrize from './components/DLTPrize.jsx'
import DLTPredict from './components/DLTPredict.jsx'
import DLTAudit from './components/DLTAudit.jsx'
import DLTTerms from './components/DLTTerms.jsx'
import DLTDataManager from './components/DLTDataManager.jsx'
import { FC3D_DRAWS } from './data/fc3d.js'
import { PL3_DRAWS } from './data/pl3.js'
import { PL5_DRAWS } from './data/pl5.js'
import { DLT_DRAWS } from './data/dlt.js'
import { fetchPl3Draws } from './lib/pl3.js'
import { fetchPl5Draws } from './lib/pl5.js'
import { fetchFc3dDraws } from './lib/fc3d.js'
import { fetchKl8Draws } from './lib/kl8.js'
import { fetchDltDraws } from './lib/dlt.js'
import * as pl3Engine from './lib/pl3Predict.js'
import * as pl5Engine from './lib/pl5Predict.js'
import * as pl5Stats from './lib/pl5Stats.js'
import { loadJournal, getRecord } from './lib/journal.js'
import { loadSettings, isNeonReady } from './lib/settings.js'
import { getSql } from './lib/neon.js'
import { ensureAccessTables, fetchMyRequest, listAdmins } from './lib/access.js'
import { getDeviceId } from './lib/device.js'
import { checkAppUpdate } from './lib/update.js'

// 排列三专用推算引擎的算法说明（v1 与福彩3D共用，v2/v3 为排列三模式，pro 为增强档）
const PL3_ALGO_INFO = {
  v1: { name: '经典综合评分', desc: '热冷+跨度+和值+奇偶+形态+遗漏 8 维度加权评分' },
  v2: { name: '排列三 v3', desc: '多专家概率集成 + 1000 种结果穷举的精确预测分布' },
  pro: {
    name: '排列三 v3 Pro',
    desc: '9 专家 Hedge 自适应权重 + 六维结构约束 + 定位/Top 组合输出',
  },
  v4: {
    name: '排列三 v4 技术指标',
    desc: 'MA5/MA10 + 布林带 + MACD 投影和值/跨度区间，仅作走势参考',
  },
}

// 排列五推算引擎算法说明（只有直选玩法，5 位穷举 10 万注）
const PL5_ALGO_INFO = {
  pro: {
    name: '排列五 v3 Pro',
    desc: '9 专家 Hedge 自适应权重 + 六维结构约束 + 5 位穷举 10 万注',
    recommend: true,
  },
}

// ---------- 打开软件自动抓取：会话级去重（sessionStorage，Tauri 桌面端同样可用） ----------
const AUTO_FETCH_LABEL = { kl8: '快乐8', fc3d: '福彩3D', pl3: '排列三', pl5: '排列五', dlt: '大乐透' }
const AUTO_FETCH_PREFIX = 'caipiao.autofetch.'
function isAutoFetched(lottery) {
  try {
    return sessionStorage.getItem(AUTO_FETCH_PREFIX + lottery) === '1'
  } catch {
    return false
  }
}
function markAutoFetched(lottery) {
  try {
    sessionStorage.setItem(AUTO_FETCH_PREFIX + lottery, '1')
  } catch {
    /* sessionStorage 不可用时不去重，最多多抓一次 */
  }
}

// ---------- 更新公告已读记录（localStorage，Tauri 桌面端同样可用） ----------
const CHANGELOG_SEEN_KEY = 'caipiao.changelog.seen'
function readChangelogSeen() {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY) || ''
  } catch {
    return '' // 存储不可用时视为未读，最多多弹一次
  }
}
function writeChangelogSeen(version) {
  try {
    localStorage.setItem(CHANGELOG_SEEN_KEY, version)
  } catch {
    /* 忽略 */
  }
}

const TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'checkin', label: '每日打卡', en: 'CHECK-IN' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'kline', label: '走势K线', en: 'K-LINE' },
  { id: 'repeats', label: '重号斜连', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'prize', label: '概率奖金', en: 'ODDS' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
  { id: 'learning', label: '学习中心', en: 'LEARNING' },
  { id: 'journal', label: '购彩账本', en: 'LEDGER' },
  { id: 'data', label: '数据管理', en: 'DATA' },
  { id: 'admin', label: '后台', en: 'ADMIN' },
  { id: 'settings', label: '设置', en: 'SETTINGS' },
]

const FC3D_TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'kline', label: '走势K线', en: 'K-LINE' },
  { id: 'repeats', label: '重号分析', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'prize', label: '中奖计算', en: 'PRIZE' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
  { id: 'learning', label: '学习中心', en: 'LEARNING' },
  { id: 'terms', label: '术语大全', en: 'TERMS' },
  { id: 'data', label: '数据管理', en: 'DATA' },
]

const DLT_TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'kline', label: '走势K线', en: 'K-LINE' },
  { id: 'repeats', label: '重号分析', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'crowd', label: '选号避挤', en: 'CROWDING' },
  { id: 'prize', label: '中奖计算', en: 'PRIZE' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
  { id: 'learning', label: '学习中心', en: 'LEARNING' },
  { id: 'terms', label: '术语大全', en: 'TERMS' },
  { id: 'data', label: '数据管理', en: 'DATA' },
]

export default function App() {
  const [draws, setDraws] = useState(HISTORY_DRAWS.length ? HISTORY_DRAWS : SAMPLE_DRAWS)
  const [tab, setTab] = useState('overview')
  const [lottery, setLottery] = useState('kl8') // 'kl8' | 'fc3d' | 'pl3'
  const [fc3dDraws, setFc3dDraws] = useState(FC3D_DRAWS)
  const [fc3dTab, setFc3dTab] = useState('overview')
  const [pl3Draws, setPl3Draws] = useState(PL3_DRAWS)
  const [pl3Tab, setPl3Tab] = useState('overview')
  const [pl5Draws, setPl5Draws] = useState(PL5_DRAWS)
  const [pl5Tab, setPl5Tab] = useState('overview')
  const [pl5LoadErr, setPl5LoadErr] = useState('')
  const [dltDraws, setDltDraws] = useState(DLT_DRAWS)
  const [dltTab, setDltTab] = useState('overview')
  const [autoFetch, setAutoFetch] = useState(null) // 自动抓取状态条 { state: 'loading'|'ok'|'nonew'|'fail', text }
  const [tick, setTick] = useState(0) // 账本变化后刷新「待打卡」标记
  const usingSample = draws[0]?.sample
  const fc3dUsingSample = fc3dDraws[0]?.sample
  const pl3UsingSample = pl3Draws[0]?.sample
  const pl5UsingSample = pl5Draws[0]?.sample
  const dltUsingSample = dltDraws[0]?.sample

  // 数字型彩票（福彩3D / 排列三 / 排列五）共用同一套页面与算法，只切换数据源
  const isDigit = lottery === 'fc3d' || lottery === 'pl3' || lottery === 'pl5'
  const digitDraws = lottery === 'pl5' ? pl5Draws : lottery === 'pl3' ? pl3Draws : fc3dDraws
  const digitTab = lottery === 'pl5' ? pl5Tab : lottery === 'pl3' ? pl3Tab : fc3dTab
  const setDigitTab = lottery === 'pl5' ? setPl5Tab : lottery === 'pl3' ? setPl3Tab : setFc3dTab
  const digitLabel = lottery === 'pl5' ? '排列五' : lottery === 'pl3' ? '排列三' : '福彩3D'
  const digitUsingSample =
    lottery === 'pl5' ? pl5UsingSample : lottery === 'pl3' ? pl3UsingSample : fc3dUsingSample
  const digitCount = lottery === 'pl5' ? 5 : 3
  const digitPositions = lottery === 'pl5' ? pl5Stats.POSITIONS : undefined
  const digitPosLabels = lottery === 'pl5' ? pl5Stats.POSITIONS.map((p) => `${p}位`) : undefined
  const digitStats = lottery === 'pl5' ? pl5Stats : undefined

  // ---------- 访问控制 ----------
  // gate: loading(检查中) | open(已授权/本地模式) | gated(未授权，渲染门禁)
  const [gate, setGate] = useState('loading')
  const [device, setDevice] = useState(null) // { id }
  const [myReq, setMyReq] = useState(null) // 我的申请记录
  const [isAdmin, setIsAdmin] = useState(false)
  const [forceAdmin, setForceAdmin] = useState(false) // 门禁页直接打开后台

  // ---------- 更新公告：新版本自动弹一次，之后靠头部红点手动查看 ----------
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [seenVersion, setSeenVersion] = useState(readChangelogSeen)
  const changelogAutoShown = useRef(false)
  const changelogLatest = CHANGELOG[0]?.version || ''
  const changelogUnread = seenVersion !== changelogLatest

  // ---------- APK 新版本提示（仅原生端生效，网页端 checkAppUpdate 直接返回 null） ----------
  const [appUpdate, setAppUpdate] = useState(null)

  useEffect(() => {
    if (gate !== 'open') return undefined
    let alive = true
    const timer = setTimeout(() => {
      checkAppUpdate().then((u) => {
        if (alive && u) setAppUpdate(u)
      })
    }, 2000)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [gate])

  useEffect(() => {
    if (gate !== 'open' || !changelogLatest || changelogAutoShown.current) return
    if (readChangelogSeen() === changelogLatest) return
    changelogAutoShown.current = true
    setChangelogOpen(true)
  }, [gate, changelogLatest])

  const closeChangelog = useCallback(() => {
    setChangelogOpen(false)
    writeChangelogSeen(changelogLatest)
    setSeenVersion(changelogLatest)
  }, [changelogLatest])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  // ---------- AI 分析前置：强制同步最新开奖数据 ----------
  const refreshDigitDraws = useCallback(async () => {
    if (lottery === 'pl5') {
      const list = await fetchPl5Draws(100)
      if (list?.length) setPl5Draws(list)
      return list || pl5Draws
    }
    if (lottery === 'pl3') {
      const list = await fetchPl3Draws(100)
      if (list?.length) setPl3Draws(list)
      return list || pl3Draws
    }
    const list = await fetchFc3dDraws(100)
    if (list?.length) setFc3dDraws(list)
    return list || fc3dDraws
  }, [lottery, pl3Draws, pl5Draws, fc3dDraws])

  const refreshKl8Draws = useCallback(async () => {
    const list = await fetchKl8Draws(100)
    if (list?.length) setDraws(list)
    return list || draws
  }, [draws])

  const refreshDltDraws = useCallback(async () => {
    const list = await fetchDltDraws(100)
    if (list?.length) setDltDraws(list)
    return list || dltDraws
  }, [dltDraws])

  // 打开软件 / 切换彩种：本会话未自动抓过的彩种，进入时自动抓一次最新开奖
  // （排列五没有内置快照也由此覆盖；失败时沿用 pl5LoadErr 的空页错误路径）
  useEffect(() => {
    if (gate !== 'open') return
    if (isAutoFetched(lottery)) {
      setAutoFetch(null) // 抓过的彩种切回来：清掉上一条提示
      return
    }
    markAutoFetched(lottery)
    let alive = true
    const prevLatest =
      lottery === 'kl8'
        ? draws[0]?.id
        : lottery === 'dlt'
          ? dltDraws[0]?.id
          : lottery === 'pl5'
            ? pl5Draws[0]?.id
            : lottery === 'pl3'
              ? pl3Draws[0]?.id
              : fc3dDraws[0]?.id
    setAutoFetch({ state: 'loading', text: `正在自动抓取${AUTO_FETCH_LABEL[lottery]}最新开奖…` })
    ;(async () => {
      try {
        const list =
          lottery === 'kl8'
            ? await refreshKl8Draws()
            : lottery === 'dlt'
              ? await refreshDltDraws()
              : await refreshDigitDraws()
        if (!alive) return
        const latestId = list?.[0]?.id
        if (latestId == null) {
          setAutoFetch({
            state: 'fail',
            text: `${AUTO_FETCH_LABEL[lottery]}暂未取到开奖数据，可在「数据管理」手动抓取`,
          })
          if (lottery === 'pl5') setPl5LoadErr('未取到开奖数据')
          return
        }
        if (!prevLatest || latestId > prevLatest) {
          setAutoFetch({ state: 'ok', text: `${AUTO_FETCH_LABEL[lottery]}已更新到第 ${latestId} 期` })
        } else {
          setAutoFetch({
            state: 'nonew',
            text: `暂无新开奖，${AUTO_FETCH_LABEL[lottery]}数据已是最新（截至第 ${latestId} 期）`,
          })
        }
      } catch (e) {
        if (!alive) return
        // 静默降级：不弹错误框，只在状态条显示失败文案，用户仍可手动点按钮重试
        const msg = e?.message || String(e)
        setAutoFetch({ state: 'fail', text: `${AUTO_FETCH_LABEL[lottery]}自动抓取失败：${msg}` })
        if (lottery === 'pl5') setPl5LoadErr(msg)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, lottery])

  // 「已更新 / 暂无新数据」提示几秒后自动消失，不打扰
  useEffect(() => {
    if (!autoFetch || (autoFetch.state !== 'ok' && autoFetch.state !== 'nonew')) return undefined
    const t = setTimeout(() => setAutoFetch(null), 8000)
    return () => clearTimeout(t)
  }, [autoFetch])

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

  // 手机端页签是横向滚动的，切换后把当前页签滚到可视区域中间
  const navRef = useRef(null)
  const activeTabId = lottery === 'dlt' ? dltTab : isDigit ? digitTab : tab
  useEffect(() => {
    const nav = navRef.current
    if (!nav || nav.scrollWidth <= nav.clientWidth) return
    const el = nav.querySelector('.tab-btn.active')
    if (!el) return
    nav.scrollTo({
      left: Math.max(0, el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2),
      behavior: 'smooth',
    })
    // 手机端切页后回到内容顶部，避免停留在上一页的滚动位置
    if (window.innerWidth <= 820) window.scrollTo({ top: 0 })
  }, [activeTabId, lottery])

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
                ) : lottery === 'fc3d' ? (
                  <>福彩3D · 数据研究档案 <i>FC3D RESEARCH LEDGER</i></>
                ) : lottery === 'pl3' ? (
                  <>体彩排列三 · 数据研究档案 <i>PL3 RESEARCH LEDGER</i></>
                ) : lottery === 'pl5' ? (
                  <>体彩排列五 · 数据研究档案 <i>PL5 RESEARCH LEDGER</i></>
                ) : (
                  <>体彩大乐透 · 数据研究档案 <i>DLT RESEARCH LEDGER</i></>
                )}
              </p>
            </div>
          </div>
          <div className="masthead-meta mono">
            {lottery === 'kl8' ? (
              <>
                <div>80 选 20 · 每期开出 20 个号码</div>
                <div>选六中六概率 1 / 7,753</div>
                <div className={usingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{usingSample ? '内置演示数据' : '真实开奖数据'}
                </div>
              </>
            ) : lottery === 'dlt' ? (
              <>
                <div>35 选 5 前区 + 12 选 2 后区</div>
                <div>头奖概率 1 / 21,425,712</div>
                <div className={dltUsingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{dltUsingSample ? '内置演示数据' : '真实开奖数据'}
                </div>
              </>
            ) : lottery === 'pl5' ? (
              <>
                <div>5 位数 · 00000 – 99999</div>
                <div>直选概率 1 / 100,000</div>
                <div className={digitUsingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{digitUsingSample ? '内置演示数据' : '真实开奖数据'}
                </div>
              </>
            ) : (
              <>
                <div>3 位数 · 000 – 999</div>
                <div>直选概率 1 / 1,000</div>
                <div className={digitUsingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{digitUsingSample ? '内置演示数据' : '真实开奖数据'}
                </div>
              </>
            )}
            {/* 更新公告入口 */}
            <button className="changelog-btn" onClick={() => setChangelogOpen(true)} title="查看软件更新内容">
              更新公告
              {changelogUnread && <em className="tab-dot" title="有新更新" />}
            </button>
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
              <button
                role="tab"
                aria-selected={lottery === 'pl3'}
                className={`lottery-tab ${lottery === 'pl3' ? 'active' : ''}`}
                onClick={() => setLottery('pl3')}
              >
                排列三
              </button>
              <button
                role="tab"
                aria-selected={lottery === 'pl5'}
                className={`lottery-tab ${lottery === 'pl5' ? 'active' : ''}`}
                onClick={() => setLottery('pl5')}
              >
                排列五
              </button>
              <button
                role="tab"
                aria-selected={lottery === 'dlt'}
                className={`lottery-tab ${lottery === 'dlt' ? 'active' : ''}`}
                onClick={() => setLottery('dlt')}
              >
                大乐透
              </button>
              <span className={`lottery-indicator ${lottery}`} />
            </div>
          </div>
        </div>
      </header>

      {/* 导航 */}
      {lottery === 'kl8' && (
        <nav className="tabs" aria-label="页面导航" ref={navRef}>
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
      {isDigit && (
        <nav className="tabs" aria-label={`${digitLabel} 页面导航`} ref={navRef}>
          {FC3D_TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${digitTab === t.id ? 'active' : ''}`}
              onClick={() => setDigitTab(t.id)}
            >
              {t.label}
              <i>{t.en}</i>
            </button>
          ))}
        </nav>
      )}

      {lottery === 'dlt' && (
        <nav className="tabs" aria-label="大乐透 页面导航" ref={navRef}>
          {DLT_TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${dltTab === t.id ? 'active' : ''}`}
              onClick={() => setDltTab(t.id)}
            >
              {t.label}
              <i>{t.en}</i>
            </button>
          ))}
        </nav>
      )}

      <main className="main">
        {autoFetch && (
          <p
            className={`note note-${autoFetch.state === 'fail' ? 'warn' : 'info'}`}
            style={{ marginTop: 0 }}
          >
            {autoFetch.text}
          </p>
        )}
        {lottery === 'dlt' ? (
          <>
            {dltTab === 'overview' && <DLTOverview draws={dltDraws} />}
            {dltTab === 'hotcold' && <DLTHotCold draws={dltDraws} />}
            {dltTab === 'patterns' && <DLTPatterns draws={dltDraws} />}
            {dltTab === 'kline' && <KlinePage lottery="dlt" draws={dltDraws} />}
            {dltTab === 'repeats' && <DLTRepeats draws={dltDraws} />}
            {dltTab === 'dantuo' && <DLTDanTuo draws={dltDraws} />}
            {dltTab === 'crowd' && <DLTCrowding draws={dltDraws} />}
            {dltTab === 'prize' && <DLTPrize />}
            {dltTab === 'predict' && <DLTPredict draws={dltDraws} />}
            {dltTab === 'audit' && <DLTAudit draws={dltDraws} />}
            {dltTab === 'learning' && <LearningCenter game="dlt" />}
            {dltTab === 'terms' && <DLTTerms />}
            {dltTab === 'data' && <DLTDataManager draws={dltDraws} setDraws={setDltDraws} />}
          </>
        ) : isDigit ? (
          !digitDraws.length ? (
            <div className="page">
              <div className={pl5LoadErr ? 'note note-warn' : 'note'}>
                {pl5LoadErr
                  ? `排列五开奖数据拉取失败：${pl5LoadErr}`
                  : `正在拉取${digitLabel}最近 100 期开奖数据，请稍候…`}
              </div>
              {pl5LoadErr && (
                <button
                  className="tab-btn"
                  onClick={() => {
                    setPl5LoadErr('')
                    fetchPl5Draws(100)
                      .then((list) => list?.length && setPl5Draws(list))
                      .catch((e) => setPl5LoadErr(e?.message || '拉取失败'))
                  }}
                >
                  重新拉取
                </button>
              )}
            </div>
          ) : (
          <>
            {digitTab === 'overview' && (
              <FC3DOverview
                draws={digitDraws}
                positions={digitPositions}
                stats={digitStats}
                sumTheory={lottery === 'pl5' ? 22.5 : undefined}
                spanTheory={lottery === 'pl5' ? '约 6.6' : undefined}
                formName={lottery === 'pl5' ? '全不同' : undefined}
                formTheory={lottery === 'pl5' ? '约 30%' : undefined}
              />
            )}
            {digitTab === 'hotcold' && <FC3DHotCold draws={digitDraws} positions={digitPositions} />}
            {digitTab === 'patterns' && <FC3DPatterns draws={digitDraws} stats={digitStats} />}
            {digitTab === 'kline' && (
              <KlinePage lottery={lottery} draws={digitDraws} positions={digitPosLabels} />
            )}
            {digitTab === 'repeats' && (
              <FC3DRepeats draws={digitDraws} stats={digitStats} digitCount={digitCount} />
            )}
            {digitTab === 'dantuo' && <FC3DDanTuo label={digitLabel} digitCount={digitCount} />}
            {digitTab === 'prize' && (
              <FC3DPrize
                draws={digitDraws}
                lottery={lottery}
                label={digitLabel}
                digitCount={digitCount}
              />
            )}
            {digitTab === 'predict' &&
              (lottery === 'pl5' ? (
                <FC3D
                  draws={digitDraws}
                  engine={pl5Engine}
                  algoInfo={PL5_ALGO_INFO}
                  showTiers
                  label={digitLabel}
                  game="pl5"
                  onRefreshData={refreshDigitDraws}
                  positions={digitPositions}
                  digitCount={5}
                  defaultCover={4}
                  algoFn={{ pro: { predict: 'predictPL5', backtest: 'backtestPL5' } }}
                />
              ) : lottery === 'pl3' ? (
                <FC3D
                  draws={digitDraws}
                  engine={pl3Engine}
                  algoInfo={PL3_ALGO_INFO}
                  showTiers
                  label={digitLabel}
                  game="pl3"
                  onRefreshData={refreshDigitDraws}
                />
              ) : (
                <FC3D draws={digitDraws} label={digitLabel} game="fc3d" onRefreshData={refreshDigitDraws} />
              ))}
            {digitTab === 'audit' &&
              (lottery === 'pl5' ? (
                <FC3DAudit
                  game="pl5"
                  draws={digitDraws}
                  engine={pl5Engine}
                  defaultPeriods={20}
                  defaultAlgo="pro"
                  auditFns={{ pro: 'walkForwardAuditPL5' }}
                  predictFns={{ pro: 'predictPL5' }}
                  proEnabled
                  proLabel="排列五 v3 Pro"
                  compareEnabled={false}
                  ceilingEnabled={false}
                  digitCount={5}
                  periodsList={[10, 20, 30]}
                  formNote="五同/四同一异/…/全不同"
                />
              ) : lottery === 'pl3' ? (
                <FC3DAudit
                  game="pl3"
                  draws={digitDraws}
                  engine={pl3Engine}
                  defaultPeriods={80}
                  v2Label="精准 v3"
                  proEnabled
                  proLabel="排列三 v3 Pro"
                />
              ) : (
                <FC3DAudit game="fc3d" draws={digitDraws} />
              ))}
            {digitTab === 'learning' && <LearningCenter game={lottery} />}
            {digitTab === 'terms' && <FC3DTerms label={digitLabel} digitCount={digitCount} />}
            {digitTab === 'data' && (
              lottery === 'pl5' ? (
                <FC3DDataManager
                  draws={pl5Draws}
                  setDraws={setPl5Draws}
                  label="排列五"
                  fetchDraws={fetchPl5Draws}
                  sampleDraws={PL5_DRAWS}
                  filePrefix="pl5"
                  sourceUrl="https://www.lottery.gov.cn/kj/kjlb.html?pl5"
                  sourceName="中国体彩网开奖公告"
                  digitCount={5}
                  positions={pl5Stats.POSITIONS}
                />
              ) : lottery === 'pl3' ? (
                <FC3DDataManager
                  draws={pl3Draws}
                  setDraws={setPl3Draws}
                  label="排列三"
                  fetchDraws={fetchPl3Draws}
                  sampleDraws={PL3_DRAWS}
                  filePrefix="pl3"
                  sourceUrl="https://www.lottery.gov.cn/kj/kjlb.html?pl3"
                  sourceName="中国体彩网开奖公告"
                />
              ) : (
                <FC3DDataManager draws={fc3dDraws} setDraws={setFc3dDraws} />
              )
            )}
          </>
          )
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
            {tab === 'kline' && <KlinePage lottery="kl8" draws={draws} />}
            {tab === 'repeats' && <Repeats draws={draws} />}
            {tab === 'dantuo' && <DanTuo draws={draws} />}
            {tab === 'predict' && <Predict draws={draws} onRefreshData={refreshKl8Draws} />}
            {tab === 'prize' && <KL8Prize draws={draws} />}
            {tab === 'audit' && <Audit draws={draws} />}
            {tab === 'learning' && <LearningCenter game="kl8" />}
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

      {/* 手机端底部彩种导航（桌面端隐藏） */}
      <nav className="mobile-dock" aria-label="彩种切换">
        {[
          { id: 'kl8', label: '快乐8', glyph: '八' },
          { id: 'fc3d', label: '福彩3D', glyph: '3' },
          { id: 'pl3', label: '排列三', glyph: '三' },
          { id: 'pl5', label: '排列五', glyph: '五' },
          { id: 'dlt', label: '大乐透', glyph: '透' },
        ].map((it) => (
          <button
            key={it.id}
            type="button"
            className={`dock-item ${lottery === it.id ? 'active' : ''}`}
            aria-current={lottery === it.id ? 'page' : undefined}
            onClick={() => setLottery(it.id)}
          >
            <span className="dock-glyph" aria-hidden="true">
              {it.glyph}
            </span>
            <span className="dock-label">{it.label}</span>
          </button>
        ))}
      </nav>

      {/* 新版本提示：等更新公告关掉再弹，避免两个弹窗叠在一起 */}
      {appUpdate && !changelogOpen && (
        <UpdatePrompt update={appUpdate} onClose={() => setAppUpdate(null)} />
      )}

      <ChangelogDialog open={changelogOpen} onClose={closeChangelog} />
    </div>
  )
}
