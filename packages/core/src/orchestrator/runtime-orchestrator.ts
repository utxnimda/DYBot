import { EventEmitter } from "node:events";
import {
  createBotError,
  createTraceId,
  type AiPersonaConfig,
  type BotEvent,
  type BotError,
  type DouyuRoomCaptureConfig,
  type HealthSnapshot,
  type RuntimeStatus,
  type VoiceOutputFormat,
} from "@dybot/contracts";
import type { AiProvider } from "@dybot/ai";
import type { AudioPlayer } from "@dybot/audio";
import type { DouyuCaptureClient } from "@dybot/douyu";
import { createLogger, type Logger } from "@dybot/logging";
import type { VoiceProvider } from "@dybot/voice";
import { AiReplyPipeline } from "../pipeline/ai-reply-pipeline";
import { AudioPlaybackPipeline } from "../pipeline/audio-playback-pipeline";
import { VoiceSynthesisPipeline } from "../pipeline/voice-synthesis-pipeline";
import type { AiReplyTriggerPolicy } from "../trigger-policy/ai-reply-trigger-policy";

export interface RuntimeOrchestratorOptions {
  logger?: Logger;
  douyuCapture?: DouyuCaptureClient;
  aiProvider?: AiProvider;
  aiReplyPolicy?: AiReplyTriggerPolicy;
  aiPersona?: AiPersonaConfig;
  aiMaxOutputChars?: number;
  aiRecentDanmakuLimit?: number;
  aiMaxConcurrency?: number;
  aiMaxQueueLength?: number;
  voiceProvider?: VoiceProvider;
  voiceId?: string;
  voiceOutputFormat?: VoiceOutputFormat;
  voiceMaxConcurrency?: number;
  voiceMaxQueueLength?: number;
  audioPlayer?: AudioPlayer;
  audioOutputDeviceId?: string;
  audioMaxConcurrency?: number;
  audioMaxQueueLength?: number;
  now?: () => number;
}

type RuntimeEventListener = (event: BotEvent) => void;

export class RuntimeOrchestrator {
  readonly #events = new EventEmitter();
  readonly #logger: Logger;
  readonly #douyuCapture: DouyuCaptureClient | null;
  readonly #aiReplyPipeline: AiReplyPipeline | null;
  readonly #voiceSynthesisPipeline: VoiceSynthesisPipeline | null;
  readonly #audioPlaybackPipeline: AudioPlaybackPipeline | null;
  #douyuEventUnsubscribe: (() => void) | null = null;
  #status: RuntimeStatus = "idle";
  #startedAt: number | null = null;
  #lastError: BotError | null = null;

  constructor(options: RuntimeOrchestratorOptions = {}) {
    this.#logger = options.logger ?? createLogger({ module: "runtime" });
    this.#douyuCapture = options.douyuCapture ?? null;
    this.#audioPlaybackPipeline =
      options.audioPlayer === undefined
        ? null
        : new AudioPlaybackPipeline({
            player: options.audioPlayer,
            logger: this.#logger,
            emitEvent: (event) => {
              this.#emitRuntimeEvent(event);
            },
            outputDeviceId: options.audioOutputDeviceId,
            maxConcurrency: options.audioMaxConcurrency,
            maxQueueLength: options.audioMaxQueueLength,
            now: options.now,
          });
    this.#voiceSynthesisPipeline =
      options.voiceProvider === undefined
        ? null
        : new VoiceSynthesisPipeline({
            provider: options.voiceProvider,
            logger: this.#logger,
            emitEvent: (event) => {
              this.#emitRuntimeEvent(event);
            },
            voiceId: options.voiceId,
            outputFormat: options.voiceOutputFormat,
            maxConcurrency: options.voiceMaxConcurrency,
            maxQueueLength: options.voiceMaxQueueLength,
            now: options.now,
          });
    this.#aiReplyPipeline =
      options.aiProvider === undefined
        ? null
        : new AiReplyPipeline({
            provider: options.aiProvider,
            logger: this.#logger,
            emitEvent: (event) => {
              this.#emitRuntimeEvent(event);
            },
            policy: options.aiReplyPolicy,
            persona: options.aiPersona,
            maxOutputChars: options.aiMaxOutputChars,
            recentDanmakuLimit: options.aiRecentDanmakuLimit,
            maxConcurrency: options.aiMaxConcurrency,
            maxQueueLength: options.aiMaxQueueLength,
            now: options.now,
          });
  }

