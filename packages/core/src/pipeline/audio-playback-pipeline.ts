import {
  AudioOutputDeviceSelectionSchema,
  type AudioEvent,
  type AudioOutputDeviceSelection,
  type AudioPlaybackSkippedReason,
  type VoiceSynthesisGeneratedEvent,
} from "@dybot/contracts";
import type { AudioPlayer } from "@dybot/audio";
import type { Logger } from "@dybot/logging";
import { AudioPlaybackTaskFactory } from "../task-state/audio-playback-task-factory";

interface PendingAudioPlaybackTask {
  readonly source: VoiceSynthesisGeneratedEvent;
  readonly task: ReturnType<AudioPlaybackTaskFactory["createBaseTask"]>;
}

export interface AudioPlaybackPipelineOptions {
  readonly player: AudioPlayer;
  readonly logger: Logger;
  readonly emitEvent: (event: AudioEvent) => void;
  readonly outputDeviceId?: string | undefined;
  readonly maxConcurrency?: number | undefined;
  readonly maxQueueLength?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class AudioPlaybackPipeline {
  readonly #player: AudioPlayer;
  readonly #logger: Logger;
  readonly #emitEvent: (event: AudioEvent) => void;
  readonly #output: AudioOutputDeviceSelection;
  readonly #maxConcurrency: number;
  readonly #maxQueueLength: number;
  readonly #now: () => number;
  readonly #taskFactory = new AudioPlaybackTaskFactory();
  readonly #queue: PendingAudioPlaybackTask[] = [];
  readonly #activeControllers = new Set<AbortController>();
  #activeCount = 0;
  #stopped = false;

  constructor(options: AudioPlaybackPipelineOptions) {
    this.#player = options.player;
    this.#logger = options.logger;
    this.#emitEvent = options.emitEvent;
    this.#output = AudioOutputDeviceSelectionSchema.parse({
      outputDeviceId: options.outputDeviceId,
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

  handleVoiceSynthesisGenerated(source: VoiceSynthesisGeneratedEvent): void {
    const task = this.#taskFactory.createBaseTask(source, this.#now());

    if (this.#stopped) {
      this.#emitSkipped(task, "runtime_stopped");
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

  async #runTask(pendingTask: PendingAudioPlaybackTask): Promise<void> {
    const controller = new AbortController();
    this.#activeControllers.add(controller);

    try {
      const startedEvent = this.#taskFactory.createStartedEvent({
        task: pendingTask.task,
        source: pendingTask.source,
        outputDeviceId: this.#output.outputDeviceId,
        updatedAt: this.#now(),
      });
      this.#emitEvent(startedEvent);

      const result = await this.#player.playAudio(
        {
          traceId: pendingTask.source.traceId,
          roomId: pendingTask.source.payload.task.roomId,
          sourceEventId: pendingTask.source.payload.eventId,
          sourceTaskId: pendingTask.source.payload.task.taskId,
          sourceType: "voice.synthesis.generated",
          audio: pendingTask.source.payload.result.audio,
          output: this.#output,
        },
        { signal: controller.signal },
      );

      if (this.#stopped || controller.signal.aborted) {
        this.#emitSkipped(pendingTask.task, "runtime_stopped");
        return;
      }

      const finishedEvent = this.#taskFactory.createFinishedEvent({
        task: pendingTask.task,
        result,
        updatedAt: this.#now(),
      });
      this.#logger.info("audio.playback.finished", "Audio playback finished", {
        traceId: finishedEvent.traceId,
        roomId: finishedEvent.payload.task.roomId,
        taskId: finishedEvent.payload.task.taskId,
        playerId: finishedEvent.payload.result.playerId,
        outputDeviceId: finishedEvent.payload.result.outputDeviceId,
        playbackDurationMs: finishedEvent.payload.result.playbackDurationMs,
      });
      this.#emitEvent(finishedEvent);
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
      this.#logger.warn("audio.playback.failed", "Audio playback failed", {
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
    task: ReturnType<AudioPlaybackTaskFactory["createBaseTask"]>,
    reason: AudioPlaybackSkippedReason,
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
