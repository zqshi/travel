# Travel Agent

> 从"想去哪"到"订好了"，一句话搞定跨境旅行全流程。

Travel Agent 是一套 AI 驱动的跨境旅行规划与预定系统。  
它不只是帮你生成一份攻略，而是把**需求澄清、行程规划、多平台比价、在线预定、订单跟踪**串成一条从聊天到交付的完整链路。

出境游卡住人的，从来不是"不知道去哪玩"，而是：

- 攻略看了一堆，最终还是不知道哪个时间去哪个地方、怎么走最顺
- 比价要在 Klook / KKday / Agoda 之间反复跳转，费时费力
- 语言不通，电话预定当地商家（餐厅、包车）根本开不了口
- 订完之后价格变了、航班改了、状态变了，没人通知你

## 一句话理解

Travel Agent 把"出境旅行对话"升级为"端到端预定系统"，让用户从一句"我想去清迈五天"，走到一套可执行、已付款、有人盯的行程。

## 它为什么值得看

- 它不是另一个攻略生成器，而是能直接下单的预定引擎
- 它不是只给你一个方案，而是跨平台比价后推荐最优选择
- 它不是生成完就结束，而是持续监控订单状态并推送变更
- 它不是只能打字，还能通过语音 Agent 自动拨打商家电话完成预定

## 核心能力

### 1. 对话式行程规划

通过自然语言对话收集需求（目的地、日期、预算、偏好），由 Claude + Tavily 实时搜索生成结构化每日行程。所有推荐基于真实数据，标注来源和时效。

### 2. 多平台智能比价

自动聚合 Klook、KKday、Agoda 等平台的价格信息，生成对比报告并给出推荐。不再手动跳转对比。

### 3. 一站式预定与支付

从行程卡片直接进入预定流程：填写出行人信息 → 确认订单 → Omise 支付 → 获取预定确认号。

### 4. 语音预定 Agent

针对不支持在线预定的商家（当地餐厅、包车服务），系统通过 Twilio 自动拨打电话，由 Claude 驱动实时语音对话完成预定。

### 5. 订单状态监控

WebSocket 实时推送订单变更：价格波动、状态变更、航班调整，第一时间通知用户。

## 工作流程

```text
用户输入（"我想去清迈5天，预算8000"）
   ↓
对话澄清（确认日期、人数、偏好）
   ↓
实时搜索 + 行程生成（Tavily + Claude）
   ↓
多平台比价（Klook / KKday / Agoda）
   ↓
用户确认 → 在线预定 / 语音预定
   ↓
支付完成 → 订单确认
   ↓
持续监控 → 变更推送
```

## 技术架构

### 后端（Python / FastAPI）

```text
app/
├── agents/          # AI Agent（行程规划、比价分析）
│   ├── planner.py         # LangGraph 行程规划 Agent
│   └── price_compare.py   # 多平台比价 Agent
├── api/             # REST + WebSocket 接口
│   ├── chat.py            # SSE 流式对话
│   ├── booking.py         # 预定下单
│   ├── sessions.py        # 会话管理
│   ├── auth.py            # 手机号验证登录
│   ├── voice_booking.py   # 语音预定触发
│   └── websocket.py       # 实时通知推送
├── services/        # 业务服务
│   ├── booking.py         # 预定流程编排
│   ├── payment.py         # Omise 支付
│   ├── voice_agent.py     # Twilio 语音 Agent
│   └── order_monitor.py   # 订单状态轮询
├── platforms/       # 第三方平台聚合
│   └── aggregator.py      # Klook / KKday / Agoda 统一搜索
├── core/            # 基础设施
│   ├── config.py          # 环境配置
│   ├── database.py        # Supabase 连接
│   ├── auth.py            # JWT 认证
│   ├── currency.py        # 汇率转换
│   └── retry.py           # 重试策略
└── models/          # 数据模型
```

### 前端（Next.js 16 / React 19 / Tailwind 4）

```text
web/src/
├── app/             # 路由页面
│   ├── page.tsx           # 首页
│   ├── chat/              # 主聊天界面
│   ├── compare/           # 比价结果页
│   ├── login/             # 登录页
│   └── plan/              # 行程展示
├── features/chat/   # 聊天领域
│   ├── components/        # 消息气泡、输入框、引导页
│   ├── hooks/             # useChat、useSessions、useDrawers
│   └── services/          # SSE 流解析、API 调用
├── components/      # 通用组件
│   ├── booking-drawer.tsx       # 预定抽屉
│   ├── booking-steps/           # 预定步骤（填信息→确认→支付→完成）
│   ├── itinerary-view.tsx       # 行程卡片渲染
│   ├── voice-booking-drawer.tsx # 语音预定面板
│   └── notification-banner.tsx  # 实时通知横幅
├── hooks/           # 通用 hooks
│   └── use-websocket.ts   # WebSocket 连接管理
└── lib/
    └── auth.ts            # 认证工具
```

## 快速开始

环境要求：

- Python `3.11+`
- Node.js `20+`
- npm `10+`

### 1. 克隆项目

```bash
git clone https://github.com/zqshi/travel.git
cd travel
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入必要的 API Key：

```env
# 必填
ANTHROPIC_API_KEY=your_anthropic_api_key
TAVILY_API_KEY=your_tavily_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# 可选（预定功能需要）
KLOOK_AFFILIATE_ID=
KKDAY_AFFILIATE_ID=
AGODA_AFFILIATE_ID=
```

### 3. 启动后端

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### 4. 启动前端

```bash
cd web
npm install
npm run dev
```

### 5. 访问应用

- 前端应用：http://localhost:3000
- 后端 API 文档：http://localhost:8000/docs

## 技术栈

| 层 | 技术 |
|---|---|
| AI 推理 | Claude (Anthropic) + LangGraph |
| 实时搜索 | Tavily |
| 后端框架 | FastAPI + Uvicorn |
| 前端框架 | Next.js 16 + React 19 |
| 样式 | Tailwind CSS 4 |
| 数据库 | Supabase (PostgreSQL) |
| 支付 | Omise |
| 语音 | Twilio |
| 实时通信 | WebSocket |
| 测试 | pytest / Vitest |

## 适合谁

- 独立旅行者：不想花几个小时做攻略和比价，想一站式搞定
- 出境游新手：语言不通、平台不熟，需要全流程引导
- AI 产品开发者：参考 LangGraph Agent + 流式对话 + 预定闭环的工程实现

## 开发命令

```bash
# 后端测试
python -m pytest tests/

# 前端测试
cd web && npm run test

# 类型检查
cd web && npx tsc --noEmit

# 前端构建
cd web && npm run build

# 后端代码格式化
ruff format app/ tests/
```

## 许可

[MIT](https://opensource.org/licenses/MIT)
