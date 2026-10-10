# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[每次修改后自动上传 GitHub]
- Date: 2026-08-02
- Context: 用户完成移动端适配与鹰眼修复等多次代码修改后，提出统一的工作流要求
- Instructions:
  - 以后默认每次代码修改完成、验证通过后，自动执行 git add + commit + push 到 origin/main（无需再逐次询问）
  - 提交使用仓库历史一致的作者身份：user2701323525 <467755821698729-user2701323525@noreply.coze.cn>
  - 提交信息保持仓库风格（feat:/fix:/chore: 前缀 + 中文描述）
  - 说明：当前 origin 为 github.com/7878gyc/zhizi-web，历史提交作者实际为 7878gyc <monkeycode-ai@chaitin.com>；提交时以当前仓库历史作者为准。

[Project Knowledge Summary]
- Date: 2026-10-10
- Context: Discovered by Agent while verifying changes（运行 pnpm build）
- Category: Build Methods
- Instructions:
  - `pnpm build` 在缺少 R2_* 环境变量时会在 "Collecting page data" 阶段失败：`src/lib/r2-client.ts` 在模块加载时用 requireEnv 校验 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME，缺失即抛错。
  - 无法提供 R2 环境变量时，可用 `pnpm ts-check` + `pnpm test` + `pnpm lint:build`（或 `pnpm validate`）验证改动。
  - 首次验证前需先 `pnpm install`。

[Project Knowledge Summary]
- Date: 2026-10-10
- Context: 用户提供智子围棋官方开放 API 文档仓库，用于核对接口契约
- Category: 集成参考 / 环境配置
- Instructions:
  - 官方公开 API 契约仓库：https://github.com/kinfkong/zhizi-open-api
  - 权威字段名以 `openapi/zhizi-public-api.yaml` 为准，文档在 `docs/en/reference/`（REST、Socket.IO/GTP、engine-options、errors）
  - 关键约定：REST base `https://www.zhizigo.com`；受保护接口用 `Authorization: Bearer <user-token>`；订单与商品金额单位=分(fen)，余额/消费/入账=元(yuan)，时长=秒；401 返回纯文本 `Not Authorized`，其余错误为 `{ statusCode, key }`
  - 关键字段：change-password 请求体为 `oldPassword` + `password`；change-phone 可换手机号或邮箱且会轮换 token；send-code type 取值 `register/fast_login/reset_password/change_phone/change_email`
