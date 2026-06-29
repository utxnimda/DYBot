# 项目目录结构规范

本文档是项目目录结构的唯一准入标准。后续工程骨架、包拆分、测试目录、配置文件位置都按本文执行。

## 核心原则

- 根 `config/` 是工程配置，不是用户运行时配置。
- 每个 package 都按 `src/`、`config/`、`tests/` 的独立小工程结构组织。
- 包内 `config/` 是随代码发布的包级默认定义、schema、presets、模板，不存用户本地配置。
- 用户运行时配置、密钥、日志、数据库只放用户数据目录，不进仓库。
- Electron `main`、`preload`、`renderer` 必须物理隔离。
- `packages/contracts` 必须先行，负责共享类型、事件、IPC、错误、配置 schema。
- 业务能力通过 adapter 扩展，不能把供应商 API 调用散落在 UI 或 core 中。

## 顶层结构

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
      package.json
      tsconfig.json

    core/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    douyu/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    ai/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    voice/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    audio/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    storage/
      src/
      config/
      migrations/
      tests/
      package.json
      tsconfig.json

    app-config/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    logging/
      src/
      config/
      tests/
      package.json
      tsconfig.json

    ui-kit/
      src/
      config/
      tests/
      package.json
      tsconfig.json

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

## 根 `config/`

根 `config/` 只放工程级配置：

```text
config/
  eslint/
  tsconfig/
  vitest/
  playwright/
  electron-builder/
```

允许内容：

- TypeScript base config。
- ESLint/Prettier 规则。
- Vitest 配置。
- Playwright 配置。
- electron-builder 配置。
- Vite/Electron 公共构建配置。

禁止内容：

- 用户房间号。
- AI key。
- TTS key。
- profile。
- 运行时日志。
- SQLite 数据库。
- 任何真实密钥、token、cookie。

## 包内结构

每个 package 统一结构：

```text
packages/<name>/
  src/
  config/
  tests/
  package.json
  tsconfig.json
```

`src/`：

- 正式源码。
- 包对外入口必须通过 `src/index.ts` 收敛。
- 业务实现按领域拆目录，不建泛化 `utils/` 承载业务逻辑。

`config/`：

- 包级默认值。
- 包级 schema。
- provider presets。
- 示例模板。
- 随代码发布的常量定义。

`tests/`：

- 包内单元测试。
- 包内 fixture。
- 包内 adapter mock。

空目录规则：

- 不强行创建无内容的 `config/`、`tests/`。
- 如果为了表达结构需要保留空目录，必须放 `README.md` 说明职责，优先不用 `.gitkeep`。

## 用户运行时目录

用户运行后产生的数据不进入仓库。

Windows 默认：

```text
%APPDATA%/DYBot/
  config/
    app-config.json
    profiles/
  secrets/
  data/
    dybot.sqlite
    audio-cache/
  logs/
```

portable 模式：

```text
<portable-root>/data/
  config/
  secrets/
  data/
  logs/
```

要求：

- 安装目录、源码目录、用户数据目录分离。
- 密钥不写普通 JSON。
- 导出配置默认不包含密钥。
- 数据库 migration 作用于用户数据目录中的 SQLite。
- 日志默认写用户数据目录。

## Electron 应用结构

```text
apps/desktop/
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
```

`main`：

- 窗口、托盘、菜单、生命周期。
- 注册 IPC handler。
- 启停 runtime。
- 访问文件、数据库、系统 API。
- 不写 UI 业务表现逻辑。

`preload`：

- 唯一安全桥。
- 暴露 typed API。
- 所有入参 schema 校验。
- 不包含业务逻辑。

`renderer`：

- Vue 控制台。
- 展示状态。
- 发起命令。
- 不访问 Node、文件、数据库、socket、密钥。

## 核心包职责

`packages/contracts`：

```text
src/
  events/
  ipc/
  config/
  errors/
  ids/
```

- 事件模型。
- IPC command/reply。
- 错误码。
- 配置 schema 类型。
- ID 类型。
- 其他包可依赖它，它不能依赖业务包。

`packages/core`：

