# 彩票数据分析网站 · 项目交接文档

> 线上地址：https://cai.rayzo.cn ｜ 仓库：https://github.com/CRAI123/caipiao
>
> 一句话：把快乐8、福彩3D、排列三、双色球的历史开奖数据做成可视化分析工具，叠加算法选号、大模型解读，并每天 14:00 把四个彩种的参考号码推送到飞书群。

**先读这一段，避免误解产品定位**

彩票每期开奖是独立随机事件，任何算法都不会改变单注中奖概率。站内所有"冷热、遗漏、形态、评分、AI 终选"都是**对历史数据的描述性统计**，以及"在推荐区内提高覆盖效率"的工程手段。代码注释里多处写了 `⚠️ 不构成预测`，这是刻意保留的口径，不要在产品文案里改成"能预测""必中"。

---

## 1. 项目概览

| 项目 | 说明 |
| --- | --- |
| 定位 | 个人/小圈子使用的彩票数据研究站，无商业运营、无支付 |
| 彩种 | 快乐8（80 选 20）、福彩3D（000-999）、排列三（000-999）、双色球（33 选 6 + 16 选 1） |
| 核心能力 | 冷热/遗漏/形态/K线/重号等统计、下期推荐（算法 + AI）、中奖计算、复式胆拖、购彩账本、方法体检（前推回测）、每日飞书推送 |
| 用户体系 | 无账号密码。`device_id`（浏览器设备码）+ 昵称，管理员审核制进入（见 §5.4） |
| 数据存储 | Neon Postgres（共享缓存、账本、配置），无自建后端服务 |

---

## 2. 技术栈

| 层 | 选型 | 备注 |
| --- | --- | --- |
| 前端 | React 18 + Vite 5 | **没有路由库**，用 `useState` 切 tab；样式为普通 CSS + 内联 |
| 图表 | 自研 SVG 组件（`KlineChart.jsx`、`OmissionChart.jsx` 等） | 没引 echarts/chart.js |
| 后端 | Vercel Serverless Functions（`api/*.js`，ESM） | 只做代理、AI 调用、定时任务 |
| 数据库 | Neon Postgres + `@neondatabase/serverless` | 服务端与浏览器都直连 |
| 大模型 | OpenAI 兼容 `/chat/completions`，默认走 3hdmx 中转的 `claude-sonnet-5` | 见 `api/_lib/ai.js` |
| 桌面端 | Tauri v2（可选） | React 以 iframe 形式嵌在 Vue 外壳里，通过 `postMessage` 桥接（`src/lib/tauri.js`） |
| 部署 | Vercel（静态前端 + Serverless + Cron） | `vercel.json` |

依赖极少：`react`、`react-dom`、`@neondatabase/serverless`、`@tauri-apps/api`。没有测试框架、没有 lint 配置。

---

## 3. 目录结构

```
e:\caipiao
├─ api/                      Vercel Serverless Functions
│  ├─ _lib/                  服务端公共模块
│  │  ├─ ai.js               大模型配置解析 + callAi()
│  │  ├─ neon.js             getSql()/ensureTables()/readConfig/writeConfig
│  │  ├─ http.js             applyCors 统一 CORS/OPTIONS
│  │  ├─ kl8.js fc3d.js pl3.js ssq.js   各彩种开奖抓取
│  │  └─ xml.js              XML 解析
│  ├─ daily-push.js          每日 14:00 飞书推送（核心）
│  ├─ daily-review.js        每日 10:00 复盘（cron）
│  ├─ ai-predict.js          快乐8 单次 AI 选号
│  ├─ ai-deep.js             快乐8 AI 深度分析（共享缓存）
│  ├─ digit-ai.js            3D / 排列三 AI 解读（共享缓存，四轮）
│  ├─ cwl-proxy.js           福彩官网代理（快乐8 / 3D）
│  ├─ pl3-proxy.js           体彩官网代理（排列三）
│  ├─ ssq-proxy.js           双色球开奖代理
│  ├─ kl8-promo.js           快乐8 派奖公告监控
│  ├─ store-prediction.js    写入 kl8_predictions
│  ├─ get-reviews.js         读取 kl8_daily_reviews
│  └─ lark-proxy.js          飞书多维表格（账本）同步代理
├─ src/
│  ├─ App.jsx                入口：三套 tab 表 + 四彩种状态
│  ├─ components/            约 40 个页面/图表组件（按彩种前缀区分）
│  ├─ lib/                   统计、算法、AI 客户端、数据库、设置
│  ├─ data/                  内置历史数据兜底（sample/fc3d/pl3/ssq）
│  └─ assets/
├─ public/
├─ vercel.json               cron + rewrites
├─ vite.config.js            开发代理 + 构建期注入 __NEON_DATABASE_URL__
└─ package.json
```

