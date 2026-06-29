import {
  BotAppConfigSchema,
  DEFAULT_DOUYU_TEST_ROOM_ID,
  type BotAppConfig,
} from "@dybot/contracts";

export const DEFAULT_APP_CONFIG: BotAppConfig = BotAppConfigSchema.parse({
  appName: "DYBot",
  locale: "zh-CN",
  logLevel: "info",
  features: {
    douyuCapture: false,
    aiReply: false,
    voiceSynthesis: false,
    audioPlayback: false,
  },
  douyu: {
    defaultRoom: {
      roomId: DEFAULT_DOUYU_TEST_ROOM_ID,
    },
  },
});
