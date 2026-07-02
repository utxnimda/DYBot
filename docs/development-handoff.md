# Development Handoff

本文档用于在新工作区或其他电脑继续开发 DYBot。开始任何代码改动前，仍然必须先阅读根目录 `AGENTS.md` 和项目规范文档。

## 当前仓库状态

- Remote: `https://github.com/utxnimda/DYBot.git`
- Branch: `main`
- 最近已知远端基线提交: `bd14059 docs: add development handoff`；本次提交推送后以 GitHub `main` 最新提交为准
- 最近完成阶段：斗鱼采集 UI 接入、storage 基础包、storage runtime 接入、runtime event -> storage 集成测试、AI contracts/prompt/mock provider 基础包、AI mock reply pipeline、Voice/TTS mock pipeline、Audio playback mock queue、`pnpm run pack` 打包验收。
- 主线技术栈: TypeScript + Electron + Vue 3 + Vite + pnpm workspace
- 目标形态: 独立桌面可执行程序，不依赖远程 Web 页面作为主 UI。

## 新工作区接手步骤

```powershell
git clone https://github.com/utxnimda/DYBot.git
cd DYBot
pnpm install
pnpm check
pnpm smoke
pnpm dev
```

环境要求：

- Node.js `>=22.0.0`
- pnpm `>=10.0.0`，当前 lockfile 使用 `pnpm@11.7.0`
- Windows 是当前主要验证环境。

如果新电脑首次安装时 Electron、esbuild 或 sqlite3 的 postinstall 被 pnpm build approval 阻止，执行：

```powershell
pnpm approve-builds electron esbuild sqlite3
pnpm install
```

## 开工前必读

必须按顺序阅读：

1. `AGENTS.md`
2. `docs/ai-coding-rules.md`
3. `docs/engineering-foundation.md`
4. `docs/project-structure.md`
5. `docs/desktop-bot-assistant-architecture.md`
6. `docs/adr/0001-electron-typescript-vue.md`
7. 当前要修改 package 的 `README.md` 或 `config/README.md`

关键规则：

- `renderer` 不直接访问 Node、socket、文件、数据库或密钥。
- 跨进程通信必须走 `packages/contracts` 中的 typed IPC。
- 跨模块事件必须走 `packages/contracts` 中的 typed event。
- 外部输入必须 schema 校验或协议解析后再进入业务逻辑。
- 用户运行时配置、密钥、日志、数据库不进入仓库。

## 已完成内容

### M0: 工程骨架

- pnpm workspace。
- Electron + Vue/Vite 桌面应用骨架。
- Electron `main`、`preload`、`renderer` 物理隔离。
- TypeScript strict 基础配置。
- ESLint、Prettier、Vitest、electron-builder 配置。
- `pnpm dev`、`pnpm check`、`pnpm test`、`pnpm smoke`、`pnpm build`、`pnpm pack`、`pnpm release` 脚本。
- AI 协作规范、工程基础要求、目录结构规范、架构提案、ADR。
- 基础桌面控制台 UI。

### M1: 斗鱼采集基础模块

- `packages/contracts/src/douyu.ts`：斗鱼事件、房间配置 schema。
- `packages/douyu`：斗鱼独立采集包。
- STT 文本协议解析和序列化。
- 斗鱼 TCP packet 编解码。
- 登录、入组、心跳、退出命令构造。
- 弹幕、礼物、用户进场、房间状态、采集错误归一化。
- `DouyuTcpCaptureClient`：TCP 连接、心跳、断线重连和事件输出。
- `packages/core` 注入可选 `DouyuCaptureClient` 并转发 `douyu.*` 事件。
- Electron main 注入 `DouyuTcpCaptureClient` 并注册 `bot:douyu:*` IPC。
- preload 暴露 `window.dybot.bot.douyu` typed API。
- renderer 控制台可读取默认房间、启动/停止斗鱼采集，并显示弹幕、礼物、状态、错误事件。
- 斗鱼协议、packet、normalizer、backoff、IPC contract 单元测试。

### M1.5: Storage 基础包

- `packages/storage`：SQLite storage 独立包。
- ADR 0002：固定首版 SQLite driver 为 `sqlite` + `sqlite3`。
- `events` 表 migration 和 schema version 管理。
- `SqliteEventRepository`：异步写入和查询 `BotEvent`，支持 room、event type、limit、offset 过滤。
- 重复 `eventId` 写入返回已持久化记录，不覆盖旧记录。
- 临时文件数据库单元测试覆盖 migration repeatability、事件写入、重复写入、查询排序。

