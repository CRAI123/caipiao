// 快乐8 概率与奖金：严格组合数学 + 统计分组的样本外校准
// 算法部分只做概率、期望、注数展开；不做“预测”承诺
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Note } from './common.jsx'
import {
  KL8_PLAY_LABEL,
  kl8PlayStats,
  kl8Fushi,
  kl8Dantuo,
  fmtMoney,
  fmtPct,
  fmtTickets,
} from '../lib/kl8Math.js'
import { kl8Calibration } from '../lib/kl8Calib.js'
import { optimizePortfolio } from '../lib/kl8Optimize.js'
import { kl8Arena } from '../lib/kl8Arena.js'
import { v7Recommend } from '../lib/kl8V7.js'
import { fetchPromo } from '../lib/api.js'

export default function KL8Prize({ draws }) {
  const [play, setPlay] = useState(10)
  const [fushiN, setFushiN] = useState(11)
  const [dan, setDan] = useState(0)
  const [tuo, setTuo] = useState(0)
  const [optPlay, setOptPlay] = useState(10)
  const [optBudget, setOptBudget] = useState(20)
  const [opt, setOpt] = useState(null)
  const [arenaPlay, setArenaPlay] = useState(10)
  const [arena, setArena] = useState(null)
  const [promo, setPromo] = useState(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoErr, setPromoErr] = useState('')

  async function loadPromo() {
    setPromoBusy(true)
    setPromoErr('')
    try {
      setPromo(await fetchPromo())
    } catch (e) {
      setPromoErr(e.message || '官方公告抓取失败')
    } finally {
      setPromoBusy(false)
    }
  }

  useEffect(() => {
    loadPromo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const table = useMemo(() => Array.from({ length: 10 }, (_, i) => kl8PlayStats(i + 1)), [])
  const calib = useMemo(() => kl8Calibration(draws), [draws])

  const fushi = kl8Fushi(play, Math.max(play, Math.min(20, fushiN)))
  const dantuo = kl8Dantuo(play, Math.min(dan, play), tuo)

  function runOptimize() {
    const poolNums =
      draws.length >= 20 ? v7Recommend(draws, { play: optPlay })?.pool.map((x) => x.n) || [] : []
    setOpt(optimizePortfolio({ play: optPlay, budget: optBudget, poolNums }))
  }

  function runArena() {
    setArena(kl8Arena(draws, arenaPlay, 500))
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="各玩法概率与期望回报" tag="严格组合数学">
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>玩法</th>
                <th>单注回报</th>
                <th>中任意奖</th>
                <th>返还率</th>
                <th>最低中奖</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.k}>
                  <td>
                    <b>{r.label}</b>
                  </td>
                  <td className="mono">{fmtMoney(r.ev)} 元</td>
                  <td className="mono">{fmtPct(r.anyWin)}</td>
                  <td className="mono">{fmtPct(r.returnRate)}</td>
                  <td className="muted small">中 {r.minHit} 个</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          单注 2 元，返还率 = 单注期望回报 ÷ 2。全部玩法都低于 100%，长期期望为负；
          这些数字来自超几何分布 C(k,m)×C(80−k,20−m)/C(80,20)，与选号方法无关。
        </Note>
      </Card>

      <Card
        title="加奖 / 派奖监控"
        tag={
          !promo || !promo.ok
            ? '官方公告'
            : promo.active
              ? '快乐8 派奖进行中'
              : '当前无快乐8 派奖'
        }
      >
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <button className="btn-primary" onClick={loadPromo} disabled={promoBusy}>
            {promoBusy ? '抓取中…' : '刷新公告'}
          </button>
          <span className="muted small">
            {promo?.checkedAt
              ? `检查于 ${new Date(promo.checkedAt).toLocaleString('zh-CN', { hour12: false })} · 来源中国福彩网`
              : '来源中国福彩网「通知公告」'}
          </span>
        </div>

        {promoErr ? (
          <Note tone="warn">{promoErr}</Note>
        ) : !promo ? (
          <Note>正在读取官方公告…</Note>
        ) : !promo.ok ? (
          <Note tone="warn">
            {promo.message || '官方公告暂时无法获取'}。
            <a
              href={promo.officialUrl || 'https://www.cwl.gov.cn/xxgk/tzgg/'}
              target="_blank"
              rel="noopener noreferrer"
            >
              点此查看官方通知公告
            </a>
            ；不影响下方概率计算。
          </Note>
        ) : promo.items.length === 0 ? (
          <Note>近 12 条派奖类公告里没有快乐8 相关内容，按固定奖金表计算返还率即可。</Note>
        ) : (
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>公告</th>
                  <th>游戏</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {promo.items.map((it) => (
                  <tr key={it.url}>
                    <td className="mono">{it.date}</td>
                    <td>
                      <a href={it.url} target="_blank" rel="noopener noreferrer">
                        {it.title}
                      </a>
                    </td>
                    <td className="muted small">{it.kl8 ? '快乐8' : '其他游戏'}</td>
                    <td>
                      <span style={{ color: it.kl8 && !it.ended ? '#c23a2b' : '#6b6b6b' }}>
                        {it.kl8 ? (it.ended ? '已结束' : '派奖中') : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Note>
          快乐8 固定奖金表的返还率约 {fmtPct(promo?.baseReturnRate || 0.5753)}，任何选号方法都改变不了它。
          只有在官方派奖期，部分玩法的实际返还率才可能被抬到 100% 以上——这是规则本身送的，
          和算法无关。所以「加奖」是唯一会真实改变期望值的外部因素，值得盯，但不值得为它加注。
        </Note>
      </Card>

      <Card title="复式 / 胆拖注数与金额" tag="组合计数">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="toolbar-label">玩法</span>
          <select className="text-input" value={play} onChange={(e) => setPlay(Number(e.target.value))} style={{ width: 100 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {KL8_PLAY_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="predict-row">
          <div className="predict-label">复式</div>
          <div className="predict-value">
            <span className="muted small">选</span>
            <input
              className="text-input"
              type="number"
              min={play}
              max={20}
              value={Math.max(play, Math.min(20, fushiN))}
              onChange={(e) => setFushiN(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <span className="muted small">个号</span>
            <span className="draw-num">{fmtTickets(fushi.tickets)} 注</span>
            <span className="muted small">金额 {fmtMoney(fushi.cost)} 元</span>
          </div>
        </div>

        <div className="predict-row">
          <div className="predict-label">胆拖</div>
          <div className="predict-value">
            <span className="muted small">胆</span>
            <input
              className="text-input"
              type="number"
              min={0}
              max={play}
              value={Math.min(dan, play)}
              onChange={(e) => setDan(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <span className="muted small">拖</span>
            <input
              className="text-input"
              type="number"
              min={0}
              max={20}
              value={tuo}
              onChange={(e) => setTuo(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <span className="draw-num">{fmtTickets(dantuo.tickets)} 注</span>
            <span className="muted small">
              {dantuo.invalid ? dantuo.invalid : `金额 ${fmtMoney(dantuo.cost)} 元`}
            </span>
          </div>
        </div>
        <Note>
          复式注数 = C(选号个数, 玩法)；胆拖注数 = C(拖码个数, 玩法 − 胆码个数)。
          注数只决定覆盖范围与成本，不改变每一注的命中概率。
        </Note>
      </Card>

      <Card title="组合优化器：预算内最大化「至少中一次」" tag="蒙特卡洛 4000 期 · 可复现">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="toolbar-label">玩法</span>
          <select
            className="text-input"
            value={optPlay}
            onChange={(e) => {
              setOptPlay(Number(e.target.value))
              setOpt(null)
            }}
            style={{ width: 100 }}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {KL8_PLAY_LABEL[k]}
              </option>
            ))}
          </select>
          <span className="toolbar-label">预算</span>
          <input
            className="text-input"
            type="number"
            min={2}
            step={2}
            max={50}
            value={optBudget}
            onChange={(e) => {
              setOptBudget(Number(e.target.value))
              setOpt(null)
            }}
            style={{ width: 90 }}
          />
          <span className="muted small">元（每注 2 元）</span>
          <button className="btn-primary" onClick={runOptimize}>
            优化组合
          </button>
        </div>

        {!opt ? (
          <Note>
            在候选票面里用模拟开奖做贪心覆盖：每步挑「对尚未中奖的情形贡献最大」的一注，
            目标是让「至少中一次任意奖级」的概率最高。同样注数的随机选号会作为对照。
          </Note>
        ) : (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-name">优化后至少中一次</div>
                <div className="metric-value">{fmtPct(opt.pAny, 1)}</div>
                <div className="metric-sub">±{(opt.se * 100).toFixed(1)} pt（模拟误差）</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">同注数随机对照</div>
                <div className="metric-value">{fmtPct(opt.pBase, 1)}</div>
                <div className="metric-sub">提升 {(opt.uplift * 100).toFixed(1)} 个百分点</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">注数 / 成本</div>
                <div className="metric-value">
                  {opt.tickets} 注 / {opt.cost} 元
                </div>
                <div className="metric-sub">单注中任意奖 {fmtPct(opt.perTicketAny)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">期望回报</div>
                <div className="metric-value">{fmtMoney(opt.ev)} 元</div>
                <div className="metric-sub">返还率 {fmtPct(opt.returnRate)}，与注数同比例增长</div>
              </div>
            </div>

            <div className="chip-row" style={{ marginTop: 12 }}>
              {opt.picks.map((t, i) => (
                <span key={i} className="chip">
                  <i>
                    第{i + 1}注 {t.map((n) => String(n).padStart(2, '0')).join(' ')}
                  </i>
                </span>
              ))}
            </div>

            <Note tone="warn">
              优化只作用在「覆盖」上：候选票面来自随机 40 张 + v7 推荐池 40 张，用 {opt.sims} 期模拟做贪心；
              区间与注数固定，所以提升的是「至少中一次」的概率，而不是命中数。
              期望回报 {fmtMoney(opt.ev)} 元仍小于成本 {opt.cost} 元——多买只会让中奖更频繁、亏得更稳定，
              不会让期望由负转正。
            </Note>
          </>
        )}
      </Card>

      <Card
        title="策略竞技场：严格前推回测"
        tag={arena ? `实际 ${arena.periods} 期` : '前推 · 显著性检验'}
      >
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="toolbar-label">玩法</span>
          <select
            className="text-input"
            value={arenaPlay}
            onChange={(e) => {
              setArenaPlay(Number(e.target.value))
              setArena(null)
            }}
            style={{ width: 100 }}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {KL8_PLAY_LABEL[k]}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={runArena}>
            开始回测
          </button>
          <span className="muted small">首次计算约需 1–3 秒</span>
        </div>

        {!arena ? (
          <Note>
            让 v7 综合评分、纯随机、热号、冷号、上期重号同场比拼：每一期只用该期之前的数据选号，
            再统计真实命中数。判定标准是 |z| ≥ 1.96（95% 置信度）。
          </Note>
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>策略</th>
                    <th>期数</th>
                    <th>平均命中</th>
                    <th>与随机期望 {arena.expected.toFixed(2)} 差</th>
                    <th>z 值</th>
                    <th>结论</th>
                  </tr>
                </thead>
                <tbody>
                  {arena.rows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td className="mono">{r.n}</td>
                      <td className="mono">{r.mean.toFixed(3)}</td>
                      <td className="mono" style={{ color: r.diff > 0 ? '#c23a2b' : '#1d6f3e' }}>
                        {r.diff >= 0 ? '+' : ''}
                        {r.diff.toFixed(3)}
                      </td>
                      <td className="mono">{r.z.toFixed(2)}</td>
                      <td className="muted small">{r.significant ? '显著（需复核）' : '与随机无差异'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note tone={arena.rows.some((r) => r.significant) ? 'warn' : 'info'}>
              {arena.verdict}。理论均值 = {arena.play} × 20/80 = {arena.expected.toFixed(2)}，
              理论标准差 {arena.sd.toFixed(3)}；同时比较 5 个策略会产生多重比较问题，
              偶然出现一个 |z| ≥ 1.96 的概率约为 1 − 0.95⁵ ≈ 23%，所以单个显著不能当作有效证据。
            </Note>
          </>
        )}
      </Card>

      <Card title="冷热分组的样本外校准" tag={calib ? `近 ${calib.periods} 期` : '数据不足'}>
        {!calib ? (
          <Note>至少需要 20 期开奖数据才能做前推校准。</Note>
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>遗漏档位</th>
                    <th>样本（期×号）</th>
                    <th>命中率</th>
                    <th>相对 25% 基线</th>
                  </tr>
                </thead>
                <tbody>
                  {calib.buckets.map((b) => (
                    <tr key={b.name}>
                      <td>
                        <b>{b.name}</b>
                        <span className="muted small">
                          {b.name === '刚开'
                            ? '（遗漏 0）'
                            : b.name === '温'
                              ? '（1–3 期）'
                              : b.name === '冷'
                                ? '（4–7 期）'
                                : '（≥8 期）'}
                        </span>
                      </td>
                      <td className="mono">{fmtTickets(b.n)}</td>
                      <td className="mono">{b.rate == null ? '—' : fmtPct(b.rate)}</td>
                      <td className="mono" style={{ color: b.rate > 0.25 ? '#c23a2b' : '#1d6f3e' }}>
                        {b.rate == null ? '—' : `${b.rate >= 0.25 ? '+' : ''}${((b.rate - 0.25) * 100).toFixed(2)} pt`}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>近 10 期热号池</b>
                      <span className="muted small">（前 20 名）</span>
                    </td>
                    <td className="mono">{fmtTickets(calib.hot.n)}</td>
                    <td className="mono">{fmtPct(calib.hot.rate)}</td>
                    <td className="mono" style={{ color: calib.hot.rate > 0.25 ? '#c23a2b' : '#1d6f3e' }}>
                      {`${calib.hot.rate >= 0.25 ? '+' : ''}${((calib.hot.rate - 0.25) * 100).toFixed(2)} pt`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="metric-grid" style={{ marginTop: 10 }}>
              <div className="metric-card">
                <div className="metric-name">动态分组 log-loss</div>
                <div className="metric-value">{calib.logLossDyn.toFixed(6)}</div>
                <div className="metric-sub">用上文各档命中率逐期前推</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">恒定 25% 基线</div>
                <div className="metric-value">{calib.logLossBase.toFixed(6)}</div>
                <div className="metric-sub">不做任何分组判断</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">差值</div>
                <div className="metric-value" style={{ color: calib.diff < 0 ? '#c23a2b' : '#1d6f3e' }}>
                  {calib.diff >= 0 ? '+' : ''}
                  {calib.diff.toFixed(6)}
                </div>
                <div className="metric-sub">负数才代表分组有信息量</div>
              </div>
              <div className="metric-card">
                <div className="metric-name">动态更优占比</div>
                <div className="metric-value">{fmtPct(calib.dynWinRate, 1)}</div>
                <div className="metric-sub">{fmtTickets(calib.samples)} 个样本</div>
              </div>
            </div>

            <Note>
              这段校准严格前推：每一期只使用它之前的数据估计分档命中率，再与「一律按 25%」比较。
              各档命中率通常围绕 25% 上下波动 0.1–0.5 个百分点，log-loss 差值接近 0 甚至为正——
              也就是说，冷热分组能区分样本，但不能预测下一期。这与公开复现的同类程序结论一致：
              动态概率只是有区分度的统计分组值，不构成提高中奖率的依据。
            </Note>
          </>
        )}
      </Card>
    </div>
  )
}
