import { z } from "zod";

export const DouyuRoomIdSchema = z.string().regex(/^\d+$/);
export type DouyuRoomId = z.infer<typeof DouyuRoomIdSchema>;

export const DouyuRawMessageSchema = z.record(z.string());
export type DouyuRawMessage = z.infer<typeof DouyuRawMessageSchema>;

export const DouyuUserSchema = z.object({
  userId: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
  level: z.number().int().nonnegative().optional(),
  badgeName: z.string().min(1).optional(),
  badgeLevel: z.number().int().nonnegative().optional(),
});
export type DouyuUser = z.infer<typeof DouyuUserSchema>;

const DouyuBasePayloadSchema = z.object({
  eventId: z.string(),
  receivedAt: z.number().int().nonnegative(),
  roomId: DouyuRoomIdSchema,
  rawType: z.string().min(1),
  raw: DouyuRawMessageSchema,
});

export const DouyuDanmakuPayloadSchema = DouyuBasePayloadSchema.extend({
  messageId: z.string().min(1).optional(),
  text: z.string(),
  user: DouyuUserSchema,
});
export type DouyuDanmakuPayload = z.infer<typeof DouyuDanmakuPayloadSchema>;

export const DouyuGiftPayloadSchema = DouyuBasePayloadSchema.extend({
  giftId: z.string().min(1).optional(),
  giftName: z.string().min(1).optional(),
  count: z.number().int().positive(),
  totalCount: z.number().int().positive().optional(),
  coinType: z.string().min(1).optional(),
  coinAmount: z.number().nonnegative().optional(),
  user: DouyuUserSchema,
});
export type DouyuGiftPayload = z.infer<typeof DouyuGiftPayloadSchema>;

export const DouyuUserEnteredPayloadSchema = DouyuBasePayloadSchema.extend({
  user: DouyuUserSchema,
});
export type DouyuUserEnteredPayload = z.infer<typeof DouyuUserEnteredPayloadSchema>;

export const DouyuRoomStatusPayloadSchema = DouyuBasePayloadSchema.extend({
  status: z.enum(["connected", "login_ok", "joined_group", "heartbeat", "disconnected"]),
  message: z.string().optional(),
});
export type DouyuRoomStatusPayload = z.infer<typeof DouyuRoomStatusPayloadSchema>;

export const DouyuCaptureErrorPayloadSchema = DouyuBasePayloadSchema.extend({
  code: z.enum(["connect_failed", "protocol_error", "socket_error", "parse_error"]),
  message: z.string().min(1),
  recoverable: z.boolean(),
});
export type DouyuCaptureErrorPayload = z.infer<typeof DouyuCaptureErrorPayloadSchema>;

export const DouyuDanmakuEventSchema = z.object({
  type: z.literal("douyu.danmaku"),
  traceId: z.string(),
  payload: DouyuDanmakuPayloadSchema,
});

export const DouyuGiftEventSchema = z.object({
  type: z.literal("douyu.gift"),
  traceId: z.string(),
  payload: DouyuGiftPayloadSchema,
});

export const DouyuUserEnteredEventSchema = z.object({
  type: z.literal("douyu.user_entered"),
  traceId: z.string(),
  payload: DouyuUserEnteredPayloadSchema,
});

export const DouyuRoomStatusEventSchema = z.object({
  type: z.literal("douyu.room_status"),
  traceId: z.string(),
  payload: DouyuRoomStatusPayloadSchema,
});

export const DouyuCaptureErrorEventSchema = z.object({
  type: z.literal("douyu.capture_error"),
  traceId: z.string(),
  payload: DouyuCaptureErrorPayloadSchema,
});

export type DouyuDanmakuEvent = z.infer<typeof DouyuDanmakuEventSchema>;
export type DouyuGiftEvent = z.infer<typeof DouyuGiftEventSchema>;
export type DouyuUserEnteredEvent = z.infer<typeof DouyuUserEnteredEventSchema>;
export type DouyuRoomStatusEvent = z.infer<typeof DouyuRoomStatusEventSchema>;
export type DouyuCaptureErrorEvent = z.infer<typeof DouyuCaptureErrorEventSchema>;

export type DouyuEvent =
  | DouyuDanmakuEvent
  | DouyuGiftEvent
  | DouyuUserEnteredEvent
  | DouyuRoomStatusEvent
  | DouyuCaptureErrorEvent;

export const DouyuRoomCaptureConfigSchema = z.object({
  roomId: DouyuRoomIdSchema,
  host: z.string().min(1).default("danmuproxy.douyu.com"),
  port: z.number().int().positive().default(8601),
  groupId: z.string().min(1).default("-9999"),
  heartbeatIntervalMs: z.number().int().positive().default(45_000),
  reconnect: z
    .object({
      enabled: z.boolean().default(true),
      maxAttempts: z.number().int().nonnegative().default(10),
      initialDelayMs: z.number().int().positive().default(1_000),
      maxDelayMs: z.number().int().positive().default(30_000),
    })
    .default({}),
});

export type DouyuRoomCaptureConfig = z.infer<typeof DouyuRoomCaptureConfigSchema>;