### M1.6: Storage 接入 runtime

- `packages/app-config` 新增用户数据目录下的 runtime data 和默认 SQLite 路径解析。
- Electron main 启动时初始化用户数据目录中的 `dybot.sqlite`。
- Electron main 订阅 `RuntimeOrchestrator` 事件并异步持久化到 storage。
- storage 写入失败只记录 `storage.event_persist_failed`，不阻塞 renderer 事件广播。
- renderer 仍不接触数据库、文件路径或 Node API。
- `sqlite3` 在 electron-vite main build 中保持 external，workspace 包保持 inline。
- `tests/fixtures/douyu-replay.ts` 和 `tests/integration/storage-runtime-event.test.ts` 覆盖 runtime.status，以及 fixture 回放 `douyu.danmaku`、`douyu.gift`、`douyu.user_entered`、`douyu.room_status`、`douyu.capture_error` 的持久化，并验证 room/event type/分页查询。

### M2.0: AI 回复基础包

- `packages/contracts/src/ai.ts`：AI prompt message、persona、reply request、prompt、reply result schema。
- `packages/ai`：AI 独立包，当前包含 provider interface、prompt builder、token estimate、mock provider。
- prompt builder 明确分离 system instruction 和 danmaku data block，弹幕文本只进入 user data block。
- `MockAiProvider` 生成 deterministic 短回复、模型信息、耗时和 token 估算，不接真实 key。
- AI 单元测试覆盖 prompt 注入隔离、mock provider schema、短回复和不回显危险弹幕指令。

### M2.1: AI mock reply pipeline

- `packages/contracts/src/ai.ts` 新增 `AiReplyTask`、`ai.reply.generated`、`ai.reply.failed` typed event contract。
- `packages/contracts/src/ai.ts` 新增 `ai.reply.skipped`，AI generated event 只携带 prompt hash/消息数/字符数摘要，不再广播或入库完整 prompt。
- `packages/contracts/src/event-metadata.ts` 新增 `getBotEventMetadata()`，storage 和 renderer 复用同一套 eventId/roomId/occurredAt 提取逻辑。
- `packages/core` 拆出 `AiReplyPipeline`、`DanmakuContextWindow`、`AiReplyTaskFactory`、`AiReplyTriggerPolicy`，runtime 只负责装配和事件转发。
- AI pipeline 支持 max concurrency、queue length、关键词/全局/用户冷却、stop cancellation 和 skipped reason。
- 停止态弹幕只产出 `runtime_stopped` skipped event，不写入上下文窗口，避免重启后污染后续 AI prompt。
- AI reply task 保留原始弹幕 `traceId`、`roomId`、`triggerEventId`，并携带 provider/model/token/latency 估算。
- AI provider 失败时产出 `ai.reply.failed` 可恢复事件，不阻塞后续斗鱼事件。
- Electron main 只在 `features.aiReply` 为 true 时注入 `MockAiProvider`；renderer 事件流可展示 AI reply/skipped，并在概览统计 reply 数。
- storage repository 已支持 AI reply events 的 eventId、roomId、occurredAt 提取；集成测试覆盖 AI reply 入库。
- 根 `package.json` 脚本内部已统一使用 `corepack pnpm`，避免当前 Windows shell 缺少全局 pnpm shim 时失败。

### M2.2: Voice/TTS mock pipeline

- `packages/contracts/src/voice.ts`：voice synthesis request/result/task schema，以及 `voice.synthesis.generated`、`voice.synthesis.failed`、`voice.synthesis.skipped` typed event contract。
- `packages/contracts/src/ids.ts` 新增 `AudioAssetId` 和 `createAudioAssetId()`，用于 TTS 结果产生可追踪音频资产元数据。
- `packages/contracts/src/event-metadata.ts` 支持 voice events 的 eventId、roomId、occurredAt 提取，storage 和 renderer 继续共用同一套 metadata 逻辑。
- 新增 `packages/voice`：TTS provider interface、`MockVoiceProvider`、`cleanTextForSpeech()` 和包内单元测试；当前不接真实 TTS key，不生成真实音频文件。
- `packages/core` 新增 `VoiceSynthesisPipeline` 和 `VoiceSynthesisTaskFactory`，runtime 在 `ai.reply.generated` 后自动触发 mock TTS，并保留同一 `traceId`。
- Voice pipeline 支持 max concurrency、queue length、stop cancellation、provider failure 和 skipped reason。
- Electron main 只在 `features.aiReply` 与 `features.voiceSynthesis` 同时为 true 时注入 `MockVoiceProvider`；renderer 可展示 voice events 并统计 TTS 生成数。
- storage integration 已覆盖 AI -> voice generated event 的持久化和 room/event type 查询。
- 补齐 `packages/ai/src/token/estimate.ts`，恢复 AI mock provider 和 core typecheck 所需的 token 估算导出。