```text
src/
  orchestrator/
  pipeline/
  trigger-policy/
  context-memory/
  task-state/
```

- 运行时编排。
- 弹幕/礼物到 AI/TTS/播放的任务状态机。
- 触发策略。
- 上下文裁剪。
- 不直接实现斗鱼协议、具体 AI provider、具体 TTS provider。

`packages/douyu`：

```text
src/
  protocol/
  capture/
  gifts/
  normalizer/
  reconnect/
```

- TCP 连接。
- 斗鱼 STT 编解码。
- 登录、入组、心跳、重连。
- 弹幕/礼物归一化。
- 只输出标准事件，不调用 AI/TTS。

`packages/ai`：

```text
src/
  adapters/
    openai-compatible/
    gemini/
    qwen/
  prompt/
  token/
  model-registry/
```

- AI provider adapter。
- prompt 构造。
- token 预算。
- 模型列表和降级。
- 错误归一。

`packages/voice`：

```text
src/
  adapters/
    fish-audio/
    edge-tts/
    gpt-sovits/
  cache/
  voice-registry/
  library/
```

- TTS provider adapter。
- 音色管理。
- 语音库生成。
- 音频缓存。
- 文本清洗。

`packages/audio`：

```text
src/
  devices/
  queue/
  player/
  volume/
```

- 音频设备枚举。
- 播放队列。
- 播放/暂停/跳过/打断。
- 不关心弹幕、AI、TTS provider。

`packages/storage`：

```text
src/
  db/
  repositories/
  migrations/
  backup/
migrations/
```

- SQLite 连接。
- migration。
- repository。
- 备份和恢复。
- UI 不能直接访问 SQL。

`packages/app-config`：

```text
src/
  schema/
  defaults/
  profiles/
  secrets/
  loader/
```

- 用户配置 schema。
- 默认配置。
- profile 合并。
- secret 引用。
- 用户数据目录解析。

`packages/logging`：

```text
src/
  logger/
  redaction/
  rotation/
  export/
```

- 结构化日志。
- traceId。
- 脱敏。
- 滚动和导出。

`packages/ui-kit`：

```text
src/
  components/
  composables/
  styles/
```

- 纯 UI 组件。
- 不包含业务 provider 调用。
- 不访问 IPC。

## 测试目录分层

包内测试：

```text
packages/douyu/tests/
packages/ai/tests/
packages/voice/tests/
```

根测试：

```text
tests/
  fixtures/
  integration/
  e2e/
```

规则：

- 包内测试只测本包逻辑。
- 跨包 pipeline 测试放 `tests/integration/`。
- UI 端到端测试放 `tests/e2e/`。
- 真实 API key 不用于自动化测试。
- 斗鱼协议样本、AI/TTS mock 数据放 fixture。

## M0 实际创建优先级

第一批创建：

```text
apps/desktop/electron/main/src
apps/desktop/electron/preload/src
apps/desktop/renderer/src
packages/contracts/src
packages/core/src
packages/logging/src
packages/app-config/src
config/tsconfig
config/eslint
config/vitest
docs
scripts
tests/fixtures
```

第二批接功能时创建：

```text
packages/douyu
packages/ai
packages/voice
packages/audio
packages/storage
packages/ui-kit
```

如果提前全展开，必须在空包内放 `README.md` 说明职责。

## 命名规则

- 运行时配置包叫 `packages/app-config`，不叫 `packages/config`。
- 工程配置只叫根 `config/`。
- adapter 目录统一叫 `adapters/`。
- package 对外入口统一 `src/index.ts`。
- 测试文件统一 `*.test.ts`。
- fixture 文件放 `fixtures/`，不要混在源码目录。

## 禁止事项

- 禁止把真实用户配置放进仓库。
- 禁止把密钥、cookie、token 放进仓库。
- 禁止 renderer 直接访问 Node API。
- 禁止跨包深层 import，例如从其他包导入 `src/internal/*`。
- 禁止 UI 组件直接调用 AI/TTS/斗鱼 provider。
- 禁止把业务逻辑堆进 `utils/`。
- 禁止因为“现在方便”绕过 `packages/contracts`。
