import { z } from "zod";
import { DouyuRoomIdSchema } from "./douyu";
import { BotErrorSchema } from "./errors";

const EventIdLikeSchema = z.string().regex(/^evt_/);
const TaskIdLikeSchema = z.string().regex(/^task_/);
const AudioAssetIdLikeSchema = z.string().regex(/^asset_/);

export const VoiceOutputFormatSchema = z.enum(["wav", "mp3", "ogg"]);
export type VoiceOutputFormat = z.infer<typeof VoiceOutputFormatSchema>;

export const VoiceSelectionSchema = z.object({
  voiceId: z.string().min(1).default("mock-default"),
  outputFormat: VoiceOutputFormatSchema.default("wav"),
});
export type VoiceSelection = z.infer<typeof VoiceSelectionSchema>;

export const VoiceSynthesisRequestSchema = z.object({
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  sourceEventId: EventIdLikeSchema,
  sourceTaskId: TaskIdLikeSchema,
  sourceType: z.literal("ai.reply.generated"),
  text: z.string().min(1).max(240),
  voice: VoiceSelectionSchema.default({}),
});
export type VoiceSynthesisRequest = z.infer<typeof VoiceSynthesisRequestSchema>;

export const VoiceAudioAssetSchema = z.object({
  assetId: AudioAssetIdLikeSchema,
  cacheKey: z.string().min(1),
  mimeType: z.string().min(1),
  byteLength: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  source: z.enum(["mock", "generated", "cache"]),
});
export type VoiceAudioAsset = z.infer<typeof VoiceAudioAssetSchema>;

export const VoiceSynthesisResultSchema = z.object({
  traceId: z.string().min(1),
  providerId: z.string().min(1),
  voiceId: z.string().min(1),
  text: z.string().min(1).max(240),
  outputFormat: VoiceOutputFormatSchema,
  audio: VoiceAudioAssetSchema,
  latencyMs: z.number().nonnegative(),
  characterCount: z.number().int().nonnegative(),
});
export type VoiceSynthesisResult = z.infer<typeof VoiceSynthesisResultSchema>;

export const VoiceSynthesisTaskStatusSchema = z.enum([
  "queued",
  "synthesizing",
  "generated",
  "failed",
  "skipped",
]);
export type VoiceSynthesisTaskStatus = z.infer<typeof VoiceSynthesisTaskStatusSchema>;

export const VoiceSynthesisTaskSchema = z.object({
  taskId: TaskIdLikeSchema,
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  sourceEventId: EventIdLikeSchema,
  sourceTaskId: TaskIdLikeSchema,
  sourceType: z.literal("ai.reply.generated"),
  status: VoiceSynthesisTaskStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type VoiceSynthesisTask = z.infer<typeof VoiceSynthesisTaskSchema>;

export const VoiceSynthesisSkippedReasonSchema = z.enum([
  "empty_text",
  "queue_full",
  "runtime_stopped",
]);
export type VoiceSynthesisSkippedReason = z.infer<typeof VoiceSynthesisSkippedReasonSchema>;

export const VoiceSynthesisGeneratedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: VoiceSynthesisTaskSchema.extend({
    status: z.literal("generated"),
  }),
  result: VoiceSynthesisResultSchema,
});
export type VoiceSynthesisGeneratedPayload = z.infer<typeof VoiceSynthesisGeneratedPayloadSchema>;

export const VoiceSynthesisFailedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: VoiceSynthesisTaskSchema.extend({
    status: z.literal("failed"),
  }),
  error: BotErrorSchema,
});
export type VoiceSynthesisFailedPayload = z.infer<typeof VoiceSynthesisFailedPayloadSchema>;

export const VoiceSynthesisSkippedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: VoiceSynthesisTaskSchema.extend({
    status: z.literal("skipped"),
  }),
  reason: VoiceSynthesisSkippedReasonSchema,
});
export type VoiceSynthesisSkippedPayload = z.infer<typeof VoiceSynthesisSkippedPayloadSchema>;

export const VoiceSynthesisGeneratedEventSchema = z.object({
  type: z.literal("voice.synthesis.generated"),
  traceId: z.string().min(1),
  payload: VoiceSynthesisGeneratedPayloadSchema,
});
export type VoiceSynthesisGeneratedEvent = z.infer<typeof VoiceSynthesisGeneratedEventSchema>;

export const VoiceSynthesisFailedEventSchema = z.object({
  type: z.literal("voice.synthesis.failed"),
  traceId: z.string().min(1),
  payload: VoiceSynthesisFailedPayloadSchema,
});
export type VoiceSynthesisFailedEvent = z.infer<typeof VoiceSynthesisFailedEventSchema>;

export const VoiceSynthesisSkippedEventSchema = z.object({
  type: z.literal("voice.synthesis.skipped"),
  traceId: z.string().min(1),
  payload: VoiceSynthesisSkippedPayloadSchema,
});
export type VoiceSynthesisSkippedEvent = z.infer<typeof VoiceSynthesisSkippedEventSchema>;

export type VoiceEvent =
  VoiceSynthesisGeneratedEvent | VoiceSynthesisFailedEvent | VoiceSynthesisSkippedEvent;
