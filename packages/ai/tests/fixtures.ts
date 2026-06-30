import {
  AiReplyRequestSchema,
  createEventId,
  createTraceId,
  type AiReplyRequest,
  type DouyuDanmakuEvent,
} from "@dybot/contracts";

export interface CreateAiReplyRequestOptions {
  readonly text?: string;
  readonly nickname?: string;
  readonly systemPrompt?: string;
  readonly maxOutputChars?: number;
}

export function createAiReplyRequest(options: CreateAiReplyRequestOptions = {}): AiReplyRequest {
  return AiReplyRequestSchema.parse({
    traceId: createTraceId(),
    roomId: "9999",
    trigger: createDanmakuEvent({
      text: options.text ?? "hello bot",
      nickname: options.nickname ?? "tester",
    }),
    persona: {
      botName: "DYBot",
      systemPrompt: options.systemPrompt ?? "Reply like a concise livestream assistant.",
    },
    recentDanmaku: [
      createDanmakuEvent({
        eventId: "evt_recent_danmaku",
        receivedAt: 1_782_800_000_000,
        text: "recent context",
        nickname: "viewer",
      }),
    ],
    maxOutputChars: options.maxOutputChars ?? 80,
  });
}

function createDanmakuEvent(input: {
  readonly text: string;
  readonly nickname: string;
  readonly eventId?: string;
  readonly receivedAt?: number;
}): DouyuDanmakuEvent {
  return {
    type: "douyu.danmaku",
    traceId: createTraceId(),
    payload: {
      eventId: input.eventId ?? createEventId(),
      receivedAt: input.receivedAt ?? 1_782_800_000_100,
      roomId: "9999",
      rawType: "chatmsg",
      raw: {
        type: "chatmsg",
        txt: input.text,
      },
      text: input.text,
      user: {
        userId: "user_1",
        nickname: input.nickname,
      },
    },
  };
}
