// 数据管理 —— 在线抓取 / 导入 / 导出 / 恢复演示数据（更新时整体覆盖）
import React, { useState } from 'react'
import { Card, Note, DrawBalls, ballKindByRange } from './common.jsx'
import { parseDrawText, SAMPLE_DRAWS, SAMPLE_NOTE } from '../data/sample.js'
import { fetchKl8Draws } from '../lib/kl8.js'

export default function DataManager({ draws, setDraws }) {
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
      const list = await fetchKl8Draws(100)
      setDraws(list) // 整体覆盖：清空旧数据，只保留最新抓取结果
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
    const { draws: parsed, errors: errs } = parseDrawText(text)
    setErrors(errs)
    if (parsed.length) {
      setDraws(parsed) // 同样整体覆盖
      setMsg(`成功导入 ${parsed.length} 期（旧数据已清空并整体覆盖，最新期号 ${parsed[0].id}）`)
    } else {
      setMsg(null)
    }
  }

  function doExport() {
    const lines = draws
      .map((d) => [d.id, d.date, ...d.nums.map((n) => String(n).padStart(2, '0'))].join(','))
      .join('\n')
    const blob = new Blob([lines + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'kl8_history.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page">
      <Note tone="warn">
        本站当前使用的{draws[0]?.sample ? `是${SAMPLE_NOTE}。` : '是真实开奖数据（官网抓取或手动导入）。'}
        每次抓取或导入都会<b>先清空旧数据、再整体覆盖</b>，不会追加或合并。导入格式：每行一期，
        <code>期号,日期,20个号码</code>，分隔符支持空格/逗号/制表符，日期可省略。
      </Note>

      <Card title="一键抓取开奖数据" tag="来源：中国福彩官网">
        <p className="muted small">
          自动抓取最近 100 期快乐8开奖（期号、开奖日期、20 个开奖号），来源为
          <a href="https://www.cwl.gov.cn/ygkj/wqkjgg/kl8/" target="_blank" rel="noreferrer">
            中国福彩官网开奖公告
          </a>
          。官网未开放跨域，本站通过本地代理转发，因此需以 <code>npm run dev</code> 或
          <code>npm run preview</code> 方式运行。快乐8 每天开奖一期。
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
              '2026296,2026-11-06,01,02,04,07,13,15,19,30,34,42,44,45,48,50,54,63,67,71,73,74\n2026295 03 05 09 12 18 21 25 28 33 37 41 46 49 52 58 61 66 69 75 79'
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
            <button className="tab-btn" onClick={() => setDraws(SAMPLE_DRAWS)}>
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
          <p className="muted small">
            真实数据可从中国福彩官网（www.cwl.gov.cn）「开奖公告」或彩票走势图页面复制。导入后所有统计页将自动切换为真实数据。
          </p>
        </Card>

        <Card title="导出当前数据" tag={`${draws.length} 期`}>
          <p className="muted small">
            将当前数据导出为 CSV（期号,日期,20 个开奖号），便于在 Excel 中继续研究。
          </p>
          <button className="btn-primary" onClick={doExport}>导出 CSV</button>
          <div className="data-preview">
            <b className="small">数据预览（最新 3 期）</b>
            <ul className="recent-list">
              {draws.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <span className="recent-id mono">{d.id}</span>
                  <span className="recent-date muted mono">{d.date || '—'}</span>
                  <DrawBalls draw={d} size="xs" />
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
                <th>20 个开奖号</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td className="mono muted">{d.date || '—'}</td>
                  <td>
                    <span className="cell-balls wrap">
                      {d.nums.map((n) => (
                        <span key={n} className={`mini-ball mini-${ballKindByRange(n)}`}>
                          {String(n).padStart(2, '0')}
                        </span>
                      ))}
                    </span>
                  </td>
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
