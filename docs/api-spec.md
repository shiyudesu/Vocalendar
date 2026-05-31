# Vocalendar API 契约

## 1. 文档定位

本文件是 Vocalendar 的 API 通用规范与全量预定义接口契约。

规则：

- 所有对外 REST / WebSocket / Sync 契约以本文档为准
- `docs/modules/api.md` 负责模块范围与阶段；字段级契约只在本文档维护
- 当前文档描述的是目标态契约，不等于仓库当前已实现能力

## 2. 通用规范

### 2.1 基础约定

- Base Path：`/api/v1`
- Content-Type：默认 `application/json`
- 字段命名：统一 `camelCase`
- 时间：统一传输 ISO 8601 字符串，服务端 UTC 存储
- 时区：统一使用 IANA 时区，例如 `Asia/Shanghai`
- 分页：统一 cursor-based，不提供 offset

### 2.2 统一成功响应

```json
{
  "data": {},
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-05-30T15:00:00.000Z"
  }
}
```

### 2.3 统一失败响应

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "事件不存在",
    "details": null
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-05-30T15:00:00.000Z"
  }
}
```

### 2.4 统一认证

- 正式鉴权采用 JWT Bearer Token
- 会话模型：`accessToken + refreshToken`
- 需要断网补同步时，服务端可同时维护 `syncToken` 或等价版本游标

### 2.5 通用错误码

| 错误码 | 说明 |
| --- | --- |
| `VALIDATION_ERROR` | 请求参数校验失败 |
| `UNAUTHORIZED` | 未认证 |
| `FORBIDDEN` | 无权访问 |
| `EMAIL_ALREADY_EXISTS` | 邮箱已被注册 |
| `INVALID_CREDENTIALS` | 邮箱或密码错误 |
| `USER_NOT_FOUND` | 用户不存在 |
| `EVENT_NOT_FOUND` | 事件不存在 |
| `DRAFT_NOT_FOUND` | 草稿不存在 |
| `DRAFT_EXPIRED` | 草稿过期或不可确认 |
| `DRAFT_MISSING_FIELDS` | 草稿缺少必要字段，尚不能确认创建事件 |
| `DRAFT_PARSE_FAILED` | 文本 / 语音无法解析成有效草稿 |
| `TIME_CONFLICT` | 与已有事件冲突 |
| `ATTENDEE_NOT_FOUND` | 参与者不存在 |
| `NOTIFICATION_NOT_FOUND` | 通知不存在 |
| `VOICE_PROVIDER_UNAVAILABLE` | ASR / TTS 提供方不可用 |
| `VOICE_INPUT_TOO_SHORT` | 录音过短 |
| `VOICE_INPUT_EMPTY` | 无有效语音 |
| `COMMAND_NOT_SUPPORTED` | 快捷指令不支持 |
| `SYNC_CONFLICT` | 离线补同步发生冲突 |
| `RATE_LIMITED` | 请求频率限制 |
| `INTERNAL_ERROR` | 服务端内部错误 |

## 3. 核心对象

### 3.1 Event

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 事件 ID |
| `userId` | string | 是 | 所属用户 |
| `title` | string | 是 | 标题 |
| `description` | string \| null | 否 | 描述 |
| `startTime` | string | 是 | 开始时间 |
| `endTime` | string \| null | 否 | 结束时间 |
| `allDay` | boolean | 否 | 是否全天 |
| `timezone` | string | 是 | 时区 |
| `location` | string \| null | 否 | 地点 |
| `recurrence` | `RecurrenceRule \| null` | 否 | 重复规则 |
| `reminders` | `Reminder[]` | 是 | 提醒数组 |
| `attendees` | `Attendee[]` | 否 | 参与者 |
| `priority` | `low \| normal \| high` | 是 | 优先级 |
| `tags` | string[] | 否 | 标签 |
| `source` | `voice \| manual` | 是 | 来源 |
| `createdAt` | string | 是 | 创建时间 |
| `updatedAt` | string | 是 | 更新时间 |

### 3.2 RecurrenceRule

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `frequency` | `daily \| weekly \| monthly \| yearly` | 是 | 重复频率 |
| `interval` | number | 否 | 默认 1 |
| `byWeekDay` | number[] | 否 | 周内重复日 |
| `byMonthDay` | number[] | 否 | 月内重复日 |
| `until` | string \| null | 否 | 截止时间 |
| `count` | number \| null | 否 | 重复次数 |
| `exclusions` | string[] | 否 | 被跳过的原始实例开始时间列表 |

### 3.3 Reminder

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 提醒 ID |
| `eventId` | string | 是 | 事件 ID |
| `minutesBefore` | number | 是 | 提前分钟数 |
| `method` | `push \| email \| sms` | 是 | 提醒方式 |
| `sentAt` | string \| null | 否 | 发送时间 |

### 3.4 Attendee

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 参与者 ID |
| `name` | string | 是 | 姓名 |
| `email` | string \| null | 否 | 邮箱 |
| `status` | `pending \| accepted \| declined` | 是 | 状态 |

### 3.5 User / UserSettings

`UserSettings` 至少包含：

- `theme: light | dark | system`
- `defaultView: day | week | month | list`
- `defaultReminderMinutes: number`
- `voiceFeedback: boolean`
- `voiceSpeed: number`
- `language: string`

说明：

- 深色模式实际联动行为不属于 API
- API 只负责持久化和返回 `theme`

### 3.6 EventDraft

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `draftId` | string | 是 | 草稿 ID |
| `sourceText` | string | 是 | 原始文本 |
| `source` | `text \| voice` | 是 | 输入来源 |
| `referenceAt` | string | 是 | 相对时间解析基准 |
| `normalizedText` | string | 否 | 归一化文本 |
| `parsed` | object | 是 | 已识别字段 |
| `missingFields` | string[] | 是 | 缺失字段 |
| `warnings` | string[] | 是 | 提示 |
| `canSave` | boolean | 是 | 是否可直接保存 |
| `clarificationPrompt` | string \| null | 否 | 补问文案 |

`parsed`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string \| null | 否 | 标题 |
| `startAt` | string \| null | 否 | 开始时间 |
| `endAt` | string \| null | 否 | 结束时间 |
| `timezone` | string | 是 | 时区 |
| `location` | string \| null | 否 | 地点 |
| `participants` | string[] | 是 | 参与者候选 |

### 3.7 Notification

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 通知 ID |
| `title` | string | 是 | 标题 |
| `message` | string | 是 | 内容 |
| `time` | string | 是 | 时间 |
| `read` | boolean | 是 | 是否已读 |

### 3.8 Voice / Intelligence 对象

新增对象：

- `VoiceTranscriptionResult`
  - `text`
  - `language`
  - `confidence`
  - `segments[]`
- `TextToSpeechResult`
  - `audioUrl`
  - `durationMs`
  - `mimeType`
- `ConflictCheckResult`
  - `hasConflict`
  - `conflicts[]`
  - `suggestions[]`
- `Suggestion`
  - `type: duration | reminder | departure | title`
  - `value`
  - `reason`
- `QuickCommandResult`
  - `commandText`
  - `result`
  - `affectedEvents[]`

## 4. 接口清单

### 4.1 Auth

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | 邮箱密码注册 | MVP |
| `POST` | `/auth/login` | 邮箱密码登录 | MVP |
| `POST` | `/auth/refresh` | 刷新令牌 | MVP |
| `POST` | `/auth/logout` | 注销会话 | MVP |
| `GET` | `/me` | 获取当前用户 | MVP |
| `PATCH` | `/me` | 更新资料 | MVP |
| `PATCH` | `/me/settings` | 更新设置 | MVP |
| `DELETE` | `/me` | 删除账户 | V1.0 |
| `GET` | `/me/export?format=ics|csv` | 导出数据 | V1.0 |

### 4.2 Events

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `GET` | `/events` | 按时间范围 / 关键词 / 来源 / 优先级查询事件 | MVP |
| `POST` | `/events` | 根据 `draftId` 创建事件的兼容入口 | MVP |
| `GET` | `/events/{eventId}` | 获取事件详情 | MVP |
| `PUT` | `/events/{eventId}` | 全量更新事件 | MVP |
| `DELETE` | `/events/{eventId}` | 删除事件 | MVP |
| `POST` | `/events/batch-delete` | 批量删除 | V1.0 |
| `PUT` | `/events/{eventId}/reminders` | 覆盖提醒数组 | V1.0 |

查询参数：

- `startDate`
- `endDate`
- `timezone`
- `keyword`
- `source`
- `priority`
- `cursor`
- `limit`

重复事件范围：

- `recurrenceScope=single`
- `recurrenceScope=following`
- `recurrenceScope=all`

说明：

- 对 `PUT /events/{eventId}`：
  - `recurrenceScope=single` 或 `following` 时，请求体必须额外带 `occurrenceStartTime`
  - `occurrenceStartTime` 表示本次命中的原始实例开始时间
- 对 `DELETE /events/{eventId}`：
  - `recurrenceScope` 与 `occurrenceStartTime` 通过 query 传递
  - `single` / `following` 必须带 `occurrenceStartTime`
- 当前实现语义：
  - `single update`：将该实例从原系列排除，并生成一个独立的非重复事件
  - `following update`：按命中实例切断原系列，并为该实例及其后续实例生成新的重复系列
  - `single delete`：仅把该实例加入 `recurrence.exclusions`
  - `following delete`：截断命中实例及其后续实例

### 4.3 Attendees

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/events/{eventId}/attendees` | 添加参与者 | MVP |
| `PATCH` | `/events/{eventId}/attendees/{attendeeId}` | 更新参与者状态 | MVP |
| `DELETE` | `/events/{eventId}/attendees/{attendeeId}` | 移除参与者 | MVP |
| `POST` | `/events/{eventId}/attendees/invitations` | 发送邀请 | V1.0 |

