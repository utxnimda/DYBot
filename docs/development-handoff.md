# Development Handoff

本文档用于在新工作区或其他电脑上继续开发 DYBot。开始任何代码改动前，仍然必须先阅读根目录 `AGENTS.md` 和项目规范文档。

## 当前仓库状态

- Remote: `https://github.com/utxnimda/DYBot.git`
- Branch: `main`
- 当前已推送基线提交: `b70e190 feat: bootstrap desktop bot foundation`
- 主线技术栈: TypeScript + Electron + Vue 3 + Vite + pnpm workspace
- 目标形态: 独立桌面可执行程序，不依赖远程 Web 页面作为主 UI

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
- Windows 是当前主要验证环境

如果新电脑首次安装时 Electron 或 esbuild 的 postinstall 被 pnpm build approval 阻止，执行：

```powershell
pnpm approve-builds electron esbuild
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
- 任何跨进程通信必须走 `packages/contracts` 中的 typed IPC。
- 任何跨模块事件必须走 `packages/contracts` 中的 typed event。
- 外部输入必须 schema 校验或协议解析后再进入业务逻辑。
- 用户运行时配置、密钥、日志、数据库不进入仓库。

## 已完成内容

### M0: 工程骨架

已完成：

- pnpm workspace。
- Electron + Vue/Vite 桌面应用基础骨架。
- Electron `main`、`preload`、`renderer` 物理隔离。
- TypeScript strict 基础配置。
- ESLint、Prettier、Vitest、electron-builder 配置。
- `pnpm dev`、`pnpm check`、`pnpm test`、`pnpm smoke`、`pnpm build`、`pnpm pack`、`pnpm release` 脚本。
- AI 协作规范、工程基础要求、目录结构规范、架构提案、ADR。
- 基础桌面控制台 UI。

### M1: 斗鱼采集基础模块

已完成：

- `packages/contracts/src/douyu.ts`：斗鱼事件、房间配置 schema。
- `packages/douyu`：斗鱼独立采集包。
- STT 文本协议解析和序列化。
- 斗鱼 TCP packet 编解码。
- 登录、入组、心跳、退出命令构造。
- 弹幕、礼物、用户进场、房间状态、采集错误归一化。
- `DouyuTcpCaptureClient`：基础 TCP 连接、心跳、断线重连和事件输出。
- `packages/core` 注入可选 `DouyuCaptureClient` 并转发 `douyu.*` 事件。
- 斗鱼协议、packet、normalizer、backoff 单元测试。

### 配置默认值

- 默认斗鱼测试房间号: `9999`
- 定义位置: `packages/contracts/src/config.ts` 的 `DEFAULT_DOUYU_TEST_ROOM_ID`
- 默认 app config 位置: `packages/app-config/src/defaults.ts`
- 真实用户房间配置后续必须进入用户数据目录/profile，不放仓库。

## 最近验证状态

最近已通过：

```powershell
pnpm check
pnpm smoke
pnpm build
```

说明：

- 自动化测试使用 fixture/mock，不连接真实斗鱼房间。
- `pnpm dev` 已验证可以启动 Electron 开发版，但当前没有保持后台运行。
- `pnpm build` 会生成 `apps/desktop/out/`，该目录已被 `.gitignore` 忽略。

## 当前尚未完成

M1 还没有完整闭环到 UI：

- `DouyuTcpCaptureClient` 还未在 `apps/desktop/electron/main` 中实例化并注入 runtime。
- preload IPC 还没有暴露“启动/停止斗鱼采集”和“读取默认斗鱼配置”的 typed API。
- renderer UI 还没有房间号输入、连接/断开按钮、弹幕/礼物实时流展示。
- 没有真实斗鱼房间手工验收记录。
- 事件还没有入库，`packages/storage` 尚未创建。

AI/TTS/音频链路尚未开始：

- `packages/ai` 尚未创建。
- `packages/voice` 尚未创建。
- `packages/audio` 尚未创建。
- `packages/storage` 尚未创建。
- `packages/ui-kit` 尚未创建。

## 推荐下一步

### 下一步 1: 接通斗鱼采集到桌面 UI

目标：启动桌面应用后可以用默认房间 `9999` 连接斗鱼，并在 UI 看到弹幕/礼物事件。

建议拆分：

1. 在 `apps/desktop/electron/main/src/index.ts` 创建 `DouyuTcpCaptureClient` 并注入 `createRuntimeOrchestrator`。
2. 在 `packages/contracts/src/ipc.ts` 增加 typed IPC：
   - `bot:douyu:get-default-room`
   - `bot:douyu:start`
   - `bot:douyu:stop`
3. preload 暴露最小 API，并用 schema 校验入参和出参。
4. renderer 增加房间配置和连接状态区域。
5. renderer 订阅 `douyu.danmaku`、`douyu.gift`、`douyu.room_status`、`douyu.capture_error` 并显示事件流。
6. 补单元测试或 IPC schema 测试。
7. 跑 `pnpm check`、`pnpm smoke`、`pnpm build`。

注意：renderer 不能直接 import `@dybot/douyu`，只能通过 preload 暴露的 typed API 和 `BotEvent` 事件工作。

### 下一步 2: 创建 storage 包

目标：将斗鱼事件入库，为后续上下文、AI prompt、统计、回放测试打基础。

建议先做：

- `packages/storage` 包结构。
- SQLite 选型 ADR 或说明，先固定 `better-sqlite3` 或 `sqlite` 之一。
- migration 基础设施。
- `events` 表和 repository。
- fake/memory 或临时文件数据库测试。

### 下一步 3: AI 回复模块

目标：从 `douyu.danmaku` 进入触发策略，调用 mock AI provider 生成短回复。

建议先做 mock provider，不接真实 key：

- `packages/ai` adapter 接口。
- prompt builder，系统规则、人设、弹幕 data block 分离。
- token 预算接口占位。
- mock provider 单测。

## 重要文件索引

- 工程入口规则: `AGENTS.md`
- 项目说明: `README.md`
- 架构提案: `docs/desktop-bot-assistant-architecture.md`
- 目录规范: `docs/project-structure.md`
- 工程基础要求: `docs/engineering-foundation.md`
- Electron 技术 ADR: `docs/adr/0001-electron-typescript-vue.md`
- 桌面 app: `apps/desktop`
- contract 包: `packages/contracts`
- runtime core: `packages/core`
- 斗鱼包: `packages/douyu`
- 默认配置包: `packages/app-config`
- 日志包: `packages/logging`

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
