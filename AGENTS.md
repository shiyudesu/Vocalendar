# AGENTS.md

## 1. 作用

本文件约束 AI Agent 和开发者在 Vocalendar 仓库中的协作方式。它不重复产品需求，只定义：

1. 文档体系：什么信息存在哪个文件里，避免重复维护
2. 工作流：改动前读什么、什么时候先补文档、什么时候先写计划
3. 工程底线：当前仓库结构、验证要求、Git 规范

开始任何非微小改动前，先读本文件，再按下面顺序读取。

---

## 2. 必读顺序

按当前仓库实际文件读取，不要引用不存在的文档：

1. `docs/prd.md`
   - 产品目标、范围、里程碑、当前版本阶段
2. `docs/modules/api.md`
   - 当前唯一已建立的模块计划文档
   - 只要改 API、语音链路、智能建议、同步能力或与这些能力相关的前端行为，都应先读
3. `docs/api-spec.md`
   - API 通用规范、全量接口契约、错误码、Sync / Realtime / Voice 相关接口边界
4. 包内 `AGENTS.md`
   - 修改 `packages/api/**` 前读 `packages/api/AGENTS.md`
   - 修改 `packages/mobile/**` 前读 `packages/mobile/AGENTS.md`

说明：

- 当前仓库没有 `docs/architecture.md`
- 当前仓库没有 `packages/api/openapi.yaml`
- 不要再把它们当作必读文件或事实来源

---

## 3. 文档单一事实来源

| 主题 | 唯一存放位置 | 不应重复到 |
| --- | --- | --- |
| 产品目标、用户场景、里程碑 | `docs/prd.md` | 代码注释、其他 Markdown |
| API 模块范围、阶段边界、开发任务拆分 | `docs/modules/api.md` | `docs/prd.md`、代码注释 |
| API 通用规范、接口路径、请求响应结构、错误码、Sync / Realtime / Voice 契约 | `docs/api-spec.md` | 其他 Markdown、零散注释 |
| API 包内部目录边界 | `packages/api/AGENTS.md` | 根文档的字段级细节 |
| Mobile 包内部边界 | `packages/mobile/AGENTS.md` | 根文档的字段级细节 |

核心规则：

- 改产品目标、版本阶段、是否把某能力提前到 MVP / V1.0 / V1.5 / V2.0
  - 同时更新 `docs/prd.md`
- 改 API 模块范围、任务拆分、阶段职责
  - 同时更新 `docs/modules/api.md`
- 改接口路径、字段、错误码、分页、鉴权、WebSocket / Sync 协议
  - 同时更新 `docs/api-spec.md`
- 同一变更涉及多个维度时，必须在同一个变更里同步更新相关文档

---

## 4. 当前仓库状态认知

当前仓库代码与文档的关系如下：

- 当前代码实现主要覆盖 `v0.1` 的文本草稿解析与基础事件闭环
- `docs/api-spec.md` 描述的是更完整的目标态 API 契约
- 如果代码现状落后于契约，应让实现向契约对齐
- 不要为了迁就当前代码而直接收缩 `docs/api-spec.md`，除非用户明确决定缩减产品范围，并同步修改 `docs/prd.md`

---

## 5. 计划先行

### 5.1 什么时候必须先补计划或模块文档

以下改动开始前，必须先补书面计划或更新 `docs/modules/api.md`：

- 新增接口
- 改已有接口路径、字段或错误码
- 跨包改动（如 `schemas + api`、`api + web`、`web + mobile`）
- 语音链路改动（ASR、TTS、VAD 边界、快捷指令、语音历史）
- 智能能力改动（冲突检测、习惯建议、交通时间建议）
- 多端同步或离线同步改动

### 5.2 计划至少要写清楚

1. 范围边界：做什么，不做什么
2. 代码映射：改哪些文件、增哪些文件
3. 文档映射：要同步改哪份文档
4. 接口变化：路径、方法、请求 / 响应变化
5. 验收标准：必须能验证
6. 依赖与阻塞：依赖当前哪些能力，缺什么

### 5.3 禁止

- 在没有书面计划的情况下展开大功能开发
- 用临时实现绕开 `docs/api-spec.md`
- 把 `V1.5` / `V2.0` 的范围偷偷塞进 MVP 实现

---

## 6. 工程底线

### 6.1 当前目录与职责

- `packages/api/`
  - Hono API 服务
  - 当前入口：`packages/api/src/index.ts`
  - 当前主要实现位于 `http/routes`、`services`、`repositories`
