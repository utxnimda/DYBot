import {
  VoiceSynthesisFailedEventSchema,
  VoiceSynthesisGeneratedEventSchema,
  VoiceSynthesisSkippedEventSchema,
  createBotError,
  createEventId,
  createTaskId,
  type AiReplyGeneratedEvent,
  type BotErrorCode,
  type TraceId,
  type VoiceSynthesisFailedEvent,
  type VoiceSynthesisGeneratedEvent,
  type VoiceSynthesisResult,
  type VoiceSynthesisSkippedEvent,
  type VoiceSynthesisSkippedReason,
  type VoiceSynthesisTask,
} from "@dybot/contracts";

export class VoiceSynthesisTaskFactory {
  createBaseTask(
    source: AiReplyGeneratedEvent,
    now: number,
  ): Omit<VoiceSynthesisTask, "status" | "updatedAt"> {
    return {
      taskId: createTaskId(),
      traceId: source.traceId,
      roomId: source.payload.task.roomId,
      sourceEventId: source.payload.eventId,
      sourceTaskId: source.payload.task.taskId,
      sourceType: "ai.reply.generated",
      createdAt: now,
    };
  }

  createGeneratedEvent(input: {
    readonly task: Omit<VoiceSynthesisTask, "status" | "updatedAt">;
    readonly result: VoiceSynthesisResult;
    readonly updatedAt: number;
  }): VoiceSynthesisGeneratedEvent {
    return VoiceSynthesisGeneratedEventSchema.parse({
      type: "voice.synthesis.generated",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "generated",
          updatedAt: input.updatedAt,
        },
        result: input.result,
      },
    });
  }

  createFailedEvent(input: {
    readonly task: Omit<VoiceSynthesisTask, "status" | "updatedAt">;
    readonly error: unknown;
    readonly updatedAt: number;
    readonly code?: BotErrorCode;
  }): VoiceSynthesisFailedEvent {
    return VoiceSynthesisFailedEventSchema.parse({
      type: "voice.synthesis.failed",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "failed",
          updatedAt: input.updatedAt,
        },
        error: createBotError({
          code: input.code ?? "TTS_PROVIDER_UNAVAILABLE",
          message: getErrorMessage(input.error),
          recoverable: true,
          traceId: input.task.traceId as TraceId,
        }),
      },
    });
  }

  createSkippedEvent(input: {
    readonly task: Omit<VoiceSynthesisTask, "status" | "updatedAt">;
    readonly reason: VoiceSynthesisSkippedReason;
    readonly updatedAt: number;
  }): VoiceSynthesisSkippedEvent {
    return VoiceSynthesisSkippedEventSchema.parse({
      type: "voice.synthesis.skipped",
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
