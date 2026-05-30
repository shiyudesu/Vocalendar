# Vocalendar 模块依赖说明

本文档只回答一个长期问题：

1. **模块间如何依赖** — 谁依赖谁，契约是什么

模块的详细目标、范围、任务拆分和验收标准，见各模块独立文档。

---

## 1. 模块间总依赖图

```text
                    ┌─────────────┐
                    │   Schemas   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Parser  │    │   API    │    │   Web    │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         │  解析能力      │   HTTP API    │   构建产物
         └──────────────►│               │
                         │               │
         Voice           │               ▼
         转写文本 ───────►│         ┌──────────┐
                         │         │  Mobile  │
                         │         └──────────┘
                         │
                         ▼
                    ┌──────────┐
                    │  Voice   │
                    └──────────┘
```

### 依赖规则

| 依赖方 | 被依赖方 | 契约 |
| ------ | -------- | ---- |
| Parser | Schemas | schema 类型与共享字段约束 |
| API | Schemas + Parser | schema + 解析服务能力 |
| Web | Schemas + API | schema + HTTP REST 接口 |
| Voice | Schemas + Parser + Web | `source=voice` 字段、转写文本解析、UI 壳体 |
| Mobile | Web + API | Web 构建产物 + 部署后的 HTTP API |

**关键原则**：模块间只通过契约耦合，不直接依赖对方内部实现。

---

## 2. 模块职责边界

### Module: Schemas

- 负责全量共享 schema、类型、错误码定义
- 不负责业务解析、HTTP 路由或 UI

### Module: Parser

- 负责自然语言到结构化草稿的解析能力
- 不负责 HTTP、存储、UI

### Module: API

- 负责 HTTP 路由、参数校验、错误映射、业务编排
- 不负责前端交互和语音采集

### Module: Web

- 负责浏览器端输入、草稿展示、列表与交互流程
- 不负责解析规则和数据持久化

### Module: Voice

- 负责录音、转写、纠错链路
- 不负责解析规则和后端接口实现

### Module: Mobile

- 负责 Capacitor 壳体与原生权限/集成
- 不重复实现 Web UI 或后端契约

---

## 3. 契约协作原则

- `docs/api-spec.md` 是全量预定义接口契约来源
- 模块开发前，先确认所依赖的接口和对象已在 `api-spec.md` 或对应模块文档中定义
- `Web` 和 `Mobile` 只依赖 HTTP API，不复制 Parser 逻辑
- `Parser` 的输入输出结构必须先在 `Schemas` 中定义，再被 `API` 和 `Web` 消费
- 若模块边界变化，先更新本文件和对应模块文档，再改代码

---

## 4. 当前 PR 拆分总览

### 已完成 PR

| PR | 模块 | 内容 |
| --- | --- | --- |
| `#1` | Schemas / API / Web / Mobile | 仓库基线：schema 初始包、Hono 骨架、Web 基线、Capacitor 壳体 |
| `#2` | Schemas / API | `listEvents` recent 查询基础契约与路由 |
| `#3` | Parser | 草稿创建解析器 |
| `#4` | API | 草稿更新、事件创建、recent 列表闭环 |
| `#5` | Web | 文本输入与草稿展示 |
| `#6` | Schemas | QueryRequest、EventListItem、事件状态契约 |

### 待开始 PR

| PR | 模块 | 内容 | 主要依赖 |
| --- | --- | --- | --- |
| `#7` | Schemas | Reminder / Recurrence schema | 需求明确 |
| `#8` | Schemas | User / Session schema | `v1.0` 范围确认 |
| `#9` | Parser | 范围查询解析 | Schemas `#6` |
| `#10` | Parser | 修改/删除意图识别 | Parser `#3` |
| `#11` | Parser | 语音文本适配 | Voice 录音产物 |
| `#12` | Parser | 提醒/重复规则解析 | Schemas `#7` |
| `#13` | API | 事件详情、修改、删除接口 | 现有事件仓储 |
| `#14` | API | 范围查询接口 | Parser `#9` |
| `#32` | API | repository 抽象与持久层切换边界 | API `#13`、API `#14` |
| `#33` | API | Drizzle + PostgreSQL 接入 | API `#32` |
| `#15` | API | `source=voice` 草稿接入 | Parser `#11` |
| `#16` | API | Reminder CRUD | Schemas `#7` |
| `#17` | API | 账号体系 | Schemas `#8` |
| `#18` | Web | API client 补齐 + 草稿补充 + 确认创建 + 最近列表 | API `#4` |
| `#19` | Web | 查询页面 UI | API `#14` |
| `#20` | Web | 事件编辑/删除 UI | API `#13` |
| `#21` | Web | 语音录音入口与纠错交互 | Voice `#24`、Voice `#25` |
| `#22` | Web | 提醒/重复设置 UI | API `#16` |
| `#23` | Web | 账号页面 | API `#17` |
| `#24` | Voice | 浏览器录音 API | 无 |
| `#25` | Voice | ASR 服务接入 | Voice `#24` |
| `#26` | Voice | 转写展示与纠错联调 | Voice `#25`、Web `#21` |
| `#27` | Voice | 录音到 draft 端到端 | Parser `#11`、API `#15`、Web `#21` |
| `#28` | Mobile | `webDir` 接入与基础运行验证 | Web 构建稳定 |
| `#29` | Mobile | 麦克风权限与语音接线 | Voice `#24` |
| `#30` | Mobile | 本地通知/推送集成 | 无 |
| `#31` | Mobile | ipa/apk 构建流水线 | Mobile `#28` |
