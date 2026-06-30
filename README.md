# 桌面机器人助手

这是桌面机器人助手的新工程目录。

当前主线已经确定为 **TypeScript + Electron + Vue/Vite**：交付目标是独立桌面可执行程序，不是依赖远程 Web 页面的控制台。

## 开工前必读

任何代码、配置、依赖、脚本、目录结构改动开始前，必须先阅读：

1. [项目 AI 协作规范](docs/ai-coding-rules.md)
2. [工程基础要求](docs/engineering-foundation.md)
3. [项目目录结构规范](docs/project-structure.md)
4. [架构提案](docs/desktop-bot-assistant-architecture.md)
5. [ADR 0001：Electron + TypeScript + Vue/Vite](docs/adr/0001-electron-typescript-vue.md)

根目录 [AGENTS.md](AGENTS.md) 是给 AI coding agent 的入口规则。

换电脑或新工作区继续开发时，先看 [开发交接文档](docs/development-handoff.md)。

## 当前模块

- `apps/desktop`：Electron 桌面壳，包含 main、preload、renderer 三层隔离。
- `packages/contracts`：跨模块事件、IPC、配置、错误和日志 schema。
- `packages/core`：runtime orchestrator，负责统一状态和事件转发。
- `packages/douyu`：斗鱼协议、TCP 采集、心跳、重连和弹幕/礼物事件归一化，不调用 AI/TTS/UI。
- `packages/storage`：SQLite 连接、migration 和 events repository，负责后续事件入库。
- 斗鱼采集 UI：桌面控制台通过 preload IPC 启动/停止默认房间采集并显示事件流。
- `packages/app-config`：运行时配置和用户数据目录解析。
- `packages/logging`：结构化日志和脱敏。

## 基础要求

后续实现必须遵守工程规范，核心原则：

- TypeScript strict。
- Electron 安全边界：renderer 不直接访问 Node、密钥、数据库和 socket。
- IPC、配置、外部 API 响应必须做 schema 校验。
- 斗鱼、AI、TTS、音频播放必须是独立模块，通过 typed event/command 串联。
- 根 `config/` 只放工程配置；包内 `config/` 只放随代码发布的包级默认定义；用户运行时配置只进用户数据目录。
- 默认测试房间号为 `9999`，真实用户房间配置后续进入用户数据目录/profile。
- 每条事件链路必须有 `traceId`，日志默认脱敏。
- 打包发布前必须通过 typecheck、lint、test 和 smoke test。

## 常用命令

```powershell
pnpm dev
pnpm check
pnpm test
pnpm smoke
pnpm build
```
