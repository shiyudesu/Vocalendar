# Vocalendar API v1.0 分阶段交付计划

## Summary

- 目标：把当前仅有草稿解析与基础事件闭环的 `packages/api` / `packages/schemas`，推进到文档定义的 `API v1.0` 目标态，并补齐所有缺失的 MVP 前置能力。
- 范围：只覆盖 `API v1.0`；Web/Mobile 不在本轮实现范围内，只作为消费方约束。
- 完成定义：按“真实可运行集成”交付。完成态要求本地可通过 `docker-compose.yml` 跑起 Postgres/Redis，API 能真实完成本地注册登录、事件/提醒/通知闭环、导出、WebSocket 实时同步、阿里云 ASR/TTS 与实时 ASR WebSocket。

## Phase Plan

### 阶段 1：契约与基础设施底座

- 同步并校准 `docs/prd.md`、`docs/modules/api.md`、`docs/api-spec.md` 与当前已确认决策。
- 重构 `packages/schemas`，从 `v0_1` 升级到目标态 schema：`auth`、`me/settings`、`events`、`recurrence`、`reminders`、`attendees`、`drafts`、`notifications`、`voice`、`realtime`、`export`。
- 在 `packages/api` 建立 `config/env`、数据库连接、migration、repository 分层、Redis 接入、JWT 配置读取。
- 明确统一命名：事件字段使用 `startTime/endTime`，事件来源使用 `voice | manual`，列表统一 cursor 分页。

### 阶段 2：MVP 认证与账户

- 实现本地邮箱密码 `register/login/refresh/logout`。
- 实现 `GET/PATCH /me`、`PATCH /me/settings`、`DELETE /me`。
- 引入多设备会话模型，`accessToken=15m`，`refreshToken=30d`。
- 为所有需鉴权路由补认证中间件、错误码与 request context。

### 阶段 3：MVP 事件主链路

- 用 Postgres 仓储替换内存事件/草稿仓储。
- 实现 `POST /events`、`GET /events`、`GET/PUT/DELETE /events/{id}`。
- 实现 `POST /drafts`、`PATCH /drafts/{draftId}`、`POST /drafts/{draftId}/confirm`。
- 实现参与者接口：添加、更新状态、删除。
- 保留现有文本解析逻辑，但迁移到目标态 schema 与错误码。

### 阶段 4：通知、提醒、重复事件与导出

- 实现 `GET/PATCH/DELETE /notifications` 与 `POST /notifications/{id}/snooze`。
- 实现 `PUT /events/{id}/reminders` 与提醒到期生成通知记录。
- 实现重复事件范围更新/删除，支持 `single|following|all`。
- 实现 `GET /me/export?format=ics|csv`，采用直接文件下载。

### 阶段 5：语音能力

- 实现 `POST /voice/asr` 上传音频识别。
- 实现 `GET /voice/asr/ws`，客户端连 Vocalendar，服务端代理阿里云实时 ASR WebSocket。
- 实现 `POST /voice/tts`、`GET /voice/providers`、`GET /voice-history`。
- 实时 ASR 首期只支持 `pcm / 16kHz / mono`；VAD 仍由客户端负责。
- 语音历史只存元数据与识别/合成结果，不存原始音频。

### 阶段 6：实时同步与统一收口

- 实现 `GET /realtime/ws`。
- 对事件与通知写操作广播 `event.created`、`event.updated`、`event.deleted`、`notification.new`、`draft.clarification`。
- 统一错误码、鉴权、provider 状态判断、WS 鉴权、导出响应格式。
- 拆分当前单体 `app.test.ts`，按资源组织契约测试与集成测试。

## Branch And PR Workflow

