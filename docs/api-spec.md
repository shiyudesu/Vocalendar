# Vocalendar API 通用规范与当前稳定契约

## 1. 文档定位

本文件负责两类内容：

- 所有版本共享的 API 通用规范
- 已进入开发版本的当前稳定接口契约与核心对象

本文件不提前定义未来版本的具体接口。某个版本的 API 应先在对应 `docs/plans/*.md` 中确定；当该版本进入开发且契约足够稳定后，再同步写入本文件，作为前后端共享实现基线。

当前收录的稳定版本契约为：`v0.1 Text Create`。

---

## 2. 使用范围与同步规则

### 2.1 版本优先
- 未进入开发的版本，不在本文件中预写具体接口
- 某个版本的接口设计，先写入对应 `docs/plans/*.md`
- 该版本开始开发并形成稳定契约后，再同步到本文件

### 2.2 本文件应包含
- Base Path、数据格式、时间和时区约定
- 统一响应结构
- 统一错误模型与通用错误码
- API 命名与资源组织规范
- 当前稳定版本的核心对象与接口契约

### 2.3 本文件不应包含
- 尚未启动版本的接口路径、字段和示例
- 逐版本开发排期、任务拆分和验收节奏
- 产品目标、页面流程和工程协作规则

---

## 3. 通用规则

### 3.1 基本约定
- Base Path：`/api/v1`
- 数据格式：`application/json`
- 字段命名：请求与响应统一使用 `camelCase`
- 时间存储：UTC ISO 8601 字符串
- 时区传递：使用 IANA 时区，例如 `Asia/Shanghai`
- 客户端复用：`Next.js Web` 前端与后续 `Capacitor` 移动端必须调用同一套 HTTP API，不按客户端类型拆分独立契约
- 不兼容变更：进入新的主版本路径，例如 `/api/v2`

### 3.2 鉴权阶段约定

| 阶段 | 鉴权方式 |
| --- | --- |
| `v0.1-v0.5` | 允许匿名会话或开发态伪用户 |
| `v1.0+` | Bearer Token 或等价正式鉴权机制 |

在匿名阶段，服务端仍应维护基本 session 概念，用于隔离事件数据和埋点。

### 3.3 RESTful 命名规范
- 路径应优先使用复数资源名，例如 `drafts`、`events`
- 创建资源使用 `POST /resources`
- 查询集合使用 `GET /resources`
- 获取单个资源使用 `GET /resources/:id`
- 部分更新使用 `PATCH /resources/:id`
- 删除资源使用 `DELETE /resources/:id`
- 避免在路径中使用动作型命名，例如 `/parse`、`/clarify`、`/createEvent`
- 当某个操作本质上是在修改资源状态时，优先用资源更新而不是动作接口
- 只有在确实无法抽象为资源操作时，才引入明确动作型子路径，并在对应版本 plan 中说明理由

### 3.4 统一成功响应格式

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

### 3.5 统一失败响应格式

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

### 3.6 通用错误码

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

### 3.7 时间与查询规则
- 所有写入数据库的时间必须转成 UTC
- 响应必须携带事件原始业务时区
- 与“今天/明天/本周”相关的查询解释应基于用户时区，而不是服务器时区
- 涉及时间范围查询时，`from` 和 `to` 的语义必须在对应版本 plan 中明确

### 3.8 文档同步规则
- 版本内 API 决策先更新对应 `docs/plans/*.md`
- 当前稳定契约发生新增、删除、改名或语义变化时，再同步更新本文件
- 任何改变核心对象结构的任务，都必须同时检查 `docs/architecture.md`、`docs/prd.md` 和对应版本 plan 是否受影响

---

## 4. 当前稳定契约：`v0.1 Text Create`

来源：`docs/plans/v0.1-text-create.md`

`v0.1` 只覆盖“文本输入 -> 草稿生成 -> 补充缺失字段 -> 用户确认 -> 创建事件 -> 查看最近创建事件”闭环，不包含未来版本的查询、修改、删除、语音输入、提醒和同步能力。
当前版本虽然只交付 `Web` 入口，但接口契约从一开始就要求可被后续 `Capacitor` 移动端复用。

### 4.1 核心对象

#### Event

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
| `source` | string | 是 | `v0.1` 固定为 `text` |
| `status` | string | 是 | `confirmed` |
| `createdAt` | string | 是 | 创建时间 |
| `updatedAt` | string | 是 | 最后更新时间 |

#### EventDraft

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `draftId` | string | 是 | 草稿唯一标识 |
| `sourceText` | string | 是 | 用户输入的原始文本 |
| `source` | string | 是 | `v0.1` 固定为 `text` |
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

`v0.1` 保存前的最低要求：
- `title` 非空
- `startAt` 非空
- `timezone` 非空
- `sourceText` 和 `source` 可追踪

### 4.2 接口定义

#### `POST /api/v1/drafts`

作用：
- 接收自然语言文本，生成事件草稿

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
| `referenceAt` | string | 是 | 用户点击提交时的 UTC ISO 8601 时间，用于解析“明天”“下周五”等相对表达 |
| `source` | string | 是 | `v0.1` 固定传 `text`，后续版本可扩展为 `voice` |

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

可能错误码：
- `VALIDATION_ERROR`
- `DRAFT_PARSE_FAILED`

#### `PATCH /api/v1/drafts/:draftId`

作用：
- 在已有草稿基础上补充缺失字段或修正已识别字段

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

#### `v0.1` 解析行为约束

- 时间解析使用 `chrono-node` 作为基础库，并在服务层补充中文相对时间和时段词规则
- `POST /drafts` 默认表示创建事件草稿，不单独做通用意图分类
- 实体抽取使用纯 TypeScript 规则引擎，不引入通用中文 NLP/NER 库
- 解析顺序固定为 `time -> location -> participants -> title`
- 触发词不写入实体值本身；例如“和小王在星巴克”应解析为 `participants=["小王"]`、`location="星巴克"`
- `title` 通过去除已消费实体 span 后的剩余文本生成；如果剩余文本不足以形成稳定动作短语，则不得强行猜测标题
- 相对时间必须基于 `referenceAt + timezone` 解释，而不是直接使用服务器当前时间
- 对“明天”“下周五下午”这类缺少具体钟点的表达，不允许直接猜测 `startAt`
- `participants` 和 `location` 采用“有证据才填”的策略；规则失效时允许留空，不做无触发词强猜
- 只要能识别出部分事件信号，就返回部分 `draft`；只有完全无法形成可操作草稿时才返回 `DRAFT_PARSE_FAILED`

成功响应：
- 返回更新后的 `draft`

可能错误码：
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `DRAFT_PARSE_FAILED`

#### `POST /api/v1/events`

作用：
- 将可保存草稿创建为正式事件

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

可能错误码：
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `DRAFT_MISSING_FIELDS`
- `EVENT_CONFLICT`
- `PERSISTENCE_ERROR`

#### `GET /api/v1/events`

作用：
- 返回最近创建的事件列表

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mode` | string | 否 | `v0.1` 仅支持 `recent` |
| `limit` | number | 否 | 返回条数，默认 `5`，最大 `10` |

示例：
- `GET /api/v1/events?mode=recent&limit=5`

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

可能错误码：
- `VALIDATION_ERROR`
- `PERSISTENCE_ERROR`
