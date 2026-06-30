import { z } from "zod";
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
