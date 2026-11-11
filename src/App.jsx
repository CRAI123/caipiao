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
import FC3DOverview from './components/FC3DOverview.jsx'
import FC3DHotCold from './components/FC3DHotCold.jsx'
import FC3DPatterns from './components/FC3DPatterns.jsx'
import FC3DRepeats from './components/FC3DRepeats.jsx'
import FC3DDanTuo from './components/FC3DDanTuo.jsx'
import FC3DPrize from './components/FC3DPrize.jsx'
import FC3DAudit from './components/FC3DAudit.jsx'
import FC3DTerms from './components/FC3DTerms.jsx'
import FC3DDataManager from './components/FC3DDataManager.jsx'
import SSQOverview from './components/SSQOverview.jsx'
import SSQHotCold from './components/SSQHotCold.jsx'
import SSQPatterns from './components/SSQPatterns.jsx'
import SSQRepeats from './components/SSQRepeats.jsx'
import SSQDanTuo from './components/SSQDanTuo.jsx'
import SSQCrowding from './components/SSQCrowding.jsx'
import SSQPrize from './components/SSQPrize.jsx'
import SSQPredict from './components/SSQPredict.jsx'
import SSQAudit from './components/SSQAudit.jsx'
import SSQTerms from './components/SSQTerms.jsx'
import SSQDataManager from './components/SSQDataManager.jsx'
import { FC3D_DRAWS } from './data/fc3d.js'
import { PL3_DRAWS } from './data/pl3.js'
import { SSQ_DRAWS } from './data/ssq.js'
import { fetchPl3Draws } from './lib/pl3.js'
import { fetchSsqDraws } from './lib/ssq.js'
import * as pl3Engine from './lib/pl3Predict.js'
import { loadJournal, getRecord } from './lib/journal.js'
import { loadSettings, isNeonReady } from './lib/settings.js'
import { getSql } from './lib/neon.js'
import { ensureAccessTables, fetchMyRequest, listAdmins } from './lib/access.js'
import { getDeviceId } from './lib/device.js'

// 排列三专用推算引擎的算法说明（v1 与福彩3D共用，v2/v3 为排列三模式，pro 为增强档）
const PL3_ALGO_INFO = {
  v1: { name: '经典综合评分', desc: '热冷+跨度+和值+奇偶+形态+遗漏 8 维度加权评分' },
  v2: { name: '排列三 v3', desc: '多专家概率集成 + 1000 种结果穷举的精确预测分布' },
  pro: {
    name: '排列三 Pro',
    desc: '9 专家 Hedge 自适应权重 + 六维结构约束 + 定位/Top 组合输出',
    recommend: true,
  },
}

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

const FC3D_TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'repeats', label: '重号分析', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'prize', label: '中奖计算', en: 'PRIZE' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
  { id: 'terms', label: '术语大全', en: 'TERMS' },
  { id: 'data', label: '数据管理', en: 'DATA' },
]

