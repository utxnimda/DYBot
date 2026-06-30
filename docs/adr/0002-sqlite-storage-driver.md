# ADR 0002: 使用 sqlite + sqlite3 作为首版 SQLite 驱动

## 状态

已接受。

## 背景

`packages/storage` 需要为斗鱼事件、后续 AI 上下文、回放测试和统计提供本地 SQLite 存储。项目主应用运行在 Electron 34.5.8，实测内置 Node 版本为 20.19.1；当前开发机 Node 为 24.x。Electron 34 不能依赖 Node 24 的 `node:sqlite`。

工程基础文档要求 storage 使用 SQLite，并建议在 `better-sqlite3` 或 `sqlite` 路线中固定一种访问层。

## 决策

首版 storage 使用：

- `sqlite`：Promise wrapper。
- `sqlite3`：底层 SQLite driver。

使用边界：

- 只允许在 Electron main/runtime 或 Node 测试环境中使用。
- renderer 不允许直接 import `@dybot/storage`。
- repository 层封装 SQL，UI 和业务模块不拼 SQL。
- 数据库文件必须位于用户数据目录或测试临时目录，不进入仓库。

## 原因

- `better-sqlite3` 是按 Node ABI 构建的原生模块。在当前环境下，本机 Node 24 编译产物要求 `NODE_MODULE_VERSION 137`，Electron 34 内置 Node 20 要求 `NODE_MODULE_VERSION 132`，同一个 `node_modules` 会在测试和 Electron 运行之间互相冲突。
- `sqlite3` 使用更适合 Electron 场景的 native driver 路线，并通过 `createRequire` 在 main 进程加载 CJS native 模块，避免 ESM bundling interop 问题。
- `sqlite` 的 Promise API 更适合把写入失败隔离为可恢复异步错误，不阻塞 runtime event broadcast。
- 当前最重要的是保证 `pnpm check`、Node 单测、Electron dev runtime 和后续打包流程可以共存。

## 代价

- repository API 需要 async/await，比 `better-sqlite3` 同步 API 稍复杂。
- `sqlite3` 仍然是 native 依赖，pnpm 需要记录 build approval。
- 后续 `pnpm pack`/`pnpm release` 仍需验证 native module 是否被 electron-builder 正确收集。

## 结果

- `packages/storage` 暴露 async storage service 和 repository。
- Electron main 初始化用户数据目录中的 `dybot.sqlite`，并订阅 runtime events 做异步持久化。
- `sqlite3` 在 electron-vite main build 中保持 external，workspace 包保持 inline。

## 回补计划

- 在打包阶段增加 native module 打包验收。
- 增加 runtime event bus -> storage repository 的集成测试。
- 当 Electron 内置 Node 提供稳定 `node:sqlite` 后，重新评估是否迁移到标准库以减少第三方 native 依赖。
