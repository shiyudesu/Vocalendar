# Module: API

## 1. 模块定位

`API` 模块负责 Vocalendar 的 Hono HTTP / WebSocket 对外接口、鉴权编排、领域服务接线、错误码映射与多端同步协议。

本模块必须覆盖：

- 认证与账户
- 事件 CRUD、查询、搜索、重复事件范围更新
- 草稿解析确认链路
- 通知与提醒
- 参与者与邀请
- 在线 ASR / TTS 的服务端接线
- 智能建议与快捷指令的对外接口
- 多端实时同步
- 移动端离线补同步协议

本模块不直接实现：

- 浏览器 / 移动端录音 UI
- VAD 算法本体
- Web 深色模式渲染
- 端侧离线 ASR 模型

但 API 必须提供这些能力需要的契约和错误处理。

## 2. 与 PRD 的对应关系

### 已纳入 API 范围

- 语音识别（ASR）
  - 提供音频上传识别接口
  - 提供实时语音识别 WebSocket 接口
  - 提供 provider 能力状态接口
  - 识别结果回到 `drafts` / 快捷指令链路
- 语音反馈（TTS）
  - 提供文本转语音接口
  - 通过用户设置持久化 `voiceFeedback`、`voiceSpeed`
- 智能建议
  - 时间冲突检测
  - 历史习惯推荐时长 / 提醒
  - 地点相关出发建议
- 对话式语音助手（LLM 驱动）
  - `POST /assistant/chat` 统一对话入口
  - DeepSeek LLM 做意图识别 + 槽位提取 + 事件拆分
  - 返回结构化操作列表（创建/更新/删除/查询/补问）
- 快捷指令
  - “我到家了”
  - “会议延期 15 分钟”
  - “会议取消”
- 离线支持
  - 提供移动端 bootstrap 同步和离线 mutation 补提交通道
- 深色模式
  - 通过用户设置持久化 `theme`

### 明确不是独立 API 功能，但需在 API 中留边界

- VAD 自动静音检测
  - 由客户端录音链路负责
  - API 需要处理空白音频、过短音频、无有效语音等失败场景
- 深色模式系统联动
  - 由 Web / Mobile 负责
  - API 只存储设置值，不负责渲染行为

## 3. 阶段范围

### MVP

- 本地邮箱注册 / 登录 / 刷新 / 注销
- 当前用户资料与设置
- 事件 CRUD
- 时间范围查询 / 关键词搜索
- 草稿创建 / 草稿修正 / 草稿确认
- 通知列表 / 已读 / 删除
- 参与者增删改

### V1.0

- 重复事件范围更新 / 删除
- 提醒数组更新
- 数据导出
- 在线 ASR 上传识别
- 实时 ASR WebSocket 会话
- TTS 播报音频生成
- 语音能力状态接口
- 语音历史
- 稍后提醒
- WebSocket 实时同步

### V1.5

- 时间冲突检测接口
- 智能建议接口
- 快捷指令执行接口
- 智能能力与草稿 / 事件链路的统一错误码

### V2.0

- 离线 bootstrap 同步
- 离线 mutation 批量补提交
- 同步冲突回传

## 4. 当前差距

截至 `2026-05-31`，当前仓库代码已补齐阶段 1-2 的基础底座与认证最小闭环，但事件、通知、语音与实时能力仍显著落后于契约，主要差距如下：

- 认证、事件、草稿、通知、语音历史与 realtime outbox 已接入非测试 runtime 的 Postgres 仓储，但仍未完成真实 docker-compose 集成验证
- 提醒已接入后台 due-time processor，支持 reminder 持久化、到期判定、通知记录生成与 `notification.new` realtime 推送
- `POST /voice/asr`、`POST /voice/tts`、`GET /voice/providers` 与 `GET /voice/asr/ws` 已接入运行时阿里云 provider adapter，但仍未完成 live 凭证与 docker-compose 环境下的端到端验证
- 快捷指令执行能力尚未实现
- 智能建议能力尚未实现
- WebSocket 同步已落库 realtime outbox，并已接入 Redis pub/sub 路径；但仍未完成 docker-compose / 多实例 live 广播验证
- 无离线同步协议实现
- 重复事件范围更新 / 删除已实现 `single|following|all` 真实语义，使用 `occurrenceStartTime` 锚定命中实例
- 前端语音流程已接入真实浏览器录音 + WebSocket 实时 ASR，TTS 语音反馈与语音历史已上线

## 5. 开发任务拆分

| PR | 内容 | 阶段 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| `#13` | `GET/PUT/DELETE /events/{id}` | MVP | 现有事件仓储 | 🔵 可开工 |
| `#14` | `GET /events` 时间范围查询 / 搜索 | MVP | Parser 范围解析 | 🔵 可开工 |
| `#15` | `source=voice` 草稿接入 | MVP | Voice 转写文本 | ✅ 已完成 |
| `#16` | 提醒数组更新 / 通知基础接口 | V1.0 | Schemas | ✅ 已完成 |
| `#17` | 认证与账户接口 | MVP | Schemas | ✅ 已完成 |
| `#18` | 重复事件范围更新 / 删除接口 | V1.0 | Schemas / 仓储 | ✅ 已完成 |
| `#19` | `POST /voice/asr` + `GET /voice/asr/ws` 与 provider 抽象 | V1.0 | Voice provider | ✅ 前端已接入实时 WS |
| `#20` | `POST /voice/tts` 与设置联动 | V1.0 | TTS provider | ✅ 前端已接入播放 |
| `#21` | `GET /voice/providers` 能力状态接口 | V1.0 | 配置层 | ✅ 接口已就绪 |
| `#22` | 语音历史接口 | V1.0 | 仓储 | ✅ 已完成 |
| `#23` | `POST /intelligence/conflicts` | V1.5 | Parser | ⏳ 待开始 |
| `#24` | `POST /intelligence/suggestions` | V1.5 | Parser / 历史数据 | ⏳ 待开始 |
| `#25` | `POST /voice/commands/execute` | V1.5 | Parser | ⏳ 待开始 |
| `#28` | `POST /assistant/chat` 对话式助手 + DeepSeek LLM | V1.0 | DeepSeek API | ✅ 已实现 |
| `#26` | `GET /realtime/ws` 实时同步 | V1.0 | Redis / 推送层 | 🟡 待 live 验证 |
| `#27` | `/sync/bootstrap` + `/sync/mutations` | V2.0 | Mobile / 仓储 | ⏳ 待开始 |

## 6. 验收标准

- `docs/api-spec.md` 中覆盖 Auth / Events / Voice / Intelligence / Notifications / Realtime / Sync
- ASR、TTS、VAD、智能建议、快捷指令、深色模式、离线支持都在本文档中有明确 API 边界说明
- 阶段划分清晰，不把 `V1.5` / `V2.0` 混入 MVP
- 后续实现可以直接按本文档 PR 拆分推进
