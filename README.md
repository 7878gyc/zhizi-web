# 智子围棋 AI 分析平台

基于 Next.js 16 + React 19 + TypeScript 5 的围棋 AI 分析 Web 应用。集成智子围棋（Zhizi Go）GPU 算力平台，通过 Socket.IO 协议连接 KataGo 引擎，提供实时对局分析。

> **在线 Demo**：[https://zhizi.110708.xyz](https://zhizi.110708.xyz)

## 核心功能

- **登录认证**：手机号/邮箱 + 密码登录、验证码登录/注册、找回密码，通过后端代理转发 `zhizigo.com` API；会话 token 存 httpOnly Cookie
- **交互式棋盘**：Canvas 渲染 19x19 围棋盘，支持落子、悔棋、重放、棋盘尺寸切换（9/13/19 路）
- **AI 实时分析**：通过 Socket.IO 连接 KataGo 引擎，获取胜率走势和最佳推荐落子
- **多配置选择**：GPU 类型（1x/3x/6x/12x/24x/VIP 共享）、引擎（默认 CUDA，可切 TensorRT）、权重（18bnbt/28bnbt/fdx）
- **棋盘候选点**：LizzieYZY 风格的彩色选点（红→绿渐变，最佳为青色 + 蓝环），标注胜率与目差
- **变化图预览**：点击推荐落子查看 AI 推演的变化图（PV），预览时棋盘自动隐藏彩色选点
- **鹰眼分析**：基于共享分析缓存计算吻合率、首选命中率与问题手（疑问/失误/恶手/大恶手）。问题手归属到真正造成亏损的那一手，可点击跳转；切换分支、移动端关闭面板都不会丢数据
- **胜率曲线图**：Canvas 绘制的实时胜率走势图，统一黑方视角，跟随当前分支（含当前分支后续主线），支持点击跳转
- **棋谱导入**：支持 SGF 文件导入、野狐围棋棋谱链接解析、云棋谱库导入
- **SGF 导出**：生成含 KataGo LZ/注释属性的 SGF，**保留变化分支与根节点 AB/AW 让子**，支持本地下载与保存回云棋谱库（可覆盖更新）
- **棋谱云保存**：上传 SGF 到 Cloudflare R2 存储，支持列表查看、下载和删除，用户数据隔离
- **自动分析**：当前局面已有分析结果后每 2 秒自动前进下一步，遇到终局自动停止
- **棋谱导航**：第一手/最后一手、单步前进/后退、5 步快进/快退
- **贴目输入**：贴目值支持输入框自定义（范围 ±150 目，超出报错并重置默认值），提供 5.5/6.5/7.5 常用选项，桌面与移动端一致
- **用户菜单**：点击用户名（手机号/邮箱）展开下拉列表——我的棋谱、消费记录、充值、更换手机/邮箱、修改密码、会员自动续费、退出
- **账号设置**：修改密码（成功后需重新登录）、更换手机号/邮箱、会员自动续费开关（`PUT /api/cluster/account/me`）
- **消费记录**：弹窗展示当前余额，合并算力使用记录（时长/倍率/GPU/金额）与充值入账记录（充值方式/金额），按时间倒序，金额正负着色
- **余额充值**：快捷选项 5/10/20/50/100 元 + 自定义金额，微信支付
- **VIP 充值**：动态加载会员产品（1/3/6/12 个月），卡片选择后创建订单并唤起微信支付，自动轮询支付结果
- **移动端适配**：<768px 自动切换移动端布局（顶部操作栏、底部菜单、Tab 分析面板）；分析/鹰眼数据保存在共享缓存中，关闭面板后可恢复
- **分析缓存**：按 `MoveNode.id` 缓存每个局面的候选点与胜率；同一手数的不同分支不会互相覆盖，切分支会重新同步引擎
- **导入安全**：SGF 使用目标棋盘尺寸重放，非 2–19 路 `SZ` 回退 19 路；`KM[0]` 按无贴目处理

## 快速开始

### 环境要求

- Node.js 20.9+
- pnpm 9+
- PostgreSQL 14+（棋谱云保存功能需要）
- Cloudflare R2（棋谱云保存功能需要；未配置时相关 API 会在启动/请求时明确报错）

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 按需填入 DATABASE_URL、R2_*、USER_HASH_SALT、NEXT_PUBLIC_SITE_URL
```

生产环境必须配置 `USER_HASH_SALT`；缺失时服务端会直接报错（fail closed），不会退化成无盐哈希。

### 启动开发服务器

```bash
pnpm dev
```

启动后浏览器访问 `http://localhost:5000`。

### 构建

```bash
pnpm build
```

构建/启动阶段需要 R2 相关环境变量（`src/lib/r2-client.ts` 在模块加载时校验），请先按 `.env.example` 配置。

### 代码检查与测试

```bash
pnpm ts-check         # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm lint:build       # ESLint 仅报告 error
pnpm validate         # 同时运行 ts-check + lint:build
pnpm test             # 运行单元测试（vitest）
pnpm test:watch       # 监听模式运行单元测试
pnpm test:coverage    # 运行单元测试并输出覆盖率报告
pnpm exec prisma db push    # 数据库迁移（首次部署）
pnpm exec prisma generate   # 重新生成 Prisma Client
pnpm exec prisma studio     # 数据库可视化浏览
```

当前测试：17 个测试文件、139 项用例，覆盖围棋规则、坐标/SGF 解析、分析缓存、自动分析、鹰眼、认证哈希、迁移、支付与上传限制等。

## 项目结构

```
prisma/
└── schema.prisma                            # Prisma 数据模型（Record）
vitest.config.ts                             # Vitest 测试配置（jsdom + @/ 别名）
vitest.setup.ts                              # Vitest 测试初始化（jest-dom 断言）
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts               # 密码登录代理
│   │   │   ├── send-code/route.ts           # 短信/邮箱验证码发送代理（type 白名单）
│   │   │   ├── fast-login/route.ts          # 验证码登录代理
│   │   │   ├── me/route.ts                  # 用户信息代理
│   │   │   ├── logout/route.ts              # 清除会话 Cookie
│   │   │   ├── migrate/route.ts             # 老用户数据迁移（事务化）
│   │   │   └── fetch-socketio-token/route.ts # Socket.IO 令牌代理（args 白名单）
│   │   ├── foxwq/route.ts                   # 野狐棋谱抓取代理
│   │   ├── upload/route.ts                  # R2 预签名上传 URL（5MB 限制 + 归属校验）
│   │   ├── cluster/
│   │   │   ├── account/                     # 注册/改密/换绑/账户设置代理
│   │   │   ├── balance/route.ts             # 账户余额代理
│   │   │   ├── usage/my-usages/route.ts     # 算力使用记录代理
│   │   │   ├── credit/my-credits/route.ts   # 入账记录代理
│   │   │   └── product/route.ts             # 会员产品代理（无鉴权）
│   │   ├── pay/
│   │   │   ├── orders/route.ts              # 创建支付订单（服务端反查会员价）
│   │   │   └── orders/[orderId]/route.ts    # 订单状态查询
│   │   └── records/
│   │       ├── route.ts                     # 棋谱列表 + 保存
│   │       └── [id]/
│   │           ├── route.ts                 # 棋谱删除 / 重命名
│   │           └── download/route.ts        # 棋谱下载（预签名 URL）
│   ├── login/page.tsx                       # 登录页
│   ├── analyze/
│   │   ├── page.tsx                         # AI 分析主页面（移动/桌面条件渲染）
│   │   ├── _components/                     # 分析页子组件
│   │   │   ├── analyze-header.tsx           # 顶部栏（桌面）
│   │   │   ├── board-controls.tsx           # 棋盘控制条
│   │   │   ├── cloud-save-menu.tsx          # SGF 保存/云导入菜单
│   │   │   ├── foxwq-import-dialog.tsx      # 野狐导入弹窗
│   │   │   ├── komi-input.tsx               # 贴目输入框
│   │   │   ├── user-menu.tsx                # 用户菜单（消费/充值/VIP/账号设置）
│   │   │   └── mobile/                      # 移动端布局组件
│   │   └── _hooks/
│   │       ├── use-analysis-cache.ts        # 按 nodeId 缓存分析结果
│   │       ├── use-auto-analyze.ts          # 自动分析（等待当前局面分析完成）
│   │       ├── use-cloud-records.ts         # 云棋谱列表
│   │       └── __tests__/                   # 分析 Hook 测试
│   ├── records/page.tsx                     # 棋谱管理页
│   ├── about/ · privacy/                    # 关于/隐私与法律声明
│   ├── layout.tsx                           # 根布局 + metadata（深色主题）
│   ├── not-found.tsx / error.tsx            # 自定义 404 / 运行时错误页
│   ├── robots.ts / sitemap.ts               # SEO（读取 NEXT_PUBLIC_SITE_URL）
│   └── globals.css                          # 全局样式
├── components/
│   ├── go-board.tsx                         # Canvas 棋盘（候选点/变化图/悬停）
│   ├── ai-config-panel.tsx                  # AI 引擎配置面板
│   ├── analysis-panel.tsx                   # 胜率条 + 选点表
│   ├── move-tree.tsx                        # 落子树形导航
│   ├── winrate-chart.tsx                    # 胜率曲线（当前分支）
│   ├── hawk-eye-panel.tsx                   # 鹰眼（从共享缓存派生）
│   ├── katago-log-viewer.tsx                # 引擎日志查看器
│   ├── __tests__/hawk-eye-panel.test.tsx    # 鹰眼手数/颜色/亏损归属测试
│   └── ui/                                  # shadcn/ui 组件库
├── hooks/
│   ├── use-go-game.ts                       # 棋盘/MoveNode/提子/劫/胜率回写
│   ├── use-mobile.ts                        # 移动端断点检测
│   ├── use-zhizi-analysis.ts                # Socket.IO + GTP 串行同步/重连
│   ├── use-dialog-behavior.ts               # 弹窗焦点/ESC/滚动锁
│   └── __tests__/use-go-game.test.tsx       # 游戏逻辑与换盘尺寸测试
└── lib/
    ├── go-types.ts                          # 类型、坐标转换、info 解析、树工具
    ├── sgf.ts                               # SGF 导出（分支 + AB/AW + LZ/注释）
    ├── sgf-parser.ts                        # SGF 解析（分支 + LZ，缓存按 nodeId）
    ├── analysis-key.ts                      # 需要重新同步引擎的局面签名
    ├── cloud-save.ts                        # 云保存上传/建记录/更新记录（校验响应）
    ├── auth.ts                              # 客户端展示信息缓存 + 会话校验
    ├── auth-server.ts                       # 服务端认证、加盐哈希、fileKey 归属
    ├── user-key.ts                          # 存储键解析 + 老数据事务迁移
    ├── record-limits.ts                     # 文件名 / 5MB 上传限制
    ├── zhizi-auth.ts · zhizi-proxy.ts       # 智子会话/BFF 代理
    ├── zhizi-errors.ts                      # 上游错误文案映射
    ├── prisma.ts · r2-client.ts             # Prisma / R2 客户端
    ├── site.ts                              # NEXT_PUBLIC_SITE_URL
    ├── og-font.ts                           # OG 中文字体
    ├── utils.ts                             # 通用工具
    └── __tests__/                           # 纯逻辑与 API 路由测试
        ├── go-types.test.ts · sgf.test.ts · sgf-parser.test.ts
        ├── analysis-key.test.ts · record-limits.test.ts
        ├── auth.test.ts · auth-server.test.ts · user-key.test.ts
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
| 表单 | React Hook Form（shadcn/ui form 组件） |
| 测试 | Vitest + Testing Library |
| 代码检查 | ESLint 9 + eslint-plugin-import |
| 构建 | Next.js 默认 SWC（不使用 Babel） |
| 包管理 | pnpm 9 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 密码登录（代理到 zhizigo.com，成功后写入 httpOnly Cookie） |
| `/api/auth/send-code` | POST | 发送短信/邮箱验证码（type 白名单：register/fast_login/reset_password/change_phone/change_email） |
| `/api/auth/fast-login` | POST | 验证码快速登录 |
| `/api/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/logout` | POST | 登出（清除 httpOnly Cookie） |
| `/api/auth/migrate` | POST | 老用户数据迁移（先批量拷贝 R2，再 DB 事务更新，最后删旧对象） |
| `/api/auth/fetch-socketio-token` | POST | 获取 KataGo 引擎连接令牌（校验 args 白名单，且只转发 `args`） |
| `/api/cluster/account/register` | POST | 注册（需先 send-code type=register） |
| `/api/cluster/account/reset-password` | POST | 重置密码（成功后写入新会话 Cookie） |
| `/api/cluster/account/change-password` | POST | 修改密码（响应不含新 token，需重新登录） |
| `/api/cluster/account/change-phone` | POST | 更换手机号/邮箱 |
| `/api/cluster/account/me` | PUT | 更新账户（仅 membershipAutoRenew） |
| `/api/foxwq` | POST | 爬取野狐围棋棋谱内容 |
| `/api/upload` | POST | 生成 R2 预签名上传 URL（文件 ≤5MB、fileKey 必须属于当前用户） |
| `/api/records` | GET | 获取当前用户的棋谱列表 |
| `/api/records` | POST | 保存棋谱记录（校验文件名、大小 ≤5MB、fileKey 归属） |
| `/api/records/[id]` | DELETE | 删除指定棋谱（R2 文件 + 数据库记录） |
| `/api/records/[id]` | PATCH | 重命名棋谱记录（覆盖保存时使用） |
| `/api/records/[id]/download` | GET | 生成棋谱文件下载预签名 URL |
| `/api/cluster/balance` | GET | 获取账户余额（代理到 zhizigo.com） |
| `/api/cluster/usage/my-usages` | GET | 获取算力使用记录（消费记录弹窗） |
| `/api/cluster/credit/my-credits` | GET | 获取入账/充值记录 |
| `/api/cluster/product` | GET | 获取会员产品列表（无鉴权） |
| `/api/pay/orders` | POST | 创建微信 Native 支付订单（充值/VIP；会员价格由服务端产品表反查，不信任客户端 amount） |
| `/api/pay/orders/[orderId]` | GET | 查询支付订单状态（轮询支付结果） |

## 棋谱云保存

### 架构原理

棋谱云保存功能将用户上传的 SGF 文件存储在 Cloudflare R2（S3 兼容对象存储），元数据存储在 PostgreSQL 数据库中。整个流程复用智子围棋平台（zhizigo.com）的认证体系，用户数据通过哈希值隔离。

```
┌──────────────┐   Cookie: zhizi_session=<token>        ┌──────────────┐
│              │ ─────────────────────────────────────▶ │              │
│   前端浏览器   │                                        │  Next.js API │
│  (浏览器直传)  │ ◀───────────────────────────────────── │   后端服务    │
│              │     返回预签名 PUT URL (300秒有效)        │              │
└──────┬───────┘                                        └──────┬───────┘
       │                                                       │
       │  PUT <presigned-url>                    ┌──────────────┴──────────────┐
       │  Content-Type: application/x-go-sgf     │                              │
       └────────────────────────────────────────▶│  1. 从 httpOnly Cookie       │
                                                  │     提取 token               │
                                                  │  2. 调用 zhizigo.com /me     │
                                                  │     验证身份获取 phone/email  │
┌──────────────┐                                  │  3. HMAC-SHA256(salt,        │
│              │◀─────────────────────────────────│     identifier) = userHash  │
│   Cloudflare │  生成预签名 Upload URL             │  4. 路径: records/{userHash} │
│      R2      │                                  │     /{uuid}.sgf             │
│              │                                   │  5. 数据库 where:           │
│  文件结构:    │                                   │     { userHash }            │
│  records/    │                                  └─────────────────────────────┘
│  └─ {hash}/  │
│     └─ *.sgf │
└──────────────┘
```

**用户标识流程**：前端发送同源请求时由浏览器自动携带 httpOnly Cookie 中的会话 token，后端据此调用智子 `/account/me` 取回手机号/邮箱，再计算**加盐哈希（HMAC-SHA256）**作为存储键。哈希运算仅在后端执行，前端不接触用户手机号/邮箱原文，也读不到 token。

**老用户迁移（零数据丢失）**：引入盐之前创建的数据以旧的无盐 SHA-256 作为存储路径。老用户登录后会自动触发迁移（`POST /api/auth/migrate`）：先把 `records/{旧键}/` 下的对象全部**拷贝到 `records/{加盐键}/`**，再用一个 Prisma 事务批量更新 DB，最后删除旧对象。任一拷贝或事务失败都会清理已拷贝的新对象并继续使用旧键，不会出现“部分记录在新键、部分在旧键”的中间态；迁移是幂等的，下次登录会重试。`fileKey` 不在本人旧目录下的异常记录会被跳过。新账号直接使用加盐键，路径无法被枚举推算。

**生产环境盐**：`USER_HASH_SALT` 在 production 下必填；缺失时相关接口直接失败，避免悄悄退化为可用手机号/邮箱枚举的无盐哈希。

**上传与归属校验**：单个 SGF 最大 5 MiB；预签名上传、入库、下载、删除都会校验 `fileKey` 位于 `records/{当前 userHash}/` 下，防止伪造 fileKey 越权读写（IDOR）。

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
pnpm exec prisma db push
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
| `R2_ENDPOINT` | 可选，R2/S3 endpoint | 默认由 `R2_ACCOUNT_ID` 拼出 `https://{account-id}.r2.cloudflarestorage.com`；使用其他 S3 兼容服务时可显式指定 |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID | 登录 Cloudflare 控制台，进入 R2 页面，右上角显示的 32 位十六进制字符串 |
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID | 在 R2 桶的 Settings → Manage R2 API Tokens 中创建，创建后立即显示。以 `r2_` 开头 |
| `R2_SECRET_ACCESS_KEY` | R2 API Secret Access Key | 与 Access Key ID 同时创建，创建后仅显示一次，需立即保存。格式为变长字符串 |
| `R2_BUCKET_NAME` | R2 存储桶名称 | 创建桶时指定的名称，例如 `zhizi-records` |
| `USER_HASH_SALT` | 用户标识加盐哈希的盐（HMAC key） | 自行生成的随机字符串，例如 `openssl rand -hex 32`。**生产环境必填**（缺失会直接报错，避免退化为无盐哈希）；**必须稳定持久**：一旦更换，已存在的账号将无法定位自己的数据 |
| `NEXT_PUBLIC_SITE_URL` | 站点对外 URL（metadata / sitemap / robots） | 例如 `https://zhizi.example.com`；自部署时改成自己的域名 |
| `ZHIZI_API_BASE` | 可选，智子 API 基地址 | 默认 `https://www.zhizigo.com`；切换测试环境时使用 |

### 环境变量示例

```bash
# PostgreSQL 连接字符串（Neon 示例）
DATABASE_URL="postgresql://zhizi:xxxxxxxx@ep-cool-bush-123456.ap-southeast-1.aws.neon.tech/zhizi?sslmode=require"

# Cloudflare R2
R2_ACCOUNT_ID="3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
R2_ACCESS_KEY_ID="r2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_BUCKET_NAME="zhizi-records"

# 生产必填：用户标识加盐哈希（HMAC key）
USER_HASH_SALT="replace-with-openssl-rand-hex-32"

# 站点对外 URL
NEXT_PUBLIC_SITE_URL="https://zhizi.example.com"
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
| `userHash` | String | 用户存储键：新账号为加盐哈希（HMAC-SHA256），老数据为旧的无盐 SHA-256；带索引，用于用户隔离 |
| `fileName` | String | 上传文件原始名称 |
| `fileKey` | String | R2 文件路径 `records/{userHash}/{uuid}.sgf`，唯一约束 |
| `fileSize` | Int | 文件大小（字节） |
| `gameInfo` | Json? | 从 SGF 解析的游戏元信息（对局双方、结果等），可为空 |
| `createdAt` | DateTime | 创建时间 |

## 分析协议

基于智子围棋开放平台 v1.1.0，核心流程：

1. 通过 `/api/auth/fetch-socketio-token` 获取连接令牌和 URL（每次连接/重连都取新令牌，不复用旧令牌）
2. 使用 Socket.IO 连接 KataGo 引擎（`/socket.io.v4` 路径）
3. `stdout` 事件按流缓冲，仅在收到完整 `\n` 行时解析；一次事件可能是半行，也可能是 `{ data: binary }` 二进制块
4. GTP 命令串行、不流水线：给每条命令加数字 ID，收到 `= <id>` 成功响应后再发下一条。同步前先 `stop` 旧分析并清空行缓冲，顺序固定为 `boardsize` → `kata-set-rules` → `komi` → `clear_board` → 让子 → `play...` → `kata-analyze B/W 50`；重放期间收到的旧 `info` 会被丢弃
5. 引擎通过 `stdout` 持续返回 `info` 行，解析胜率、选点、PV 等信息（50cs = 0.5s 间隔）
6. 断开前先发送 `stop`；重连时丢弃旧 GTP、取新令牌、等 `ready` 后整盘重放再 `kata-analyze`
7. 胜率统一转换为黑方视角存储和展示（引擎原始胜率是“当前行棋方”视角）
8. 每次同步带 `generation` / `runId`：断线重连或新请求会作废旧 socket 回调、在途 GTP 命令与旧分析结果

## 分析状态与缓存

- **落子树**：`useGoGame` 用 `MoveNode` 表示分支，每次导航从根节点重放棋盘与提子。导入 SGF 时 `loadFromTree(tree, target, boardSizeOverride)` 显式传入目标棋盘尺寸，避免 `setBoardSize` 尚未生效时用旧尺寸重放。
- **同步签名**：切换局面时用 `buildAnalysisSyncKey` 生成签名，包含 `nodeId`、棋盘尺寸、贴目、规则、行棋方、当前手顺与让子。**同一手数的不同分支 nodeId 不同，因此会重新分析**，不会复用上一分支结果。
- **缓存键**：`useAnalysisCache` 使用 `Map<nodeId, { data, winrate }>`，不再按手数缓存；导航时只展示属于当前 nodeId 的缓存。`syncingRef` 保证重放盘面期间旧局面的 info 不会写进新缓存。
- **鹰眼**：`HawkEyePanel` 从共享缓存 + 当前路径 nodeId 派生结果，不维护组件内历史；修正了“实际着手 / 手数颜色 / 胜率亏损”整体错位一手的问题，移动端关闭面板也不会丢数据。
- **自动分析**：只有当 `cache.has(currentNodeId)` 时才前进，避免引擎还没算完就每 2 秒跳下一手。
- **胜率曲线**：`getExtendedLine` 以当前节点为基准，向前拼接当前路径、向后沿首选子节点延伸；点击曲线/问题手始终落在当前分支。
- **SGF 边界**：`SZ` 仅接受 2–19（非法回退 19），`KM[0]` 是合法值；导出保留变化分支和根节点 `AB/AW` 让子，LZ/注释按 `node.id` 取缓存；`gtpToCoord` 对 pass/越界坐标显式抛错，调用方按无效点跳过。

## 测试与校验

```bash
pnpm validate    # tsc + ESLint（--quiet）
pnpm test        # Vitest
pnpm build       # Next.js 生产构建
```

当前测试共 **17 个测试文件、139 项用例**，覆盖：

- 围棋落子/提子/自杀/悔棋/胜率回写，以及导入换棋盘尺寸；
- 坐标转换、GTP info 解析、落子树/当前分支工具；
- SGF 解析与导出（分支、AB/AW 让子、KM/SZ 边界、LZ 往返）；
- 分析缓存按 nodeId 隔离、自动分析等待当前局面；
- 鹰眼手数/颜色/亏损归属与同手数分支隔离；
- 认证加盐哈希（含生产缺盐 fail-closed）、老数据迁移、上传限制；
- Socket.IO 令牌 args 白名单与支付订单服务端定价；
- 云保存响应校验/防重复记录、弹窗焦点与滚动锁、移动布局断点、默认 CUDA 引擎。

## 注意事项

- 必须使用 **pnpm** 作为包管理器（仓库锁定 pnpm 9）
- 分析功能需要先在智子围棋平台注册账号
- 从本地文件/野狐导入 SGF 会自动断开当前 AI 连接，需手动重新开始分析；从云棋谱导入会保持连接，并按新棋谱自动重新同步分析
- 远程算力模式尚未接入，当前固定使用本地分析；不会再通过 localStorage 绕过登录校验
- 登录/验证码/下单接口未在应用内做速率限制，生产部署建议在反向代理或网关层限流
- 生产环境必须配置 `USER_HASH_SALT`；缺少时相关接口会直接失败（这是刻意的 fail-closed 行为）
- 构建/启动需要 R2 环境变量；`src/lib/r2-client.ts` 会在模块加载时校验，缺失会明确报错
