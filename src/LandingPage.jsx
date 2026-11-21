import React, { useEffect, useState } from 'react'
import logoImg from './assets/logo.webp'
import './landing.css'

const DESKTOP_DOWNLOAD = '/updates/yanchaishi_0.1.51_x64-setup.exe'

const RESEARCH_STEPS = [
  { id: '01', title: '同步开奖', text: '汇集公开开奖数据，保留完整期号与号码档案。' },
  { id: '02', title: '观察冷热', text: '按位置查看出现频次、当前遗漏与历史分布。' },
  { id: '03', title: '拆解形态', text: '从和值、跨度、奇偶与重号等角度理解结构。' },
  { id: '04', title: '回测方法', text: '用逐期滚动回测检验方法，而不是只看单次结果。' },
  { id: '05', title: '记录复盘', text: '留下研究记录与购彩账本，让每次判断有据可查。' },
]

const FEATURES = [
  {
    id: '01',
    title: '把数据看清楚',
    text: '从一期号码到长期分布，用清晰的图表代替杂乱表格。',
    items: ['冷热遗漏与位置频次', '形态走势与重号斜连', '和值、跨度与分布观察'],
    type: 'chart',
  },
  {
    id: '02',
    title: '把方法算明白',
    text: '研究工具不只给出结果，也保留计算过程与历史表现。',
    items: ['复式胆拖与奖金计算', '逐期回测与方法体检', '样本外表现对照'],
    type: 'audit',
  },
  {
    id: '03',
    title: '把复盘留下来',
    text: '将研究、记录和理性边界放在同一个工作空间里。',
    items: ['每日研究打卡', '购彩账本与投入记录', '数据中心与本地管理'],
    type: 'journal',
  },
]

const LOTTERIES = [
  { name: '快乐8', en: 'KUAILE 8', note: '80 选 20 · 多玩法统计', mark: '8' },
  { name: '福彩3D', en: 'FC3D', note: '三位数 · 定位与形态', mark: '3D' },
  { name: '排列三', en: 'PL3', note: '三位数 · 组合与回测', mark: 'P3' },
  { name: '排列五', en: 'PL5', note: '五位数 · 分位研究', mark: 'P5' },
  { name: '双色球', en: 'SSQ', note: '红球 + 蓝球 · 结构分析', mark: '双' },
]

function Arrow() {
  return <span aria-hidden="true">→</span>
}

