import type { z } from "zod";
import { DouyuRoomCaptureConfigSchema } from "./douyu";
import type { BotEvent, HealthSnapshot } from "./events";

export const IpcChannel = {
  BotGetHealth: "bot:get-health",
  BotStart: "bot:start",
  BotStop: "bot:stop",
  BotEvent: "bot:event",
  DouyuGetDefaultRoom: "bot:douyu:get-default-room",
  DouyuStart: "bot:douyu:start",
  DouyuStop: "bot:douyu:stop",
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export const DouyuStartCaptureRequestSchema = DouyuRoomCaptureConfigSchema;
export type DouyuStartCaptureRequest = z.infer<typeof DouyuStartCaptureRequestSchema>;

export interface DybotDesktopApi {
  bot: {
    getHealth(): Promise<HealthSnapshot>;
    start(): Promise<HealthSnapshot>;
    stop(): Promise<HealthSnapshot>;
    douyu: {
      getDefaultRoom(): Promise<DouyuStartCaptureRequest>;
      start(input: DouyuStartCaptureRequest): Promise<HealthSnapshot>;
      stop(): Promise<HealthSnapshot>;
    };
    onEvent(listener: (event: BotEvent) => void): () => void;
  };
}
