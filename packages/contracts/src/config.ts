import { z } from "zod";
import { DouyuRoomCaptureConfigSchema } from "./douyu";
import { LogLevelSchema } from "./logging";

export const DEFAULT_DOUYU_TEST_ROOM_ID = "9999";

export const BotFeatureFlagsSchema = z.object({
  douyuCapture: z.boolean(),
  aiReply: z.boolean(),
  voiceSynthesis: z.boolean(),
  audioPlayback: z.boolean(),
});

export type BotFeatureFlags = z.infer<typeof BotFeatureFlagsSchema>;

export const BotDouyuConfigSchema = z.object({
  defaultRoom: DouyuRoomCaptureConfigSchema.default({ roomId: DEFAULT_DOUYU_TEST_ROOM_ID }),
});

export type BotDouyuConfig = z.infer<typeof BotDouyuConfigSchema>;

export const BotAppConfigSchema = z.object({
  appName: z.literal("DYBot"),
  locale: z.enum(["zh-CN", "en-US"]),
  logLevel: LogLevelSchema,
  defaultProfileId: z.string().optional(),
  features: BotFeatureFlagsSchema,
  douyu: BotDouyuConfigSchema,
});

export type BotAppConfig = z.infer<typeof BotAppConfigSchema>;