**命名规律**：`src/components/` 里没有前缀的是快乐8，`FC3D*` 是福彩3D，`SSQ*` 是双色球；排列三与 3D 共用整套组件（靠 `lottery` 状态区分数据源）。

---

## 4. 本地运行与部署

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

### 4.1 环境变量

| 变量 | 用途 | 必须 |
| --- | --- | --- |
| `DATABASE_URL` | 服务端 Neon 连接串（`getSql()` 读取） | 是（缺了 AI 缓存/推送配置全退化） |
| `VITE_DATABASE_URL` / `DATABASE_URL` | 构建期注入 `__NEON_DATABASE_URL__`，作为前端直连默认值 | 可选 |
| `FEISHU_WEBHOOK_URL` | 飞书群机器人 webhook（也可存 DB） | 推送必需 |
| `FEISHU_WEBHOOK_SECRET` | 机器人开启签名校验时填写 | 按需 |
| `CRON_SECRET` | 校验 cron/手动触发的 `Authorization` | 建议 |

> ⚠️ **安全要点**：`vite.config.js` 会把 `DATABASE_URL` 通过 `define` 打进浏览器包（`__NEON_DATABASE_URL__`）。这是早期"纯浏览器应用"的遗留设计，注释里已警示"仅限个人本地使用"。如果给多人用，建议改成只走服务端接口、不要在构建环境里放可写连接串。

### 4.2 定时任务（vercel.json）

| 路径 | Cron（UTC） | 北京时间 | 作用 |
| --- | --- | --- | --- |
| `/api/daily-review` | `0 2 * * *` | 10:00 | 抓上期开奖 → 对比预测命中 → AI 写复盘 |
| `/api/daily-push` | `0 6 * * *` | 14:00 | 四彩种推荐推送到飞书群 |

Serverless 函数默认有执行时长上限，耗时接口都显式声明了 `export const config = { maxDuration: 60 }`（Vercel 需 Pro 档才允许 60s）。

---

## 5. 前端架构

### 5.1 页面结构

`src/App.jsx` 用三套 tab 常量驱动，没有任何路由：

- **快乐8**：总览 / 每日打卡 / 冷热遗漏 / 形态走势 / 走势K线 / 重号斜连 / 复式胆拖 / 概率奖金 / 下期推荐 / 方法体检 / 购彩账本 / 数据管理 / 后台 / 设置
- **福彩3D**：总览 / 冷热 / 形态 / K线 / 重号 / 复式胆拖 / 中奖计算 / 下期推荐 / 方法体检 / 术语大全 / 数据管理
- **双色球**：同上，另有"选号避挤"
- **排列三**：复用 3D 的组件，`lottery='pl3'` 时切换数据与算法档位（v1 / v3 / pro / v4）

### 5.2 数据流

```
用户切彩种 → App 里 fetch*Draws（走 /api/*-proxy）
           → 内置常量兜底（src/data/*.js，接口挂了也能看）
           → props 传给各 tab 组件 → 组件内部用 src/lib/* 现算统计/推荐
```

前端**不做持久化缓存**，每次刷新重新抓取；历史开奖数据是"抓取 + 内置兜底"两条路。

### 5.3 关键 lib

