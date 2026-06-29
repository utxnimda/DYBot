# 工程基础要求

本文档是桌面机器人助手的工程准入标准。后续代码、配置、依赖、测试、打包和发布都必须遵守这里的要求。除非有新的 ADR 明确覆盖，否则本文优先级高于临时实现习惯。

任何代码改动开始前，必须先阅读 [项目 AI 协作规范](ai-coding-rules.md)、本文档、[项目目录结构规范](project-structure.md)、[架构提案](desktop-bot-assistant-architecture.md) 和相关 ADR。

## 目标

本项目要交付的是一个可长期维护的独立桌面程序，不是临时脚本集合，也不是依赖远程页面的 Web 控制台。

基础要求：

- 程序可以打包成独立 Windows 可执行程序和安装包。
- 核心链路可观测：斗鱼事件、AI、TTS、播放队列都有状态、日志和错误。
- 模块边界稳定：UI 不能直接访问密钥、斗鱼 socket、TTS 密钥或数据库细节。
- 任何新功能先进入清晰模块，再进入 UI。
- 本地配置、密钥、日志、数据库与程序安装目录分离。
- 每个外部系统都有 adapter，不把上游 API 细节扩散到业务层。

## 官方依据

当前主线技术栈：

- Electron：桌面壳、主进程、preload、IPC、打包。
- TypeScript：主语言。
- Node.js：本地 runtime、斗鱼 TCP、AI/TTS HTTP、文件和数据库。
- Vue 3 + Vite：桌面 UI。

参考官方文档：

- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- TypeScript TSConfig `strict`: https://www.typescriptlang.org/tsconfig/#strict
- Node.js security best practices: https://nodejs.org/en/learn/getting-started/security-best-practices
- Vue official style guide: https://vuejs.org/style-guide/
- Vite production build: https://vite.dev/guide/build
- electron-builder documentation: https://www.electron.build/

## AI 协作要求

所有 AI coding agent 和人工协作者必须遵守 [项目 AI 协作规范](ai-coding-rules.md)。

硬性要求：

- 任何代码改动前必须阅读强制规范文档。
- 目录结构改动必须符合 [项目目录结构规范](project-structure.md)。
- 不允许未读规范直接新增 package、依赖、IPC、provider、migration 或构建脚本。
- 不允许为短期方便绕过 `packages/contracts`、Electron 安全边界、schema 校验或日志脱敏。
- 不能满足规范时，必须新增或更新 ADR 记录例外、风险和回补计划。

## 技术选型基线

必须使用：

- TypeScript。
- Electron。
- Vue 3。
- Vite。
- pnpm workspace。
- ESLint。
- Prettier。
- Vitest。
- Playwright。
- SQLite。

推荐依赖：

- `zod`：配置、IPC、外部 API 响应校验。
- `pino`：结构化日志。
- `better-sqlite3` 或 `sqlite`：SQLite 访问层，最终二选一后固定。
- `electron-builder`：Windows 安装包和 portable 包。
- `electron-updater`：确认更新源后再引入。

禁止默认引入：

- 重型状态管理库，除非 UI 状态复杂到 Vue 原生能力不够。
- 未维护的音频、TTS、Socket、数据库依赖。
- 在 renderer 进程使用 Node API。
- 在 renderer 进程保存或读取密钥。

## 仓库结构

目录结构的唯一详细规范见 [项目目录结构规范](project-structure.md)。第一阶段采用单仓库、多包结构：

```text
Bot/
  apps/
    desktop/
      electron/
        main/
          src/
          config/
        preload/
          src/
          config/
      renderer/
        src/
        config/
      package.json
      tsconfig.json

  packages/
    contracts/
      src/
      config/
      tests/
    core/
      src/
      config/
      tests/
    douyu/
      src/
      config/
      tests/
    ai/
      src/
      config/
      tests/
    voice/
      src/
      config/
      tests/
    audio/
      src/
      config/
      tests/
    storage/
      src/
      config/
      migrations/
      tests/
    app-config/
      src/
      config/
      tests/
    logging/
      src/
      config/
      tests/
    ui-kit/
      src/
      config/
      tests/

  config/
    eslint/
    tsconfig/
    vitest/
    playwright/
    electron-builder/

  scripts/
  tests/
    fixtures/
    integration/
    e2e/
  docs/
```

