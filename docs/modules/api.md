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

截至 `2026-05-30`，当前仓库代码仍主要停留在文本草稿解析与基础事件闭环，存在以下差距：

- 无正式账号体系实现
- 无在线 ASR / TTS 能力
- 无快捷指令执行能力
- 无智能建议能力
- 无 WebSocket 同步能力
- 无离线同步协议实现
- 前端语音流程仍是 mock
- 深色模式尚未验证真实系统联动

## 5. 开发任务拆分

| PR | 内容 | 阶段 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| `#13` | `GET/PUT/DELETE /events/{id}` | MVP | 现有事件仓储 | 🔵 可开工 |
| `#14` | `GET /events` 时间范围查询 / 搜索 | MVP | Parser 范围解析 | 🔵 可开工 |
| `#15` | `source=voice` 草稿接入 | MVP | Voice 转写文本 | ⏳ 待开始 |
| `#16` | 提醒数组更新 / 通知基础接口 | V1.0 | Schemas | ⏳ 待开始 |
| `#17` | 认证与账户接口 | MVP | Schemas | ⏳ 待开始 |
| `#18` | 重复事件范围更新 / 删除接口 | V1.0 | Schemas / 仓储 | ⏳ 待开始 |
| `#19` | `POST /voice/asr` + `GET /voice/asr/ws` 与 provider 抽象 | V1.0 | Voice provider | ⏳ 待开始 |
| `#20` | `POST /voice/tts` 与设置联动 | V1.0 | TTS provider | ⏳ 待开始 |
| `#21` | `GET /voice/providers` 能力状态接口 | V1.0 | 配置层 | ⏳ 待开始 |
| `#22` | 语音历史接口 | V1.0 | 仓储 | ⏳ 待开始 |
| `#23` | `POST /intelligence/conflicts` | V1.5 | Parser | ⏳ 待开始 |
| `#24` | `POST /intelligence/suggestions` | V1.5 | Parser / 历史数据 | ⏳ 待开始 |
| `#25` | `POST /voice/commands/execute` | V1.5 | Parser | ⏳ 待开始 |
| `#26` | `GET /realtime/ws` 实时同步 | V1.0 | Redis / 推送层 | ⏳ 待开始 |
| `#27` | `/sync/bootstrap` + `/sync/mutations` | V2.0 | Mobile / 仓储 | ⏳ 待开始 |

## 6. 验收标准

- `docs/api-spec.md` 中覆盖 Auth / Events / Voice / Intelligence / Notifications / Realtime / Sync
- ASR、TTS、VAD、智能建议、快捷指令、深色模式、离线支持都在本文档中有明确 API 边界说明
- 阶段划分清晰，不把 `V1.5` / `V2.0` 混入 MVP
- 后续实现可以直接按本文档 PR 拆分推进