| 文件 | 作用 |
| --- | --- |
| `stats.js` | 快乐8 统计引擎：频次/遗漏/形态/重号/组合数学/奖级/启发式打分 |
| `kl8Math.js` | 快乐8 严格超几何概率与奖金表（P(m)=C(k,m)C(80-k,20-m)/C(80,20)） |
| `kl8V7.js` | 快乐8 v7 多窗口加权评分，产出推荐池 30 + 排除池 30 + 十码 |
| `kl8Arena.js` | 策略竞技场：严格前推回测 4 种策略 + 理论基准，给 z 值 |
| `kl8Calib.js` | 遗漏分档校准（log-loss 对比恒定 25%） |
| `fc3dPredict.js` | 3D 引擎：v1 多维评分、v2 位置独立建模+马尔可夫+遗漏回补、v4 技术指标档 |
| `pl3Predict.js` | 排列三 v3（4 专家 + 1000 穷举）与 v3 Pro（9 专家 Hedge 权重 + 六维结构约束） |
| `ssqPredict.js` | 双色球十章法（一层法→十分法）+ 蓝球周期 + 选号拥挤度 |
| `digitAi.js` | 3D/排列三 AI 用的统计摘要、算法候选池、prompt 构造 |
| `api.js` | 前端调后端的封装（浏览器用相对 `/api`，Tauri 用线上域名） |
| `aiWait.js` | 共享结果几乎秒回，为了让体验一致，按固定节奏播一遍"分析中"进度 |
| `access.js` / `device.js` | 访问申请、管理员、device_id 与 SHA-256 |
| `settings.js` / `neon.js` | localStorage 设置 + 浏览器直连 Neon |
| `journal.js` / `sync.js` | 购彩账本 CRUD 与同步、AI 分析回写 |
| `tauri.js` | 桌面端 postMessage 桥 |

### 5.4 访问控制

- 表：`access_requests(device_id PK, nickname, status[pending|approved|rejected], …)`、`admins(device_id PK, nickname)`、`admin_config(key, value)`
- 用户身份 = 浏览器 `device_id`（存 localStorage）；清缓存/换浏览器就是新用户
- 管理员 = 知道令牌（存 `admin_config` 里的是 SHA-256 哈希）或设备在 `admins` 表
- `AccessGate.jsx` 挡在应用外层；`Admin.jsx` 是审核后台
- **没有服务端 API 鉴权**，属于"熟人小圈子"强度，不要当正式权限系统用

### 5.5 设置页

`Settings.jsx` 把 Neon 连接串、大模型 base/key/model、飞书 App ID/Secret/App Token/Table ID 存在**当前浏览器 localStorage**，前端直连使用。注意这与服务端的 `admin_config` 是两套：**用户在设置页里改大模型，不影响 cron 推送用的服务端配置**。

---

## 6. 后端 API 一览

| 路径 | 方法 | 作用 | 缓存 | 大模型 |
| --- | --- | --- | --- | --- |
| `/api/cwl-proxy?path=` | GET | 福彩官网转发（快乐8/3D 开奖、公告），带 Referer | 无 | – |
| `/api/pl3-proxy?count=` | GET | 体彩排列三开奖（gameNo=35） | 无 | – |
| `/api/ssq-proxy?count=` | GET | 双色球开奖 | 无 | – |
| `/api/kl8-promo` | GET | 福彩"通知公告"里筛派奖/加奖，失败给 lastKnown | 无 | – |
| `/api/ai-predict` | POST | 快乐8 单次 AI 选号（20 码→10 码） | 无 | 1 次 |
| `/api/ai-deep` | POST | 快乐8 深度分析：`action=peek` 读缓存 / `run` 首位触发 | `kl8_ai_deep_runs` | 9 + 3 次 |
| `/api/digit-ai` | POST | 3D/排列三四轮解读，同上 peek/run | `digit_ai_runs` | 4 次 |
| `/api/store-prediction` | POST | 快乐8 预测写入 `kl8_predictions` | – | – |
| `/api/get-reviews?limit=` | GET | 读 `kl8_daily_reviews` | – | – |
| `/api/daily-review` | GET | cron 复盘 | 写 `kl8_daily_reviews` | 1 次 |
| `/api/daily-push` | GET/POST | 每日飞书推送，支持 `?test=1&dry=1&only=xxx&status=1` | 读写 `admin_config` | 0–3 次 |
| `/api/lark-proxy` | POST | 代理飞书多维表格（账本同步），凭证不落库 | – | – |