目录职责：

- `apps/desktop/electron/main`：窗口、托盘、生命周期、菜单、后台模块托管。
- `apps/desktop/electron/preload`：唯一允许暴露给 renderer 的安全 API。
- `apps/desktop/renderer`：Vue UI，不直接访问 Node、文件、socket、密钥。
- `packages/contracts`：事件、命令、IPC、配置、数据库 DTO 的共享类型和 schema。
- `packages/core`：任务编排、状态机、触发策略、上下文裁剪。
- `packages/douyu`：斗鱼 TCP、协议、礼物归一化。
- `packages/ai`：模型 provider、prompt、token 预算、降级、限流。
- `packages/voice`：TTS provider、音色、语音库、音频缓存。
- `packages/audio`：设备枚举、播放队列、播放控制。
- `packages/storage`：SQLite migration、repository。
- `packages/app-config`：运行时配置 schema、profile、用户数据目录、密钥引用。
- `packages/logging`：结构化日志、脱敏、日志导出。
- `packages/ui-kit`：纯 UI 组件，不包含业务状态。
- 根 `config/`：工程级配置，如 TypeScript、ESLint、Vitest、Playwright、electron-builder。

配置目录边界：

- 根 `config/` 只放工程配置。
- 包内 `config/` 只放随代码发布的默认定义、schema、presets、模板。
- 用户运行时配置、密钥、日志、数据库只放用户数据目录，不进仓库。
- 运行时配置包固定命名为 `packages/app-config`，不使用 `packages/config`。

禁止：

- `utils` 目录承载业务逻辑。
- UI 组件直接调用 provider。
- 任意模块直接读写其他模块的数据文件。
- 跨包循环依赖。
- 跨包深层 import，例如导入其他包的 `src/internal/*`。
- 把用户运行时配置或密钥放入根 `config/` 或包内 `config/`。

## 模块边界

所有业务模块只通过 command/event 交互。

允许的依赖方向：

```text
renderer -> preload contract -> main orchestrator
main orchestrator -> core
core -> douyu / ai / voice / audio / storage / app-config / logging
domain packages -> contracts
storage -> contracts
logging -> contracts
```

禁止的依赖方向：

```text
renderer -> fs/net/sqlite/secret
renderer -> douyu/ai/voice/audio provider implementation
provider -> renderer
douyu -> ai
ai -> audio
voice -> douyu
```

跨模块数据必须是显式类型，不能传裸对象。

## TypeScript 要求

`tsconfig` 必须开启：

- `strict: true`
- `noImplicitOverride: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `useUnknownInCatchVariables: true`
- `noFallthroughCasesInSwitch: true`

编码要求：

- 外部输入先用 schema 校验，再进入业务层。
- `catch (err)` 中先把 `unknown` 归一化成内部错误类型。
- 公共函数要有明确返回类型。
- 禁止把 `any` 作为逃生通道。确实需要时必须局部隔离并说明原因。
- 禁止业务层依赖 `process.env`，环境变量只能在 app-config 层读取。
- 时间统一用 epoch ms 存储；UI 层负责格式化。
- ID 使用带前缀字符串，例如 `evt_`、`task_`、`voice_`。

## Electron 安全要求

必须遵守：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`，除非有 ADR 说明不能开启的具体原因。
- preload 只暴露最小 API。
- 所有 IPC 参数必须用 schema 校验。
- 禁止 renderer 传入任意文件路径后由 main 直接读写。
- 禁止 renderer 传入任意 URL 后由 main 直接请求。
- 禁止使用 `eval`、动态执行字符串、远程代码加载。
- 禁止加载远程页面作为主 UI。
- 外部链接使用系统浏览器打开，不在主窗口导航。
- CSP 必须在生产构建启用。

