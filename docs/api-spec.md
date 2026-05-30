# Vocalendar API 全量接口契约

## 1. 文档定位

本文档是 Vocalendar 的**全量预定义接口契约**，所有模块开发必须基于本文档定义的接口。

规则：
- 接口一旦定义，模块开发期间不允许擅自变更
- 如需变更，走「接口变更评审」：提出方更新本文档 → 通知所有依赖方评审 → 合并后方可实施
- 本文档的变更是全项目级事件，不是单个模块的内部决定
- 未实现的接口标记为「预留」，其实现排期由对应模块计划维护

---

## 2. 通用规则

### 2.1 基本约定
- Base Path：`/api/v1`
- 数据格式：`application/json`
- 字段命名：请求与响应统一使用 `camelCase`
- 时间存储：UTC ISO 8601 字符串
- 时区传递：使用 IANA 时区，例如 `Asia/Shanghai`
- 客户端复用：`packages/web` 的 Vite React Web 前端通过配置化 API base URL 跨域调用 `packages/api` HTTP API；后续 `Capacitor` 移动端必须调用同一套部署后的 HTTP API，不按客户端类型拆分独立契约
- 不兼容变更：进入新的主版本路径，例如 `/api/v2`

### 2.2 鉴权阶段约定

| 阶段 | 鉴权方式 |
| --- | --- |
| `v0.1-v0.5` | 允许匿名会话或开发态伪用户 |
| `v1.0+` | Bearer Token 或等价正式鉴权机制 |

在匿名阶段，服务端仍应维护基本 session 概念，用于隔离事件数据和埋点。

### 2.3 RESTful 命名规范
- 路径应优先使用复数资源名，例如 `drafts`、`events`
- 创建资源使用 `POST /resources`
- 查询集合使用 `GET /resources`
- 获取单个资源使用 `GET /resources/:id`
- 部分更新使用 `PATCH /resources/:id`
- 删除资源使用 `DELETE /resources/:id`
- 避免在路径中使用动作型命名，例如 `/parse`、`/clarify`、`/createEvent`
- 当某个操作本质上是在修改资源状态时，优先用资源更新而不是动作接口
- 只有在确实无法抽象为资源操作时，才引入明确动作型子路径，并在本文档中说明理由

