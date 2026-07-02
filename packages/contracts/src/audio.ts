import { z } from "zod";
import { DouyuRoomIdSchema } from "./douyu";
import { BotErrorSchema } from "./errors";
import { VoiceAudioAssetSchema } from "./voice";

const EventIdLikeSchema = z.string().regex(/^evt_/);
const TaskIdLikeSchema = z.string().regex(/^task_/);

export const AudioOutputDeviceSelectionSchema = z.object({
  outputDeviceId: z.string().min(1).default("mock-default-output"),
});
export type AudioOutputDeviceSelection = z.infer<typeof AudioOutputDeviceSelectionSchema>;

export const AudioPlaybackRequestSchema = z.object({
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  sourceEventId: EventIdLikeSchema,
  sourceTaskId: TaskIdLikeSchema,
  sourceType: z.literal("voice.synthesis.generated"),
  audio: VoiceAudioAssetSchema,
  output: AudioOutputDeviceSelectionSchema.default({}),
});
export type AudioPlaybackRequest = z.infer<typeof AudioPlaybackRequestSchema>;

export const AudioPlaybackResultSchema = z.object({
  traceId: z.string().min(1),
  playerId: z.string().min(1),
  outputDeviceId: z.string().min(1),
  audio: VoiceAudioAssetSchema,
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().nonnegative(),
  playbackDurationMs: z.number().int().nonnegative(),
});
export type AudioPlaybackResult = z.infer<typeof AudioPlaybackResultSchema>;

export const AudioPlaybackTaskStatusSchema = z.enum([
  "queued",
  "playing",
  "done",
  "failed",
  "skipped",
]);
export type AudioPlaybackTaskStatus = z.infer<typeof AudioPlaybackTaskStatusSchema>;

export const AudioPlaybackTaskSchema = z.object({
  taskId: TaskIdLikeSchema,
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  sourceEventId: EventIdLikeSchema,
  sourceTaskId: TaskIdLikeSchema,
  sourceType: z.literal("voice.synthesis.generated"),
  status: AudioPlaybackTaskStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type AudioPlaybackTask = z.infer<typeof AudioPlaybackTaskSchema>;

export const AudioPlaybackSkippedReasonSchema = z.enum([
  "queue_full",
  "runtime_stopped",
  "audio_unavailable",
]);
export type AudioPlaybackSkippedReason = z.infer<typeof AudioPlaybackSkippedReasonSchema>;

export const AudioPlaybackStartedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AudioPlaybackTaskSchema.extend({
    status: z.literal("playing"),
  }),
  audio: VoiceAudioAssetSchema,
  outputDeviceId: z.string().min(1),
});
export type AudioPlaybackStartedPayload = z.infer<typeof AudioPlaybackStartedPayloadSchema>;

export const AudioPlaybackFinishedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AudioPlaybackTaskSchema.extend({
    status: z.literal("done"),
  }),
  result: AudioPlaybackResultSchema,
});
export type AudioPlaybackFinishedPayload = z.infer<typeof AudioPlaybackFinishedPayloadSchema>;

export const AudioPlaybackFailedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AudioPlaybackTaskSchema.extend({
    status: z.literal("failed"),
  }),
  error: BotErrorSchema,
});
export type AudioPlaybackFailedPayload = z.infer<typeof AudioPlaybackFailedPayloadSchema>;

export const AudioPlaybackSkippedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AudioPlaybackTaskSchema.extend({
    status: z.literal("skipped"),
  }),
  reason: AudioPlaybackSkippedReasonSchema,
});
export type AudioPlaybackSkippedPayload = z.infer<typeof AudioPlaybackSkippedPayloadSchema>;

export const AudioPlaybackStartedEventSchema = z.object({
  type: z.literal("audio.playback.started"),
  traceId: z.string().min(1),
  payload: AudioPlaybackStartedPayloadSchema,
});
export type AudioPlaybackStartedEvent = z.infer<typeof AudioPlaybackStartedEventSchema>;

export const AudioPlaybackFinishedEventSchema = z.object({
  type: z.literal("audio.playback.finished"),
  traceId: z.string().min(1),
  payload: AudioPlaybackFinishedPayloadSchema,
});
export type AudioPlaybackFinishedEvent = z.infer<typeof AudioPlaybackFinishedEventSchema>;

export const AudioPlaybackFailedEventSchema = z.object({
  type: z.literal("audio.playback.failed"),
  traceId: z.string().min(1),
  payload: AudioPlaybackFailedPayloadSchema,
});
export type AudioPlaybackFailedEvent = z.infer<typeof AudioPlaybackFailedEventSchema>;

export const AudioPlaybackSkippedEventSchema = z.object({
  type: z.literal("audio.playback.skipped"),
  traceId: z.string().min(1),
  payload: AudioPlaybackSkippedPayloadSchema,
});
export type AudioPlaybackSkippedEvent = z.infer<typeof AudioPlaybackSkippedEventSchema>;

export type AudioEvent =
  | AudioPlaybackStartedEvent
  | AudioPlaybackFinishedEvent
  | AudioPlaybackFailedEvent
  | AudioPlaybackSkippedEvent;
