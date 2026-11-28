// 福彩3D 下期推荐 —— 基于多维度术语评分的下期推算 + 上期回算验证
// 算法档位由 algoInfo 驱动：福彩3D 两档（v1/v2），排列三三档（v1/v2/pro）
// 多版本时默认输出跨版本「融合推荐」（见 lib/fusion.js），单版本档位折叠进高级区
import React, { useEffect, useMemo, useState } from 'react'
import * as fc3dEngine from '../lib/fc3dPredict.js'
import { readLearning } from '../lib/learning.js'
import {
  walkForwardStats,
  fusionWeights,
  fuseView,
  hasPosTop,
  adaptPosTop,
  FUSION_WALK_PERIODS,
  FUSION_TEMPERATURE,
} from '../lib/fusion.js'
import DigitAI from './DigitAI.jsx'

const FUSION_KEY = 'fusion'
const shortKey = (k) => (k === 'pro' ? 'Pro' : k)

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

const ALGO_INFO = {
  v1: { name: '经典综合评分', desc: '热冷+跨度+和值+奇偶+形态+遗漏 8 维度加权评分' },
  v2: { name: '精准模式', desc: '位置独立建模 + 马尔可夫转移 + 指数衰减 + 遗漏回补', recommend: true },
  v4: { name: '技术指标 v4', desc: 'MA5/MA10 + 布林带 + MACD 投影和值/跨度区间，仅作走势参考' },
}

// 档位 → 引擎函数名，避免在组件里写死 if/else
const ALGO_FN = {
  v1: { predict: 'predictFC3D', backtest: 'backtestFC3D' },
  v2: { predict: 'predictFC3Dv2', backtest: 'backtestFC3Dv2' },
  pro: { predict: 'predictPL3Pro', backtest: 'backtestPL3Pro' },
  v4: { predict: 'predictFC3Dv4', backtest: 'backtestFC3Dv4' },
}

