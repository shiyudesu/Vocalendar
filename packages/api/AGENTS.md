# packages/api AGENTS.md

## 1. 作用

本文件约束 `packages/api` 内的 Hono 后端服务实现。根目录 `AGENTS.md` 仍然是仓库级最高协作规则；本文件只补充 API 包内部的组织方式和边界。

## 2. 包职责

`packages/api` 是 Vocalendar 的产品服务能力入口，负责：

- 暴露 `/api/*` HTTP 接口
- 请求校验、错误映射和响应封装
- 调用领域服务完成事件解析、草稿补问、事件创建和查询
- 隔离数据库、外部服务和运行时配置

不要在本包中实现 Web 或移动端 UI。

## 3. 端口约定

- Web dev 端口：`8060`
- API dev 端口：`8061`
- API 默认读取 `PORT` 环境变量；未设置时使用 `8061`
- Web 与移动端都应通过配置化 API base URL 调用本服务，不依赖 Vite proxy

## 4. 推荐目录

```text
src/
  index.ts                 # 进程入口，只负责启动服务
  config/                  # 端口、环境变量和运行时配置
  http/
    app.ts                 # Hono app 组装
    middleware/            # CORS、request id、错误处理等 HTTP 中间件
    routes/                # 资源路由，只做校验、编排和错误映射
  services/                # 领域服务，放核心业务规则
  repositories/            # 数据访问，不夹带业务规则
  integrations/            # 外部服务适配
  db/                      # schema、迁移、连接管理
  utils/                   # API 包内部工具
```

## 5. 分层规则

- `index.ts` 不写业务逻辑
- route handler 不直接访问数据库
- route handler 不实现复杂解析规则，只调用 `services/`
- `services/` 不依赖 Hono 的 `Context`
- `repositories/` 不返回 HTTP 响应对象
- 对外输入必须先经过 schema 校验；共享契约优先放入 `packages/schemas`

## 6. 验证

修改本包后至少运行：

```bash
pnpm --filter @vocalendar/api check
```

涉及构建或入口变更时额外运行：

```bash
pnpm --filter @vocalendar/api build
```
