// 双色球 数据管理 —— 在线抓取 / 导入 / 导出 / 恢复内置历史数据
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { SSQ_DRAWS } from '../data/ssq.js'
import { fetchSsqDraws } from '../lib/ssq.js'

/** 解析粘贴文本：每行一期，期号 日期 6 红 1 蓝，共 7 个号码 */
function parseSsqText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const draws = []
  const errors = []
  lines.forEach((line, idx) => {
    const clean = line.replace(/[|+＋]/g, ' ')
    const parts = clean.split(/[\s,，;；]+/).filter(Boolean)
    let id = null
    let date = null
    const nums = []
    for (const p of parts) {
      if (/^\d{4,}$/.test(p) && id === null) id = Number(p)
      else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(p)) date = p
      else if (/^\d{1,2}$/.test(p)) nums.push(Number(p))
    }
    if (id === null) {
      errors.push(`第 ${idx + 1} 行缺少期号：${line}`)
      return
    }
    if (nums.length !== 7) {
      errors.push(`第 ${idx + 1} 行号码个数为 ${nums.length}，应为 6 红 + 1 蓝 = 7 个`)
      return
    }
    const red = nums.slice(0, 6)
    const blue = nums[6]
    const redOk = red.every((n) => n >= 1 && n <= 33) && new Set(red).size === 6
    if (!redOk) {
      errors.push(`第 ${idx + 1} 行红球需为 6 个不重复的 01–33：${line}`)
      return
    }
    if (blue < 1 || blue > 16) {
      errors.push(`第 ${idx + 1} 行蓝球需在 01–16：${line}`)
      return
    }
    draws.push({ id, date: date || null, red: red.slice().sort((a, b) => a - b), blue })
  })
  draws.sort((a, b) => b.id - a.id)
  // 期号去重
  const seen = new Set()
  const unique = draws.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
  return { draws: unique, errors }
}

export default function SSQDataManager({ draws, setDraws }) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const [msg, setMsg] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState(null)
  const [fetchErr, setFetchErr] = useState(null)
  const [fetchCount, setFetchCount] = useState(100)

  async function doFetch() {
    setFetching(true)
    setFetchErr(null)
    setFetchMsg(null)
    try {
      const list = await fetchSsqDraws(fetchCount)
      setDraws(list)
      setFetchMsg(
        `已抓取 ${list.length} 期（旧数据已清空并整体覆盖）：${list[list.length - 1].id} → ${list[0].id}`,
      )
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setFetching(false)
    }
  }

  function doImport() {
    const { draws: parsed, errors: errs } = parseSsqText(text)
    setErrors(errs)
    if (parsed.length) {
      setDraws(parsed)
      setMsg(`成功导入 ${parsed.length} 期（旧数据已清空并整体覆盖，最新期号 ${parsed[0].id}）`)
    } else {
      setMsg(null)
    }
  }

  function doExport() {
    const lines = draws
      .map((d) => [d.id, d.date || '', ...d.red, d.blue].join(','))
      .join('\n')
    const blob = new Blob([lines + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ssq_history.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page">
      <Note tone="warn">
        每次抓取或导入都会<b>先清空旧数据、再整体覆盖</b>，不会追加或合并。
        导入格式：每行一期，<code>期号,日期,红1,红2,红3,红4,红5,红6,蓝</code>，
        分隔符支持空格/逗号，也可用 <code>|</code> 分隔红蓝（如 <code>2026129,03,09,16,20,25,30|05</code>）。
      </Note>

      <Card title="一键抓取开奖数据" tag="数据源：500.com 开奖 XML（备用：中国福彩网）">
        <p className="muted small">
          自动抓取最近若干期双色球开奖（期号、开奖日期、6 红 + 1 蓝）。
          官网未开放跨域，本站通过 <code>/api/ssq-proxy</code> 转发。
          双色球每周二、四、日开奖，共约 150 期/年。
        </p>
        <div className="row-actions">
          <select
            className="ssq-select"
            value={fetchCount}
            onChange={(e) => setFetchCount(Number(e.target.value))}
            disabled={fetching}
          >
            {[30, 60, 100, 150, 200].map((n) => (
              <option key={n} value={n}>
                最近 {n} 期
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={doFetch} disabled={fetching}>
            {fetching ? '正在抓取…' : '开始抓取'}
          </button>
          <span className="muted small">
            当前共 {draws.length} 期，最新 {draws[0]?.id} 期
          </span>
        </div>
        {fetchMsg && <p className="note note-info">{fetchMsg}</p>}
        {fetchErr && <div className="note note-warn">抓取失败：{fetchErr}</div>}
      </Card>

      <div className="grid-2">
        <Card title="导入历史开奖数据" tag="粘贴后点导入">
          <textarea
            className="import-area mono"
            rows={10}
            placeholder={'2026129,2026-11-10,3,9,16,20,25,30,5\n2026128 2026-11-08 5 6 10 25 27 30 11\n2026127,13,14,19,25,29,32|12'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row-actions">
            <button className="btn-primary" onClick={doImport} disabled={!text.trim()}>
              导入并整体覆盖
            </button>
            <button
              className="tab-btn"
              onClick={() => {
                setText('')
                setErrors([])
                setMsg(null)
              }}
            >
              清空输入
            </button>
            <button className="tab-btn" onClick={() => setDraws(SSQ_DRAWS)}>
              恢复内置数据
            </button>
          </div>
          {msg && <p className="note note-info">{msg}</p>}
          {errors.length > 0 && (
            <div className="note note-warn">
              <b>{errors.length} 行未通过校验：</b>
              <ul className="error-list">
                {errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="导出当前数据" tag={`${draws.length} 期`}>
          <p className="muted small">
            导出为 CSV（期号,日期,红1…红6,蓝），可直接在 Excel 中继续研究。
          </p>
          <button className="btn-primary" onClick={doExport}>
            导出 CSV
          </button>
          <div className="data-preview">
            <b className="small">数据预览（最新 3 期）</b>
            <ul className="recent-list">
              {draws.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <span className="recent-id mono">{d.id}</span>
                  <span className="recent-date muted mono">{d.date || '—'}</span>
                  <span className="ssq-repeat-nums">
                    {d.red.map((n) => (
                      <Ball key={n} n={n} kind="red" size="xs" />
                    ))}
                    <span className="ssq-divider" aria-hidden="true" />
                    <Ball n={d.blue} kind="blue" size="xs" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card title="全部数据" tag={`${draws.length} 期 · 最新在前`}>
        <div className="table-scroll tall">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>日期</th>
                <th>红球</th>
                <th>蓝球</th>
                <th>和值</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td className="mono muted">{d.date || '—'}</td>
                  <td>
                    <span className="ssq-repeat-nums">
                      {d.red.map((n) => (
                        <Ball key={n} n={n} kind="red" size="xs" />
                      ))}
                    </span>
                  </td>
                  <td>
                    <Ball n={d.blue} kind="blue" size="xs" />
                  </td>
                  <td className="mono">{d.red.reduce((s, n) => s + n, 0)}</td>
                  <td className="muted small">{d.sample ? '演示' : '真实'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
