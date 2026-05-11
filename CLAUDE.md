# 项目开发声明

本项目严格遵守以下开发规范，所有参与开发的 Agent 和开发者必须执行。

## 开发范式：DDD + TDD

### DDD（领域驱动设计）
- 按业务领域划分模块，不按技术层划分
- 每个模块职责单一，边界清晰
- 前端按 feature 组织：`features/{domain}/` 下包含 hooks、components、types、services
- 后端按 domain 组织：`app/{domain}/` 下包含 models、services、repositories、api

### TDD（测试驱动开发）
- 先写测试，再写实现
- 每次修改或新增功能后，自动运行全部相关测试
- 测试不通过不视为完成

## 代码规范

### 文件行数限制
- 每个文件不超过 **1000 行**
- 超出时必须按职责拆分为独立模块

### 功能边界
- 每个文件/模块只负责一个明确的功能
- 组件只处理 UI 渲染，业务逻辑抽入 hooks/services
- API 调用封装在独立的 service 层
- 状态管理通过 custom hooks 提供，不在组件内直接管理复杂状态

## 测试要求

### 单元测试
- 前端：Vitest + React Testing Library
- 后端：pytest
- 覆盖所有 hooks、services、utils 的核心逻辑
- 覆盖组件的关键交互行为

### 端到端测试
- 使用 Playwright
- 覆盖核心用户流程（登录、聊天、生成行程、预定）
- CI 中必须通过

### 自动化验证
- 每次功能完成后运行：`npm run test && npm run e2e`
- 前端构建检查：`npx tsc --noEmit && npx next build`
- 后端测试：`cd /Users/zqs/Downloads/project/lvyou && python -m pytest tests/`

## 文档与代码卫生

### 禁止存在
- 过时的文档、脚本、代码
- 冗余的重复实现
- 无用的注释、dead code、未使用的依赖
- 临时测试文件（如 `/tmp/screenshot-test.mjs`）

### 每次修改必须
- 检查并更新相关文档
- 清理因本次修改产生的废弃代码
- 确认没有引入重复逻辑

## 前端架构（web/）

```
src/
  app/                    # Next.js 路由页面（薄层，只组装 feature 组件）
  features/               # 按业务领域划分
    chat/                 # 聊天领域
      components/         # 聊天相关 UI 组件
      hooks/              # 聊天相关 hooks（useChat, useMessages, useSessions）
      services/           # API 调用（chatService, sessionService）
      types.ts            # 聊天领域类型定义
    booking/              # 预定领域
    itinerary/            # 行程领域
  components/             # 通用 UI 组件（Button, Drawer, Sidebar 等）
  lib/                    # 工具函数
  __tests__/              # 测试文件（镜像 src 结构）
```

## 后端架构（app/）

```
app/
  domains/                # 业务领域
    planning/             # 行程规划
    booking/              # 预定
    chat/                 # 对话
    auth/                 # 认证
  core/                   # 核心基础设施（数据库、配置）
  shared/                 # 跨领域共享（类型、工具）
tests/                    # 测试（镜像 app 结构）
```