主进程职责：

- 生命周期。
- 窗口和托盘。
- 安全 IPC。
- 后台 runtime 启停。
- 日志和配置入口。

preload 职责：

- 暴露 typed API。
- 订阅事件。
- 参数校验前置。
- 不包含业务逻辑。

renderer 职责：

- 展示状态。
- 发起命令。
- 表单校验和交互反馈。
- 不保存密钥。

## Node.js 后端要求

Node 代码必须按服务端工程标准处理：

- 所有 I/O 都要可取消或有超时。
- 所有重试都有上限、退避、日志。
- 长连接必须有 heartbeat、断线状态和重连策略。
- HTTP 请求必须设置 timeout。
- 文件写入使用原子写入策略：写临时文件后 rename。
- 数据库 migration 必须可重复运行。
- 不把 API key、cookie、token 写入日志。
- 不信任任何来自弹幕、配置文件、远程 API 的输入。

## Vue UI 要求

UI 首屏是控制台，不做营销页。

必须提供：

- 斗鱼房间连接状态。
- 弹幕和礼物实时流。
- AI 状态、模型、最近错误。
- TTS 状态、音色、最近错误。
- 播放队列、当前播放、跳过/暂停。
- 日志面板或日志入口。
- 配置保存状态和校验错误。

组件要求：

- 单文件组件只负责一个明确 UI 单元。
- 业务状态放到 feature store/composable，不散落在组件深层。
- 组件 props/emits 必须有类型。
- 列表项必须有稳定 key。
- 异步操作必须显示 pending、success、error。
- 危险操作必须二次确认。

样式要求：

- 控制台风格，信息密度合理。
- 不做浮夸 hero 页。
- 不使用大面积单一紫色、深蓝、棕橙或米色主题。
- 字体大小不随 viewport 宽度缩放。
- 按钮、输入框、列表、状态标签尺寸稳定，避免内容变化导致布局跳动。

## 配置和密钥

配置分层：

```text
defaults
app-config.json
profiles/<profileId>.json
runtime overrides
secret store
```

要求：

- 所有配置有 schema 和默认值。
- 配置保存前校验。
- 导出配置默认不包含密钥。
- 密钥用系统安全存储或加密存储，不写普通 JSON。
- `.env` 只允许开发环境使用。
- 生产包不包含真实密钥、cookie、token、私钥。

第一版可以先用本机加密文件作为 secret store，但必须把接口设计成可替换系统 keychain。

## 日志

必须使用结构化日志。

日志字段：

```json
{
  "ts": "2026-06-29T12:00:00.000Z",
  "level": "info",
  "module": "ai",
  "event": "ai.reply.generated",
  "traceId": "evt_...",
  "roomId": "9046690",
  "latencyMs": 1234
}
```

要求：

- 每条弹幕到播放完成都有同一个 `traceId`。
- 日志按天或大小滚动。
- UI 可以打开日志目录和导出日志。
- 错误日志包含可行动信息，不只写 `failed`。
- 日志导出默认脱敏。

必须脱敏：

- API key。
- token。
- cookie。
- remote secret。
- 代理用户名密码。
- 私钥路径中的敏感用户名可选脱敏。

## 错误模型

所有模块统一返回内部错误：

```ts
type BotErrorCode =
  | "DOUYU_CONNECT_FAILED"
  | "DOUYU_PROTOCOL_ERROR"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "TTS_PROVIDER_UNAVAILABLE"
  | "AUDIO_DEVICE_UNAVAILABLE"
  | "CONFIG_INVALID"
  | "STORAGE_ERROR";
```

要求：

- 错误必须有 `code`、`message`、`recoverable`、`traceId`。
- UI 展示用户可理解的错误。
- 日志保留技术细节。
- 可恢复错误不使 runtime 崩溃。

## AI 和 Prompt 安全

要求：