说明：

- 仅对已存在 Vocalendar 账户的参与者发送内部邀请通知
- 当前返回聚合结果：`sentCount`、`skippedCount`
- 当前不发送外部邮件

### 4.4 Drafts / Voice Core

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/drafts` | 文本 / 转写文本生成草稿 | MVP |
| `PATCH` | `/drafts/{draftId}` | 草稿补充与修正 | MVP |
| `POST` | `/drafts/{draftId}/confirm` | 确认草稿并创建事件 | MVP |
| `GET` | `/voice-history` | 获取语音历史 | V1.0 |

说明：

- `POST /drafts/{draftId}/confirm` 是目标态草稿确认接口
- 当前实现仍保留 `POST /events` + `draftId` 作为兼容入口，两者都调用同一套草稿确认逻辑

### 4.5 ASR / TTS

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/voice/asr` | 上传音频并做在线识别 | V1.0 |
| `GET` | `/voice/asr/ws` | 建立实时语音识别 WebSocket 会话 | V1.0 |
| `POST` | `/voice/tts` | 生成播报音频 | V1.0 |
| `GET` | `/voice/providers` | 获取语音 provider / 离线能力状态 | V1.0 |

说明：

- `VAD` 不是独立 API
- 客户端负责停录时机
- API 负责音频接收、ASR 调用、失败处理和草稿衔接
- `POST /voice/asr`、`POST /voice/tts` 需要 Bearer Token
- `GET /voice/asr/ws` 通过 `accessToken` query 参数鉴权
- API 服务端代理阿里云实时识别 WebSocket 协议，不将 provider 协议暴露给客户端