### M2.3: Audio playback mock queue

- `packages/contracts/src/audio.ts`：audio playback request/result/task schema，以及 `audio.playback.started`、`audio.playback.finished`、`audio.playback.failed`、`audio.playback.skipped` typed event contract。
- 新增 `packages/audio`：`AudioPlayer` interface、`MockAudioPlayer`、mock output devices 和包内单元测试；当前不枚举真实设备、不播放真实音频。
- `packages/contracts/src/event-metadata.ts` 支持 audio events 的 eventId、roomId、occurredAt 提取，storage 和 renderer 继续共用同一套 metadata 逻辑。
- `packages/core` 新增 `AudioPlaybackPipeline` 和 `AudioPlaybackTaskFactory`，runtime 在 `voice.synthesis.generated` 后自动创建播放任务，并保留同一 `traceId`。
- Audio pipeline 支持 max concurrency、queue length、stop cancellation、player failure 和 skipped reason。
- Electron main 只在 `features.aiReply`、`features.voiceSynthesis`、`features.audioPlayback` 同时为 true 时注入 `MockAudioPlayer`；renderer 可展示 audio playback events 并统计播放完成数。
- storage integration 已覆盖 AI -> voice -> audio playback finished event 的持久化和 room/event type 查询。

## 配置默认值

- 默认斗鱼测试房间号: `9999`
- 定义位置: `packages/contracts/src/config.ts` 的 `DEFAULT_DOUYU_TEST_ROOM_ID`
- 默认 app config 位置: `packages/app-config/src/defaults.ts`
- 真实用户房间配置后续必须进入用户数据目录/profile，不放仓库。

## 最近验证状态

最近已通过（本轮 audio mock queue 后重新跑过）：

```powershell
corepack pnpm --filter @dybot/audio typecheck
corepack pnpm --filter @dybot/audio test
corepack pnpm --filter @dybot/contracts typecheck
corepack pnpm --filter @dybot/core typecheck
corepack pnpm --filter @dybot/desktop typecheck
node node_modules\vitest\vitest.mjs run packages\core\tests\runtime-orchestrator.test.ts
node node_modules\vitest\vitest.mjs run tests\integration\storage-runtime-event.test.ts
corepack pnpm -r typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm smoke
corepack pnpm exec prettier --check <本次 audio 改动文件>
```

说明：

- 自动化测试使用 fixture/mock，不连接真实 AI/TTS key。
- 本轮已修复根脚本内部裸 `pnpm` 调用；当前 Windows shell 可直接使用 `corepack pnpm build`。
- 全仓库 `prettier --check .` 仍会命中历史格式差异；本轮失败文件为既有 AI/core/storage 等 18 个文件。本轮已格式化并校验本次 audio 改动文件，未做全仓库格式化 churn。
- `pnpm dev` 已启动到 `storage.ready` 和 `desktop.ready`，验证 Electron main 可以初始化 SQLite storage；验证后已手动结束 dev 进程。
- dev 过程中出现过 Chromium SSL handshake 背景日志，不影响本地应用 ready。
- 真实斗鱼房间 `9999` 包级网络验收已通过：`DouyuTcpCaptureClient` 连接成功，收到 `connected`、`joined_group`、`login_ok`、`heartbeat`、`danmaku`、`gift`、`user_entered`、`disconnected` 事件；30 秒窗口内计数为 room_status 9、danmaku 97、gift 39、user_entered 155。
- Electron 构建产物 UI 按钮路径已通过真实房间验收：preload 注入 `window.dybot` 正常，点击“连接”后 UI 显示 `login_ok`、弹幕计数 1、礼物计数 2，事件流包含 `douyu.danmaku` 和 `douyu.gift`；点击“断开”后 UI 状态为 `disconnected`。
- `pnpm build` 会生成 `apps/desktop/out/`，该目录已被 `.gitignore` 忽略。`pnpm run pack` 已通过，electron-builder 执行了 `@electron/rebuild` 并为 `sqlite3` 准备 native 依赖，产出 `release/win-unpacked`，release 目录已被忽略。