  onEvent(listener: RuntimeEventListener): () => void {
    this.#events.on("event", listener);
    return () => this.#events.off("event", listener);
  }

  getHealth(): HealthSnapshot {
    return {
      status: this.#status,
      startedAt: this.#startedAt,
      updatedAt: Date.now(),
      activeProfileId: null,
      lastError: this.#lastError,
    };
  }

  start(): HealthSnapshot {
    if (this.#status === "running" || this.#status === "starting") {
      return this.getHealth();
    }

    this.#setStatus("starting");
    this.#aiReplyPipeline?.reset();
    this.#voiceSynthesisPipeline?.reset();
    this.#audioPlaybackPipeline?.reset();
    this.#startedAt = Date.now();
    this.#lastError = null;
    this.#logger.info("runtime.start", "Runtime orchestrator started");
    this.#setStatus("running");
    return this.getHealth();
  }

  stop(): HealthSnapshot {
    if (this.#status === "stopped" || this.#status === "idle" || this.#status === "stopping") {
      return this.getHealth();
    }

    this.#setStatus("stopping");
    if (this.#douyuCapture !== null) {
      void this.#douyuCapture.stop().catch((error: unknown) => {
        this.#logger.warn("runtime.douyu.stop_failed", "Failed to stop Douyu capture", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    this.#aiReplyPipeline?.stop();
    this.#voiceSynthesisPipeline?.stop();
    this.#audioPlaybackPipeline?.stop();
    this.#logger.info("runtime.stop", "Runtime orchestrator stopped");
    this.#startedAt = null;
    this.#setStatus("stopped");
    return this.getHealth();
  }

  async startDouyuCapture(config: DouyuRoomCaptureConfig): Promise<HealthSnapshot> {
    if (this.#douyuCapture === null) {
      this.#lastError = createBotError({
        code: "CONFIG_INVALID",
        message: "Douyu capture client is not configured",
        recoverable: true,
      });
      this.#logger.error("runtime.douyu.not_configured", this.#lastError.message);
      return this.getHealth();
    }

    this.#ensureDouyuEventForwarding();
    await this.#douyuCapture.start(config);
    return this.getHealth();
  }

  async stopDouyuCapture(): Promise<HealthSnapshot> {
    if (this.#douyuCapture === null) {
      return this.getHealth();
    }

    await this.#douyuCapture.stop();
    return this.getHealth();
  }

  fail(error: unknown): HealthSnapshot {
    this.#lastError = createBotError({
      code: "RUNTIME_ERROR",
      message: error instanceof Error ? error.message : "Unknown runtime error",
      recoverable: true,
    });
    this.#logger.error("runtime.error", this.#lastError.message);
    this.#setStatus("error");
    return this.getHealth();
  }

  #ensureDouyuEventForwarding(): void {
    if (this.#douyuCapture === null || this.#douyuEventUnsubscribe !== null) {
      return;
    }

    this.#douyuEventUnsubscribe = this.#douyuCapture.onEvent((event) => {
      this.#emitRuntimeEvent(event);
      if (event.type === "douyu.danmaku") {
        this.#aiReplyPipeline?.handleDanmaku(event);
      }
    });
  }

  #emitRuntimeEvent(event: BotEvent): void {
    this.#events.emit("event", event);
    if (event.type === "ai.reply.generated") {
      this.#voiceSynthesisPipeline?.handleAiReplyGenerated(event);
    }
    if (event.type === "voice.synthesis.generated") {
      this.#audioPlaybackPipeline?.handleVoiceSynthesisGenerated(event);
    }
  }

  #setStatus(status: RuntimeStatus): void {
    this.#status = status;
    const traceId = createTraceId();
    const event: BotEvent = {
      type: "runtime.status",
      traceId,
      payload: this.getHealth(),
    };
    this.#emitRuntimeEvent(event);
  }
}

export function createRuntimeOrchestrator(
  options?: RuntimeOrchestratorOptions,
): RuntimeOrchestrator {
  return new RuntimeOrchestrator(options);
}
