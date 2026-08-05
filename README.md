# 智子围棋 AI 分析平台

基于 Next.js 16 + React 19 + TypeScript 5 的围棋 AI 分析 Web 应用。集成智子围棋（Zhizi Go）GPU 算力平台，通过 Socket.IO 协议连接 KataGo 引擎，提供实时对局分析。

## 核心功能

- **登录认证**：手机号/邮箱 + 密码登录、短信验证码登录，通过后端代理转发 `zhizigo.com` API
- **交互式棋盘**：Canvas 渲染 19x19 围棋盘，支持落子、悔棋、重放、棋盘尺寸切换（9/13/19 路）
- **AI 实时分析**：通过 Socket.IO 连接 KataGo 引擎，获取胜率走势和最佳推荐落子
- **多配置选择**：GPU 类型（1x/2x/3x/4x/VIP 共享）、权重（18b/28bnbt/fdx）
- **棋盘候选点**：LizzieYZY 风格的彩色选点（红→绿渐变，最佳为青色 + 蓝环），标注胜率与目差
- **变化图预览**：点击推荐落子查看 AI 推演的变化图（PV），预览时棋盘自动隐藏彩色选点
- **鹰眼分析**：AI 吻合率、首选命中率、问题手标注（疑问/失误/恶手/大恶手），问题手列表可点击跳转，数据随 AI 实时刷新
- **胜率曲线图**：Canvas 绘制的实时胜率走势图，统一黑方视角，支持点击跳转
- **棋谱导入**：支持 SGF 文件导入、野狐围棋棋谱链接解析、云棋谱库导入
- **SGF 导出**：生成含 KataGo LZ 分析属性的 SGF，支持本地下载与保存回云棋谱库（可覆盖更新）
- **棋谱云保存**：上传 SGF 到 Cloudflare R2 存储，支持列表查看、下载和删除，用户数据隔离
- **自动分析**：开启后每 2 秒自动前进下一步，遇到终局自动停止
- **棋谱导航**：第一手/最后一手、单步前进/后退、5 步快进/快退
- **贴目输入**：贴目值支持输入框自定义（范围 ±150 目，超出报错并重置默认值），提供 5.5/6.5/7.5 常用选项，桌面与移动端一致
- **用户菜单**：点击用户名（手机号/邮箱）展开下拉列表——消费记录、充值、退出
- **消费记录**：弹窗展示当前余额，合并算力使用记录（时长/倍率/GPU/金额）与充值入账记录（充值方式/金额），按时间倒序，金额正负着色
- **余额充值**：快捷选项 5/10/20/50/100 元 + 自定义金额，微信支付
- **VIP 充值**：动态加载会员产品（1/3/6/12 个月），卡片选择后创建订单并唤起微信支付，自动轮询支付结果
- **移动端适配**：<768px 自动切换移动端布局（顶部操作栏、底部菜单、Tab 分析面板）

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+（棋谱云保存功能需要）

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
pnpm validate         # 同时运行 ts-check + lint:build
npx prisma db push    # 数据库迁移（首次部署）
npx prisma generate   # 重新生成 Prisma Client
npx prisma studio     # 数据库可视化浏览
```

## 项目结构

```
prisma/
└── schema.prisma                            # Prisma 数据模型（Record）
src/
├── app/
│   ├── api/auth/
│   │   ├── login/route.ts                   # 密码登录代理
│   │   ├── send-code/route.ts               # 短信验证码发送代理
│   │   ├── fast-login/route.ts              # 验证码登录代理
│   │   ├── me/route.ts                      # 用户信息代理
│   │   └── fetch-socketio-token/route.ts    # Socket.IO 令牌代理
│   ├── api/foxwq/route.ts                   # 野狐棋谱爬取代理
│   ├── api/upload/route.ts                  # R2 预签名上传 URL 生成
│   ├── api/cluster/
│   │   ├── balance/route.ts                 # 账户余额代理
│   │   ├── usage/my-usages/route.ts         # 算力使用记录代理
│   │   ├── credit/my-credits/route.ts       # 入账记录代理
│   │   └── product/route.ts                 # 会员产品代理（无鉴权）
│   ├── api/pay/
│   │   ├── orders/route.ts                  # 创建支付订单代理
│   │   └── orders/[orderId]/route.ts        # 订单状态查询代理
│   ├── api/records/
│   │   ├── route.ts                         # 棋谱列表 + 保存
│   │   └── [id]/route.ts                    # 棋谱删除 / 重命名
│   │   └── [id]/download/route.ts           # 棋谱下载（预签名 URL）
│   ├── login/page.tsx                       # 登录页面
│   ├── analyze/
│   │   ├── page.tsx                         # AI 分析主页面（移动/桌面条件渲染）
│   │   ├── _components/                     # 分析页子组件
│   │   │   ├── analyze-header.tsx           # 顶部栏（桌面）
│   │   │   ├── board-controls.tsx           # 棋盘控制条
│   │   │   ├── cloud-save-menu.tsx          # SGF 保存菜单
│   │   │   ├── foxwq-import-dialog.tsx      # 野狐导入弹窗
│   │   │   ├── player-name-editor.tsx       # 棋手名编辑
│   │   │   ├── komi-input.tsx               # 贴目输入框（范围校验 + 常用选项）
│   │   │   ├── user-menu.tsx                # 用户菜单（消费记录/充值/VIP）
│   │   │   └── mobile/                      # 移动端组件
│   │   │       ├── mobile-analyze-layout.tsx    # 移动端布局容器
│   │   │       ├── mobile-top-bar.tsx           # 顶部操作栏
│   │   │       ├── mobile-bottom-bar.tsx        # 底部操作栏
│   │   │       ├── mobile-menu-sheet.tsx        # Tab 分析面板（常驻挂载）
│   │   │       ├── mobile-player-badges.tsx     # 棋手徽章
│   │   │       └── mobile-game-info-tab.tsx     # 棋局信息 Tab
│   │   └── _hooks/
│   │       ├── use-analysis-cache.ts        # 分析结果缓存 Hook
│   │       ├── use-auto-analyze.ts          # 自动分析 Hook
│   │       └── use-cloud-records.ts         # 云棋谱列表 Hook
│   ├── records/page.tsx                     # 棋谱管理页面
│   ├── layout.tsx                           # 根布局
│   ├── robots.ts                            # robots 配置
│   └── globals.css                          # 全局样式
├── components/
│   ├── go-board.tsx              # Canvas 围棋棋盘组件（候选点/变化图绘制）
│   ├── ai-config-panel.tsx       # AI 配置选择面板
│   ├── analysis-panel.tsx        # 分析结果面板（胜率条 + 选点表，支持双列紧凑模式）
│   ├── move-tree.tsx             # 落子树形导航
│   ├── winrate-chart.tsx         # 胜率曲线图
│   ├── hawk-eye-panel.tsx        # 鹰眼分析面板（问题手列表）
│   ├── katago-log-viewer.tsx     # KataGo 引擎日志查看器
│   └── ui/                       # shadcn/ui 组件库
├── hooks/
│   ├── use-go-game.ts            # 围棋游戏核心逻辑 Hook
│   ├── use-mobile.ts             # 移动端断点检测 Hook
│   └── use-zhizi-analysis.ts     # Socket.IO 连接与分析 Hook
└── lib/
    ├── go-types.ts               # 围棋类型定义、坐标转换、分析数据解析
    ├── sgf.ts                    # SGF 生成（含 LZ/注释属性）、坐标转换
    ├── sgf-parser.ts             # SGF 文件解析器（含 LZ 属性解析）
    ├── auth.ts                   # Token 管理工具（localStorage）
    ├── auth-server.ts            # 服务端认证（extractUserHash + SHA256）
    ├── prisma.ts                 # PrismaClient 单例
    ├── r2-client.ts              # Cloudflare R2 S3 客户端
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
| ORM | Prisma 5 |
| 数据库 | PostgreSQL |
| 对象存储 | Cloudflare R2 (S3 兼容) |
| 图标 | Lucide React |
| 表单 | React Hook Form + Zod |
| 包管理 | pnpm |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 密码登录（代理到 zhizigo.com） |
| `/api/auth/send-code` | POST | 发送短信验证码 |
| `/api/auth/fast-login` | POST | 验证码快速登录 |
| `/api/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/fetch-socketio-token` | POST | 获取 KataGo 引擎连接令牌 |
| `/api/foxwq` | POST | 爬取野狐围棋棋谱内容 |
| `/api/upload` | POST | 生成 Cloudflare R2 预签名上传 URL |
| `/api/records` | GET | 获取当前用户的棋谱列表 |
| `/api/records` | POST | 保存棋谱记录到数据库 |
| `/api/records/[id]` | DELETE | 删除指定棋谱（R2 文件 + 数据库记录） |
| `/api/records/[id]` | PATCH | 重命名棋谱记录（覆盖保存时使用） |
| `/api/records/[id]/download` | GET | 生成棋谱文件下载预签名 URL |
| `/api/cluster/balance` | GET | 获取账户余额（代理到 zhizigo.com） |
| `/api/cluster/usage/my-usages` | GET | 获取算力使用记录（消费记录弹窗） |
| `/api/cluster/credit/my-credits` | GET | 获取入账/充值记录 |
| `/api/cluster/product` | GET | 获取会员产品列表（无鉴权） |
| `/api/pay/orders` | POST | 创建微信 Native 支付订单（充值/VIP） |
| `/api/pay/orders/[orderId]` | GET | 查询支付订单状态（轮询支付结果） |