- `packages/web/`
  - Vite React 前端
  - 当前 dev / preview 端口：`8060`
- `packages/mobile/`
  - Capacitor 壳体
  - `webDir` 指向 `../web/dist`
- `packages/schemas/`
  - 共享 Zod schema 与 TypeScript 类型
  - 当前导出入口：`packages/schemas/src/index.ts`
- `docs/`
  - 当前存在的核心文档只有：
    - `docs/prd.md`
    - `docs/modules/api.md`
    - `docs/api-spec.md`

### 6.2 端口与调用关系

- Web dev 端口：`8060`
- API dev 端口：`8061`
- API 默认读取 `PORT`，未设置时走 `8061`
- Web 与 Mobile 都通过配置化 API base URL 调用 API
- 不要依赖只在本地有效的代理约定来定义接口行为

### 6.3 代码边界

- 不在 UI 组件里写复杂业务规则
- Route handler 只做校验、编排和错误映射
- 业务规则优先放 `services/`
- 共享输入输出优先放 `packages/schemas`
- 不跳过输入校验、错误码设计和基本测试

---

## 7. 验证要求

### 7.1 一般要求

- 运行 `pnpm` 命令时需要提权，不要在沙箱中直接运行
- 不要宣称“完成”或“已通过”，除非已经跑过对应验证
- 文档改动至少检查文件结构、命名、引用路径

### 7.2 当前脚本与推荐验证

| 位置 | 命令 | 何时运行 |
| --- | --- | --- |
| 根目录 | `pnpm check` | 跨包改动后 |
| 根目录 | `pnpm fix` | 需要统一自动修复时 |
| `packages/api` | `pnpm --filter @vocalendar/api check` | 改 API 代码后 |
| `packages/api` | `pnpm --filter @vocalendar/api test` | 改 route / service / repository / schema 行为后 |
| `packages/api` | `pnpm --filter @vocalendar/api build` | 改入口、构建、运行配置后 |
| `packages/web` | `pnpm --filter @vocalendar/web check` | 改 Web 代码后 |
| `packages/web` | `pnpm --filter @vocalendar/web build` | 改 Vite 配置或产物相关行为后 |
| `packages/schemas` | `pnpm --filter @vocalendar/schemas check` | 改共享 schema 后 |
| `packages/schemas` | `pnpm --filter @vocalendar/schemas test` | 改共享 schema 行为后 |
| `packages/mobile` | `pnpm --filter @vocalendar/mobile check` | 改 mobile 代码后 |
| `packages/mobile` | `pnpm --filter @vocalendar/mobile build` | 改 Capacitor 配置或平台同步后 |

### 7.3 文档改动的最低检查

- 文档路径存在
- 相互引用路径正确
- 不再引用仓库中不存在的文档或契约文件

---

## 8. Git Commit 规范

### 8.1 提交格式

```text
<type>(<scope>): <subject>
```

例如：

```text
feat(api): 支持 POST /drafts 自然语言解析
fix(web): 修正日期选择器时区偏移问题
docs(api-spec): 补充快捷指令接口契约
refactor(services): 抽离草稿补问逻辑
test(schemas): 补全事件草稿边界用例
chore(deps): 升级 hono 至 4.12.x
```

### 8.2 类型（type）

| 类型 | 含义 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 纯格式变更 |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建、工具、依赖 |
| `ci` | CI 配置 |
| `revert` | 回滚 |

### 8.3 作用域（scope）

- `api`
- `web`
- `mobile`
- `schemas`
- `services`
- `parser`
- `deps`
- `*`

### 8.4 主题（subject）

- 使用祈使句
- 首字母小写
- 句尾不加句号
- 控制在 50 个字符以内
- 必须能脱离上下文理解

---

## 9. PR 规范

- 每个 PR 只做一件事
- 大功能拆成多个独立 PR
- PR 描述至少说明：
  - 改了什么
  - 为什么改
  - 接口 / 行为影响
  - 如何验证

如果改动影响 `docs/prd.md`、`docs/modules/api.md`、`docs/api-spec.md` 中任一文件，PR 描述里应明确写出同步点。

---

## 10. 禁止事项

- 引用不存在的文档作为规则来源
- 在未更新文档的情况下直接改产品范围或接口契约
- 让 `docs/prd.md`、`docs/modules/api.md`、`docs/api-spec.md` 长期重复维护同一细节
- 把 mock 行为当作真实能力宣称完成
- 用当前代码现状倒逼文档收缩，而不先确认是否要改产品范围
