# Module: Schemas

## 1. 模块定位

跨模块共享的 Zod schema、TypeScript 类型和错误码定义。

本模块不依赖任何业务模块，是 API、Web、Parser、Voice 的契约基础层。

## 2. 接口契约

- **暴露**：Zod schema、TypeScript 类型、错误码枚举
- **依赖**：无

## 3. 开发任务

| PR | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| `#1` | 初始共享 schema 包（Draft/Event 核心类型） | 无 | ✅ 已完成 |
| `#2` | `updateDraftRequestSchema` + `listEventsQuerySchema` | `#1` | ✅ 已完成 |
| `#6` | QueryRequest、EventListItem、事件状态契约补齐 | `#2` | ✅ 已完成 |
| `#7` | Reminder / Recurrence schema | 需求明确 | ⏳ 阻塞 |
| `#8` | 账号体系相关类型（User / Session） | `v1.0` 范围确认 | ⏳ 阻塞 |

## 4. 验收标准

- [ ] `pnpm check` 通过
- [ ] `packages/schemas` 可被 api/web 导入
- [ ] 所有 api-spec.md 中当前使用中的 schema 已在此定义
- [ ] 全量预定义契约中的 QueryRequest、EventListItem 已定义
- [ ] Reminder / Recurrence 相关 schema 已定义

## 5. 风险与阻塞

- 风险：后续模块可能发现 schema 遗漏字段 → 对冲：每次 api-spec 变更先更新本模块
- 阻塞：无

## 6. 变更日志

| 日期       | 变更内容                                        | 影响模块         |
| ---------- | ----------------------------------------------- | ---------------- |
| 2026-05-29 | 初始 schema、错误码、响应结构                   | Parser, API, Web |
| 2026-05-30 | 补齐 QueryRequest、EventListItem 和事件状态契约 | Parser, API, Web |