export default function FC3D({
  draws,
  engine = fc3dEngine,
  algoInfo = ALGO_INFO,
  showTiers = false,
  label = '福彩3D',
  game = 'fc3d',
  onRefreshData,
  positions = ['百', '十', '个'],
  digitCount = 3,
  algoFn = ALGO_FN,
  defaultCover = 6,
}) {
  const [algo, setAlgo] = useState(null) // null = 未选择：有融合能力时默认融合，否则用推荐档
  const [showPicker, setShowPicker] = useState(false)
  const [showWeights, setShowWeights] = useState(false)
  const [cover, setCover] = useState(defaultCover)
  const [coverRate, setCoverRate] = useState(0.8)

  // 可融合探测：跑一遍各非 v4 版本的当前输出，按结构（posTop）判定能否参与融合。
  // v4 是指标区间参考，按产品约定不进入融合。
  const probe = useMemo(() => {
    const out = {}
    for (const k of Object.keys(algoInfo)) {
      if (k === 'v4') continue
      const name = algoFn[k] && algoFn[k].predict
      if (!name || typeof engine[name] !== 'function') continue
      try {
        out[k] = engine[name](draws, { cover: 6, coverRate: 0.8 })
      } catch {
        out[k] = null
      }
    }
    return out
  }, [draws, engine, algoInfo, algoFn])
  const fusionKeys = useMemo(
    () => Object.keys(probe).filter((k) => hasPosTop(adaptPosTop(probe[k]))),
    [probe],
  )
  const fusionAvailable = fusionKeys.length >= 2

  // walk-forward 近 30 期定权 + 当前期融合输出（不随 cover/coverRate 变化重算定权）
  const fusionStats = useMemo(
    () =>
      fusionAvailable
        ? walkForwardStats(
            engine,
            fusionKeys,
            (k) => algoFn[k].predict,
            draws,
            { periods: FUSION_WALK_PERIODS, minTrain: 40 },
          )
        : null,
    [fusionAvailable, engine, fusionKeys, algoFn, draws],
  )
  const fusion = useMemo(() => {
    if (!fusionAvailable || !fusionStats) return null
    const { weights, equalized } = fusionWeights(fusionStats, fusionKeys)
    return {
      weights,
      equalized,
      view: fuseView(engine, fusionKeys, (k) => algoFn[k].predict, draws, weights, { coverRate }),
    }
  }, [fusionAvailable, fusionStats, engine, fusionKeys, algoFn, draws, coverRate])

  const defaultAlgo = Object.keys(algoInfo).find((k) => algoInfo[k].recommend) || 'v2'
  // 数据变化导致融合失效 / algo 键不存在时回退到默认档，避免 algoInfo[algoCur] 取空
  const algoCur =
    algo === FUSION_KEY
      ? fusionAvailable
        ? FUSION_KEY
        : defaultAlgo
      : algo && algoInfo[algo]
        ? algo
        : fusionAvailable
          ? FUSION_KEY
          : defaultAlgo
  const isFusion = algoCur === FUSION_KEY && !!fusion
  // 融合视图下，辅助明细取权重最高的可融合版本
  const primary = isFusion
    ? fusionKeys.reduce((a, b) => (fusion.weights[a] >= fusion.weights[b] ? a : b), fusionKeys[0])
    : algoCur
  const fn = algoFn[primary] || Object.values(algoFn)[0]

  // 学习中心自适应权重：挂载时读一次（切彩种随 game 重读）；none/coldStart 不传 override
  const [learning, setLearning] = useState(null)
  useEffect(() => {
    let alive = true
    readLearning(game)
      .then((r) => alive && setLearning(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [game])
  // learning_state 'experts:p0..pN' → 引擎 weightsOverride：
  // pl3/qxc 为按位顺序数组（每项长度=专家数）；fc3d 引擎取单条扁平权重，逐位平均
  const learnW = useMemo(() => {
    if (!learning || learning.source === 'none' || learning.coldStart) return null
    const experts = engine.FC3D_EXPERTS || engine.PRO_EXPERTS
    if (!experts) return null
    const npos = game === 'qxc' ? 7 : 3
    const fams = []
    let n = Infinity
    for (let pos = 0; pos < npos; pos++) {
      const v = (learning.state.find((s) => s.paramKey === `experts:p${pos}`) || {}).value
      if (
        !v ||
        !Array.isArray(v.keys) ||
        !Array.isArray(v.weights) ||
        v.keys.length !== experts.length ||
        v.weights.length !== experts.length
      )
        return null
      if (!v.weights.every((x) => Number.isFinite(Number(x)))) return null
      fams.push(v.weights.map(Number))
      n = Math.min(n, Number(v.n || 0))
    }
    const weightsOverride =
      game === 'fc3d' ? fams[0].map((_, i) => fams.reduce((a, f) => a + f[i], 0) / npos) : fams
    return { weightsOverride, n }
  }, [learning, game, engine])
  const overrideActive =
    !!learnW &&
    ((game === 'fc3d' && fn.predict === 'predictFC3Dv2') ||
      (game === 'pl3' && fn.predict === 'predictPL3Pro') ||
      (game === 'qxc' && fn.predict === 'predictQXC'))

  const pred = useMemo(
    () =>
      engine[fn.predict](
        draws,
        overrideActive ? { cover, coverRate, weightsOverride: learnW.weightsOverride } : { cover, coverRate },
      ),
    [draws, engine, fn.predict, cover, coverRate, overrideActive, learnW],
  )
  const backtest = useMemo(() => engine[fn.backtest](draws), [draws, engine, fn.backtest])

  if (!pred) {
    return (
      <div className="page">
        <div className="note note-warn">数据不足，至少需要 5 期才能进行推算。</div>
      </div>
    )
  }

  return (
    <div className="fc3d">
      {/* 玩法简介 */}
      <div className="fc3d-intro">
        <h2>下期推荐推算</h2>
        <p>
          基于 {draws.length} 期历史数据推算下期参考号码。当前算法：
          <b style={{ margin: '0 4px' }}>{isFusion ? '融合推荐' : algoInfo[algoCur].name}</b>
          <span className="muted">
            （
            {isFusion
              ? `按近 ${FUSION_WALK_PERIODS} 期回测权重合并 ${fusionKeys.map((k) => algoInfo[k].name).join(' 与 ')} 的定位候选`
              : algoInfo[algoCur].desc}
            ）
          </span>
        </p>
        {fusionAvailable ? (
          <div className="algo-toggle">
            {!showPicker && isFusion ? (
              <button className="tab-btn" onClick={() => setShowPicker(true)}>
                ▸ 切换单版本（{Object.keys(algoInfo).map(shortKey).join('/')}）
              </button>
            ) : (
              <>
                <button
                  className={`tab-btn ${isFusion ? 'active' : ''}`}
                  onClick={() => {
                    setAlgo(FUSION_KEY)
                    setShowPicker(false)
                  }}
                >
                  融合推荐
                  <em style={{ color: 'var(--red)' }}> · 默认</em>
                </button>
                {Object.entries(algoInfo).map(([k, v]) => (
                  <button
                    key={k}
                    className={`tab-btn ${algoCur === k ? 'active' : ''}`}
                    onClick={() => setAlgo(k)}
                  >
                    {v.name}
                    {v.recommend && <em style={{ color: 'var(--red)' }}> · 推荐</em>}
                  </button>
                ))}
                {isFusion && (
                  <button className="tab-btn" onClick={() => setShowPicker(false)}>
                    ▾ 收起
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="algo-toggle">
            {Object.entries(algoInfo).map(([k, v]) => (
              <button
                key={k}
                className={`tab-btn ${algoCur === k ? 'active' : ''}`}
                onClick={() => setAlgo(k)}
              >
                {v.name}
                {v.recommend && <em style={{ color: 'var(--red)' }}> · 推荐</em>}
              </button>
            ))}
          </div>
        )}
        <div className="algo-toggle" style={{ marginTop: 8 }}>
          <span className="muted small" style={{ alignSelf: 'center', marginRight: 6 }}>
            区间覆盖目标
          </span>
          {[0.7, 0.8, 0.85, 0.9].map((r) => (
            <button
              key={r}
              className={`tab-btn ${coverRate === r ? 'active' : ''}`}
              onClick={() => setCoverRate(r)}
            >
              {Math.round(r * 100)}%
            </button>
          ))}
          <span className="muted small" style={{ alignSelf: 'center', marginLeft: 6 }}>
            目标越高，区间越宽、命中率越高，但没有任何信息增益
          </span>
        </div>
      </div>

      {overrideActive && (
        <div className="muted small" style={{ margin: '8px 0' }}>
          权重来自学习中心（n={learnW.n} 期样本）· 仅优化一致性，不提高中奖概率
        </div>
      )}

      {/* AI 分析放在最上方，和推荐结果一起看 */}
      <DigitAI
        draws={draws}
        label={label}
        game={game}
        digitCount={digitCount}
        onRefreshData={onRefreshData}
      />

      {/* 融合推荐：跨版本定位候选加权合并 */}
      {isFusion && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>融合推荐 · 定位候选加权合并</h3>
            <span
              className="muted small"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowWeights((s) => !s)}
            >
              {fusionKeys.map((k) => `${shortKey(k)} ${Math.round(fusion.weights[k] * 100)}%`).join(' · ')}
              {' '}▸ 权重详情
            </span>
          </div>
          {showWeights && (
            <div className="muted small" style={{ margin: '6px 0 10px' }}>
              权重来自近 {FUSION_WALK_PERIODS} 期逐期回算（每期只用它之前的数据）：
              {fusionKeys
                .map(
                  (k) =>
                    `${algoInfo[k].name} 平均按位命中 ${
                      fusionStats[k]?.status === 'ok' ? fusionStats[k].avgHit.toFixed(2) : '—'
                    }（${fusionStats[k]?.n || 0} 期）`,
                )
                .join('；')}
              。{fusion.equalized ? '样本不足，已退化为等权' : `weights = softmax(平均命中 × ${FUSION_TEMPERATURE})`}
            </div>
          )}

          <div className="predict-row">
            <div className="predict-label">定位候选</div>
            <div className="predict-value">
              {fusion.view.posDist.map((pd, i) => (
                <span key={i} className="pos-rec">
                  <b>{positions[i] || `${i + 1}位`}</b>
                  {pd.prob
                    .map((v, d) => ({ v, d, sources: pd.sources[d] }))
                    .filter((x) => x.v > 0)
                    .sort((a, b) => b.v - a.v)
                    .slice(0, 3)
                    .map((x) => (
                      <span
                        key={x.d}
                        className="digit-ball small"
                        title={`融合概率 ${(x.v * 100).toFixed(1)}% · 来自 ${x.sources.map(shortKey).join('/')}`}
                      >
                        {x.d}
                        <em>{Math.round(x.v * 100)}</em>
                      </span>
                    ))}
                </span>
              ))}
            </div>
          </div>

          <div className="predict-sub" style={{ marginTop: 10 }}>直选组合 Top {fusion.view.combos.length}</div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>号码</th>
                  <th>融合概率</th>
                  <th>和值</th>
                  <th>跨度</th>
                  <th>形态</th>
                </tr>
              </thead>
              <tbody>
                {fusion.view.combos.map((c) => (
                  <tr key={c.num.join('-')}>
                    <td className="mono">{c.rank}</td>
                    <td className="mono">
                      <b>{c.num.join(' ')}</b>
                    </td>
                    <td className="mono">{c.prob}%</td>
                    <td className="mono">{c.sum}</td>
                    <td className="mono">{c.span}</td>
                    <td>{c.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="metric-grid" style={{ marginTop: 12 }}>
            <div className="metric-card">
              <div className="metric-name">和值参考</div>
              <div className="metric-value">
                {fusion.view.sumRange[0]} – {fusion.view.sumRange[1]}
              </div>
              <div className="metric-sub">由合并分布推得 · 覆盖目标 {Math.round(coverRate * 100)}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">跨度参考</div>
              <div className="metric-value">
                {fusion.view.spanRange[0]} – {fusion.view.spanRange[1]}
              </div>
              <div className="metric-sub">由合并分布推得 · 覆盖目标 {Math.round(coverRate * 100)}%</div>
            </div>
          </div>

          <div className="note note-info" style={{ marginTop: 12 }}>
            融合不提高中奖概率——它只是把「该选哪个版本」的不确定性摊平成加权组合，
            长期命中仍收敛随机期望（按位 Top2 候选的随机期望为每位 2/10）。
            v4 为走势区间参考，不进入融合；v1 经典综合评分没有定位输出，同样不参与融合。
          </div>
        </div>
      )}

      {isFusion && (
        <div className="muted small" style={{ margin: '10px 0 6px' }}>
          以下为辅助明细 · 来自 {algoInfo[primary].name}（融合权重最高 {Math.round(fusion.weights[primary] * 100)}%）
        </div>
      )}

      {/* 上期开奖 */}
      <div className="predict-row">
        <div className="predict-label">上期开奖</div>
        <div className="predict-value">
          <span className="draw-num">{pred.lastDraw.num.join(' ')}</span>
          <span className="muted mono">
            {pred.lastDraw.id ?? pred.lastDraw.drawId} · 和值 {pred.lastAnalysis.sum} · 跨度 {pred.lastAnalysis.span} ·{' '}
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

      {/* 七星彩后区（0–14） */}
      {pred.backTop && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>后区推荐（0 – 14）</h3>
            <span className="muted small">后区独立建模 · 与前 6 位概率结构不同</span>
          </div>
          <div className="predict-row">
            <div className="predict-label">后区 Top3</div>
            <div className="predict-value">
              {pred.backTop.map((d) => (
                <DigitBall key={`back-${d}`} d={d} omit={pred.omitBack?.[d] ?? 0} />
              ))}
            </div>
          </div>
          <div className="predict-row">
            <div className="predict-label">后区排名</div>
            <div className="predict-value">
              {pred.backRanked.slice(0, 8).map((r) => (
                <span key={`backrank-${r.digit}`} className="digit-ball small" title={`遗漏 ${r.omit} 期`}>
                  {r.digit}
                  <em>{r.omit}</em>
                </span>
              ))}
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            后区只有 15 个取值，单号随机概率 1/15 ≈ 6.67%；推荐只表示模型在候选集内的相对排序。
          </div>
        </div>
      )}

      {/* 覆盖档位：6/7/8 码，命中与成本一目了然 */}
      {showTiers && pred.tiers && (
        <div className="predict-row">
          <div className="predict-label">覆盖档位</div>
          <div className="predict-value">
            {pred.tiers.map((t) => (
              <button
                key={t.cover}
                className={`tab-btn ${cover === t.cover ? 'active' : ''}`}
                onClick={() => setCover(t.cover)}
              >
                {t.cover} 码 · 期望 {t.expectHits}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTiers && pred.tiers && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>覆盖档位 · 命中与成本</h3>
            <span className="muted small">期望命中 = 覆盖码数 × {digitCount * 10}%</span>
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>档位</th>
                  <th>平均命中</th>
                  <th>{digitCount} 码全覆盖</th>
                  <th>{pred.tiers[0]?.groupBets !== undefined ? '组选复式' : '直选复式'}</th>
                  <th>成本</th>
                  <th>每命中 1 个号</th>
                </tr>
              </thead>
              <tbody>
                {pred.tiers.map((t) => (
                  <tr key={t.cover}>
                    <td>
                      {t.cover} 码
                      {cover === t.cover ? (
                        <span className="prize-badge prize-badge-win" style={{ marginLeft: 6 }}>当前</span>
                      ) : null}
                    </td>
                    <td className="mono">{t.expectHits} 个</td>
                    <td className="mono">{t.fullCoverRate}%</td>
                    <td className="mono">{t.groupBets !== undefined ? `${t.groupBets} 注` : `${t.directBets} 注`}</td>
                    <td className="mono">{t.groupBets !== undefined ? `${t.groupCost} 元` : `${t.directCost} 元`}</td>
                    <td className="mono">{t.costPerHit} 元</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note note-info" style={{ marginTop: 12 }}>
            档位越高，平均命中越多（{pred.tiers[0]?.cover} 码 {pred.tiers[0]?.expectHits} 个 →{' '}
            {pred.tiers[pred.tiers.length - 1]?.cover} 码 {pred.tiers[pred.tiers.length - 1]?.expectHits} 个），但每命中 1 个号的代价同步上升，
            单注中奖概率本身不变。选哪档只取决于你愿意花多少钱，不存在“更划算的选号”。
          </div>
        </div>
      )}

      {/* v2 定位推荐（融合视图已由融合卡输出，不重复展示） */}
      {!isFusion && pred.posTop && (
        <div className="predict-row">
          <div className="predict-label">定位推荐</div>
          <div className="predict-value">
            {positions.map((label, i) => (
              <span key={label} className="pos-rec">
                <b>{label}</b>
                {pred.posTop[i].map((d) => (
                  <span key={d} className="digit-ball small">{d}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* v3 Pro 增强输出：结构约束后的 Top 组合 + 直选方案 + 专家权重 */}
      {!isFusion && pred.topCombos && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>v3 Pro 增强输出</h3>
            <span className="muted small">
              9 专家自适应集成 · 结构约束强度 β={pred.structBeta}
            </span>
          </div>

          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>号码</th>
                  <th>模型概率</th>
                  <th>相对提升</th>
                  <th>和值</th>
                  <th>跨度</th>
                  <th>形态</th>
                </tr>
              </thead>
              <tbody>
                {pred.topCombos.map((c) => (
                  <tr key={c.num.join('-')}>
                    <td className="mono">{c.rank}</td>
                    <td className="mono">
                      <b>{c.num.join(' ')}</b>
                    </td>
                    <td className="mono">{c.prob}%</td>
                    <td className="mono">×{c.lift}</td>
                    <td className="mono">{c.sum}</td>
                    <td className="mono">{c.span}</td>
                    <td>{c.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chip-row" style={{ marginTop: 12 }}>
            <span className="chip">
              <i>
                直选方案 {pred.directPlan.bets} 注 · {pred.directPlan.cost} 元
              </i>
            </span>
            {positions.map((label, i) => (
              <span key={label} className="chip">
                <i>
                  {label}位 {pred.directPlan.pos[i].join(' ')}
                </i>
              </span>
            ))}
          </div>

          <div className="predict-sub" style={{ marginTop: 14 }}>专家当前权重（Hedge 自适应，%）</div>
          <div className="chip-row">
            {pred.expertWeights.map((e) => (
              <span key={e.key} className="chip">
                <i>
                  {e.name} {e.weight}
                </i>
              </span>
            ))}
          </div>

          <div className="note note-info" style={{ marginTop: 12 }}>
            权重不是手工拍的：每个专家先在最近 24 期上按对数损失打分，越准权重越高，所以权重接近均匀
            恰恰说明没有哪个专家真的更懂未来。Top 组合的「相对提升」是结构约束加权后的概率相对原始
            位置模型的倍数，只代表推荐区更集中，<b>不代表单注中奖概率变高</b>。
          </div>
        </div>
      )}

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
          <div className="metric-sub">
            取 {pred.spanRange[1] - pred.spanRange[0] + 1} 个值 · 均值 {pred.spanAvg} · 众数 {pred.spanMode}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-name">和值</div>
          <div className="metric-value">
            {pred.sumRange[0]} – {pred.sumRange[1]}
          </div>
          <div className="metric-sub">
            取 {pred.sumRange[1] - pred.sumRange[0] + 1} 个值 · 均值 {pred.sumAvg} · 众数 {pred.sumMode}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-name">奇偶形态</div>
          <div className="metric-value">{pred.recommendedOdd.slice(0, 2).join(' / ')}</div>
          <div className="metric-sub">
            取 {pred.recommendedOdd.length} 种 · 上限 {((pred.recommendedOdd.length / (pred.oddTotal || 8)) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-name">推荐形态</div>
          <div className="metric-value">{pred.recommendedForms.join(' / ')}</div>
          <div className="metric-sub">近50期出现频率</div>
        </div>
      </div>

      {/* 技术指标档：K 线指标投影（仅 v4 输出） */}
      {pred.indicator && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>技术指标档 · 和值 / 跨度投影</h3>
            <span className="muted small">
              和值序列 {pred.indicator.window} 期 · MA5 {pred.indicator.sumProj.ma5} · 布林{' '}
              {pred.indicator.sumProj.lower}–{pred.indicator.sumProj.upper} · KDJ 定位修正已启用
            </span>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-name">和值投影</div>
              <div className="metric-value">
                {pred.indicator.sumProj.lo} – {pred.indicator.sumProj.hi}
              </div>
              <div className="metric-sub">
                中枢 {pred.indicator.sumProj.center} · σ {pred.indicator.sumProj.sigma} ·{' '}
                {pred.indicator.sumProj.bollState}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-name">跨度投影</div>
              <div className="metric-value">
                {pred.indicator.spanProj.lo} – {pred.indicator.spanProj.hi}
              </div>
              <div className="metric-sub">
                中枢 {pred.indicator.spanProj.center} · σ {pred.indicator.spanProj.sigma}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-name">趋势方向</div>
              <div className="metric-value">
                {pred.indicator.sumProj.trend > 0 ? '↑ 偏强' : pred.indicator.sumProj.trend < 0 ? '↓ 偏弱' : '→ 走平'}
              </div>
              <div className="metric-sub">
                MACD 柱 {pred.indicator.sumProj.hist} · 强度 {pred.indicator.sumProj.trend}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-name">布林中轨</div>
              <div className="metric-value">{pred.indicator.sumProj.mid}</div>
              <div className="metric-sub">上 {pred.indicator.sumProj.upper} · 下 {pred.indicator.sumProj.lower}</div>
            </div>
          </div>

          <div className="chip-row" style={{ marginTop: 10 }}>
            {pred.indicator.compat.map((c) => (
              <span key={c.digit} className="chip">
                <i>
                  {c.digit} 号兼容 {c.rate}%
                </i>
              </span>
            ))}
          </div>

          {pred.indicator.kdj && (
            <div className="chip-row" style={{ marginTop: 6 }}>
              {pred.indicator.kdj.map((k) => (
                <span key={k.digit} className="chip">
                  <i>
                    {k.digit} 号 KDJ 修正 {k.bias > 0 ? '+' : ''}
                    {k.bias}
                  </i>
                </span>
              ))}
            </div>
          )}

          <div className="note note-info" style={{ marginTop: 12 }}>
            这一档把和值/跨度区间换成「布林中轨 + MA5 + MACD 柱」的投影，并按两码和落在投影区间的概率给数字加减分；
            再对百/十/个三个位置各自的 0–9 遗漏序列做 KDJ(9,3,3) 与 MACD 读数，超卖区、金叉、绿柱收敛轻微加分，
            超买区、死叉、红柱收敛轻微减分。
            指标只是同一条序列的平滑，<b>不含未来信息、也不提高命中率</b>，只是多一个观察角度。
          </div>
        </div>
      )}

      <div className="note note-warn" style={{ marginTop: 12 }}>
        和值、跨度、奇偶的「准确率」由取值个数决定：奇偶 8 种形态真实概率各为 1/8，取 7 种的上限就是
        87.5%，取 6 种只有 75%；和值取 13 个值的上限约 80%。这不是算法能突破的，只是覆盖宽度的算术结果。
      </div>

      {/* 奇偶专项 */}
      {pred.oddEven && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>奇偶专项</h3>
            <span className="muted small">形态遗漏回补 · 位置奇偶节奏 · 连出变盘</span>
          </div>

          {/* 位置奇偶节奏 */}
          <div className="odd-pos-row">
            {pred.oddEven.perPos.map((p) => (
              <div key={p.pos} className="odd-pos">
                <div className="odd-pos-label">{p.label}位倾向</div>
                <span className={`odd-bit ${p.recommend === '奇' ? 'odd' : 'even'}`}>{p.recommend}</span>
                <div className="odd-pos-sub">
                  当前{p.current} · 连 {p.streak} 期
                </div>
                <div className="odd-pos-reason">{p.reason}</div>
              </div>
            ))}
          </div>

          {/* 8 形态评分 */}
          <div className="odd-pattern-list">
            {pred.oddEven.ranked.map((p, i) => (
              <div key={p.pattern} className={`odd-pattern ${i < 3 ? 'top' : ''}`}>
                <span className="op-name">{p.pattern}</span>
                <span className="op-macro">{p.macro}</span>
                <span className="op-omit">漏 {p.omit}</span>
                <span className="op-score">{p.score}</span>
              </div>
            ))}
          </div>

          {/* 宏观形态分布 */}
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>宏观形态</th>
                  <th>近期次数</th>
                  <th>理论概率</th>
                  <th>遗漏</th>
                  <th>理论周期</th>
                  <th>评分</th>
                </tr>
              </thead>
              <tbody>
                {pred.oddEven.macro.map((m) => (
                  <tr key={m.macro}>
                    <td>{m.macro}</td>
                    <td className="mono">{m.count}</td>
                    <td className="mono">{(m.prob * 100).toFixed(1)}%</td>
                    <td className="mono">{m.omit}</td>
                    <td className="mono">{m.cycle}</td>
                    <td className="mono">{m.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note note-info" style={{ marginTop: 12 }}>
            两奇一偶 / 两偶一奇合计占 75%（理论周期 2.67 期），全奇 / 全偶合计 25%（理论周期 8 期）。
            遗漏越久标记回补关注，但开奖独立随机，形态不会“强制平衡”。
          </div>
        </div>
      )}

      {/* 012 路专项 */}
      {pred.road012 && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>012 路专项</h3>
            <span className="muted small">除 3 余数分布 · 荐路 / 杀路</span>
          </div>

          <div className="road-legend">
            {pred.road012.roadName.map((name, r) => (
              <span key={r} className={`road-chip road-${r}`}>
                {name}：{pred.road012.roadDigits[r].join(' ')}
              </span>
            ))}
          </div>

          <div className="odd-pos-row">
            {pred.road012.perPosRoad.map((p) => (
              <div key={p.pos} className="odd-pos">
                <div className="odd-pos-label">{p.label}位路数</div>
                <span className={`road-bit road-${p.recommend}`}>{p.recommend}路</span>
                <div className="odd-pos-sub">
                  当前 {p.current}路 · 近{p.counts.join('/')}
                </div>
                <div className="odd-pos-reason">
                  倾向 {p.recommend} 路（{pred.road012.roadDigits[p.recommend].join(' ')}）
                </div>
              </div>
            ))}
          </div>

          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>路数</th>
                  <th>号码</th>
                  <th>近期次数</th>
                  <th>遗漏</th>
                  <th>评分</th>
                  <th>建议</th>
                </tr>
              </thead>
              <tbody>
                {pred.road012.roadName.map((name, r) => {
                  const order = pred.road012.recommendedRoads.indexOf(r)
                  return (
                    <tr key={r}>
                      <td>{name}</td>
                      <td className="mono">{pred.road012.roadDigits[r].join(' ')}</td>
                      <td className="mono">{pred.road012.roadCount[r]}</td>
                      <td className="mono">{pred.road012.roadOmit[r]}</td>
                      <td className="mono">{pred.road012.roadScore[r]}</td>
                      <td>
                        {pred.road012.killedRoad === r ? (
                          <span className="prize-badge prize-badge-invalid">杀路</span>
                        ) : order < 2 ? (
                          <span className="prize-badge prize-badge-win">荐路</span>
                        ) : (
                          <span className="prize-badge prize-badge-lose">观望</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            推荐路数组合：{pred.road012.recommendedPatterns.join(' / ')}（百十个）
          </div>
        </div>
      )}

      {/* 重号 · 邻号 · 杀号 */}
      {pred.repeatNeighbor && (
        <div className="odd-card">
          <div className="odd-card-head">
            <h3>重号 · 邻号 · 杀号</h3>
            <span className="muted small">上期 {pred.repeatNeighbor.lastNums.join(' ')}</span>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-name">平均重号</div>
              <div className="metric-value">{pred.repeatNeighbor.avgRepeat}</div>
              <div className="metric-sub">相邻两期重复号码个数</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">预期重号</div>
              <div className="metric-value">{pred.repeatNeighbor.expectedRepeat}</div>
              <div className="metric-sub">近期重号个数众数</div>
            </div>
            <div className="metric-card">
              <div className="metric-name">邻号命中率</div>
              <div className="metric-value">{pred.repeatNeighbor.neighborRate}%</div>
              <div className="metric-sub">下期出现邻号的比例</div>
            </div>
          </div>

          <div className="predict-row">
            <div className="predict-label">重号候选</div>
            <div className="predict-value">
              {pred.repeatNeighbor.repeatCandidates.map((d) => (
                <span key={`rep-${d}`} className="digit-ball small">{d}</span>
              ))}
            </div>
          </div>
          <div className="predict-row">
            <div className="predict-label">邻号推荐</div>
            <div className="predict-value">
              {pred.repeatNeighbor.neighborNums.map((d) => (
                <span key={`nb-${d}`} className="digit-ball small">{d}</span>
              ))}
            </div>
          </div>
          <div className="predict-row">
            <div className="predict-label">杀号建议</div>
            <div className="predict-value">
              {pred.kill.map((k) => (
                <span key={`kill-${k.digit}`} className="kill-chip" title={k.reason}>
                  {k.digit}<em>漏{k.omit}</em>
                </span>
              ))}
            </div>
          </div>

          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>重号个数</th>
                  <th>出现期数</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                {pred.repeatNeighbor.repeatDist.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k} 个</td>
                    <td className="mono">{r.count}</td>
                    <td className="mono">{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            杀号理由：{pred.kill.map((k) => `${k.digit}（${k.reason}）`).join('；')}
          </div>
        </div>
      )}

      {/* 全部数字评分 */}
      <div className="digit-scores">
        <div className="predict-label">
          {game === 'qxc' ? '前区 0-9 综合评分' : '0-9 综合评分'}（含遗漏期数）
        </div>
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

      {/* 回算验证 */}
      {backtest && (
        <div className="fc3d-backtest">
          <h2 className="section-title">上期回算验证</h2>
          <div className="backtest-card">
            <div className="backtest-row">
              <div className="backtest-label">预测期号</div>
              <div className="backtest-value mono">{backtest.actualDraw.id}</div>
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
              <div className={`bt-metric ${backtest.digitHitCount === digitCount ? 'hit' : ''}`}>
                <div className="bt-name">命中</div>
                <div className="bt-val">{backtest.digitHitCount}/{digitCount}</div>
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

      <div className="note note-warn" style={{ marginTop: 16 }}>
        ⚠️ 彩票开奖号码完全随机，以上推算仅为历史数据的统计描述，无法预测中奖，请理性购彩！
      </div>
    </div>
  )
}
