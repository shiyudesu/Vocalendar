# Vocalendar 技术架构与工程规范

## 1. 文档定位

本文件负责定义 Vocalendar 的技术架构、技术栈、目录结构和编码底线。它只回答“系统怎么组织”和“工程上必须遵守什么”，不负责产品路线与具体版本开发步骤。

---

## 2. 架构目标

当前架构需要同时满足四个要求：
- 支持 `packages/web` 中的 Vite + React + Nitro 全栈应用首发，尽快验证自然语言创建与 CRUD 主流程
- 在单应用内保持 Client UI、Nitro API、领域服务和持久层边界清晰，方便后续能力扩展
- 让事件模型、接口契约和解析流程可在 Web 与后续 `Capacitor` 移动端之间复用
- 在代码量尚小的阶段，用 `pnpm workspace` monorepo 管理全栈 Web 应用与共享契约；当前应用包统一放在 `packages/` 下

---

## 3. 技术栈

## 3.1 首选技术栈

| 层级 | 技术选择 | 选择原因 |
| --- | --- | --- |
| Web 前端 | Vite + React + TypeScript | 当前仓库已有 `packages/web`，适合轻量快速搭建 SPA，并为后续 `Capacitor` 承载复用前端能力 |
| 移动端承载 | Capacitor | 在保持前后端分离前提下，渐进把 Web 能力带到移动端 |
| UI 样式 | Tailwind CSS | 适合快速迭代原型与组件化页面 |
| API / 服务端 | Nitro + H3 + TypeScript | 作为 Vite 插件接入当前 `packages/web`，用文件路由提供 `/api/*`；适合轻量 REST JSON 服务，并保留部署到 Node、serverless 或 edge-like runtime 的弹性 |
| Monorepo | pnpm workspace | 统一管理全栈 Web 应用与共享包，降低契约漂移 |
| 数据校验 | Zod | Web、API 与后续移动端共享 schema，减少契约漂移 |
| 数据访问 | Drizzle ORM | 结构清晰，适合从 SQLite 平滑迁移到 PostgreSQL |
| 本地数据 | SQLite | 适合原型和单机开发 |
| 共享/生产数据 | PostgreSQL | 适合多人环境和后续移动端共用后端 |
| 测试 | Vitest + React Testing Library + Playwright | 覆盖单元、组件和端到端验证 |
| 代码质量 | Rslint + Oxfmt | Rslint 同时承担 lint 与 TypeScript type-check；Oxfmt 负责格式化、import 排序和 Tailwind class 排序，统一风格并降低 AI 和多人协作噪音 |

## 3.2 输入与解析策略

- `v0.1-v0.4`：优先使用文本等价输入，先稳定 drafts / events 契约和 CRUD 流程
- `v0.5`：在既有文本接口之上接入浏览器内语音能力或受控转写能力
- `v0.1` 时间解析采用 `chrono-node` 作为基础能力，并在服务层补充中文相对时间、时段词和业务默认规则；当前版本不引入独立 Duckling 服务，也不把 LLM 作为主解析器
- `v0.1` 不单独做通用 intent classifier；`POST /drafts` 天然表示“创建草稿”意图，领域服务只负责从文本中抽取时间、参与人、地点和标题候选
- `v0.1` 实体抽取采用纯 TypeScript 规则引擎和 span 消解，不引入通用中文 NLP/NER 库；LLM 辅助解析只在后续版本评估
- 事件解析应由服务层统一处理，不把规则散落在 UI 组件中
- Web 前端通过同源 HTTP 调用 Nitro API；后续 `Capacitor` App 调用同一套部署后的 HTTP API，不在客户端内复制解析逻辑
- 后续如果引入外部 ASR/LLM 服务，应保持已有事件草稿接口稳定

---

## 4. 系统分层

## 4.1 逻辑分层

| 层 | 职责 | 说明 |
| --- | --- | --- |
| Client UI | 输入交互、状态反馈、事件确认、列表展示 | 包含 `packages/web` 的 Vite React Web 与后续 `Capacitor` App，不直接操作数据库，不包含复杂业务规则 |
| Application API | 接收请求、做参数校验、调用领域服务、返回结果 | `packages/web` 内的 Nitro API routes，对外仍暴露稳定 HTTP API |
| Domain Services | 事件解析、草稿补问、事件管理、查询规则 | 业务核心，应保持平台无关 |
| Persistence | 事件存储、查询、迁移、索引 | 通过 ORM 统一访问 |
| Integrations | 浏览器语音能力、外部日历、通知服务 | 对外部依赖做适配与隔离 |

## 4.2 核心数据流

