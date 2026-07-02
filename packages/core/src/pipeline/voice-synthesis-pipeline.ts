import {
  VoiceSelectionSchema,
  type AiReplyGeneratedEvent,
  type VoiceEvent,
  type VoiceOutputFormat,
  type VoiceSelection,
  type VoiceSynthesisSkippedReason,
} from "@dybot/contracts";
import type { VoiceProvider } from "@dybot/voice";
import type { Logger } from "@dybot/logging";
import { VoiceSynthesisTaskFactory } from "../task-state/voice-synthesis-task-factory";

interface PendingVoiceSynthesisTask {
  readonly source: AiReplyGeneratedEvent;
  readonly task: ReturnType<VoiceSynthesisTaskFactory["createBaseTask"]>;
}

export interface VoiceSynthesisPipelineOptions {
  readonly provider: VoiceProvider;
  readonly logger: Logger;
  readonly emitEvent: (event: VoiceEvent) => void;
  readonly voiceId?: string | undefined;
  readonly outputFormat?: VoiceOutputFormat | undefined;
  readonly maxConcurrency?: number | undefined;
  readonly maxQueueLength?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class VoiceSynthesisPipeline {
  readonly #provider: VoiceProvider;
  readonly #logger: Logger;
  readonly #emitEvent: (event: VoiceEvent) => void;
  readonly #voice: VoiceSelection;
  readonly #maxConcurrency: number;
  readonly #maxQueueLength: number;
  readonly #now: () => number;
  readonly #taskFactory = new VoiceSynthesisTaskFactory();
  readonly #queue: PendingVoiceSynthesisTask[] = [];
  readonly #activeControllers = new Set<AbortController>();
  #activeCount = 0;
  #stopped = false;

  constructor(options: VoiceSynthesisPipelineOptions) {
    this.#provider = options.provider;
    this.#logger = options.logger;
    this.#emitEvent = options.emitEvent;
    this.#voice = VoiceSelectionSchema.parse({
      voiceId: options.voiceId,
      outputFormat: options.outputFormat,
    });
    this.#maxConcurrency = sanitizePositiveInteger(options.maxConcurrency, 1);
    this.#maxQueueLength = sanitizePositiveInteger(options.maxQueueLength, 20);
    this.#now = options.now ?? Date.now;
  }

  reset(): void {
    this.#stopped = false;
  }

  stop(): void {
    this.#stopped = true;
    const queuedTasks = this.#queue.splice(0);
    for (const pendingTask of queuedTasks) {
      this.#emitSkipped(pendingTask.task, "runtime_stopped");
    }

    for (const controller of this.#activeControllers) {
      controller.abort();
    }
    this.#activeControllers.clear();
  }

  handleAiReplyGenerated(source: AiReplyGeneratedEvent): void {
    const task = this.#taskFactory.createBaseTask(source, this.#now());

    if (this.#stopped) {
      this.#emitSkipped(task, "runtime_stopped");
      return;
    }

    if (source.payload.result.text.trim().length === 0) {
      this.#emitSkipped(task, "empty_text");
      return;
    }

    if (this.#queue.length >= this.#maxQueueLength) {
      this.#emitSkipped(task, "queue_full");
      return;
    }

    this.#queue.push({ source, task });
    this.#drainQueue();
  }

  #drainQueue(): void {
    while (!this.#stopped && this.#activeCount < this.#maxConcurrency) {
      const pendingTask = this.#queue.shift();
      if (pendingTask === undefined) {
        return;
      }

      this.#activeCount += 1;
      void this.#runTask(pendingTask).finally(() => {
        this.#activeCount -= 1;
        this.#drainQueue();
      });
    }
  }

  async #runTask(pendingTask: PendingVoiceSynthesisTask): Promise<void> {
    const controller = new AbortController();
    this.#activeControllers.add(controller);

    try {
      const result = await this.#provider.synthesizeSpeech(
        {
          traceId: pendingTask.source.traceId,
          roomId: pendingTask.source.payload.task.roomId,
          sourceEventId: pendingTask.source.payload.eventId,
          sourceTaskId: pendingTask.source.payload.task.taskId,
          sourceType: "ai.reply.generated",
          text: pendingTask.source.payload.result.text,
          voice: this.#voice,
        },
        { signal: controller.signal },
      );

      if (this.#stopped || controller.signal.aborted) {
        this.#emitSkipped(pendingTask.task, "runtime_stopped");
        return;
      }

      const event = this.#taskFactory.createGeneratedEvent({
        task: pendingTask.task,
        result,
        updatedAt: this.#now(),
      });
      this.#logger.info("voice.synthesis.generated", "Voice synthesis generated", {
        traceId: event.traceId,
        roomId: event.payload.task.roomId,
        taskId: event.payload.task.taskId,
        providerId: event.payload.result.providerId,
        voiceId: event.payload.result.voiceId,
        durationMs: event.payload.result.audio.durationMs,
        latencyMs: event.payload.result.latencyMs,
      });
      this.#emitEvent(event);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        this.#emitSkipped(pendingTask.task, "runtime_stopped");
        return;
      }

      const event = this.#taskFactory.createFailedEvent({
        task: pendingTask.task,
        error,
        updatedAt: this.#now(),
      });
      this.#logger.warn("voice.synthesis.failed", "Voice synthesis failed", {
        traceId: event.traceId,
        roomId: event.payload.task.roomId,
        taskId: event.payload.task.taskId,
        error: event.payload.error.message,
      });
      this.#emitEvent(event);
    } finally {
      this.#activeControllers.delete(controller);
    }
  }

  #emitSkipped(
    task: ReturnType<VoiceSynthesisTaskFactory["createBaseTask"]>,
    reason: VoiceSynthesisSkippedReason,
  ): void {
    const event = this.#taskFactory.createSkippedEvent({
      task,
      reason,
      updatedAt: this.#now(),
    });
    this.#emitEvent(event);
  }
}

function sanitizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}