统一约定：`applyCors` 处理跨域与 OPTIONS；错误返回 `{ error: string }`；缺依赖（如没配 DATABASE_URL）尽量降级而不是 500。

---

## 7. 数据层

### 7.1 表

服务端在 `api/_lib/neon.js#ensureTables` 幂等建表：

| 表 | 主键 | 用途 |
| --- | --- | --- |
| `kl8_journal` | `(date, lottery)`（老表由前端自动迁移主键） | 每日打卡账本 |
| `kl8_predictions` | `draw_id` | 快乐8 历史预测（play/mode/picks/dans/tuos/ai_picks） |
| `kl8_daily_reviews` | `date` | 每日复盘（predicted/actual/hits/won/prize/ai_summary） |
| `kl8_ai_deep_runs` | `(draw_id, play)` | 快乐8 深度分析共享结果 |
| `digit_ai_runs` | `(game, draw_id)` | 3D/排列三 AI 共享结果 |
| `access_requests` / `admins` / `admin_config` | 见 §5.4 | 访问控制与共享配置 |

`admin_config` 是全局键值表，已知 key：

| key | 内容 |
| --- | --- |
| `shared_llm_config` | `{llmBaseUrl, llmKey, llmModel}` 服务端大模型配置 |
| `daily_push_config` | `{webhook, secret, kl8, fc3d, pl3, ssq}` 推送开关与机器人 |
| `daily_push_last` | 最近一次推送状态（`?status=1` 查看） |
| `daily_push_history` | 上期推送号码，用于计算"上期命中几个" |
| `admin_token_hash` 一类 | 管理员令牌哈希（见 `src/lib/access.js`） |

### 7.2 共享 AI 缓存状态机（重点）

同一期同一玩法只允许第一个用户真正调用大模型，其余人直接读结果：

1. `INSERT ... ON CONFLICT DO NOTHING RETURNING` 抢占 → 抢到写 `status='running'`
2. 调用成功 → `UPDATE status='done', result=<payload>`
3. 失败/超时 → 删除 running 行，让别人能重试
4. `running` 超过 3 分钟视为僵尸，允许接管
5. `result.schema` 是**结果结构版本号**（`digit-ai` 当前 `SCHEMA=5`，`ai-deep` 为 `3`）。版本不匹配就视为过期，重算

改 AI 输出结构时**必须递增 schema**，否则旧结构会被继续当缓存返回。

---

## 8. 四个彩种的算法

### 8.1 快乐8（80 选 20，每号概率恒 25%）

- `stats.js`：加权频次（半衰期）、当前遗漏、形态/重号/斜连、组合数学、奖级与期望
- `kl8V7.js`：多窗口（短/中/长）加权 → 每号综合分 → 取 Top30 推荐池、Bottom30 排除池、balanced 选十
- `kl8Arena.js`：严格前推回测（每期只用历史建池），4 策略 vs 理论期望，输出平均命中与 z 值；`|z|<1.96` 视为与随机无显著差异
- `kl8Math.js`：超几何分布精确概率与官方奖金表；选十中十约 1/8,911,711

### 8.2 福彩3D（直选 1/1000、组六 1/167、组三 1/333）

- v1：热冷+跨度+和值+奇偶+大小+质合+形态+遗漏 加权
- v2（默认）：三个位置独立建模 + 一阶马尔可夫 + 指数衰减 + 遗漏回补，输出每位置 TopN 与和值/跨度区间、胆码拖码、杀号
- v4：把和值/跨度区间换成 BOLL/MA/MACD 投影，叠加 KDJ 读数，属于"换个描述方式"的独立档位

