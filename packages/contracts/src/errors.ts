import { z } from "zod";
import type { TraceId } from "./ids";

export const BotErrorCodeSchema = z.enum([
  "DOUYU_CONNECT_FAILED",
  "DOUYU_PROTOCOL_ERROR",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_RATE_LIMITED",
  "TTS_PROVIDER_UNAVAILABLE",
  "AUDIO_DEVICE_UNAVAILABLE",
  "CONFIG_INVALID",
  "STORAGE_ERROR",
  "IPC_INVALID_PAYLOAD",
  "RUNTIME_ERROR",
]);

export type BotErrorCode = z.infer<typeof BotErrorCodeSchema>;

export const BotErrorSchema = z.object({
  code: BotErrorCodeSchema,
  message: z.string().min(1),
  recoverable: z.boolean(),
  traceId: z.string().optional(),
  detail: z.string().optional(),
});

export type BotError = z.infer<typeof BotErrorSchema>;

export function createBotError(input: {
  code: BotErrorCode;
  message: string;
  recoverable?: boolean;
  traceId?: TraceId;
  detail?: string;
}): BotError {
  return {
    code: input.code,
    message: input.message,
    recoverable: input.recoverable ?? true,
    traceId: input.traceId,
    detail: input.detail,
  };
}
