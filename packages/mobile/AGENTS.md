# packages/mobile AGENTS.md

## 1. 作用

本文件约束 `packages/mobile` 内的 Capacitor 移动端壳体实现。根目录 `AGENTS.md` 仍然是仓库级最高协作规则；本文件只补充移动端包内部边界。

## 2. 包职责

`packages/mobile` 是 Vocalendar 的原生运行入口，负责：

- 维护 Capacitor 配置与原生平台工程
- 承载 `packages/web` 产出的 Web 资源
- 接入移动端权限、通知、语音等原生能力
- 通过配置化 API base URL 调用 `packages/api` 提供的 HTTP API

不要在本包中重复实现 Web UI、后端路由或接口契约。

## 3. 端口约定

- Web dev 端口：`8060`
- API dev 端口：`8061`
- 本地调试时，移动端 WebView 应调用配置化 API base URL，不依赖 Vite proxy

## 4. 构建规则

- `capacitor.config.ts` 的 `webDir` 指向 `../web/dist`
- 执行 `pnpm --filter @vocalendar/mobile build` 前，必须确保 `packages/web` 已完成构建；根目录 `pnpm build` 通过 Turborepo 依赖图保证这一点
- 新增 iOS / Android 原生工程后，不要手改生成文件来绕开 Capacitor 同步流程

## 5. 验证

修改本包后至少运行：

```bash
pnpm --filter @vocalendar/mobile check
```

涉及 Capacitor 配置或原生平台同步时额外运行：

```bash
pnpm --filter @vocalendar/mobile build
```