### 4.6 Intelligence

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/intelligence/conflicts` | 检测时间冲突 | V1.5 |
| `POST` | `/intelligence/suggestions` | 生成习惯 / 提醒 / 出发建议 | V1.5 |
| `POST` | `/voice/commands/execute` | 执行快捷指令 | V1.5 |

首批快捷指令：

- `我到家了`
- `会议延期 15 分钟`
- `会议取消`

### 4.7 Notifications

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `GET` | `/notifications` | 查询通知列表 | MVP |
| `PATCH` | `/notifications/{notificationId}` | 标记已读 / 未读 | MVP |
| `DELETE` | `/notifications/{notificationId}` | 删除通知 | MVP |
| `POST` | `/notifications/{notificationId}/snooze` | 稍后提醒 | V1.0 |

说明：

- `PUT /events/{eventId}/reminders` 仅覆盖事件上的提醒配置，不会在写入时立即生成通知
- 服务端后台 reminder processor 会按提醒触发时间扫描到期 reminder，并在到期时：
  - 创建 `notifications` 记录
  - 推送 `notification.new` realtime 事件
  - 回写对应 reminder 的 `sentAt`
- `Notification.time` 表示本次通知实际触发时间；`snooze` 会把该时间顺延

### 4.8 Realtime

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `GET` | `/realtime/ws` | 建立 WebSocket 实时同步连接 | V1.0 |

连接方式：

- URL：`/api/v1/realtime/ws?accessToken=<jwt>`
- 协议：WebSocket
- 鉴权：使用当前用户 `accessToken`

推送事件类型：

- `event.created`
- `event.updated`
- `event.deleted`
- `notification.new`
- `draft.clarification`

### 4.9 Sync

| 方法 | 路径 | 作用 | 阶段 |
| --- | --- | --- | --- |
| `GET` | `/sync/bootstrap` | 获取离线初始化数据与 sync cursor | V2.0 |
| `POST` | `/sync/mutations` | 批量提交离线期间 mutation | V2.0 |

说明：

- 移动端离线查看 / 创建属于客户端职责
- API 负责增量同步、冲突回传和服务器最终状态

## 5. 关键请求 / 响应约定

### 5.1 `POST /drafts`

请求体：

```json
{
  "sourceText": "明天下午三点和张总在国贸喝咖啡",
  "timezone": "Asia/Shanghai",
  "referenceAt": "2026-05-30T01:00:00.000Z",
  "source": "voice"
}
```

### 5.1A `POST /drafts/{draftId}/confirm`

成功返回：

```json
{
  "data": {
    "event": {
      "id": "evt_001",
      "userId": "usr_001",
      "title": "喝咖啡",
      "description": null,
      "startTime": "2026-05-30T07:00:00.000Z",
      "endTime": null,
      "allDay": false,
      "timezone": "Asia/Shanghai",
      "location": "国贸",
      "recurrence": null,
      "reminders": [],
      "attendees": [],
      "priority": "normal",
      "tags": [],
      "source": "voice",
      "createdAt": "2026-05-30T01:05:00.000Z",
      "updatedAt": "2026-05-30T01:05:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-05-30T15:00:00.000Z"
  }
}
```

失败语义：

- 草稿不存在：`404 DRAFT_NOT_FOUND`
- 草稿仍缺字段：`422 DRAFT_MISSING_FIELDS`

### 5.2 `POST /voice/asr`

请求体：

- `multipart/form-data`
- 字段：
  - `audio`
  - `language`
  - `provider`
  - `enablePunctuation`

成功返回：

```json
{
  "data": {
    "text": "明天下午三点和张总在国贸喝咖啡",
    "language": "zh-CN",
    "confidence": 0.96,
    "segments": [
      { "startMs": 0, "endMs": 1250, "text": "明天下午三点" }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-05-30T15:00:00.000Z"
  }
}
```

鉴权：

- Bearer Token
- 当前请求体走 `multipart/form-data`
- 当前服务端将音频字节透传给阿里云上传 ASR HTTP 接口

### 5.3 `GET /voice/asr/ws`

连接方式：

- URL：`/api/v1/voice/asr/ws?accessToken=<jwt>`
- 协议：WebSocket
- 鉴权：使用当前用户 `accessToken`

客户端开始消息：

```json
{
  "type": "session.start",
  "audioFormat": "pcm",
  "sampleRate": 16000,
  "language": "zh-CN",
  "enableIntermediateResult": true,
  "enablePunctuation": true,
  "enableInverseTextNormalization": true
}
```

客户端音频消息：

- 二进制帧
- 每帧内容为连续音频数据
- 首期支持 `pcm / 16kHz / mono`

客户端结束消息：

```json
{
  "type": "session.finish"
}
```

服务端开始响应：

```json
{
  "type": "session.started",
  "sessionId": "vasr_001"
}
```

服务端中间结果：

```json
{
  "type": "transcript.partial",
  "sessionId": "vasr_001",
  "text": "明天下午三点",
  "confidence": 0.96,
  "isFinal": false
}
```

服务端最终结果：

```json
{
  "type": "transcript.final",
  "sessionId": "vasr_001",
  "text": "明天下午三点和张总开会",
  "confidence": 0.97,
  "isFinal": true
}
```

服务端结束响应：

```json
{
  "type": "session.finished",
  "sessionId": "vasr_001"
}
```

服务端错误响应：

```json
{
  "type": "error",
  "code": "VOICE_PROVIDER_UNAVAILABLE",
  "message": "Aliyun realtime ASR failed."
}
```

### 5.4 `POST /voice/tts`

请求体：

```json
{
  "text": "已为您创建明天下午三点的客户会议",
  "language": "zh-CN",
  "voice": "zh-CN-XiaoxiaoNeural",
  "speed": 1
}
```

鉴权：

- Bearer Token
- 当前成功响应中的 `audioUrl` 为 `data:` URL，直接内嵌音频字节

### 5.4A `POST /events/{eventId}/attendees/invitations`

成功返回：

```json
{
  "data": {
    "sentCount": 1,
    "skippedCount": 0
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-05-30T15:00:00.000Z"
  }
}
```

### 5.4B `GET /me/export?format=ics|csv`

说明：

- `csv` 当前导出两段内容：
  - 当前用户基础资料
  - 当前用户事件列表
- `ics` 当前导出当前用户全部事件的 `VEVENT`
- 当前实现直接返回文件内容，不包 `data/meta` JSON
- `format=csv`：
  - `Content-Type: text/csv; charset=utf-8`
  - 文件内容包含用户资料表头和事件列表表头
- `format=ics`：
  - `Content-Type: text/calendar; charset=utf-8`
  - 文件内容为 `VCALENDAR`，每个事件导出为 `VEVENT`
  - 若事件带重复规则、参与者、提醒，则分别导出 `RRULE`、`ATTENDEE`、`VALARM`

### 5.5 `POST /intelligence/conflicts`

请求体：

```json
{
  "title": "客户会议",
  "startTime": "2026-05-31T02:30:00.000Z",
  "endTime": "2026-05-31T04:00:00.000Z",
  "timezone": "Asia/Shanghai",
  "location": "国贸三期"
}
```

### 5.6 `POST /voice/commands/execute`

请求体：

```json
{
  "commandText": "会议延期 15 分钟",
  "referenceAt": "2026-05-30T10:00:00.000Z",
  "timezone": "Asia/Shanghai",
  "source": "voice"
}
```

## 6. 特殊说明

### 6.1 VAD

- `PRD` 要求支持 VAD 自动静音检测
- 该能力由客户端采集链路实现
- API 需要明确处理：
  - 空白音频
  - 过短音频
  - 无法识别的音频

### 6.2 深色模式

- API 不提供专门深色模式接口
- 统一走 `PATCH /me/settings`
- 只存储 `theme`，不处理“跟随系统”的渲染逻辑

### 6.3 离线支持

- `PRD` 要求移动端支持离线查看 / 创建
- API 需提供 Sync 协议，否则该能力无法落地
- Sync 进入 `V2.0`

## 7. 当前状态说明

截至 `2026-05-30`：

- 当前仓库实现仍主要是文本草稿解析与基础事件闭环
- 本文档已经补入你指出的缺口：ASR、TTS、智能建议、快捷指令、离线同步
- 深色模式与 VAD 也已在契约中明确边界，不再缺项