### 8.3 排列三（同 3D 概率）

- v3：4 个专家（20/60/200 期频率 + 一阶转移）Laplace 平滑合成，穷举 1000 种结果得到精确分布，再取 Top 码/区间/形态
- v3 Pro：9 专家（含二阶转移、遗漏回补、周期邻距、冷热反转），权重用 Hedge 在线学习（按最近 N 期对数损失指数加权），穷举时叠加六维结构约束（跨度/和值/形态/奇偶/和值尾/重号）
- 推送默认用 Pro 档

### 8.4 双色球

- 红球：按《吴明揭秘双色球》十章体系逐层筛（一层法到十分法），最终按结构约束枚举组合打分
- 蓝球：周期冷热 → 遗漏 → 振荡 → 黄金周期
- 选号拥挤度：唯一有文献支撑的优化方向，估算"有多少人可能也买了这注"，只影响分摊不影响概率

---

## 9. AI 层

### 9.1 配置与调用

`api/_lib/ai.js`

- `resolveLlmSettings()`：先读 `admin_config.shared_llm_config`，没有就用内置默认（3hdmx 中转 / claude-sonnet-5）
- `callAi(settings, messages, {maxTokens, temperature})`：标准 OpenAI 格式，非流式，失败抛错

### 9.2 三种 AI 任务的差异

| 任务 | 模型调用 | 关键设计 |
| --- | --- | --- |
| `ai-predict` | 1 次 | 快乐8 加权评分给 20 码，AI 从中选 10；无缓存 |
| `ai-deep` | 第一轮 3 模型 × 3 温度 = 9 次，第二轮 3 模型复核 = 3 次 | 先做 60 期样本外前推回测，把回测数字喂给模型；投票聚合后与算法分加权（55% AI + 45% 算法）收敛出 10 码；输出 `final10 / votes / report / backtest / v7` 等 |
| `digit-ai` | 四轮：结构解读 → 反向质询 → 算法候选终选 → 终审校验 | **AI 只能在算法候选池内选号**；终选要求 3 直选 + 2 组六 + 1 组三 |

### 9.3 终选"保留 + 补齐"策略（重要）

早期校验很严：少给一注或给一注池外号码，整份结果作废回退算法。实际模型经常差一两注，导致长时间显示"AI 未过校验"。

现在的规则（`api/digit-ai.js` 与 `api/daily-push.js` 同口径）：

1. 过滤掉池外号码，保留 AI 的池内选择
2. 不足 3/2/1 的部分，按算法候选池顺序补齐
3. 备注写明 `AI 终选 X/6 注在池内，其余由算法候选补齐`
4. 只有"输出完全无法解析 / 超时"才整份回退算法前三

### 9.4 前端体验

`src/lib/aiWait.js`：命中共享缓存时几乎瞬间返回，但按钮仍按固定节奏播进度，避免"同一份结果有人秒出有人等 40 秒"的观感差异。

---

## 10. 每日飞书推送（`api/daily-push.js`）

### 10.1 触发与配置

- 定时：Vercel Cron `0 6 * * *`（UTC）= 北京时间 14:00
- 手动：`GET /api/daily-push?test=1`（需 `CRON_SECRET`，如果配置了）
- 配置优先级：`admin_config.daily_push_config` → 环境变量
  ```json
  {"webhook":"https://open.feishu.cn/open-apis/bot/v2/hook/xxx","secret":"","kl8":true,"fc3d":true,"pl3":true,"ssq":true}
  ```
- 调试参数：`?status=1` 看上次推送状态（无需鉴权）；`?dry=1` 只返回 JSON 不发送；`?only=` 只算一个彩种，取值 `kl8 | fc3d | pl3 | ssq`
- ⚠️ 鉴权只挡 GET：配了 `CRON_SECRET` 时 GET 需带 `Bearer`，但 **POST 不校验**（早期为了设置页手动测试放开的）。也就是说任何人都能 POST 触发一次真实推送，建议后续补上鉴权

