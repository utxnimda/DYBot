import {
  AiPersonaConfigSchema,
  type AiEvent,
  type AiPersonaConfig,
  type AiReplySkippedReason,
  type DouyuDanmakuEvent,
} from "@dybot/contracts";
import type { AiProvider } from "@dybot/ai";
import type { Logger } from "@dybot/logging";
import { DanmakuContextWindow } from "../context-memory/danmaku-context-window";
import { AiReplyTaskFactory } from "../task-state/ai-reply-task-factory";
import {
  createDefaultAiReplyTriggerPolicy,
  type AiReplyTriggerPolicy,
  type AiReplyTriggerSkipReason,
} from "../trigger-policy/ai-reply-trigger-policy";

interface PendingAiReplyTask {
  readonly trigger: DouyuDanmakuEvent;
  readonly recentDanmaku: readonly DouyuDanmakuEvent[];
  readonly task: ReturnType<AiReplyTaskFactory["createBaseTask"]>;
}

export interface AiReplyPipelineOptions {
  readonly provider: AiProvider;
  readonly logger: Logger;
  readonly emitEvent: (event: AiEvent) => void;
  readonly policy?: AiReplyTriggerPolicy | undefined;
  readonly persona?: AiPersonaConfig | undefined;
  readonly maxOutputChars?: number | undefined;
  readonly recentDanmakuLimit?: number | undefined;
  readonly maxConcurrency?: number | undefined;
  readonly maxQueueLength?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class AiReplyPipeline {
  readonly #provider: AiProvider;
  readonly #logger: Logger;
  readonly #emitEvent: (event: AiEvent) => void;
  readonly #policy: AiReplyTriggerPolicy;
  readonly #persona: AiPersonaConfig;
  readonly #maxOutputChars: number;
  readonly #maxConcurrency: number;
  readonly #maxQueueLength: number;
  readonly #now: () => number;
  readonly #contextWindow: DanmakuContextWindow;
  readonly #taskFactory = new AiReplyTaskFactory();
  readonly #queue: PendingAiReplyTask[] = [];
  readonly #activeControllers = new Set<AbortController>();
  #activeCount = 0;
  #stopped = false;

  constructor(options: AiReplyPipelineOptions) {
    this.#provider = options.provider;
    this.#logger = options.logger;
    this.#emitEvent = options.emitEvent;
    this.#policy = options.policy ?? createDefaultAiReplyTriggerPolicy();
    this.#persona = AiPersonaConfigSchema.parse(options.persona ?? {});
    this.#maxOutputChars = options.maxOutputChars ?? 80;
    this.#maxConcurrency = sanitizePositiveInteger(options.maxConcurrency, 1);
    this.#maxQueueLength = sanitizePositiveInteger(options.maxQueueLength, 20);
    this.#now = options.now ?? Date.now;
    this.#contextWindow = new DanmakuContextWindow(options.recentDanmakuLimit ?? 10);
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
    this.#contextWindow.clear();
    for (const controller of this.#activeControllers) {
      controller.abort();
    }
    this.#activeControllers.clear();
  }

  handleDanmaku(trigger: DouyuDanmakuEvent): void {
    const now = this.#now();
    const task = this.#taskFactory.createBaseTask(trigger, now);

    if (this.#stopped) {
      this.#emitSkipped(task, "runtime_stopped");
      return;
    }

    const recentDanmaku = this.#contextWindow.getRecent(trigger.payload.roomId);
    this.#contextWindow.remember(trigger);

    const decision = this.#policy.evaluate(trigger, now);
    if (!decision.triggered) {
      this.#emitSkipped(task, toSkippedReason(decision.reason));
      return;
    }

    if (this.#queue.length >= this.#maxQueueLength) {
      this.#emitSkipped(task, "queue_full");
      return;
    }

    this.#queue.push({ trigger, recentDanmaku, task });
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

  async #runTask(pendingTask: PendingAiReplyTask): Promise<void> {
    const controller = new AbortController();
    this.#activeControllers.add(controller);

    try {
      const result = await this.#provider.generateReply(
        {
          traceId: pendingTask.trigger.traceId,
          roomId: pendingTask.trigger.payload.roomId,
          trigger: pendingTask.trigger,
          persona: this.#persona,
          recentDanmaku: [...pendingTask.recentDanmaku],
          maxOutputChars: this.#maxOutputChars,
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

      this.#logger.info("ai.reply.generated", "AI reply generated", {
        traceId: event.traceId,
        roomId: event.payload.task.roomId,
        taskId: event.payload.task.taskId,
        providerId: event.payload.result.providerId,
        model: event.payload.result.model,
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
      this.#logger.warn("ai.reply.failed", "AI reply generation failed", {
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
    task: ReturnType<AiReplyTaskFactory["createBaseTask"]>,
    reason: AiReplySkippedReason,
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

function toSkippedReason(
  reason: AiReplyTriggerSkipReason,
): "policy_not_matched" | "global_cooldown" | "user_cooldown" {
  return reason;
}