## 棋谱云保存

### 架构原理

棋谱云保存功能将用户上传的 SGF 文件存储在 Cloudflare R2（S3 兼容对象存储），元数据存储在 PostgreSQL 数据库中。整个流程复用智子围棋平台（zhizigo.com）的认证体系，用户数据通过哈希值隔离。

```
┌──────────────┐     Authorization: Bearer <token>     ┌──────────────┐
│              │ ─────────────────────────────────────▶ │              │
│   前端浏览器   │                                        │  Next.js API │
│  (浏览器直传)  │ ◀───────────────────────────────────── │   后端服务    │
│              │     返回预签名 PUT URL (300秒有效)        │              │
└──────┬───────┘                                        └──────┬───────┘
       │                                                       │
       │  PUT <presigned-url>                    ┌──────────────┴──────────────┐
       │  Content-Type: application/x-go-sgf     │                              │
       └────────────────────────────────────────▶│  1. 从 Authorization header  │
                                                  │     提取 token               │
                                                  │  2. 调用 zhizigo.com /me     │
                                                  │     验证身份获取 phone/email  │
┌──────────────┐                                  │  3. SHA256(identifier)       │
│              │◀─────────────────────────────────│     = userHash               │
│   Cloudflare │  生成预签名 Upload URL             │  4. 路径: records/{userHash} │
│      R2      │                                  │     /{uuid}.sgf             │
│              │                                   │  5. 数据库 where:           │
│  文件结构:    │                                   │     { userHash }            │
│  records/    │                                  └─────────────────────────────┘
│  └─ {hash}/  │
│     └─ *.sgf │
└──────────────┘
```

