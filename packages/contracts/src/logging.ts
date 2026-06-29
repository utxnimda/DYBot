import { z } from "zod";

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const BotModuleIdSchema = z.enum([
  "runtime",
  "douyu",
  "ai",
  "voice",
  "audio",
  "storage",
  "app-config",
  "logging",
  "desktop-main",
  "desktop-preload",
  "desktop-renderer",
]);

export type BotModuleId = z.infer<typeof BotModuleIdSchema>;

export const LogEntrySchema = z.object({
  ts: z.string(),
  level: LogLevelSchema,
  module: BotModuleIdSchema,
  event: z.string().min(1),
  message: z.string().min(1),
  traceId: z.string().optional(),
  roomId: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  context: z.record(z.unknown()).optional(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;