### 10.2 处理流程

1. 并发抓四个彩种最新数据，用 `freshness()` 判断数据是否更新（3D/排列三/快乐8 期望昨天，双色球放宽到 4 天），过期在卡片顶部亮红字
2. 各自算算法推荐（快乐8 v7 / 3D v2 / 排列三 Pro / 双色球十章法）
3. 3D、排列三、快乐8 再走 AI 终选：先读共享表有没有本期结果，没有才现场调用（单次超时 38s，超时就用算法结果）
4. 读 `daily_push_history` 里上期推送的号码 + 最新开奖，算"上期命中几个"（算法口径与 AI 口径分开）
5. 发送 4 张卡片；把本次号码写入 `daily_push_history`，推送结果写入 `daily_push_last`

### 10.3 卡片内容

- 标题：彩种 + 期号，例如「快乐8 · 第 2026316 期推荐」
- 顶部：上期开奖、中奖概率、上期命中（算法 vs AI）
- 中部：本期推荐号码（快乐8 算法十码 + AI 终审 + 三注参考；3D/排列三 直选复式/百十个/双胆拖码/和值跨度杀号/覆盖档位 + AI 终选 3+2+1）
- 底部：算法池规模、AI 备注、风险提示

> **版式变迁（交接时注意）**：曾经按卡片 JSON 2.0 + 原生 `table` 组件重做过一版，手机上表格需要横向滑动、看不全，已 `git revert` 回退。当前线上是 **卡片 JSON 1.0** 的多行文字版式（`config.wide_screen_mode` + `elements`），手机端单列完整显示。要再改版式，务必先用真机看效果。

### 10.4 AI 结果写回全站共享表

推送算出来的 3D/排列三终选会写回 `digit_ai_runs`，站内用户当天直接复用，不再重复烧 token。规则：

- 允许覆盖：`device_id='daily-push'` 自己写的旧记录，或 `schema` 落后的僵尸记录
- 拒绝覆盖：站内用户 `running` 中，或已是当前 schema 的真实结果
- 实现要点：先 `INSERT ... ON CONFLICT DO NOTHING` 抢占；若抢不到再按上述条件 `DO UPDATE`。**早期只写了 DO NOTHING，被旧的 schema=3 行占住主键，导致写回一直静默失败**

快乐8 推送端的 AI 结果结构与站内 `ai-deep` 不一致（推送只有 10 码，站内有 votes/report/backtest），因此**没有**回写 `kl8_ai_deep_runs`，避免前端渲染异常。

### 10.5 已废弃：企业自建应用机器人

曾做过 `/api/lark-bot`（事件订阅 + 单聊/群内回复 + 指令），已整体删除：

- 原因：群内发消息返回 `230035 Send Message Permission deny`（外部群不支持自建应用机器人），且使用价值有限
- 遗留：`lark_bot_config`、`lark_bot_handled` 两条配置已从数据库删除；飞书后台的事件订阅可自行停用
- 现在只有**群自定义机器人 Webhook**（单向推送，不能 @、不能收消息）

---

## 11. 数据来源

| 彩种 | 来源 | 实现 |
| --- | --- | --- |
| 快乐8 | 中国福彩官网 `findDrawNotice?name=kl8` | `api/_lib/kl8.js`，前端走 `/cwl-api`、线上走 `/api/cwl-proxy` |
| 福彩3D | 中国福彩官网 `name=3d` | `api/_lib/fc3d.js` |
| 排列三 | 体彩官网 `webapi.sporttery.cn` `gameNo=35` | `api/_lib/pl3.js` + `/api/pl3-proxy` |
| 双色球 | 见 `api/ssq-proxy.js` | `api/_lib/ssq.js` |
| 派奖公告 | 福彩官网通知公告列表 | `api/kl8-promo.js` |

本地 `vite.config.js` 为前三个配了 dev/preview 代理（含 Referer），线上由 Serverless 转发，因为浏览器无法跨域直连且官网校验 Referer。

