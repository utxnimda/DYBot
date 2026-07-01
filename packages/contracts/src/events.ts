import { z } from "zod";
import {
  AiReplyFailedEventSchema,
  AiReplyGeneratedEventSchema,
  AiReplySkippedEventSchema,
} from "./ai";
import {
  DouyuCaptureErrorEventSchema,
  DouyuDanmakuEventSchema,
  DouyuGiftEventSchema,
  DouyuRoomStatusEventSchema,
  DouyuUserEnteredEventSchema,
} from "./douyu";
import { BotErrorSchema } from "./errors";
import { LogEntrySchema } from "./logging";

export const RuntimeStatusSchema = z.enum([
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
]);
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;

export const HealthSnapshotSchema = z.object({
  status: RuntimeStatusSchema,
  startedAt: z.number().nullable(),
  updatedAt: z.number(),
  activeProfileId: z.string().nullable(),
  lastError: BotErrorSchema.nullable(),
});

export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>;

export const RuntimeStatusEventSchema = z.object({
  type: z.literal("runtime.status"),
  traceId: z.string(),
  payload: HealthSnapshotSchema,
});

export const LogEntryEventSchema = z.object({
  type: z.literal("log.entry"),
  traceId: z.string(),
  payload: LogEntrySchema,
});

export const BotEventSchema = z.discriminatedUnion("type", [
  RuntimeStatusEventSchema,
  LogEntryEventSchema,
  DouyuDanmakuEventSchema,
  DouyuGiftEventSchema,
  DouyuUserEnteredEventSchema,
  DouyuRoomStatusEventSchema,
  DouyuCaptureErrorEventSchema,
  AiReplyGeneratedEventSchema,
  AiReplyFailedEventSchema,
  AiReplySkippedEventSchema,
]);

export type RuntimeStatusEvent = z.infer<typeof RuntimeStatusEventSchema>;
export type LogEntryEvent = z.infer<typeof LogEntryEventSchema>;
export type BotEvent = z.infer<typeof BotEventSchema>;