### 创建主流程
1. 用户在前端输入自然语言文本
2. `packages/web` 的 Vite React Web 将文本提交给同源 Nitro 草稿接口；后续 `Capacitor` App 调用同一套部署后的 HTTP API
3. 服务层返回结构化事件草稿、缺失字段和警告信息
4. 用户确认或补充字段
5. 前端提交创建事件请求
6. 服务层保存事件并返回最终结果

### 查询主流程
1. `packages/web` 的 Vite React Web 或后续 `Capacitor` App 发起时间范围或关键词查询请求
2. 服务层做参数标准化和时间窗口解析
3. 持久层返回事件集合
4. 前端按简要或详细模式展示

---

## 5. 推荐目录结构

```text
packages/
  web/
    src/
      components/
      lib/
    api/
      v1/
        drafts.post.ts
        drafts/[draftId].patch.ts
        events.get.ts
        events.post.ts
    server/
      services/
      repositories/
      integrations/
      db/
      utils/
    vite.config.ts
  mobile/
    capacitor.config.ts
    ios/
    android/
  schemas/
  shared/
  config/
tests/
  unit/
  integration/
  e2e/
docs/
pnpm-workspace.yaml
```

### 目录规则
- `packages/web/` 放 Vite React SPA、Nitro API routes、服务端领域服务和前端交互逻辑
- `packages/web/api/` 放 Nitro 文件路由，按文件名表达 HTTP 方法与路径
- `packages/web/server/services/` 放业务逻辑，不允许依赖前端页面组件
- `packages/web/server/repositories/` 负责数据库读写
- `packages/mobile/` 放 `Capacitor` 配置和原生工程壳体，不重复实现后端契约
- `packages/schemas/` 放前后端共享的 Zod schema
- `packages/shared/` 只放跨应用共享的稳定类型与工具，不放端专属业务逻辑
- `packages/config/` 放共享的 TypeScript、Rslint、Oxfmt 等工程配置

---

## 6. 编码底线

## 6.1 通用要求
- 全项目使用 TypeScript 严格模式
- 所有对外输入必须经过 schema 校验
- 时间相关字段统一使用 ISO 8601 存储，并显式携带时区语义
- Web/移动端页面组件不允许直接访问数据库
- 业务规则不允许散落在多个 UI 组件中重复实现

## 6.2 组件与服务边界
- UI 组件负责展示状态和触发动作，不负责事件解析与持久化规则
- Nitro API route handler 只做鉴权、校验、编排和错误映射
- 领域服务负责核心规则，如时间解析、缺失字段判断、冲突检查
- Repository 负责数据访问，不夹带业务分支逻辑

## 6.3 错误处理
- API 必须返回统一错误结构
- 所有预期业务错误必须有稳定错误码
- 不允许把底层异常原样暴露给前端
- 解析失败、字段缺失、保存失败、权限失败应能被明确区分

## 6.4 测试底线
- 新增领域服务必须有单元测试
- 新增 API 必须至少有一条成功路径和一条失败路径测试
- 活跃版本的核心用户流程必须有端到端测试
- 文档中承诺的验收标准，必须能映射到自动化测试或手动验证清单

---

## 7. 配置与环境

### 7.1 环境划分
- `local`：开发环境，允许 SQLite 和受控 mock
- `staging`：集成验证环境，优先使用接近真实的接口与数据库
- `production`：真实用户环境，必须启用监控、日志和恢复策略

### 7.2 配置原则
- 所有密钥和环境变量放入环境配置，不写入源码
- 外部服务开关必须可配置，便于在 mock、真实服务和降级路径间切换
- 任何影响数据写入行为的配置都必须可追踪

---

## 8. 可观测性与安全底线

### 8.1 可观测性
- 记录关键链路：开始输入、草稿生成、补问、确认、保存成功、保存失败
- 当语音输入上线后，额外记录录音开始、转写完成和转写失败
- 每条请求应具备可追踪的 request id
- 失败原因至少区分：输入失败、校验失败、解析失败、持久化失败、外部依赖失败

### 8.2 安全与隐私
- 默认最小权限原则
- 明确区分开发数据与真实用户数据
- 语音与事件数据的采集、传输和存储边界必须清晰
- 在进入真实用户测试前，必须补齐隐私说明和权限说明

---

## 9. 演进规则

- 当某个版本需要新增能力时，优先复用现有事件模型和接口契约
- 如果未来从 `packages/web` 内置 Nitro API 拆分为独立 API 服务，应保持 `api-spec.md` 中的契约不变或有迁移说明
- 如果移动端接入，应复用同一套 API、共享 schema 和领域服务，而不是为移动端另起一套后端契约
- 架构调整时，必须同步更新本文件和受影响的计划文档