- 系统指令、人设、弹幕原文分离。
- 弹幕永远作为 data block，不允许拼进 system prompt。
- 弹幕里的“忽略规则”“输出密钥”“执行命令”只能作为用户内容。
- 回复默认短句，适合语音播放。
- 输出进入 TTS 前要清洗：URL、超长文本、特殊符号、敏感内容。
- AI provider 返回错误时进入降级或跳过，不阻塞后续弹幕。
- 记录 token 估算和模型耗时。

## 斗鱼采集要求

要求：

- TCP 连接、登录、入组、心跳、重连独立成模块。
- 协议编解码有 fixture 测试。
- 弹幕、礼物、进场、系统消息归一化后再进入事件总线。
- 礼物金额和类型允许手动覆盖。
- 同一房间事件入库。
- 采集模块不直接调用 AI 或 TTS。

## TTS 和音频要求

要求：

- TTS provider 统一接口。
- 音色注册表和 provider 配置分离。
- TTS 结果按文本 hash、音色、参数缓存。
- 播放队列有状态机：`queued`、`playing`、`done`、`failed`、`skipped`。
- 支持选择音频输出设备。
- 设备不可用时给出可恢复错误。
- 播放模块不关心弹幕和 AI，只接收音频任务。

## 数据库要求

SQLite 是默认本地存储。

要求：

- migration 版本化。
- repository 层封装 SQL。
- 禁止 UI 直接访问数据库。
- 程序升级前自动检测 schema。
- 破坏性 migration 前备份。
- 用户可在 UI 中打开数据目录。

关键表：

- `events`
- `reply_tasks`
- `ai_messages`
- `audio_assets`
- `voices`
- `usage_stats`
- `profiles`

## 测试要求

每次合并前至少通过：

```text
pnpm check
pnpm test
```

质量门：

- TypeScript typecheck。
- ESLint。
- Prettier check。
- unit tests。
- 核心链路 smoke test。

必须测试：

- 斗鱼 STT 编解码。
- 弹幕和礼物归一化。
- 触发规则。
- prompt 构造和上下文裁剪。
- AI provider mock。
- TTS provider mock。
- 播放队列状态机。
- 配置 schema。
- SQLite migration。
- IPC 参数校验。

E2E：

- Playwright 覆盖 UI 基本流程。
- 不依赖真实 AI/TTS key。
- 使用 fake provider 和 fixture。

## 构建和发布

命令基线：

```text
pnpm dev
pnpm check
pnpm test
pnpm smoke
pnpm build
pnpm pack
pnpm release
```

发布产物：

```text
release/
  v0.1.0/
    BotAssistant-Setup-v0.1.0.exe
    BotAssistant-Portable-v0.1.0.zip
    BUILD_INFO.json
    checksums.txt
```

`BUILD_INFO.json` 必须包含：

- version。
- git commit。
- build time。
- platform。
- enabled features。
- dependency lockfile hash。

发布前禁止：

- 未提交真实密钥扫描。
- typecheck 失败。
- lint 失败。
- 测试失败。
- 没有更新 migration 但 schema 已变化。

## 代码评审清单

每次新增功能都要回答：

- 模块边界是否正确。
- 是否新增了可复用 adapter，而不是把 API 调用写死在 UI。
- 输入是否经过 schema 校验。
- 错误是否可恢复。
- 日志是否有 traceId。
- 是否泄露密钥或敏感字段。
- 是否有测试覆盖关键逻辑。
- 是否影响打包产物。
- 是否需要 migration。
- 是否需要更新文档。

## Definition of Done

一个任务完成必须满足：

- 功能可运行。
- 类型检查通过。
- 相关测试通过。
- 关键错误路径可见。
- 日志足够定位问题。
- 没有密钥泄露。
- 文档或配置样例已更新。
- UI 状态完整：空、加载、成功、失败。

## 例外流程

如果某项要求短期无法满足，必须写入 ADR 或任务备注：

- 例外原因。
- 风险。
- 临时方案。
- 回补时间点。

没有记录的例外视为不允许。
