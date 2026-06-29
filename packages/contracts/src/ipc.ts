import type { BotEvent, HealthSnapshot } from "./events";

export const IpcChannel = {
  BotGetHealth: "bot:get-health",
  BotStart: "bot:start",
  BotStop: "bot:stop",
  BotEvent: "bot:event",
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export interface DybotDesktopApi {
  bot: {
    getHealth(): Promise<HealthSnapshot>;
    start(): Promise<HealthSnapshot>;
    stop(): Promise<HealthSnapshot>;
    onEvent(listener: (event: BotEvent) => void): () => void;
  };
}