## 当前尚未完成

M1 剩余风险和补充项：

- 已有 runtime.status 和 fixture `douyu.*` event bus -> storage repository 集成测试；后续可补真实录制 jsonl 回放和更多协议变体。
- 采集连接失败时 UI 依赖 `douyu.capture_error` 事件展示错误，后续可补更明确的连接状态模型。
- 当前只接单房间控制，多房间采集还未做。

AI/TTS/音频链路剩余：

- AI runtime pipeline 当前仍只接 `MockAiProvider`，默认配置下 `features.aiReply=false` 不会启用；尚未做真实 provider 配置、模型列表、规则 UI 和 reply_tasks 专表。
- Voice/TTS runtime pipeline 当前仍只接 `MockVoiceProvider`，默认配置下 `features.voiceSynthesis=false` 不会启用；尚未做真实 TTS provider、音色配置、音频缓存和语音库。
- Audio playback runtime pipeline 当前仍只接 `MockAudioPlayer`，默认配置下 `features.audioPlayback=false` 不会启用；尚未做真实设备枚举、用户选择输出设备、音量、暂停/跳过/打断和真实音频播放。
- `packages/ui-kit` 尚未创建。

## 推荐下一步

### 下一步 1: AI/voice/audio config profile hardening

目标：把 AI、voice 和 audio mock pipeline 从代码默认项推进到可配置的直播间 profile。

建议先做：

- 在 app-config profile 中表达 AI/voice/audio 开关、关键词、冷却、队列长度、并发、voiceId、输出格式和 outputDeviceId。
- UI 提供 AI/voice/audio mock pipeline 的启停、规则展示、队列状态和 skipped reason 过滤。
- 后续再接真实 provider profile，不把真实 API key、TTS key、provider base URL 或用户设备配置放进仓库。

### 下一步 2: Real provider/device integration

目标：在 mock 链路稳定后逐步接真实 AI、TTS 和音频设备能力。

建议先做：

- 真实 AI provider 前先完成 token budget、上下文窗口、限流和 prompt 审计日志脱敏。
- 真实 TTS provider 前先完成 voice profile、缓存目录、音频资产生命周期和错误恢复策略。
- 真实音频播放前先完成设备枚举、测试音、输出设备选择、音量和播放队列控制。

### 下一步 3: Storage 打包回归持续化

目标：把 native driver 打包验证纳入持续回归。

建议先做：

- 保持 `pnpm run pack` 作为 native driver 回归验证。
- 如果后续 pack 失败，优先调整 electron-builder native unpack/rebuild 配置，不允许把数据库逻辑移到 renderer。

## 重要文件索引

- 工程入口规则: `AGENTS.md`
- 项目说明: `README.md`
- 架构提案: `docs/desktop-bot-assistant-architecture.md`
- 目录规范: `docs/project-structure.md`
- 工程基础要求: `docs/engineering-foundation.md`
- Electron 技术 ADR: `docs/adr/0001-electron-typescript-vue.md`
- SQLite driver ADR: `docs/adr/0002-sqlite-storage-driver.md`
- 桌面 app: `apps/desktop`
- contract 包: `packages/contracts`
- runtime core: `packages/core`
- AI 包: `packages/ai`
- Voice 包: `packages/voice`
- Audio 包: `packages/audio`
- 斗鱼包: `packages/douyu`
- 默认配置包: `packages/app-config`
- 日志包: `packages/logging`
- 存储包: `packages/storage`

## Git 约定

当前仓库已初始化并推送到 GitHub。继续开发时建议：

```powershell
git pull --ff-only
pnpm install
pnpm check
```

完成一个可验证的小阶段后：

```powershell
git status --short
git add .
git commit -m "feat: ..."
git push
```

不要提交：

- `node_modules/`
- `apps/desktop/out/`
- `dist/`、`release/`、`coverage/`
- `.env*`
- API key、token、cookie、私钥
- SQLite 数据库、日志、用户运行时配置
