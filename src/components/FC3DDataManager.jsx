// 福彩3D 数据管理 —— 在线抓取 / 导入 / 导出 / 恢复演示数据
import React, { useState } from 'react'
import { Card, Note } from './common.jsx'
import { FC3D_DRAWS } from '../data/fc3d.js'
import { fetchFc3dDraws } from '../lib/fc3d.js'

/** 解析用户粘贴的福彩3D / 七星彩历史文本：每行一期，期号 日期 各位数字 */
function parseFc3dText(text, digitCount = 3, maxValues = null) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const draws = []
  const errors = []
  const maxFor = (i) => (maxValues && maxValues[i] != null ? maxValues[i] : 9)
  lines.forEach((line, idx) => {
    // 支持：期号,日期,1,2,3  或  期号 日期 1 2 3  或  期号 123  或  123
    const parts = line.split(/[\s,，]+/).filter(Boolean)
    if (parts.length < 1) return
    // 尝试找期号（纯数字且长度>=4；七星彩的 8 位连写号码不当作期号）
    let id = null
    let date = null
    const numIdx = []
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (id === null && /^\d{4,}$/.test(p) && !(digitCount === 7 && p.length === 8)) {
        id = Number(p)
      } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(p)) {
        date = p
      } else if (/^\d+$/.test(p)) {
        numIdx.push(p)
      }
    }
    // 如果没找到期号，用行号当 id
    if (id === null) {
      errors.push(`第 ${idx + 1} 行缺少期号：${line}`)
      return
    }
    // 解析号码：可能是 "123" / "72476314" 连续，或 "1 2 3" 分开
    let digits = null
    if (numIdx.length === 1 && numIdx[0].length === digitCount) {
      digits = numIdx[0].split('').map(Number)
    } else if (numIdx.length === 1 && digitCount === 7 && numIdx[0].length === 8) {
      const arr = numIdx[0].split('').map(Number)
      digits = [arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6] * 10 + arr[7]]
    } else if (numIdx.length === digitCount) {
      digits = numIdx.map(Number)
    } else {
      errors.push(`第 ${idx + 1} 行号码格式错误（应为 ${digitCount} 个数字）：${line}`)
      return
    }
    for (let i = 0; i < digits.length; i++) {
      const max = maxFor(i)
      if (!Number.isInteger(digits[i]) || digits[i] < 0 || digits[i] > max) {
        errors.push(`第 ${idx + 1} 行第 ${i + 1} 位超出 0-${max}：${line}`)
        return
      }
    }
    draws.push({ id, date: date || null, num: digits })
  })
  draws.sort((a, b) => b.id - a.id)
  return { draws, errors }
}

export default function FC3DDataManager({
  draws,
  setDraws,
  label = '福彩3D',
  fetchDraws = fetchFc3dDraws,
  sampleDraws = FC3D_DRAWS,
  filePrefix = 'fc3d',
  sourceUrl = 'https://www.cwl.gov.cn/ygkj/wqkjgg/3d/',
  sourceName = '中国福彩官网开奖公告',
  digitCount = 3,
  positions = ['百', '十', '个'],
  maxValues = null,
}) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const [msg, setMsg] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState(null)
  const [fetchErr, setFetchErr] = useState(null)

  async function doFetch() {
    setFetching(true)
    setFetchErr(null)
    setFetchMsg(null)
    try {
      const list = await fetchDraws(100)
      setDraws(list)
      setFetchMsg(`已抓取 ${list.length} 期（旧数据已清空并整体覆盖）：${list[list.length - 1].id} → ${list[0].id}`)
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setFetching(false)
    }
  }

  function doImport() {
    const { draws: parsed, errors: errs } = parseFc3dText(text, digitCount, maxValues)
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
      .map((d) => [d.id, d.date || '', ...d.num].join(','))
      .join('\n')
    const blob = new Blob([lines + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filePrefix}_history.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page">
      <Note tone="warn">
        每次抓取或导入都会<b>先清空旧数据、再整体覆盖</b>，不会追加或合并。
        导入格式：每行一期，<code>期号,日期,{positions.join(',')}</code>（或 <code>期号 {positions.map(() => '0').join('')}</code>），
        分隔符支持空格/逗号，日期可省略。
      </Note>

      <Card title="一键抓取开奖数据" tag={`来源：${sourceName}`}>
        <p className="muted small">
          自动抓取最近 100 期{label}开奖（期号、开奖日期、{positions.join('')} {digitCount} 个号码），来源为
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            {sourceName}
          </a>
          。官网未开放跨域，本站通过代理转发。{label} 每天开奖一期。
        </p>
        <div className="row-actions">
          <button className="btn-primary" onClick={doFetch} disabled={fetching}>
            {fetching ? '正在抓取…' : '抓取最近 100 期'}
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
            placeholder={
              digitCount === 3
                ? '2024300,2024-11-05,3,7,2\n2024301 2024-11-06 8 1 5\n2024302 049'
                : '26134,2026-11-15,7,2,4,7,6,3,14\n26135 2026-11-16 1 9 3 5 2 8 12\n26136 72476314'
            }
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
            <button className="tab-btn" onClick={() => setDraws(sampleDraws)}>
              恢复演示数据
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
            将当前数据导出为 CSV（期号,日期,{positions.join(',')}），便于在 Excel 中继续研究。
          </p>
          <button className="btn-primary" onClick={doExport}>导出 CSV</button>
          <div className="data-preview">
            <b className="small">数据预览（最新 3 期）</b>
            <ul className="recent-list">
              {draws.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <span className="recent-id mono">{d.id}</span>
                  <span className="recent-date muted mono">{d.date || '—'}</span>
                  <span className="fc3d-recent-num mono">{d.num.join(' ')}</span>
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
                {positions.map((p) => (
                  <th key={p}>{p}位</th>
                ))}
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td className="mono muted">{d.date || '—'}</td>
                  {positions.map((p, i) => (
                    <td key={p} className="mono"><span className="digit-ball">{d.num[i]}</span></td>
                  ))}
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