### 2.4 统一成功响应格式

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-05-29T10:00:00Z"
  }
}
```

规则：
- `data` 承载业务结果
- `meta.requestId` 用于链路追踪
- `meta.timestamp` 为服务端响应时间

### 2.5 统一失败响应格式

```json
{
  "error": {
    "code": "DRAFT_MISSING_FIELDS",
    "message": "startAt is required before saving",
    "details": {
      "missingFields": ["startAt"]
    }
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-05-29T10:00:00Z"
  }
}
```

规则：
- `error.code` 是前后端可依赖的稳定错误码
- `error.message` 是面向调试和日志的可读信息
- `error.details` 用于补充结构化上下文，可按错误类型扩展

### 2.6 通用错误码

| 错误码 | 说明 |
| --- | --- |
| `VALIDATION_ERROR` | 请求体或查询参数不合法 |
| `UNAUTHORIZED` | 未通过鉴权 |
| `FORBIDDEN` | 权限不足 |
| `NOT_FOUND` | 资源不存在 |
| `DRAFT_PARSE_FAILED` | 文本无法解析成有效草稿 |
| `DRAFT_MISSING_FIELDS` | 草稿缺少必要字段，不能直接保存 |
| `EVENT_CONFLICT` | 与现有事件冲突 |
| `PERSISTENCE_ERROR` | 数据保存失败 |
| `EXTERNAL_PROVIDER_ERROR` | 外部依赖异常 |

### 2.7 时间与查询规则
- 所有写入数据库的时间必须转成 UTC
- 响应必须携带事件原始业务时区
- 与"今天/明天/本周"相关的查询解释应基于用户时区，而不是服务器时区
- 涉及时间范围查询时，`from` 和 `to` 的语义按本文档对应接口定义执行

---

## 3. 接口清单

### 3.1 已实现接口

| 方法 | 路径 | 用途 | 实现模块 | 状态 |
|------|------|------|---------|------|
| POST | `/api/v1/drafts` | 创建草稿 | Parser + API | 已实现 |
| PATCH | `/api/v1/drafts/:draftId` | 更新草稿 | Parser + API | 已实现 |
| POST | `/api/v1/events` | 创建事件 | API | 已实现 |
| GET | `/api/v1/events` | 查询事件（recent 模式） | API | 已实现 |

### 3.2 预留接口

以下接口已在本契约中定义，但尚未实现，排期由对应模块计划维护：

| 方法 | 路径 | 用途 | 依赖模块 | 状态 |
|------|------|------|---------|------|
| GET | `/api/v1/events` | 范围查询（today/tomorrow/week/keyword） | Parser + API | 预留 |
| GET | `/api/v1/events/:id` | 获取单个事件 | API | 预留 |
| PATCH | `/api/v1/events/:id` | 修改事件 | Parser + API | 预留 |
| DELETE | `/api/v1/events/:id` | 删除事件 | API | 预留 |
| POST | `/api/v1/drafts` | 语音来源草稿（source=voice） | Voice + Parser + API | 预留 |
| POST | `/api/v1/reminders` | 创建提醒 | API | 预留 |
| GET | `/api/v1/reminders` | 查询提醒 | API | 预留 |
| PATCH | `/api/v1/reminders/:id` | 修改提醒 | API | 预留 |
| DELETE | `/api/v1/reminders/:id` | 删除提醒 | API | 预留 |

---

## 4. 核心对象

### 4.1 Event

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 事件唯一标识 |
| `title` | string | 是 | 事件标题或主体 |
| `description` | string \| null | 否 | 事件详情 |
| `startAt` | string | 是 | UTC ISO 8601 时间 |
| `endAt` | string \| null | 否 | 结束时间 |
| `timezone` | string | 是 | 原始语义对应时区 |
| `location` | string \| null | 否 | 地点 |
| `participants` | string[] | 否 | 参与人列表 |
| `source` | string | 是 | `text` 或 `voice` |
| `status` | string | 是 | `confirmed` / `cancelled` / `draft` |
| `createdAt` | string | 是 | 创建时间 |
| `updatedAt` | string | 是 | 最后更新时间 |

### 4.2 EventDraft

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `draftId` | string | 是 | 草稿唯一标识 |
| `sourceText` | string | 是 | 用户输入的原始文本 |
| `source` | string | 是 | `text` 或 `voice` |
| `referenceAt` | string | 是 | 解析相对时间时使用的提交基准时间，UTC ISO 8601 |
| `normalizedText` | string | 否 | 归一化后的文本 |
| `parsed` | object | 是 | 当前已识别字段 |
| `missingFields` | string[] | 是 | 保存前必须补全的字段 |
| `warnings` | string[] | 是 | 非阻塞问题提示 |
| `canSave` | boolean | 是 | 是否允许直接创建事件 |
| `clarificationPrompt` | string \| null | 否 | 面向用户的补问信息 |

#### EventDraft.parsed

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string \| null | 否 | 解析出的标题 |
| `startAt` | string \| null | 否 | 解析出的开始时间 |
| `endAt` | string \| null | 否 | 解析出的结束时间 |
| `timezone` | string | 是 | 当前解析对应时区 |
| `location` | string \| null | 否 | 地点 |
| `participants` | string[] | 否 | 参与人列表 |

保存前最低要求：
- `title` 非空
- `startAt` 非空
- `timezone` 非空
- `sourceText` 和 `source` 可追踪

### 4.3 EventListItem

范围查询结果中的事件摘要：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 事件 ID |
| `title` | string | 是 | 标题 |
| `startAt` | string | 是 | 开始时间 |
| `endAt` | string \| null | 否 | 结束时间 |
| `timezone` | string | 是 | 时区 |
| `location` | string \| null | 否 | 地点 |

### 4.4 QueryRequest（预留）

范围查询请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `range` | string \| null | 否 | `today` / `tomorrow` / `week` / `month` |
| `from` | string \| null | 否 | UTC ISO 8601，与 `to` 二选一或同时使用 |
| `to` | string \| null | 否 | UTC ISO 8601 |
| `keyword` | string \| null | 否 | 标题/地点关键词 |
| `limit` | number | 否 | 默认 20，最大 100 |
| `offset` | number | 否 | 默认 0 |

规则：`range` 和 `from/to` 至少提供一种；同时提供时取交集。

---

## 5. 接口详细定义

### 5.1 `POST /api/v1/drafts`

作用：接收自然语言文本，生成事件草稿

请求体：

```json
{
  "sourceText": "明天下午三点和张总在国贸喝咖啡",
  "timezone": "Asia/Shanghai",
  "referenceAt": "2026-05-29T02:00:00Z",
  "source": "text"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `sourceText` | string | 是 | 用户原始文本 |
| `timezone` | string | 是 | 当前用户时区 |
| `referenceAt` | string | 是 | 用户点击提交时的 UTC ISO 8601 时间，用于解析"明天""下周五"等相对表达 |
| `source` | string | 是 | `text` 或 `voice` |

成功响应：

```json
{
  "data": {
    "draft": {
      "draftId": "drf_123",
      "sourceText": "明天下午三点和张总在国贸喝咖啡",
      "source": "text",
      "referenceAt": "2026-05-29T02:00:00Z",
      "normalizedText": "明天下午3点和张总在国贸喝咖啡",
      "parsed": {
        "title": "和张总喝咖啡",
        "startAt": "2026-05-30T07:00:00Z",
        "endAt": null,
        "timezone": "Asia/Shanghai",
        "location": "国贸",
        "participants": ["张总"]
      },
      "missingFields": [],
      "warnings": [],
      "canSave": true,
      "clarificationPrompt": null
    }
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-05-29T10:00:00Z"
  }
}
```

可能错误码：`VALIDATION_ERROR`、`DRAFT_PARSE_FAILED`

### 5.2 `PATCH /api/v1/drafts/:draftId`

作用：在已有草稿基础上补充缺失字段或修正已识别字段

请求体：

```json
{
  "userInput": "下午三点开始",
  "referenceAt": "2026-05-29T02:05:00Z",
  "fields": {
    "location": "国贸"
  }
}
```

规则：
- `userInput` 和 `fields` 至少提供一个
- 提供 `userInput` 时，`referenceAt` 必填
- `fields` 只允许更新 `title`、`startAt`、`endAt`、`timezone`、`location`、`participants`
- 服务端必须重新计算 `missingFields`、`warnings` 和 `canSave`

解析行为约束：
- 时间解析使用 `chrono-node` 作为基础库，并在服务层补充中文相对时间和时段词规则
- `POST /drafts` 默认表示创建事件草稿，不单独做通用意图分类
- 实体抽取使用纯 TypeScript 规则引擎，不引入通用中文 NLP/NER 库
- 解析顺序固定为 `time -> location -> participants -> title`
- 触发词不写入实体值本身；例如"和小王在星巴克"应解析为 `participants=["小王"]`、`location="星巴克"`
- `title` 通过去除已消费实体 span 后的剩余文本生成；如果剩余文本不足以形成稳定动作短语，则不得强行猜测标题
- 相对时间必须基于 `referenceAt + timezone` 解释，而不是直接使用服务器当前时间
- 对"明天""下周五下午"这类缺少具体钟点的表达，不允许直接猜测 `startAt`
- `participants` 和 `location` 采用"有证据才填"的策略；规则失效时允许留空，不做无触发词强猜
- 只要能识别出部分事件信号，就返回部分 `draft`；只有完全无法形成可操作草稿时才返回 `DRAFT_PARSE_FAILED`

成功响应：返回更新后的 `draft`

可能错误码：`VALIDATION_ERROR`、`NOT_FOUND`、`DRAFT_PARSE_FAILED`

### 5.3 `POST /api/v1/events`

作用：将可保存草稿创建为正式事件

请求体：

```json
{
  "draftId": "drf_123"
}
```

规则：
- `draftId` 必填
- 引用的草稿必须存在且 `canSave = true`
- 事件创建成功后返回完整 `Event`

成功响应：

```json
{
  "data": {
    "event": {
      "id": "evt_123",
      "title": "和张总喝咖啡",
      "description": null,
      "startAt": "2026-05-30T07:00:00Z",
      "endAt": null,
      "timezone": "Asia/Shanghai",
      "location": "国贸",
      "participants": ["张总"],
      "source": "text",
      "status": "confirmed",
      "createdAt": "2026-05-29T10:00:00Z",
      "updatedAt": "2026-05-29T10:00:00Z"
    }
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-05-29T10:00:00Z"
  }
}
```

可能错误码：`VALIDATION_ERROR`、`NOT_FOUND`、`DRAFT_MISSING_FIELDS`、`EVENT_CONFLICT`、`PERSISTENCE_ERROR`

### 5.4 `GET /api/v1/events`

作用：查询事件列表

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mode` | string | 否 | `recent` 或 `range` |
| `limit` | number | 否 | 返回条数，默认 `20`，最大 `100` |
| `offset` | number | 否 | 分页偏移，默认 `0` |
| `range` | string | 否 | `today` / `tomorrow` / `week` / `month`，`mode=range` 时生效 |
| `from` | string | 否 | UTC ISO 8601，`mode=range` 时生效 |
| `to` | string | 否 | UTC ISO 8601，`mode=range` 时生效 |
| `keyword` | string | 否 | 关键词过滤 |

当前状态：
- `mode=recent` 已实现
- `mode=range` 及全部范围查询参数为**预留**，待 Parser + API 模块实现

示例：
- `GET /api/v1/events?mode=recent&limit=5`
- `GET /api/v1/events?mode=range&range=today&limit=20`（预留）
- `GET /api/v1/events?mode=range&from=2026-05-30T00:00:00Z&to=2026-05-31T00:00:00Z`（预留）

成功响应：

```json
{
  "data": {
    "items": [],
    "total": 0
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-05-29T10:00:00Z"
  }
}
```

可能错误码：`VALIDATION_ERROR`、`PERSISTENCE_ERROR`

### 5.5 `GET /api/v1/events/:id`（预留）

作用：获取单个事件详情

成功响应：返回完整 `Event`

可能错误码：`NOT_FOUND`

### 5.6 `PATCH /api/v1/events/:id`（预留）

作用：修改已创建事件

请求体：字段同 `Event`，允许部分更新

规则：
- 只允许修改 `title`、`description`、`startAt`、`endAt`、`timezone`、`location`、`participants`
- 不允许通过此接口修改 `source`、`status`（状态变更应有专门语义）
- 修改后返回更新后的完整 `Event`

可能错误码：`VALIDATION_ERROR`、`NOT_FOUND`、`EVENT_CONFLICT`、`PERSISTENCE_ERROR`

### 5.7 `DELETE /api/v1/events/:id`（预留）

作用：删除事件

规则：
- 删除后返回 `204 No Content`
- 预留软删除支持（`status` 字段已有 `cancelled`）

可能错误码：`NOT_FOUND`、`PERSISTENCE_ERROR`

---

## 6. 文档变更日志

| 日期 | 变更 | 影响模块 |
|------|------|---------|
| 2026-05-29 | 初始版本，收录 v0.1 稳定契约 | Schemas, Parser, API, Web |
| 2026-05-30 | 补齐 QueryRequest、EventListItem 与 recent 查询分页契约 | Schemas, API, Web |
| 2026-05-30 | 升级为全量预定义契约，新增预留接口（范围查询、事件修改删除、提醒） | 全模块 |
