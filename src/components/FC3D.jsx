import React, { useMemo } from 'react'
import { FC3D_DRAWS } from '../data/fc3d.js'
import { predictFC3D, backtestFC3D, analyzeDraw } from '../lib/fc3dPredict.js'

/** 福彩3D 术语条目 */
const TERMS = [
  {
    title: '形态',
    items: [
      { name: '豹子', desc: '三个数字全部相同', example: '例：222' },
      { name: '顺子', desc: '三个数字为连续号码', example: '例：123、689、731' },
      { name: '对子（组三）', desc: '三个号码里有两个数字相同', example: '两数一样' },
      { name: '组六', desc: '三个数字全都不相同', example: '' },
    ],
  },
  {
    title: '数值类',
    items: [
      { name: '跨度', desc: '一注号码里，最大数 − 最小数', example: '' },
      { name: '和值', desc: '三个数字相加得到的总和', example: '' },
      { name: '合值', desc: '三个数字相加的和值取个位', example: '例：139，和值13，合值为3' },
    ],
  },
  {
    title: '奇偶',
    items: [
      { name: '奇偶', desc: '三个号码区分奇数、偶数，共 8 种组合形态', example: '奇奇奇、奇奇偶……' },
    ],
  },
  {
    title: '大中小',
    items: [
      { name: '小号', desc: '0、1、2', example: '' },
      { name: '中号', desc: '3、4、5、6', example: '' },
      { name: '大号', desc: '7、8、9', example: '' },
    ],
  },
  {
    title: '质数、合数（彩民常用划分）',
    items: [
      { name: '质数', desc: '1、2、3、5、7', example: '' },
      { name: '合数', desc: '0、4、6、8、9', example: '' },
    ],
  },
  {
    title: '单双组合',
    items: [
      { name: '单数组合', desc: '全奇数组合', example: '139、157、379、357' },
      { name: '双数组合', desc: '全偶数组合', example: '028、268、046、248' },
      { name: '两单（两奇）', desc: '两个奇数搭配', example: '13、19、39、15、17、57、37' },
      { name: '两双（两偶）', desc: '两个偶数搭配', example: '02、08、28、26、68、04、06' },
    ],
  },
  {
    title: '奇偶搭配形态',
    items: [
      { name: '两单一双', desc: '两个奇数 + 一个偶数', example: '130、132、134、136、138、190、194、572、794' },
      { name: '两双一单', desc: '两个偶数 + 一个奇数', example: '021、023、025、027、029、081、085、087、012' },
    ],
  },
  {
    title: '其他常用概念',
    items: [
      { name: '遗漏', desc: '某个号码或者某种形态，距离上次开出间隔的期数', example: '' },
      { name: '冷热号', desc: '热号 = 近期频繁开出的号码；冷号 = 很久没有开出的号码', example: '' },
    ],
  },
]

function DigitBall({ d, hot, cold, omit }) {
  let cls = 'digit-ball'
  if (hot) cls += ' hot'
  if (cold) cls += ' cold'
  return (
    <span className={cls} title={`遗漏 ${omit} 期`}>
      {d}
      <em>{omit}</em>
    </span>
  )
}