**用户标识流程**：前端发送请求时不传递任何用户信息，后端从 Bearer token 独立完成身份验证和哈希计算。SHA256 运算仅在后端执行，前端不接触用户手机号/邮箱原文。

**文件存储隔离**：每个用户的 SGF 文件存储在独立的 R2 路径 `records/{userHash}/` 下，不同用户的文件通过哈希值天然隔离。

**数据库隔离**：Prisma Record 模型中的 `userHash` 字段建有索引，所有查询强制带 `where: { userHash }` 条件，确保用户只能操作自己的棋谱记录。

### 配置方法

#### 1. 创建 Cloudflare R2 存储桶

登录 [Cloudflare 控制台](https://dash.cloudflare.com)，进入左侧 **R2** 页面：

- 点击「Create bucket」，命名（例如 `zhizi-records`）
- 创建后进入桶的 **Settings** 页面，找到「R2 API」区域
- 记下 **Account ID**（右上角显示，格式为 32 位 hex 字符串）
- 点击「Manage R2 API Tokens」创建 Access Key
  - 选择「Object Read & Write」权限
  - 指定范围仅限当前桶（推荐）或所有桶
  - 创建后记下 **Access Key ID** 和 **Secret Access Key**（只会显示一次）

#### 2. 准备 PostgreSQL 数据库

推荐使用 [Neon](https://neon.tech) Serverless PostgreSQL 或 [Supabase](https://supabase.com)，也可自建。创建数据库后获取连接字符串。

#### 3. 创建环境变量

```bash
# 复制模板
cp .env.example .env
```

编辑 `.env` 文件，填入实际值。

#### 4. 执行数据库迁移

```bash
npx prisma db push
```

该命令会读取 `prisma/schema.prisma` 中的 Record 模型，在 PostgreSQL 中创建对应表。

#### 5. 启动服务

```bash
pnpm dev
```

### 环境变量

| 变量名 | 说明 | 获取方法 |
|--------|------|----------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 在数据库提供商（Neon / Supabase 等）控制台的「Connection string」或「Connect」页面复制。注意选择连接池模式（pooled connection），格式为 `postgresql://user:password@host:port/database?pgbouncer=true` |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID | 登录 Cloudflare 控制台，进入 R2 页面，右上角显示的 32 位十六进制字符串 |
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID | 在 R2 桶的 Settings → Manage R2 API Tokens 中创建，创建后立即显示。以 `r2_` 开头 |
| `R2_SECRET_ACCESS_KEY` | R2 API Secret Access Key | 与 Access Key ID 同时创建，创建后仅显示一次，需立即保存。格式为变长字符串 |
| `R2_BUCKET_NAME` | R2 存储桶名称 | 创建桶时指定的名称，例如 `zhizi-records` |

### 环境变量示例

```bash
# PostgreSQL 连接字符串（Neon 示例）
DATABASE_URL="postgresql://zhizi:xxxxxxxx@ep-cool-bush-123456.ap-southeast-1.aws.neon.tech/zhizi?sslmode=require"

# Cloudflare R2
R2_ACCOUNT_ID="3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
R2_ACCESS_KEY_ID="r2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_BUCKET_NAME="zhizi-records"
```

### 数据库模型

```prisma
model Record {
  id        String    @id @default(cuid())
  userHash  String
  fileName  String
  fileKey   String    @unique
  fileSize  Int
  gameInfo  Json?
  createdAt DateTime  @default(now())

  @@index([userHash])
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (cuid) | 记录主键，自动生成 |
| `userHash` | String | SHA256(phone/email)，带索引，用于用户隔离 |
| `fileName` | String | 上传文件原始名称 |
| `fileKey` | String | R2 文件路径 `records/{userHash}/{uuid}.sgf`，唯一约束 |
| `fileSize` | Int | 文件大小（字节） |
| `gameInfo` | Json? | 从 SGF 解析的游戏元信息（对局双方、结果等），可为空 |
| `createdAt` | DateTime | 创建时间 |

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
