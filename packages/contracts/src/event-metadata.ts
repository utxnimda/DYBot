import { BotEventSchema, type BotEvent } from "./events";

export interface BotEventMetadata {
  readonly stableId: string;
  readonly sourceEventId: string | null;
  readonly eventType: BotEvent["type"];
  readonly traceId: string;
  readonly roomId: string | null;
  readonly occurredAt: number;
}

export function getBotEventMetadata(input: BotEvent): BotEventMetadata {
  const event = BotEventSchema.parse(input);

  switch (event.type) {
    case "douyu.danmaku":
    case "douyu.gift":
    case "douyu.user_entered":
    case "douyu.room_status":
    case "douyu.capture_error":
      return {
        stableId: event.payload.eventId,
        sourceEventId: event.payload.eventId,
        eventType: event.type,
        traceId: event.traceId,
        roomId: event.payload.roomId,
        occurredAt: event.payload.receivedAt,
      };
    case "ai.reply.generated":
    case "ai.reply.failed":
    case "ai.reply.skipped":
      return {
        stableId: event.payload.eventId,
        sourceEventId: event.payload.eventId,
        eventType: event.type,
        traceId: event.traceId,
        roomId: event.payload.task.roomId,
        occurredAt: event.payload.task.updatedAt,
      };
    case "runtime.status":
      return {
        stableId: `${event.type}:${event.traceId}`,
        sourceEventId: null,
        eventType: event.type,
        traceId: event.traceId,
        roomId: null,
        occurredAt: event.payload.updatedAt,
      };
    case "log.entry": {
      const parsedTime = Date.parse(event.payload.ts);
      return {
        stableId: `${event.type}:${event.traceId}`,
        sourceEventId: null,
        eventType: event.type,
        traceId: event.traceId,
        roomId: event.payload.roomId ?? null,
        occurredAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
      };
    }
  }
}