export default function FC3D() {
  const pred = useMemo(() => predictFC3D(FC3D_DRAWS), [])
  const backtest = useMemo(() => backtestFC3D(FC3D_DRAWS), [])

  return (
    <div className="fc3d">
      {/* 温馨提示 */}
      <div className="fc3d-warn" role="alert">
        <span className="fc3d-warn-icon">⚠️</span>
        <div>
          <strong>温馨提示：</strong>
          彩票开奖号码完全随机，这些术语仅为彩民参考，无法预测中奖，请理性购彩！
        </div>
      </div>

      {/* 玩法简介 */}
      <div className="fc3d-intro">
        <h2>福彩3D</h2>
        <p>
          中国福利彩票 3D 游戏，每期从 000–999 中开出一个 3 位数号码。以下基于 {FC3D_DRAWS.length} 期历史数据，
          从跨度、和值、奇偶、大中小、质合、形态、遗漏、热冷等维度综合推算下期参考号码。
        </p>
      </div>

      {pred && (
        <div className="fc3d-predict">
          <h2 className="section-title">下期推荐推算</h2>

          {/* 上期开奖 */}
          <div className="predict-row">
            <div className="predict-label">上期开奖</div>
            <div className="predict-value">
              <span className="draw-num">{pred.lastDraw.num.join(' ')}</span>
              <span className="muted mono">
                {pred.lastDraw.drawId} · 和值 {pred.lastAnalysis.sum} · 跨度 {pred.lastAnalysis.span} ·{' '}
                {pred.lastAnalysis.oddPattern} · {pred.lastAnalysis.form}
              </span>
            </div>
          </div>

          {/* 胆码 + 拖码 */}
          <div className="predict-row">
            <div className="predict-label">胆码（必出）</div>
            <div className="predict-value">
              {pred.dan.map((d) => (
                <DigitBall key={`dan-${d}`} d={d} omit={pred.omit[d]} />
              ))}
            </div>
          </div>

          <div className="predict-row">
            <div className="predict-label">拖码（搭配）</div>
            <div className="predict-value">
              {pred.tuo.map((d) => (
                <DigitBall key={`tuo-${d}`} d={d} omit={pred.omit[d]} />
              ))}
            </div>
          </div>

          {/* 热号 / 冷号 */}
          <div className="predict-row">
            <div className="predict-label">热号 Top3</div>
            <div className="predict-value">
              {pred.hot.map((d) => (
                <DigitBall key={`hot-${d}`} d={d} hot omit={pred.omit[d]} />
              ))}
            </div>
          </div>

          <div className="predict-row">
            <div className="predict-label">冷号 Top3</div>
            <div className="predict-value">
              {pred.cold.map((d) => (
                <DigitBall key={`cold-${d}`} d={d} cold omit={pred.omit[d]} />
              ))}
            </div>
          </div>

          {/* 指标预测 */}
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-name">跨度</div>
              <div className="metric-value">
                {pred.spanRange[0]} – {pred.spanRange[1]}
              </div>
              <div className="metric-sub">均值 {pred.spanAvg} · 众数 {pred.spanMode}</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">和值</div>
              <div className="metric-value">
                {pred.sumRange[0]} – {pred.sumRange[1]}
              </div>
              <div className="metric-sub">均值 {pred.sumAvg} · 众数 {pred.sumMode}</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">奇偶形态</div>
              <div className="metric-value">{pred.recommendedOdd.join(' / ')}</div>
              <div className="metric-sub">近30期主形态</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">推荐形态</div>
              <div className="metric-value">{pred.recommendedForms.join(' / ')}</div>
              <div className="metric-sub">近50期出现频率</div>
            </div>
          </div>

          {/* 全部数字评分 */}
          <div className="digit-scores">
            <div className="predict-label">0-9 综合评分（含遗漏期数）</div>
            <div className="digit-score-row">
              {pred.ranked.map((r) => (
                <div key={r.digit} className={`digit-score ${pred.hot.includes(r.digit) ? 'hot' : ''} ${pred.cold.includes(r.digit) ? 'cold' : ''}`}>
                  <span className="ds-digit">{r.digit}</span>
                  <span className="ds-score">{r.score}</span>
                  <span className="ds-omit">漏{pred.omit[r.digit]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 回算验证 */}
      {backtest && (
        <div className="fc3d-backtest">
          <h2 className="section-title">上期回算验证</h2>
          <div className="backtest-card">
            <div className="backtest-row">
              <div className="backtest-label">预测期号</div>
              <div className="backtest-value mono">{backtest.actualDraw.drawId}</div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">实际开奖</div>
              <div className="backtest-value">
                <span className="draw-num big">{backtest.actualDraw.num.join(' ')}</span>
                <span className="muted mono">
                  和值 {backtest.actualAnalysis.sum} · 跨度 {backtest.actualAnalysis.span} ·{' '}
                  {backtest.actualAnalysis.oddPattern} · {backtest.actualAnalysis.form}
                </span>
              </div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">预测胆码</div>
              <div className="backtest-value">
                {backtest.prediction.dan.map((d) => (
                  <DigitBall key={`bt-dan-${d}`} d={d} omit={backtest.prediction.omit[d]} />
                ))}
                <span className="muted">命中 {backtest.danHits.length} 个</span>
              </div>
            </div>
            <div className="backtest-row">
              <div className="backtest-label">预测拖码</div>
              <div className="backtest-value">
                {backtest.prediction.tuo.map((d) => (
                  <DigitBall key={`bt-tuo-${d}`} d={d} omit={backtest.prediction.omit[d]} />
                ))}
                <span className="muted">命中 {backtest.tuoHits.length} 个</span>
              </div>
            </div>
            <div className="backtest-divider" />
            <div className="backtest-metrics">
              <div className={`bt-metric ${backtest.digitHitCount === 3 ? 'hit' : ''}`}>
                <div className="bt-name">组选命中</div>
                <div className="bt-val">{backtest.digitHitCount}/3</div>
              </div>
              <div className={`bt-metric ${backtest.spanHit ? 'hit' : ''}`}>
                <div className="bt-name">跨度</div>
                <div className="bt-val">{backtest.spanHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.sumHit ? 'hit' : ''}`}>
                <div className="bt-name">和值</div>
                <div className="bt-val">{backtest.sumHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.oddHit ? 'hit' : ''}`}>
                <div className="bt-name">奇偶</div>
                <div className="bt-val">{backtest.oddHit ? '✓' : '✗'}</div>
              </div>
              <div className={`bt-metric ${backtest.formHit ? 'hit' : ''}`}>
                <div className="bt-name">形态</div>
                <div className="bt-val">{backtest.formHit ? '✓' : '✗'}</div>
              </div>
              <div className="bt-metric total">
                <div className="bt-name">综合评分</div>
                <div className="bt-val">{backtest.score}/100</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 术语大全 */}
      <div className="fc3d-terms">
        <h2 className="section-title">术语大全</h2>
        {TERMS.map((group) => (
          <section key={group.title} className="term-group">
            <h3>{group.title}</h3>
            <div className="term-grid">
              {group.items.map((t) => (
                <div key={t.name} className="term-card">
                  <div className="term-name">{t.name}</div>
                  <div className="term-desc">{t.desc}</div>
                  {t.example && <div className="term-example">{t.example}</div>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
