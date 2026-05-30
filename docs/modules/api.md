# Module: API

## 1. 模块定位

Hono HTTP 服务、路由、数据库访问、业务编排。

本模块职责：

- HTTP 接口实现（RESTful routes）
- 请求参数校验与错误映射
- 业务逻辑编排（调用 Parser、操作数据库）
- 数据库迁移与 repository 层

不属于本模块：

- 自然语言解析（Parser 模块）
- 前端页面（Web 模块）
- 语音采集（Voice 模块）

## 2. 产品目标与范围

### 已交付（文本创建闭环）

- POST /api/v1/drafts — 创建草稿
- PATCH /api/v1/drafts/:draftId — 更新草稿
- POST /api/v1/events — 从草稿创建事件
- GET /api/v1/events?mode=recent — 最近事件列表

### 待交付

#### 范围查询

- 目标：补齐最基础的事件查询能力
- 范围内：GET /events 范围查询（today/tomorrow/week/keyword）、分页
- 验证点：用户能否在创建后快速回查今天、明天和本周事件

#### 事件修改

- 目标：支持修改已创建事件
- 范围内：PATCH /events/:id、字段变更持久化
- 验证点：用户能否自然地修改时间、标题和地点

#### 事件删除

- 目标：支持安全删除事件
- 范围内：DELETE /events/:id、软删除预留
- 验证点：删除流程是否安全可理解，不因误删破坏信任感

#### 语音来源支持

- 目标：支持 source=voice 的草稿创建
- 范围内：复用既有 drafts/events 流程，仅来源字段变化
- 依赖：Voice 模块提供转写文本

#### 提醒与重复（预留）

- 目标：支持提醒和基础重复规则
- 范围内：Reminder CRUD、重复事件存储
- 验证点：提醒与重复规则是否显著提升留存

#### 外部日历同步（预留）

- 目标：与现有日历工具协同
- 范围内：外部日历账号连接、基础导入/同步、冲突提示
- 验证点：能否降低用户迁移成本

#### 账号体系（预留）

- 目标：形成完整可用的 Web 产品
- 范围内：账号注册/登录、数据隔离、可靠存储
- 阶段：v1.0

## 3. 接口契约

- **暴露**：REST API（见 `docs/api-spec.md`）
- **依赖**：Schemas（schema）、Parser（解析函数）

## 4. 开发任务

| PR | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| `#1` | Hono API 骨架、分层结构与基础服务入口 | 无 | ✅ 已完成 |
| `#2` | `GET /events` recent 基础路由与查询 schema | Schemas `#2` | ✅ 已完成 |
| `#4` | `PATCH /drafts` + `POST /events` + `GET /events(recent)` 闭环 | Parser `#3` | ✅ 已完成 |
| `#13` | `GET /events/:id` + `PATCH /events/:id` + `DELETE /events/:id` | 现有事件仓储 | 🔵 可直接开工 |
| `#14` | `GET /events` 范围查询（`mode=range`、today/tomorrow/week、keyword） | Parser `#9` | 🟡 可先行开发路由与校验 |
| `#32` | repository 抽象、持久层边界收口、memory / sql 可切换实现 | `#13` + `#14` | 🟡 建议在文本 CRUD/查询稳定后开始 |
| `#33` | Drizzle ORM + PostgreSQL 接入（schema、迁移、事件/草稿持久化） | `#32` | 🟡 建议在语音/账号体系前完成 |
| `#15` | `source=voice` 草稿创建接入 | Parser `#11` | ⏳ 阻塞 |
| `#16` | Reminder CRUD | Schemas `#7` | ⏳ 阻塞 |
| `#17` | 账号体系（注册/登录/鉴权） | Schemas `#8` | ⏳ 阻塞 |

## 5. 验收标准

- [ ] curl 可调用所有已实现端点
- [ ] 单测覆盖成功/失败路径
- [ ] 错误码符合 api-spec.md
- [ ] 范围查询支持 today/tomorrow/week/keyword
- [ ] 事件修改删除完整实现
- [ ] 提醒 CRUD 完整实现
- [ ] 账号体系支撑多用户隔离

## 6. 风险与阻塞

- 风险：Parser 升级可能导致已有接口行为变化 → 对冲：Parser 变更必须通过 API 集成测试
- 阻塞：范围查询等待 Parser 范围解析能力

## 7. 变更日志

| 日期       | 变更内容                             | 影响模块 |
| ---------- | ------------------------------------ | -------- |
| 2026-05-29 | Hono 骨架、DB、drafts/events 基础 CR | Web      |
