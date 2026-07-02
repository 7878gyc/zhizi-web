# 智子围棋 AI 分析平台

基于 Next.js 16 + React 19 + TypeScript 5 的围棋 AI 分析 Web 应用。集成智子围棋（Zhizi Go）GPU 算力平台，通过 Socket.IO 协议连接 KataGo 引擎，提供实时对局分析。

## 核心功能

- **登录认证**：手机号/邮箱 + 密码登录，通过后端代理转发 `zhizigo.com` API
- **交互式棋盘**：Canvas 渲染 19x19 围棋盘，支持落子、悔棋、重放、棋盘尺寸切换（9/13/19 路）
- **AI 实时分析**：通过 Socket.IO 连接 KataGo 引擎，获取胜率走势和最佳推荐落子
- **多配置选择**：GPU 类型（1x/2x/4x）、引擎（OPENCL/TENSORRT）、权重（18b/28bnbt/40b）
- **棋谱导入**：支持 SGF 文件导入和野狐围棋棋谱链接解析
- **胜率曲线图**：Canvas 绘制的实时胜率走势图，统一黑方视角
- **变化图展示**：点击推荐落子查看 AI 推演的变化图（PV）
- **自动分析**：开启后每 2 秒自动前进下一步，遇到终局自动停止
- **棋谱导航**：第一手/最后一手、单步前进/后退、5 步快进/快退

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

启动后浏览器访问 `http://localhost:5000`。

### 构建

```bash
pnpm build
```

### 代码检查

```bash
pnpm ts-check         # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm validate         # 同时运行 ts-check + lint
```

## 项目结构

```
src/
├── app/
│   ├── api/auth/
│   │   ├── login/route.ts                   # 登录代理
│   │   ├── me/route.ts                      # 用户信息代理
│   │   └── fetch-socketio-token/route.ts    # Socket.IO 令牌代理
│   ├── api/foxwq/route.ts                   # 野狐棋谱爬取代理
│   ├── login/page.tsx                       # 登录页面
│   ├── analyze/page.tsx                     # AI 分析主页面
│   ├── layout.tsx                           # 根布局
│   └── globals.css                          # 全局样式
├── components/
│   ├── go-board.tsx              # Canvas 围棋棋盘组件
│   ├── ai-config-panel.tsx       # AI 配置选择面板
│   ├── analysis-panel.tsx        # 分析结果面板（胜率条 + 推荐选点）
│   ├── move-tree.tsx             # 棋谱树形导航
│   ├── winrate-chart.tsx         # 胜率曲线图
│   ├── katago-log-viewer.tsx     # KataGo 引擎日志查看器
│   └── ui/                       # shadcn/ui 组件库
├── hooks/
│   ├── use-go-game.ts            # 围棋游戏核心逻辑 Hook
│   └── use-zhizi-analysis.ts     # Socket.IO 连接与分析 Hook
└── lib/
    ├── go-types.ts               # 围棋类型定义、坐标转换、分析数据解析
    ├── auth.ts                   # Token 管理工具
    ├── sgf-parser.ts             # SGF 文件解析器
    └── utils.ts                  # 通用工具函数
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 核心 | React 19 |
| 语言 | TypeScript 5 |
| UI 组件 | shadcn/ui (Radix UI) |
| 样式 | Tailwind CSS 4 |
| 通信 | socket.io-client |
| 图标 | Lucide React |
| 表单 | React Hook Form + Zod |
| 包管理 | pnpm |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录（代理到 zhizigo.com） |
| `/api/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/fetch-socketio-token` | POST | 获取 KataGo 引擎连接令牌 |
| `/api/foxwq` | POST | 爬取野狐围棋棋谱内容 |

## 分析协议

基于智子围棋开放平台 v1.1.0，核心流程：

1. 通过 `/api/auth/fetch-socketio-token` 获取连接令牌和 URL
2. 使用 Socket.IO 连接 KataGo 引擎（`/socket.io.v4` 路径）
3. 发送 GTP 命令同步棋盘状态：`boardsize`、`komi`、`clear_board`、`play`
4. 发送 `kata-analyze B/W 50` 启动分析（50cs = 0.5s 间隔）
5. 引擎通过 `stdout` 事件持续返回 `info` 行，解析胜率、选点、PV 等信息
6. 胜率统一转换为黑方视角存储和展示

## 注意事项

- 必须使用 **pnpm** 作为包管理器
- 分析功能需要先在智子围棋平台注册账号
- SGF 导入后会自动断开当前 AI 连接，需手动重新开始分析
