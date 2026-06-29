# ADR 0001: 使用 TypeScript + Electron + Vue/Vite 作为桌面主线

## 状态

已接受。

## 背景

桌面机器人助手需要把以下能力串成一个本地独立程序：

- 动态捕捉斗鱼弹幕和礼物。
- 结合上下文调用 AI 生成回复。
- 将回复文字转成语音。
- 播放到用户选择的音频输出设备。
- 提供配置、日志、状态、队列、调试和发布能力。

参考项目 `E:\Workspace\Fun\Dyd2` 已有大量可复用设计：

- Node 服务实现斗鱼弹幕采集。
- Node 服务实现 AI gateway。
- Node 服务实现 voice clone/TTS gateway。
- Vue/Vite 实现控制面板。
- 脚本实现 feature flag、开发多服务、打包和发布。

因此第一阶段的主要风险不是桌面 UI 技术，而是工程化地复用这些能力并形成稳定本地 runtime。

## 决策

第一版主线使用：

- TypeScript。
- Electron。
- Vue 3。
- Vite。
- Node.js runtime。
- SQLite 本地存储。
- electron-builder 打包。

## 原因

选择 Electron：

- Electron 是成熟的独立桌面应用方案，不要求 UI 依赖远程 Web 页面。
- Chromium 和 Node.js 随程序一起打包，适合本地控制台、长连接、文件、数据库、托盘和后台任务。
- 可以最大化复用 `Dyd2` 的 TypeScript/Node/Vue 思路。
- Windows 打包、portable、安装包、自动更新生态成熟。
- 初期能最快完成“弹幕 -> AI -> TTS -> 播放”的闭环。

选择 Vue/Vite：

- 与 `Dyd2` 保持一致。
- 控制台 UI 开发效率高。
- Vite 构建快，开发体验稳定。

选择 TypeScript：

- 项目有较多跨模块 contract、IPC、配置、外部 API 响应和状态机。
- 严格类型能降低长期维护成本。

## 被比较方案

### Tauri 2 + Rust

优点：

- 包体小。
- 权限边界更清晰。
- Rust 适合长期后台 runtime、音频设备、协议解析。

未选原因：

- 第一阶段会显著降低 `Dyd2` Node 代码复用效率。
- 斗鱼协议、AI/TTS adapter、音频链路都要更多迁移。
- 当前更需要先跑通业务闭环。

后续可能：

- 如果 Electron 版本稳定后发现包体、内存、安全边界成为主要问题，可评估把 runtime 迁移到 Tauri/Rust。

### C#/.NET 8 + WPF/WinUI

优点：

- Windows 原生体验好。
- 音频设备、托盘、自启动和安装包成熟。

未选原因：

- 与 `Dyd2` 技术栈差异大，复用成本低。
- 需要重写斗鱼采集、AI、TTS 和 UI。
- 当前项目没有明确要求 Windows-only。

### Python + PySide6

优点：

- AI/语音实验快。
- 原型成本低。

未选原因：

- 长期发布、依赖稳定、自动更新和桌面产品体验不如 Electron/Tauri/.NET。
- 更适合作为局部 AI/音频实验，不适合作为主工程基础。

## 约束

Electron 并不意味着做远程网页。

必须遵守：

- 主 UI 只加载本地构建产物。
- 禁止把远程页面作为主应用。
- renderer 不能直接使用 Node API。
- 密钥只在 main/runtime/config/secret 层处理。
- IPC 必须有 schema 校验。
- 遵守 `docs/engineering-foundation.md` 中的 Electron 安全要求。

## 后果

正面：

- 首版交付速度快。
- 可复用 `Dyd2` 的模块设计和部分代码。
- 工具链统一在 TypeScript 生态。
- 更容易做本地开发、调试、打包和发布。

代价：

- 安装包和运行内存比 Tauri/.NET 更大。
- Electron 安全配置必须严格执行。
- 需要明确主进程、preload、renderer、runtime 的边界。

## 复审条件

满足任一条件时重新评估：

- Electron 包体或内存无法接受。
- 需要强系统级音频能力，Node/Electron 难以稳定实现。
- 需要 macOS/Linux 小包体分发。
- 安全模型要求无法用 Electron 满足。
- runtime 中 Rust/C# 模块占比超过 TypeScript。
