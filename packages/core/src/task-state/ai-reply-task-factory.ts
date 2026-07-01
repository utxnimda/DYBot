import {
  AiReplyFailedEventSchema,
  AiReplyGeneratedEventSchema,
  AiReplySkippedEventSchema,
  createBotError,
  createEventId,
  createTaskId,
  type AiPrompt,
  type AiReplyEventResult,
  type AiReplyFailedEvent,
  type AiReplyGeneratedEvent,
  type AiReplyResult,
  type AiReplySkippedEvent,
  type AiReplySkippedReason,
  type AiReplyTask,
  type BotErrorCode,
  type DouyuDanmakuEvent,
  type TraceId,
} from "@dybot/contracts";
import { createHash } from "node:crypto";

export class AiReplyTaskFactory {
  createBaseTask(
    trigger: DouyuDanmakuEvent,
    now: number,
  ): Omit<AiReplyTask, "status" | "updatedAt"> {
    return {
      taskId: createTaskId(),
      traceId: trigger.traceId,
      roomId: trigger.payload.roomId,
      triggerEventId: trigger.payload.eventId,
      triggerType: "douyu.danmaku",
      createdAt: now,
    };
  }

  createGeneratedEvent(input: {
    readonly task: Omit<AiReplyTask, "status" | "updatedAt">;
    readonly result: AiReplyResult;
    readonly updatedAt: number;
  }): AiReplyGeneratedEvent {
    return AiReplyGeneratedEventSchema.parse({
      type: "ai.reply.generated",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "generated",
          updatedAt: input.updatedAt,
        },
        result: toEventResult(input.result),
      },
    });
  }

  createFailedEvent(input: {
    readonly task: Omit<AiReplyTask, "status" | "updatedAt">;
    readonly error: unknown;
    readonly updatedAt: number;
    readonly code?: BotErrorCode;
  }): AiReplyFailedEvent {
    return AiReplyFailedEventSchema.parse({
      type: "ai.reply.failed",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "failed",
          updatedAt: input.updatedAt,
        },
        error: createBotError({
          code: input.code ?? "AI_PROVIDER_UNAVAILABLE",
          message: getErrorMessage(input.error),
          recoverable: true,
          traceId: input.task.traceId as TraceId,
        }),
      },
    });
  }

  createSkippedEvent(input: {
    readonly task: Omit<AiReplyTask, "status" | "updatedAt">;
    readonly reason: AiReplySkippedReason;
    readonly updatedAt: number;
  }): AiReplySkippedEvent {
    return AiReplySkippedEventSchema.parse({
      type: "ai.reply.skipped",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "skipped",
          updatedAt: input.updatedAt,
        },
        reason: input.reason,
      },
    });
  }
}

function toEventResult(result: AiReplyResult): AiReplyEventResult {
  return {
    traceId: result.traceId,
    providerId: result.providerId,
    model: result.model,
    text: result.text,
    latencyMs: result.latencyMs,
    estimatedInputTokens: result.estimatedInputTokens,
    estimatedOutputTokens: result.estimatedOutputTokens,
    finishReason: result.finishReason,
    promptSummary: summarizePrompt(result.prompt),
  };
}

function summarizePrompt(prompt: AiPrompt): AiReplyEventResult["promptSummary"] {
  const serialized = JSON.stringify(prompt.messages);
  return {
    hash: createHash("sha256").update(serialized).digest("hex"),
    messageCount: prompt.messages.length,
    characterCount: serialized.length,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