const SSQ_TABS = [
  { id: 'overview', label: '总览', en: 'OVERVIEW' },
  { id: 'hotcold', label: '冷热遗漏', en: 'HOT & COLD' },
  { id: 'patterns', label: '形态走势', en: 'PATTERNS' },
  { id: 'repeats', label: '重号分析', en: 'REPEATS' },
  { id: 'dantuo', label: '复式胆拖', en: 'BETS' },
  { id: 'crowd', label: '选号避挤', en: 'CROWDING' },
  { id: 'prize', label: '中奖计算', en: 'PRIZE' },
  { id: 'predict', label: '下期推荐', en: 'PREDICT' },
  { id: 'audit', label: '方法体检', en: 'AUDIT' },
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
  const [ssqDraws, setSsqDraws] = useState(SSQ_DRAWS)
  const [ssqTab, setSsqTab] = useState('overview')
  const [tick, setTick] = useState(0) // 账本变化后刷新「待打卡」标记
  const usingSample = draws[0]?.sample
  const fc3dUsingSample = fc3dDraws[0]?.sample
  const pl3UsingSample = pl3Draws[0]?.sample
  const ssqUsingSample = ssqDraws[0]?.sample

  // 三位数彩票（福彩3D / 排列三）共用同一套页面与算法，只切换数据源
  const isDigit = lottery === 'fc3d' || lottery === 'pl3'
  const digitDraws = lottery === 'pl3' ? pl3Draws : fc3dDraws
  const digitTab = lottery === 'pl3' ? pl3Tab : fc3dTab
  const setDigitTab = lottery === 'pl3' ? setPl3Tab : setFc3dTab
  const digitLabel = lottery === 'pl3' ? '排列三' : '福彩3D'
  const digitUsingSample = lottery === 'pl3' ? pl3UsingSample : fc3dUsingSample

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
                ) : lottery === 'fc3d' ? (
                  <>福彩3D · 数据研究档案 <i>FC3D RESEARCH LEDGER</i></>
                ) : lottery === 'pl3' ? (
                  <>体彩排列三 · 数据研究档案 <i>PL3 RESEARCH LEDGER</i></>
                ) : (
                  <>福彩双色球 · 数据研究档案 <i>SSQ RESEARCH LEDGER</i></>
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
            ) : lottery === 'ssq' ? (
              <>
                <div>33 选 6 红 + 16 选 1 蓝</div>
                <div>头奖概率 1 / 17,721,088</div>
                <div className={ssqUsingSample ? 'meta-sample' : 'meta-real'}>
                  数据源：{ssqUsingSample ? '内置演示数据' : '真实开奖数据'}
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
                aria-selected={lottery === 'ssq'}
                className={`lottery-tab ${lottery === 'ssq' ? 'active' : ''}`}
                onClick={() => setLottery('ssq')}
              >
                双色球
              </button>
              <span className={`lottery-indicator ${lottery}`} />
            </div>
          </div>
        </div>
      </header>

      {/* 导航 */}
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
      {isDigit && (
        <nav className="tabs" aria-label={`${digitLabel} 页面导航`}>
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

      {lottery === 'ssq' && (
        <nav className="tabs" aria-label="双色球 页面导航">
          {SSQ_TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${ssqTab === t.id ? 'active' : ''}`}
              onClick={() => setSsqTab(t.id)}
            >
              {t.label}
              <i>{t.en}</i>
            </button>
          ))}
        </nav>
      )}

      <main className="main">
        {lottery === 'ssq' ? (
          <>
            {ssqTab === 'overview' && <SSQOverview draws={ssqDraws} />}
            {ssqTab === 'hotcold' && <SSQHotCold draws={ssqDraws} />}
            {ssqTab === 'patterns' && <SSQPatterns draws={ssqDraws} />}
            {ssqTab === 'repeats' && <SSQRepeats draws={ssqDraws} />}
            {ssqTab === 'dantuo' && <SSQDanTuo draws={ssqDraws} />}
            {ssqTab === 'crowd' && <SSQCrowding draws={ssqDraws} />}
            {ssqTab === 'prize' && <SSQPrize />}
            {ssqTab === 'predict' && <SSQPredict draws={ssqDraws} />}
            {ssqTab === 'audit' && <SSQAudit draws={ssqDraws} />}
            {ssqTab === 'terms' && <SSQTerms />}
            {ssqTab === 'data' && <SSQDataManager draws={ssqDraws} setDraws={setSsqDraws} />}
          </>
        ) : isDigit ? (
          <>
            {digitTab === 'overview' && <FC3DOverview draws={digitDraws} />}
            {digitTab === 'hotcold' && <FC3DHotCold draws={digitDraws} />}
            {digitTab === 'patterns' && <FC3DPatterns draws={digitDraws} />}
            {digitTab === 'repeats' && <FC3DRepeats draws={digitDraws} />}
            {digitTab === 'dantuo' && <FC3DDanTuo label={digitLabel} />}
            {digitTab === 'prize' && (
              <FC3DPrize draws={digitDraws} lottery={lottery} label={digitLabel} />
            )}
            {digitTab === 'predict' &&
              (lottery === 'pl3' ? (
                <FC3D draws={digitDraws} engine={pl3Engine} algoInfo={PL3_ALGO_INFO} showTiers />
              ) : (
                <FC3D draws={digitDraws} />
              ))}
            {digitTab === 'audit' &&
              (lottery === 'pl3' ? (
                <FC3DAudit
                  draws={digitDraws}
                  engine={pl3Engine}
                  defaultPeriods={80}
                  v2Label="精准 v3"
                  proEnabled
                  proLabel="排列三 Pro"
                />
              ) : (
                <FC3DAudit draws={digitDraws} />
              ))}
            {digitTab === 'terms' && <FC3DTerms label={digitLabel} />}
            {digitTab === 'data' && (
              lottery === 'pl3' ? (
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
