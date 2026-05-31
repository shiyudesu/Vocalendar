# Vocalendar

## 在线访问

Vocalendar 已经部署在服务器中，请访问[https://vc.myseu.cn/](https://vc.myseu.cn/)

## 演示视频

[七牛云-语音日历工具-Vocalendar](https://www.bilibili.com/video/BV1kmVD6JE3r/?share_source=copy_web&vd_source=427520265fe7b8a117e07d6761def703)

## 简介

Vocalendar 是一个以语音和自然语言输入为核心的日历工具。当前仓库采用 pnpm workspace + Turbo 管理，包含 API、Web、Mobile 壳体和共享 Schema 四个包。

产品目标、阶段范围和 API 契约分别以以下文档为准：

- [docs/prd.md](docs/prd.md)
- [docs/modules/api.md](docs/modules/api.md)
- [docs/api-spec.md](docs/api-spec.md)

## 目录结构

```text
.
├── docs/                 # 产品、API 模块计划与 API 契约
├── packages/
│   ├── api/              # Hono API 服务，默认端口 8061
│   ├── mobile/           # Capacitor 移动端壳体，webDir 指向 packages/web/dist
│   ├── schemas/          # 共享 Zod schema 与 TypeScript 类型
│   └── web/              # Vite React Web 应用，默认端口 8060
├── scripts/              # 仓库脚本
├── docker-compose.yml    # 本地 PostgreSQL / Redis
├── pnpm-workspace.yaml
└── turbo.json
```

## 环境要求

- Node.js：使用支持 TypeScript 6 与当前工具链的版本
- pnpm：`11.4.0`
- Docker / Docker Compose：用于本地 PostgreSQL 和 Redis

## 本地启动

1. 安装依赖：

    ```bash
    pnpm install
    ```

2. 准备环境变量：

    ```bash
    cp .env.example .env
    ```

    至少需要配置：
    - `PORT`：API 端口，默认 `8061`
    - `DATABASE_URL`：PostgreSQL 连接地址
    - `REDIS_URL` 或 `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
    - `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`
    - `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_NLS_APP_KEY`
    - `DEEPSEEK_API_KEY`：使用对话式助手时需要

3. 启动本地基础设施：

    ```bash
    docker compose up -d
    ```

4. 启动开发服务：

    ```bash
    pnpm dev
    ```

    默认访问地址：
    - Web：`http://localhost:8060`
    - API：`http://localhost:8061`

## 常用命令

```bash
pnpm check
pnpm build
pnpm fix

pnpm --filter @vocalendar/api test
pnpm --filter @vocalendar/schemas test
pnpm --filter @vocalendar/web test
pnpm --filter @vocalendar/web build
pnpm --filter @vocalendar/mobile build
```

说明：本仓库约定运行 `pnpm` 命令时需要在当前执行环境中提权。

## 包说明

| 包                    | 说明                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `@vocalendar/api`     | Hono API 服务，包含 HTTP routes、领域服务、仓储、语音/LLM provider 接线 |
| `@vocalendar/web`     | Vite + React Web 应用，包含日历视图、草稿创建、语音输入与助手界面       |
| `@vocalendar/mobile`  | Capacitor 壳体，用于打包 Web 产物到 iOS / Android                       |
| `@vocalendar/schemas` | 共享 Zod schema 与 TypeScript 类型                                      |

## 第三方库与服务

内部 workspace 包（如 `@vocalendar/schemas`、`@vocalendar/web`）不计入第三方库。

### 运行时依赖

| 使用位置      | 第三方库                    | 用途                       |
| ------------- | --------------------------- | -------------------------- |
| 根目录        | `turbo`                     | Monorepo 任务编排          |
| API           | `hono`、`@hono/node-server` | HTTP API 与 Node 服务运行  |
| API           | `chrono-node`               | 自然语言时间解析           |
| API           | `pg`                        | PostgreSQL 客户端          |
| API           | `redis`                     | Redis 客户端与实时同步通道 |
| API           | `ws`                        | WebSocket 服务             |
| API / Schemas | `zod`                       | 输入输出 schema 与类型校验 |
| Web           | `react`、`react-dom`        | Web UI                     |
| Web           | `lucide-react`              | 图标                       |
| Mobile        | `@capacitor/core`           | Capacitor 运行时           |

### 开发与测试依赖

| 使用位置                     | 第三方库                                                               | 用途                               |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| API / Web / Mobile / Schemas | `typescript`                                                           | TypeScript 编译与类型检查          |
| API / Web / Mobile / Schemas | `@rslint/core`、`oxfmt`                                                | 静态检查与格式化                   |
| API / Schemas                | `tsdown`                                                               | 构建输出                           |
| API                          | `tsx`                                                                  | TypeScript 开发运行                |
| API / Web / Schemas          | `vitest`                                                               | 单元测试                           |
| API                          | `@types/node`、`@types/pg`、`@types/ws`                                | 类型声明                           |
| Web                          | `vite`、`@vitejs/plugin-react`                                         | Web 开发服务器与构建               |
| Web                          | `tailwindcss`、`@tailwindcss/vite`                                     | 样式工具链                         |
| Web                          | `@babel/core`、`@rolldown/plugin-babel`、`babel-plugin-react-compiler` | React Compiler / Babel 集成        |
| Web                          | `playwright`                                                           | 浏览器测试与调试                   |
| Web                          | `@types/react`、`@types/react-dom`、`@types/babel__core`               | 类型声明                           |
| Mobile                       | `@capacitor/cli`、`@capacitor/android`、`@capacitor/ios`               | Capacitor 构建、同步与原生平台支持 |

### 外部服务与本地镜像

| 名称                            | 用途                           |
| ------------------------------- | ------------------------------ |
| PostgreSQL `postgres:17-alpine` | 本地事件、用户、通知等数据存储 |
| Redis `redis:8-alpine`          | 本地实时同步与发布订阅         |
| 阿里云 NLS                      | ASR / TTS 语音能力             |
| DeepSeek API                    | 对话式助手的 LLM 能力          |

## 开发约定

- 修改 API、语音、同步、智能建议等能力前，先阅读 `docs/modules/api.md` 和 `docs/api-spec.md`。
- 修改 `packages/api/**` 前阅读 `packages/api/AGENTS.md`。
- 修改 `packages/mobile/**` 前阅读 `packages/mobile/AGENTS.md`。
- 接口路径、字段、错误码、分页、鉴权、WebSocket / Sync 协议以 `docs/api-spec.md` 为准。
