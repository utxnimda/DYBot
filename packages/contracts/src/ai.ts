import { z } from "zod";
import { BotErrorSchema } from "./errors";
import { DouyuDanmakuEventSchema, DouyuRoomIdSchema } from "./douyu";

export const AiChatRoleSchema = z.enum(["system", "user", "assistant"]);
export type AiChatRole = z.infer<typeof AiChatRoleSchema>;

export const AiPromptMessageSchema = z.object({
  role: AiChatRoleSchema,
  content: z.string().min(1),
});
export type AiPromptMessage = z.infer<typeof AiPromptMessageSchema>;

export const AiPersonaConfigSchema = z.object({
  botName: z.string().min(1).default("DYBot"),
  systemPrompt: z
    .string()
    .min(1)
    .default("You are a concise livestream assistant. Reply briefly and safely."),
});
export type AiPersonaConfig = z.infer<typeof AiPersonaConfigSchema>;

export const AiReplyRequestSchema = z.object({
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  trigger: DouyuDanmakuEventSchema,
  persona: AiPersonaConfigSchema.default({}),
  recentDanmaku: z.array(DouyuDanmakuEventSchema).max(20).default([]),
  maxOutputChars: z.number().int().positive().max(240).default(80),
});
export type AiReplyRequest = z.infer<typeof AiReplyRequestSchema>;

export const AiPromptSchema = z.object({
  messages: z.array(AiPromptMessageSchema).min(2),
  maxOutputChars: z.number().int().positive().max(240),
});
export type AiPrompt = z.infer<typeof AiPromptSchema>;

export const AiReplyResultSchema = z.object({
  traceId: z.string().min(1),
  providerId: z.string().min(1),
  model: z.string().min(1),
  text: z.string().min(1),
  prompt: AiPromptSchema,
  latencyMs: z.number().nonnegative(),
  estimatedInputTokens: z.number().int().nonnegative(),
  estimatedOutputTokens: z.number().int().nonnegative(),
  finishReason: z.enum(["stop", "length", "filtered"]),
});
export type AiReplyResult = z.infer<typeof AiReplyResultSchema>;

const EventIdLikeSchema = z.string().regex(/^evt_/);
const TaskIdLikeSchema = z.string().regex(/^task_/);

export const AiPromptSummarySchema = z.object({
  hash: z.string().min(1),
  messageCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
});
export type AiPromptSummary = z.infer<typeof AiPromptSummarySchema>;

export const AiReplyEventResultSchema = AiReplyResultSchema.omit({
  prompt: true,
}).extend({
  promptSummary: AiPromptSummarySchema,
});
export type AiReplyEventResult = z.infer<typeof AiReplyEventResultSchema>;

export const AiReplyTaskStatusSchema = z.enum([
  "queued",
  "generating",
  "generated",
  "failed",
  "skipped",
]);
export type AiReplyTaskStatus = z.infer<typeof AiReplyTaskStatusSchema>;

export const AiReplyTaskSchema = z.object({
  taskId: TaskIdLikeSchema,
  traceId: z.string().min(1),
  roomId: DouyuRoomIdSchema,
  triggerEventId: EventIdLikeSchema,
  triggerType: z.literal("douyu.danmaku"),
  status: AiReplyTaskStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type AiReplyTask = z.infer<typeof AiReplyTaskSchema>;

export const AiReplySkippedReasonSchema = z.enum([
  "policy_not_matched",
  "global_cooldown",
  "user_cooldown",
  "queue_full",
  "runtime_stopped",
]);
export type AiReplySkippedReason = z.infer<typeof AiReplySkippedReasonSchema>;

export const AiReplyGeneratedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AiReplyTaskSchema.extend({
    status: z.literal("generated"),
  }),
  result: AiReplyEventResultSchema,
});
export type AiReplyGeneratedPayload = z.infer<typeof AiReplyGeneratedPayloadSchema>;

export const AiReplyFailedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AiReplyTaskSchema.extend({
    status: z.literal("failed"),
  }),
  error: BotErrorSchema,
});
export type AiReplyFailedPayload = z.infer<typeof AiReplyFailedPayloadSchema>;

export const AiReplySkippedPayloadSchema = z.object({
  eventId: EventIdLikeSchema,
  task: AiReplyTaskSchema.extend({
    status: z.literal("skipped"),
  }),
  reason: AiReplySkippedReasonSchema,
});
export type AiReplySkippedPayload = z.infer<typeof AiReplySkippedPayloadSchema>;

export const AiReplyGeneratedEventSchema = z.object({
  type: z.literal("ai.reply.generated"),
  traceId: z.string().min(1),
  payload: AiReplyGeneratedPayloadSchema,
});
export type AiReplyGeneratedEvent = z.infer<typeof AiReplyGeneratedEventSchema>;

export const AiReplyFailedEventSchema = z.object({
  type: z.literal("ai.reply.failed"),
  traceId: z.string().min(1),
  payload: AiReplyFailedPayloadSchema,
});
export type AiReplyFailedEvent = z.infer<typeof AiReplyFailedEventSchema>;

export const AiReplySkippedEventSchema = z.object({
  type: z.literal("ai.reply.skipped"),
  traceId: z.string().min(1),
  payload: AiReplySkippedPayloadSchema,
});
export type AiReplySkippedEvent = z.infer<typeof AiReplySkippedEventSchema>;

export type AiEvent = AiReplyGeneratedEvent | AiReplyFailedEvent | AiReplySkippedEvent;