- 每个阶段必须独立走一次完整 Git 生命周期，不允许直接在 `main` 上开发。
- 固定循环：
    1. 从最新 `main` 创建阶段分支。
    2. 仅在该分支完成该阶段的代码、测试、文档同步。
    3. 运行该阶段所需验证命令。
    4. 使用 `gh` 创建 PR。
    5. 使用 `gh` 合并 PR。
    6. 删除本地与远端阶段分支。
    7. 回到 `main` 并拉取最新。
    8. 再开始下一阶段。
- 分支命名固定：
    - `feat/api-phase-1-foundation`
    - `feat/api-phase-2-auth`
    - `feat/api-phase-3-events`
    - `feat/api-phase-4-notifications-reminders`
    - `feat/api-phase-5-voice`
    - `feat/api-phase-6-realtime`
- PR 标题固定使用提交规范风格，例如：
    - `feat(api): build phase 1 foundation`
- 合并策略固定为 squash merge，保持主干历史清晰。
- 每个阶段 PR 描述必须包含：
    - 改了什么
    - 为什么改
    - 接口 / 行为影响
    - 如何验证
    - 同步更新了哪些文档
- 若阶段开发中发现文档与实现冲突，必须在同一阶段分支内一起修正文档后再提 PR。
- 若某阶段存在未解决阻塞，不允许跳到下一阶段分支继续开发。

## Public Interfaces And Decisions

- 认证只做本地邮箱密码注册登录，不做 OAuth。
- `POST /auth/register` 为邮箱密码注册。
- `GET /voice/asr/ws` 为 Vocalendar 自己的实时 ASR WebSocket 接口，使用 `accessToken` query 参数鉴权。
- 实时 ASR 消息协议固定为：
    - 客户端：`session.start`、二进制音频帧、`session.finish`
    - 服务端：`session.started`、`transcript.partial`、`transcript.final`、`session.finished`、`error`
- 提醒“真实可运行”定义为：提醒持久化、到期判定、通知记录生成、实时推送；不包含真实邮件/SMS/Push 投递。
- 参与者邀请“真实可运行”定义为：邀请记录与内部通知可用，不做外部邮件邀请发送。
- 阿里云实时 ASR/TTS 使用当前 `.env.example` 中的配置项，不再另起第二套 provider 配置模型。

## Test Plan

- 阶段 1：
    - `packages/schemas` 的 schema 成功/失败用例。
    - `packages/api` 的 env/db/config 初始化测试。
- 阶段 2：
    - 注册、登录、刷新、注销、未认证访问、重复邮箱、错误密码。
- 阶段 3：
    - 事件创建/查询/详情/更新/删除。
    - 草稿创建/修正/确认。
    - 参与者增删改。
- 阶段 4：
    - 提醒覆盖、通知生成、snooze、重复事件范围行为、ICS/CSV 导出。
- 阶段 5：
    - 上传 ASR、空音频、短音频、provider 失败、TTS、provider 状态、语音历史。
    - 实时 ASR WS：未认证、session.start 校验、partial/final、finish、provider 错误。
- 阶段 6：
    - `GET /realtime/ws` 认证与连接。
    - 事件/通知广播。
    - 全量回归与最终 `pnpm check`。
- 每阶段最少验证命令：
    - `pnpm --filter @vocalendar/schemas check`
    - `pnpm --filter @vocalendar/schemas test`（若该阶段改了 schemas）
    - `pnpm --filter @vocalendar/api check`
    - `pnpm --filter @vocalendar/api test`
    - `pnpm --filter @vocalendar/api build`（若该阶段改了入口、WS、构建或运行配置）
- 最终阶段额外运行：
    - `pnpm check`

## Assumptions

- 当前本地依赖基线固定为仓库根目录的 `.env.example` 与 `docker-compose.yml`。
- Postgres 与 Redis 由 `docker compose` 提供，本轮不再设计第二套本地启动方式。
- 阿里云凭证若缺失，除语音阶段外其余阶段可照常推进；语音阶段必须在真实凭证下完成最终验证后才算完成。
- 任何阶段都不能把 `V1.5` / `V2.0` 的能力混入当前实现。
