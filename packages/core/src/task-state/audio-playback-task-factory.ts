import {
  AudioPlaybackFailedEventSchema,
  AudioPlaybackFinishedEventSchema,
  AudioPlaybackSkippedEventSchema,
  AudioPlaybackStartedEventSchema,
  createBotError,
  createEventId,
  createTaskId,
  type AudioPlaybackFailedEvent,
  type AudioPlaybackFinishedEvent,
  type AudioPlaybackResult,
  type AudioPlaybackSkippedEvent,
  type AudioPlaybackSkippedReason,
  type AudioPlaybackStartedEvent,
  type AudioPlaybackTask,
  type BotErrorCode,
  type TraceId,
  type VoiceSynthesisGeneratedEvent,
} from "@dybot/contracts";

export class AudioPlaybackTaskFactory {
  createBaseTask(
    source: VoiceSynthesisGeneratedEvent,
    now: number,
  ): Omit<AudioPlaybackTask, "status" | "updatedAt"> {
    return {
      taskId: createTaskId(),
      traceId: source.traceId,
      roomId: source.payload.task.roomId,
      sourceEventId: source.payload.eventId,
      sourceTaskId: source.payload.task.taskId,
      sourceType: "voice.synthesis.generated",
      createdAt: now,
    };
  }

  createStartedEvent(input: {
    readonly task: Omit<AudioPlaybackTask, "status" | "updatedAt">;
    readonly source: VoiceSynthesisGeneratedEvent;
    readonly outputDeviceId: string;
    readonly updatedAt: number;
  }): AudioPlaybackStartedEvent {
    return AudioPlaybackStartedEventSchema.parse({
      type: "audio.playback.started",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "playing",
          updatedAt: input.updatedAt,
        },
        audio: input.source.payload.result.audio,
        outputDeviceId: input.outputDeviceId,
      },
    });
  }

  createFinishedEvent(input: {
    readonly task: Omit<AudioPlaybackTask, "status" | "updatedAt">;
    readonly result: AudioPlaybackResult;
    readonly updatedAt: number;
  }): AudioPlaybackFinishedEvent {
    return AudioPlaybackFinishedEventSchema.parse({
      type: "audio.playback.finished",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "done",
          updatedAt: input.updatedAt,
        },
        result: input.result,
      },
    });
  }

  createFailedEvent(input: {
    readonly task: Omit<AudioPlaybackTask, "status" | "updatedAt">;
    readonly error: unknown;
    readonly updatedAt: number;
    readonly code?: BotErrorCode;
  }): AudioPlaybackFailedEvent {
    return AudioPlaybackFailedEventSchema.parse({
      type: "audio.playback.failed",
      traceId: input.task.traceId,
      payload: {
        eventId: createEventId(),
        task: {
          ...input.task,
          status: "failed",
          updatedAt: input.updatedAt,
        },
        error: createBotError({
          code: input.code ?? "AUDIO_DEVICE_UNAVAILABLE",
          message: getErrorMessage(input.error),
          recoverable: true,
          traceId: input.task.traceId as TraceId,
        }),
      },
    });
  }

  createSkippedEvent(input: {
    readonly task: Omit<AudioPlaybackTask, "status" | "updatedAt">;
    readonly reason: AudioPlaybackSkippedReason;
    readonly updatedAt: number;
  }): AudioPlaybackSkippedEvent {
    return AudioPlaybackSkippedEventSchema.parse({
      type: "audio.playback.skipped",
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