function FeatureVisual({ type }) {
  if (type === 'chart') {
    return (
      <div className="feature-visual chart-visual" aria-hidden="true">
        <div className="mini-bars">
          {[34, 62, 45, 82, 56, 92, 70, 40, 66, 50].map((height, i) => (
            <i key={i} style={{ height: `${height}%` }} className={i === 5 ? 'hot' : ''} />
          ))}
        </div>
        <div className="mini-axis"><span>01</span><span>号码分布</span><span>80</span></div>
      </div>
    )
  }
  if (type === 'audit') {
    return (
      <div className="feature-visual audit-visual" aria-hidden="true">
        <div className="audit-line"><span>样本内训练</span><i /><b>历史区间</b></div>
        <div className="audit-line active"><span>样本外验证</span><i /><b>逐期推进</b></div>
        <div className="audit-line"><span>结果汇总</span><i /><b>如实记录</b></div>
      </div>
    )
  }
  return (
    <div className="feature-visual journal-visual" aria-hidden="true">
      <div className="journal-slip">
        <span>研究手账</span><b>记录，而不是冲动</b>
        <i /><i /><i className="short" />
      </div>
      <div className="journal-stamp">复盘</div>
    </div>
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing-page" id="top">
      <header className="landing-header">
        <div className="landing-nav landing-container">
          <a className="landing-brand" href="#top" aria-label="研彩室首页" onClick={closeMenu}>
            <img src={logoImg} alt="" />
            <strong>研彩室</strong>
            <span>RAYZO RESEARCH</span>
          </a>
          <nav className="landing-links" aria-label="介绍页导航">
            <a href="#research">研究流程</a>
            <a href="#features">产品功能</a>
            <a href="#lotteries">支持彩种</a>
            <a href={DESKTOP_DOWNLOAD}>桌面版</a>
          </nav>
          <a className="landing-nav-cta" href="/app">进入研彩室 <span aria-hidden="true">↗</span></a>
          <button
            className={`landing-menu-button ${menuOpen ? 'open' : ''}`}
            type="button"
            aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <i /><i />
          </button>
        </div>
        {menuOpen && (
          <nav className="landing-mobile-nav" id="landing-mobile-nav" aria-label="移动端介绍页导航">
            <a href="#research" onClick={closeMenu}>研究流程</a>
            <a href="#features" onClick={closeMenu}>产品功能</a>
            <a href="#lotteries" onClick={closeMenu}>支持彩种</a>
            <a href={DESKTOP_DOWNLOAD} onClick={closeMenu}>下载桌面版</a>
            <a className="mobile-enter" href="/app">进入研彩室 <Arrow /></a>
          </nav>
        )}
      </header>

      <main>
        <section className="landing-hero landing-container">
          <div className="hero-copy">
            <p className="landing-eyebrow"><span />NUMBERS, NOT NOISE</p>
            <h1>把纷繁的开奖数据<br /><strong>收进一间研究室</strong></h1>
            <p className="hero-description">
              研彩室是一套彩票数据统计与复盘工具。把冷热、形态、回测和账本整理在同一个屏幕里，让每一次研究都清楚、有记录，也保留对随机的敬畏。
            </p>
            <div className="hero-actions">
              <a className="landing-button primary" href="/app">开始研究 <Arrow /></a>
              <a className="landing-button secondary" href="#features">看看具体能做什么 <Arrow /></a>
            </div>
            <ul className="hero-assurances">
              <li>网页打开即用</li>
              <li>Windows / Android</li>
              <li>统计不构成投注建议</li>
            </ul>
          </div>

          <div className="hero-product" aria-label="研彩室数据面板演示图">
            <div className="product-glow" aria-hidden="true" />
            <div className="product-window">
              <div className="product-topline">
                <div className="product-title">
                  <span className="product-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 18V9m5 9V5m6 13v-7m5 7V3" /></svg>
                  </span>
                  <div><strong>快乐8 · 冷热遗漏</strong><small>历史开奖数据档案</small></div>
                </div>
                <span className="product-range">近 100 期</span>
              </div>
              <div className="product-draw">
                <div className="draw-meta"><span>最新归档</span><b className="mono">NO. 2026320</b></div>
                <div className="draw-balls" aria-hidden="true">
                  {['03', '08', '19', '27', '36', '42', '58', '69'].map((number, i) => (
                    <span key={number} className={i === 1 || i === 4 ? 'accent' : ''}>{number}</span>
                  ))}
                </div>
              </div>
              <div className="product-analysis">
                <div className="analysis-row">
                  <span className="analysis-time mono">HOT</span>
                  <i className="analysis-dot red" />
                  <div><strong>热号观察</strong><small>08 · 19 · 36 · 42 · 58</small></div>
                  <div className="analysis-meter"><i style={{ width: '78%' }} /></div>
                </div>
                <div className="analysis-row selected">
                  <span className="analysis-time mono">FORM</span>
                  <i className="analysis-dot red" />
                  <div><strong>形态分布</strong><small>奇偶比 · 和值 · 区间比</small></div>
                  <span className="analysis-link">查看</span>
                </div>
                <div className="analysis-row">
                  <span className="analysis-time mono">COLD</span>
                  <i className="analysis-dot blue" />
                  <div><strong>遗漏档案</strong><small>当前遗漏与历史最大遗漏</small></div>
                  <div className="analysis-meter blue"><i style={{ width: '48%' }} /></div>
                </div>
              </div>
              <div className="product-footer">
                <span><i /> 演示视图 · 数据仅供研究</span>
                <b>完整分析 <Arrow /></b>
              </div>
            </div>
            <div className="product-note mono" aria-hidden="true">RESEARCH LEDGER / 2026</div>
          </div>
        </section>

        <section className="landing-stats landing-container" aria-label="产品概览">
          <div><strong>5<small>种</small></strong><span>主流彩票数据</span></div>
          <div><strong>10<small>+</small></strong><span>统计研究视角</span></div>
          <div><strong>3<small>端</small></strong><span>网页、桌面与手机</span></div>
          <div><strong>0<small>次</small></strong><span>中奖结果承诺</span></div>
        </section>

        <section className="research-section" id="research">
          <div className="landing-container">
            <div className="section-heading dark">
              <div>
                <p className="landing-eyebrow"><span />THE RESEARCH PATH</p>
                <h2>从一份开奖记录，<br />到一次完整的研究复盘</h2>
              </div>
              <p>五个环节共用同一份数据档案，少一点凭感觉，多一点可验证。</p>
            </div>
            <div className="research-steps">
              {RESEARCH_STEPS.map((step) => (
                <article key={step.id}>
                  <div className="step-top mono"><span>{step.id}</span><i /></div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
            <div className="research-board">
              <div className="research-board-copy">
                <p className="board-label mono">DATA, IN CONTEXT</p>
                <h3>号码之外，<br />还有一条被看见的曲线</h3>
                <p>把单期结果放回历史区间，观察分布、变化与偏差。图表呈现的是过去，不是下一期的答案。</p>
                <div className="board-tags"><span>遗漏走势</span><span>区间分布</span><span>形态变化</span></div>
              </div>
              <div className="research-chart" aria-label="趋势图演示">
                <div className="chart-caption"><span>形态指数 · 演示</span><b className="mono">20 DRAWS</b></div>
                <svg viewBox="0 0 560 240" role="img" aria-label="抽象的历史数据趋势折线，不代表预测">
                  <defs>
                    <linearGradient id="researchArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e95745" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#e95745" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[40, 90, 140, 190].map((y) => <line key={y} x1="20" x2="540" y1={y} y2={y} className="chart-grid" />)}
                  <path className="chart-area" d="M20,192 L85,160 L150,176 L215,105 L280,130 L345,76 L410,98 L475,45 L540,64 L540,220 L20,220 Z" />
                  <polyline className="chart-line" points="20,192 85,160 150,176 215,105 280,130 345,76 410,98 475,45 540,64" />
                  {[[20,192],[85,160],[150,176],[215,105],[280,130],[345,76],[410,98],[475,45],[540,64]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" />)}
                </svg>
                <div className="chart-foot mono"><span>过去的表现</span><span>不等于未来的结果</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section landing-container" id="features">
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow"><span />WHAT'S INSIDE</p>
              <h2>三块内容，围绕同一份数据档案</h2>
            </div>
            <p>不是把工具堆在一起，而是让观察、验证和记录彼此连接。</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <article className="feature-card" key={feature.id}>
                <span className="feature-index mono">{feature.id}</span>
                <FeatureVisual type={feature.type} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <ul>{feature.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="lottery-section landing-container" id="lotteries">
          <div className="lottery-copy">
            <p className="landing-eyebrow"><span />FIVE GAMES, ONE WORKSPACE</p>
            <h2>五种彩种，<br />一套清晰的研究路径</h2>
            <p>不同玩法有各自的数据结构，不需要在多个网站和表格之间来回切换。选择彩种，就进入对应的统计视图。</p>
            <a href="/app">选择彩种，开始研究 <Arrow /></a>
          </div>
          <div className="lottery-list">
            <div className="lottery-list-head"><span>研彩室 · 彩种目录</span><b className="mono">05 GAMES</b></div>
            {LOTTERIES.map((lottery, index) => (
              <a href="/app" className="lottery-row" key={lottery.name} aria-label={`进入研彩室研究${lottery.name}`}>
                <span className="lottery-number mono">0{index + 1}</span>
                <span className="lottery-mark">{lottery.mark}</span>
                <span className="lottery-name"><strong>{lottery.name}</strong><small>{lottery.note}</small></span>
                <span className="lottery-en mono">{lottery.en}</span>
                <Arrow />
            </a>
            ))}
          </div>
        </section>

        <section className="landing-final landing-container">
          <div>
            <p className="landing-eyebrow"><span />START YOUR LEDGER</p>
            <h2>把每一次研究，<br />留在自己的档案里</h2>
            <p>网页无需安装，桌面端更专注。所有历史统计仅供学习与复盘，请理性看待随机，量力而行。</p>
          </div>
          <div className="final-actions">
            <a className="landing-button dark" href="/app">进入研彩室 <Arrow /></a>
            <a className="landing-button secondary" href={DESKTOP_DOWNLOAD}>下载 Windows 版 <span aria-hidden="true">↓</span></a>
            <small>Android 端可在手机浏览器中使用相同研究功能</small>
          </div>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <div className="footer-brand"><img src={logoImg} alt="" /><strong>研彩室</strong><span>用数据理解随机</span></div>
        <div className="footer-links"><a href="/app">网页版</a><a href={DESKTOP_DOWNLOAD}>桌面版</a><span>18+ · 理性购彩</span></div>
        <p>© 2026 研彩室 · 与任何彩票发行机构无关联 · 统计研究不构成投注建议</p>
      </footer>
    </div>
  )
}
