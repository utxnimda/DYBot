# @dybot/douyu

斗鱼采集包只负责斗鱼弹幕和礼物输入侧能力：协议编解码、TCP 连接、登录、入组、心跳、断线重连、消息解析和标准事件归一化。

边界要求：

- 不调用 AI、TTS、音频播放或 UI。
- 不读取 renderer 状态或用户密钥。
- 所有外部输入先经过 STT/packet 解析和 schema/normalizer 处理。
- 只向外输出 `@dybot/contracts` 定义的 `douyu.*` 事件。

默认测试配置由 `packages/app-config` 提供，斗鱼默认测试房间号是 `9999`。自动化测试默认使用 fixture/mock，不连接真实斗鱼房间。
