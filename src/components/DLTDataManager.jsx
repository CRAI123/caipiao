// 大乐透 数据管理 —— 在线抓取 / 导入 / 导出 / 恢复内置历史数据
import React, { useState } from 'react'
import { Card, Note, Ball } from './common.jsx'
import { DLT_DRAWS } from '../data/dlt.js'
import { fetchDltDraws } from '../lib/dlt.js'

/** 解析粘贴文本：每行一期，期号 日期 5 前区 2 后区，共 7 个号码 */
function parseDltText(text) {
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
      errors.push(`第 ${idx + 1} 行号码个数为 ${nums.length}，应为 5 前区 + 2 后区 = 7 个`)
      return
    }
    const front = nums.slice(0, 5)
    const back = nums.slice(5, 7)
    const frontOk = front.every((n) => n >= 1 && n <= 35) && new Set(front).size === 5
    if (!frontOk) {
      errors.push(`第 ${idx + 1} 行前区需为 5 个不重复的 01–35：${line}`)
      return
    }
    const backOk = back.every((n) => n >= 1 && n <= 12) && new Set(back).size === 2
    if (!backOk) {
      errors.push(`第 ${idx + 1} 行后区需为 2 个不重复的 01–12：${line}`)
      return
    }
    draws.push({
      id,
      date: date || null,
      front: front.slice().sort((a, b) => a - b),
      back: back.slice().sort((a, b) => a - b),
    })
  })
  draws.sort((a, b) => b.id - a.id)
  const seen = new Set()
  const unique = draws.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
  return { draws: unique, errors }
}

export default function DLTDataManager({ draws, setDraws }) {
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
      const list = await fetchDltDraws(fetchCount)
      setDraws(list)
      setFetchMsg(`已抓取 ${list.length} 期（旧数据已清空并整体覆盖）：${list[list.length - 1].id} → ${list[0].id}`)
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setFetching(false)
    }
  }

  function doImport() {
    const { draws: parsed, errors: errs } = parseDltText(text)
    setErrors(errs)
    if (parsed.length) {
      setDraws(parsed)
      setMsg(`成功导入 ${parsed.length} 期（旧数据已清空并整体覆盖，最新期号 ${parsed[0].id}）`)
    } else {
      setMsg(null)
    }
  }

  function doExport() {
    const lines = draws.map((d) => [d.id, d.date || '', ...d.front, ...d.back].join(',')).join('\n')
    const blob = new Blob([lines + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'dlt_history.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page">
      <Note tone="warn">
        每次抓取或导入都会<b>先清空旧数据、再整体覆盖</b>，不会追加或合并。
        导入格式：每行一期，<code>期号,日期,前1,前2,前3,前4,前5,后1,后2</code>，
        分隔符支持空格/逗号，也可用 <code>|</code> 分隔前后区（如{' '}
        <code>2026133,10,11,25,30,32|09,10</code>）。
      </Note>

      <Card title="一键抓取开奖数据" tag="数据源：500.com 开奖 XML">
        <p className="muted small">
          自动抓取最近若干期大乐透开奖（期号、开奖日期、5 前区 + 2 后区）。
          官网未开放跨域，本站通过 <code>/api/dlt-proxy</code> 转发。
          大乐透每周一、三、六开奖，共约 150 期/年。
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
            placeholder={'2026133,2026-11-21,10,11,25,30,32,9,10\n2026132 2026-11-18 2 9 16 26 35 6 11\n2026131,2,11,18,19,29|04,07'}
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
            <button className="tab-btn" onClick={() => setDraws(DLT_DRAWS)}>
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
            导出为 CSV（期号,日期,前1…前5,后1,后2），可直接在 Excel 中继续研究。
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
                    {d.front.map((n) => (
                      <Ball key={n} n={n} kind="red" size="xs" />
                    ))}
                    <span className="ssq-divider" aria-hidden="true" />
                    {d.back.map((n) => (
                      <Ball key={`b${n}`} n={n} kind="blue" size="xs" />
                    ))}
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
                <th>前区</th>
                <th>后区</th>
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
                      {d.front.map((n) => (
                        <Ball key={n} n={n} kind="red" size="xs" />
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className="ssq-repeat-nums">
                      {d.back.map((n) => (
                        <Ball key={`b${n}`} n={n} kind="blue" size="xs" />
                      ))}
                    </span>
                  </td>
                  <td className="mono">{d.front.reduce((s, n) => s + n, 0)}</td>
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
