// 购彩账本 —— 记录总览：统计卡 / 命中分布 vs 理论 / 按玩法 / 补录 / AI 报告历史
// ⚠️ 账本只复盘真实购买行为；命中波动属随机现象，不代表方法有效或失效。
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Note, Ball, StatCard, yuan } from './common.jsx'
import {
  loadJournal,
  persistJournal,
  upsertRecord,
  removeRecord,
  journalStats,
  fc3dStats,
  lotteryOf,
  LOTTERY_LABEL,
  exportJson,
} from '../lib/journal.js'
import { loadSettings, isNeonReady, isLlmReady } from '../lib/settings.js'
import { syncRecordToNeon, syncAllToNeon, analyzeRecord, syncToLark, resolveLarkSettings } from '../lib/sync.js'
import { getReviews } from '../lib/api.js'
import { openUrl } from '../lib/tauri.js'
import DailyCheckin from './DailyCheckin.jsx'

export default function Journal({ draws }) {
  const [list, setList] = useState(loadJournal)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [backfillId, setBackfillId] = useState('')
  const [larkReady, setLarkReady] = useState(false)
  const [larkCfg, setLarkCfg] = useState(null)
  const [reviews, setReviews] = useState([])
  const [lotFilter, setLotFilter] = useState('all') // all | kl8 | fc3d

  // 检查飞书配置是否就绪（含管理员共享配置）
  useEffect(() => {
    ;(async () => {
      const s = await resolveLarkSettings()
      const ready = !!(s.feishuAppId && s.feishuAppSecret && s.feishuAppToken && s.feishuTableId)
      setLarkReady(ready)
      setLarkCfg(ready ? { appToken: s.feishuAppToken, tableId: s.feishuTableId } : null)
    })()
  }, [])

  // 拉取每日 AI 复盘记录
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await getReviews(20)
        if (alive) setReviews(data.reviews || [])
      } catch {
        /* 复盘接口不可用时静默忽略 */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const stats = useMemo(() => journalStats(list), [list])
  const fstats = useMemo(() => fc3dStats(list), [list])
  const filtered = useMemo(
    () => (lotFilter === 'all' ? list : list.filter((r) => lotteryOf(r) === lotFilter)),
    [list, lotFilter],
  )
  // 顶部统计卡覆盖当前筛选范围（两种彩票的投入 / 奖金口径可相加）
  const totals = useMemo(() => {
    const bought = filtered.filter((r) => r.bought)
    const spend = bought.reduce((s, r) => s + (Number(r.spend) || 0), 0)
    const prize = bought.reduce((s, r) => s + (Number(r.prize) || 0), 0)
    return {
      days: filtered.length,
      boughtDays: bought.length,
      spend,
      prize,
      net: prize - spend,
      roi: spend ? prize / spend : 0,
      avgSpend: bought.length ? spend / bought.length : 0,
    }
  }, [filtered])
  const settings = loadSettings()
  const recordedDates = new Set(list.filter((r) => lotteryOf(r) === 'kl8').map((r) => r.date))
  const backfillDraws = useMemo(
    () => draws.filter((d) => d.date && !recordedDates.has(d.date)).slice(0, 20),
    [draws, recordedDates],
  )
  const aiReports = list.filter((r) => r.aiReport)

  function update(next) {
    setList(next)
    persistJournal(next)
  }

  async function doSyncAll() {
    setBusy(true)
    try {
      const { count, stamp } = await syncAllToNeon(list)
      update(list.map((r) => ({ ...r, synced: { ...(r.synced || {}), neon: stamp } })))
      setMsg({ tone: 'info', text: `已同步 ${count} 条记录到 Neon 云数据库` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `Neon 同步失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function doRowSync(rec) {
    setBusy(true)
    try {
      const synced = await syncRecordToNeon(rec)
      update(upsertRecord(list, synced))
      setMsg({ tone: 'info', text: `${rec.date} 已同步到 Neon` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `同步失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function doRowAi(rec) {
    if (!isLlmReady(loadSettings())) {
      return setMsg({ tone: 'warn', text: '尚未配置大模型 API，请先到「设置」页填写' })
    }
    setBusy(true)
    try {
      const analyzed = await analyzeRecord(rec, list, draws[0])
      update(upsertRecord(list, analyzed))
      setMsg({ tone: 'info', text: `${rec.date} 的 AI 分析已更新` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `AI 分析失败：${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  function doExport() {
    const blob = new Blob([exportJson(list)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'journal-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doSyncLark() {
    setBusy(true)
    try {
      const result = await syncToLark(list)
      if (result.skipped) {
        setMsg({ tone: 'info', text: '没有需要同步的记录' })
      } else {
        setMsg({ tone: 'info', text: `飞书同步完成：更新 ${result.updated} 条，新建 ${result.created} 条` })
      }
    } catch (e) {
      setMsg({ tone: 'warn', text: `飞书同步失败：${e?.message || e || '未知错误'}` })
    } finally {
      setBusy(false)
    }
  }

  // 打开飞书多维表格，用户可直接在表格里查看 / 填写数据
  function doOpenLark() {
    if (!larkCfg) return
    const url = `https://www.feishu.cn/base/${larkCfg.appToken}?table=${larkCfg.tableId}`
    openUrl(url).catch((e) => setMsg({ tone: 'warn', text: `打开飞书表格失败：${e.message}` }))
  }

  return (
    <div className="page">
      <Note tone="warn">
        账本复盘的是<b>你的真实购买行为</b>。命中多少个是独立随机事件，短期波动完全正常；
        本站与历史数据研究均表明开奖不存在可利用规律，请把购彩当作娱乐。
      </Note>

      <div className="stat-grid">
        <StatCard
          label="打卡天数"
          value={totals.days}
          note={`购买 ${totals.boughtDays} 天 · 未购 ${totals.days - totals.boughtDays} 天`}
        />
        <StatCard label="累计投入" value={totals.spend} unit="元" note={`购买日均 ${totals.avgSpend.toFixed(1)} 元`} />
        <StatCard
          label="累计奖金"
          value={totals.prize}
          unit="元"
          tone="blue"
          note={stats.best?.prize ? `快乐8 最高一天 ${stats.best.date}` : '暂无中奖记录'}
        />
        <StatCard
          label="净盈亏"
          value={`${totals.net >= 0 ? '+' : ''}${totals.net}`}
          unit="元"
          tone={totals.net >= 0 ? 'blue' : 'red'}
          note={`回报率 ${(totals.roi * 100).toFixed(1)}%`}
        />
      </div>

      <div className="grid-2">
        <Card title="命中分布对照" tag="快乐8 · 实际天数 vs 理论期望">
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>命中个数</th>
                  <th>实际天数</th>
                  <th>理论期望</th>
                  <th>选十基准概率</th>
                </tr>
              </thead>
              <tbody>
                {stats.hitRows
                  .filter((r) => r.actual > 0 || r.expected >= 0.5)
                  .map((r) => (
                    <tr key={r.k}>
                      <td className="mono">中 {r.k} 个</td>
                      <td className="mono">{r.actual}</td>
                      <td className="mono">{r.expected}</td>
                      <td className="mono muted">
                        {((stats.theory10[r.k] || { prob: 0 }).prob * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Note>
            理论期望按每期实际玩法（选几）的超几何分布折算。实际天数围绕期望值波动是随机性的正常表现，
            <b>连续中 / 连续不中都不说明任何问题</b>。
          </Note>
        </Card>

        <Card title="按玩法统计" tag="快乐8 · 命中口径为号码个数">
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>玩法</th>
                  <th>天数</th>
                  <th>投入</th>
                  <th>奖金</th>
                  <th>回报率</th>
                </tr>
              </thead>
              <tbody>
                {stats.playRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">还没有购买记录</td>
                  </tr>
                )}
                {stats.playRows.map((r) => (
                  <tr key={r.play}>
                    <td>选{['一','二','三','四','五','六','七','八','九','十'][r.play - 1]}</td>
                    <td className="mono">{r.days}</td>
                    <td className="mono">{yuan(r.spend)}</td>
                    <td className="mono">{yuan(r.prize)}</td>
                    <td className="mono" style={{ color: r.roi >= 1 ? 'var(--blue)' : 'var(--red)' }}>
                      {(r.roi * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            快乐8各玩法返还率约在 50%-65% 之间（选十头奖 500 万但概率 1/891 万）。
            长期看回报率会向返还率收敛，<b>任何玩法都不能把购彩变成正收益投资</b>。
          </Note>
        </Card>
      </div>

      {fstats.days > 0 && (
        <Card title="福彩3D 账本汇总" tag={`${fstats.days} 天 · ${fstats.bets} 注`}>
          <div className="stat-grid">
            <StatCard label="中奖注数" value={fstats.wins} unit="注" tone="red" note={`共投 ${fstats.bets} 注`} />
            <StatCard label="累计投入" value={fstats.spend} unit="元" note={`单注 2 元`} />
            <StatCard label="累计奖金" value={fstats.prize} unit="元" tone="blue" note={fstats.wins ? `命中 ${fstats.wins} 注` : '未中奖'} />
            <StatCard
              label="净盈亏"
              value={`${fstats.net >= 0 ? '+' : ''}${fstats.net}`}
              unit="元"
              tone={fstats.net >= 0 ? 'blue' : 'red'}
              note={`回报率 ${(fstats.roi * 100).toFixed(1)}%`}
            />
          </div>
          <Note>
            3D 按「注」判定中奖（直选 1040 元 / 组选3 346 元 / 组选6 173 元），与快乐8 的「命中几个号」口径不同。
            记录来自「福彩3D → 中奖计算 → 记入本期账本」。
          </Note>
        </Card>
      )}

      <Card title="账本工具" tag="云数据库 / 飞书多维表格">
        <div className="toolbar">
          <span className="toolbar-label">彩种筛选</span>
          {[['all', '全部'], ['kl8', LOTTERY_LABEL.kl8], ['fc3d', LOTTERY_LABEL.fc3d]].map(([k, label]) => (
            <button
              key={k}
              className={`mode-btn ${lotFilter === k ? 'active' : ''}`}
              onClick={() => setLotFilter(k)}
            >
              {label}
            </button>
          ))}
          <span className="toolbar-note">
            共 {list.length} 条 · 当前显示 {filtered.length} 条
          </span>
        </div>
        <div className="row-actions">
          <button className="btn-primary" onClick={doSyncAll} disabled={busy || !list.length || !isNeonReady(settings)}>
            同步全部到云数据库
          </button>
          <button className="btn-primary" onClick={doSyncLark} disabled={busy || !list.length || !larkReady}>
            {busy ? '同步中…' : '同步到飞书'}
          </button>
          <button className="tab-btn" onClick={doOpenLark} disabled={!larkReady}>
            打开飞书表格 ↗
          </button>
          <button className="tab-btn" onClick={doExport} disabled={!list.length}>
            导出 JSON
          </button>
          <span className="muted small">
            云数据库：{isNeonReady(settings) ? '已配置' : '未配置'} · 飞书：{larkReady ? '已绑定' : '未绑定'}
            （可在设置页绑定自己的飞书表格）
          </span>
        </div>
        <Note>
          账本会同步到你在「设置」页绑定的飞书多维表格，按「日期 + 彩种」自动更新或新建记录，两种彩票写在不同行；
          未绑定时回退使用管理员配置的默认表格。你也可以点「打开飞书表格」直接在飞书里查看或手动填写数据，两种方式互通。
        </Note>
        {msg && <Note tone={msg.tone === 'warn' ? 'warn' : 'info'}>{msg.text}</Note>}
      </Card>

      {backfillDraws.length > 0 && (
        <Card title="补录历史记录" tag="有开奖但没打卡的日期">
          <div className="toolbar">
            <span className="toolbar-label">选择期号</span>
            <select className="text-input" value={backfillId} onChange={(e) => setBackfillId(e.target.value)}>
              <option value="">— 选择一档 —</option>
              {backfillDraws.map((d) => (
                <option key={d.id} value={d.id}>
                  第 {d.id} 期 · {d.date}
                </option>
              ))}
            </select>
            <span className="toolbar-note">共 {backfillDraws.length} 期未打卡</span>
          </div>
          {backfillId && (
            <div style={{ marginTop: 14 }}>
              <DailyCheckin draws={draws} draw={draws.find((d) => String(d.id) === backfillId)} />
            </div>
          )}
        </Card>
      )}

      <Card title="打卡记录" tag={`${filtered.length} 条 · 最新在前`}>
        <div className="table-scroll tall">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>彩种</th>
                <th>期号</th>
                <th>购买</th>
                <th>号码（金圈=命中）</th>
                <th>命中 / 中奖</th>
                <th>花费</th>
                <th>奖金</th>
                <th>盈亏</th>
                <th>备注</th>
                <th>同步</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="muted">
                    还没有记录。快乐8 到「每日打卡」记录，福彩3D 到「中奖计算 → 记入本期账本」。
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isFc3d = lotteryOf(r) === 'fc3d'
                const draw = draws.find((d) => d.date === r.date)
                const hitSet = new Set(draw?.nums || [])
                const profit = (r.prize || 0) - (r.spend || 0)
                return (
                  <tr key={`${r.lottery}-${r.date}`}>
                    <td className="mono">{r.date}</td>
                    <td className="small">{LOTTERY_LABEL[lotteryOf(r)]}</td>
                    <td className="mono muted">{r.drawId ?? '—'}</td>
                    <td>{r.bought ? '买了' : '没买'}</td>
                    <td>
                      {r.bought && isFc3d ? (
                        <span className="mono small">
                          {(r.bets || []).map((b) => b.join('')).join(' / ')}
                          {r.playLabel ? ` · ${r.playLabel}` : ''}
                        </span>
                      ) : r.bought && r.picks?.length ? (
                        <span className="cell-balls wrap">
                          {r.picks.map((n) => (
                            <Ball key={n} n={n} size="xs" kind="auto" className={hitSet.has(n) ? 'ball-hit' : ''} />
                          ))}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono">{r.bought ? (isFc3d ? `${r.hits ?? 0} 注` : r.hits ?? '?') : '—'}</td>
                    <td className="mono">{r.bought ? yuan(r.spend || 0) : '—'}</td>
                    <td className="mono">{r.bought ? yuan(r.prize || 0) : '—'}</td>
                    <td className="mono" style={{ color: r.bought ? (profit >= 0 ? 'var(--blue)' : 'var(--red)') : undefined }}>
                      {r.bought ? `${profit >= 0 ? '+' : ''}${yuan(profit)}` : '—'}
                    </td>
                    <td className="small muted">{r.note || '—'}</td>
                    <td className="small">
                      {r.synced?.neon ? <span className="sync-badge">Neon</span> : <span className="muted">本地</span>}
                      {r.synced?.lark ? <span className="sync-badge" style={{ marginLeft: 4 }}>飞书</span> : null}
                    </td>
                    <td>
                      <div className="record-actions">
                        {!isFc3d && (
                          <button className="tab-btn" onClick={() => doRowAi(r)} disabled={busy}>AI</button>
                        )}
                        <button className="tab-btn" onClick={() => doRowSync(r)} disabled={busy || !isNeonReady(settings)}>同步</button>
                        <button
                          className="tab-btn"
                          onClick={() => {
                            if (confirm(`删除 ${r.date} 的${LOTTERY_LABEL[lotteryOf(r)]}记录？`)) {
                              update(removeRecord(list, r.date, lotteryOf(r)))
                            }
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {aiReports.length > 0 && (
        <Card title="AI 分析报告历史" tag={`${aiReports.length} 份`}>
          {aiReports.map((r) => (
            <div key={`${r.lottery}-${r.date}`} className="ai-report">
              <div className="ai-report-head">
                {r.date}（{LOTTERY_LABEL[lotteryOf(r)]} · 第 {r.drawId ?? '?'} 期） · {r.aiReport.model} ·{' '}
                {new Date(r.aiReport.at).toLocaleString('zh-CN')}
              </div>
              <div className="ai-report-body">{r.aiReport.text}</div>
            </div>
          ))}
        </Card>
      )}

      {reviews.length > 0 && (
        <Card title="每日 AI 复盘（预测 vs 实际）" tag={`最近 ${reviews.length} 期 · 每天 10:00 自动`}>
          {reviews.map((r) => (
            <div key={r.date} className="ai-report">
              <div className="ai-report-head">
                {r.date}（第 {r.drawId} 期） · 命中 <b className={r.won ? 'text-red' : ''}>{r.hits}/10</b> ·{' '}
                奖金 {yuan(r.prize)} · {r.won ? '🎉 中奖' : '未中'}
              </div>
              <div className="predict-sub" style={{ marginTop: 6 }}>
                预测：{r.predicted?.map((n) => String(n).padStart(2, '0')).join(' ') || '—'}
              </div>
              <div className="predict-sub">
                开奖：{r.actual?.map((n) => String(n).padStart(2, '0')).join(' ') || '—'}
              </div>
              <div className="ai-report-body" style={{ marginTop: 6 }}>{r.aiSummary}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