**已知坑**：福彩官网有 WAF，对海外/机房 IP 常返回 403。推送里已做"数据过期就红字提示"，不要当故障去疯狂重试。

---

## 12. 已知限制与坑（接手请先看）

1. **AI 只做候选池内终选**：不要让模型自由发挥，否则会给出池外号码，校验必然失败。
2. **Vercel 响应后实例会冻结**：不要写"先 `res.json()` 再异步干活"的代码。之前事件回调就是这么丢的——飞书看到 200 成功，实际消息从未发出。必须处理完再响应（必要时用 `waitUntil`）。
3. **卡片 2.0 在手机端的真实表现**：表格宽度撑开需要横滑，已回退到 1.0；2.0 还要求客户端 ≥7.20，低版本只显示标题。
4. **schema 版本号**：改 AI 结果结构必须同步递增（digit=5、kl8=3），否则旧缓存会被当新结果。
5. **默认大模型 key 硬编码**在 `api/_lib/ai.js` 与 `src/lib/settings.js`，交接后建议换掉并只走 `admin_config`。
6. **前端可直连数据库**：构建期注入 `DATABASE_URL` 会进浏览器包，除个人使用外应改造。
7. **访问控制很轻**：`device_id` 可伪造，没有服务端鉴权，别放敏感数据。
8. **无测试、无 lint**：改动后至少跑一次本地 dry（见 §13）。
9. **函数超时 60s**：`ai-deep` 9 次调用是极限操作，网络抖动容易超时，已有"失败即释放 running 让别人重试"的逻辑。
10. **两套配置**：设置页（localStorage，前端用）与服务端 `admin_config`（cron 用）互不相通，改错地方会"看起来没生效"。

---

## 13. 常用运维操作

```bash
# 生成四张卡片但不发送（只读，无鉴权）——注意本地 vite dev 不跑 Serverless，用线上或 vercel dev
curl "https://cai.rayzo.cn/api/daily-push?dry=1"

# 手动真实推送（线上）
curl -H "Authorization: Bearer $CRON_SECRET" "https://cai.rayzo.cn/api/daily-push?test=1"

# 只看上次推送状态
curl "https://cai.rayzo.cn/api/daily-push?status=1"

# 只推某一个彩种
curl -H "Authorization: Bearer $CRON_SECRET" "https://cai.rayzo.cn/api/daily-push?test=1&only=pl3"
```

让某一期 AI 重算（清缓存）：

```sql
DELETE FROM digit_ai_runs    WHERE game = 'fc3d' AND draw_id = 2026316;
DELETE FROM digit_ai_runs    WHERE game = 'pl3'  AND draw_id = 26316;
DELETE FROM kl8_ai_deep_runs WHERE draw_id = 2026316 AND play = 10;
```

换飞书机器人：改 `admin_config.daily_push_config.webhook`（有签名校验时同时填 `secret`），或设 `FEISHU_WEBHOOK_URL`。换完 `?test=1` 验证一次。

---

## 14. 交接清单

- [ ] GitHub 仓库权限（`CRAI123/caipiao`）
- [ ] Vercel 项目权限（环境变量、Cron 日志）
- [ ] Neon 项目权限（连接串、分支/备份）
- [ ] 飞书群自定义机器人 webhook + secret
- [ ] 大模型中转账号与 key（替换代码里的硬编码默认值）
- [ ] 域名 `cai.rayzo.cn` 的 DNS/Vercel 绑定
- [ ] 飞书开放平台里那个已废弃自建应用是否停用

**上线前自检**：

1. `npm run build` 通过
2. `GET /api/daily-push?dry=1` 返回四个彩种、卡片 JSON 完整
3. `?test=1` 群里收到 4 张卡，手机上单屏能看全
4. 站内点一次「下期推荐 → AI 分析」，确认共享缓存命中（第二次打开秒出）
5. 查 `digit_ai_runs` / `kl8_ai_deep_runs` 是否有当天 `status='done'` 且 schema 正确的记录
