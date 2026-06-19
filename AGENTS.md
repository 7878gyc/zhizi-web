# AGENTS.md

## 项目概览

智子围棋 AI 分析平台 - 基于 Next.js 16 + React 19 + TypeScript 5 的围棋AI分析Web应用。集成智子围棋（Zhizi Go）GPU算力平台的API和WebSocket/Socket.IO协议，实现对局分析功能。

## 核心功能

- **登录认证**：手机号/邮箱 + 密码登录，代理到 `zhizigo.com` API
- **交互式棋盘**：Canvas 渲染的19x19围棋盘，支持落子、悔棋、清空
- **AI分析**：通过 WebSocket/Socket.IO 连接 KataGo 引擎，获取胜率和推荐落子
- **AI配置选择**：支持不同GPU类型(1x/2x/4x)、引擎(OPENCL/TENSORRT)、权重(18b/28bnbt/40b)

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4
- **WebSocket**: socket.io-client

## 目录结构

```
src/
├── app/
│   ├── api/auth/          # 后端API代理
│   │   ├── login/route.ts         # 登录代理
│   │   ├── me/route.ts            # 用户信息代理
│   │   └── fetch-socketio-token/route.ts  # WebSocket令牌代理
│   ├── login/page.tsx     # 登录页面
│   ├── analyze/page.tsx   # AI分析主页面
│   ├── layout.tsx         # 根布局
│   └── globals.css        # 全局样式
├── components/
│   ├── go-board.tsx       # 围棋棋盘(Canvas)组件
│   ├── ai-config-panel.tsx # AI配置选择面板
│   ├── analysis-panel.tsx # 分析结果面板
│   ├── move-history.tsx   # 落子记录面板
│   └── ui/                # shadcn/ui 组件库
├── hooks/
│   ├── use-zhizi-analysis.ts  # WebSocket分析Hook
│   └── use-go-game.ts         # 围棋游戏逻辑Hook
└── lib/
    ├── go-types.ts        # 围棋类型定义与工具函数
    ├── auth.ts            # 认证工具（token管理）
    └── utils.ts           # 通用工具
```

## 构建和测试命令

- 开发：`pnpm dev`
- 构建：`pnpm build`
- TypeScript检查：`pnpm ts-check`
- Lint：`pnpm lint`

## 关键API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录（代理到 zhizigo.com） |
| `/api/auth/me` | GET | 获取用户信息 |
| `/api/auth/fetch-socketio-token` | POST | 获取WebSocket连接令牌 |

## 编码规范

- TypeScript strict 模式
- 禁止隐式 any
- 使用 pnpm 管理依赖
- 前后端分离：敏感API调用通过后端代理
