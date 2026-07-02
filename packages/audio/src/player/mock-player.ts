import {
  AudioPlaybackRequestSchema,
  AudioPlaybackResultSchema,
  type AudioPlaybackResult,
} from "@dybot/contracts";
import type { AudioPlayer, AudioPlayerRequestOptions } from "./player";

export interface MockAudioPlayerOptions {
  readonly playerId?: string;
  readonly playbackDelayMs?: number;
  readonly now?: () => number;
}

export class MockAudioPlayer implements AudioPlayer {
  readonly playerId: string;
  readonly #playbackDelayMs: number;
  readonly #now: () => number;

  constructor(options: MockAudioPlayerOptions = {}) {
    this.playerId = options.playerId ?? "mock-audio";
    this.#playbackDelayMs = sanitizeNonNegativeInteger(options.playbackDelayMs, 0);
    this.#now = options.now ?? Date.now;
  }

  playAudio(input: unknown, options?: AudioPlayerRequestOptions): Promise<AudioPlaybackResult> {
    if (options?.signal?.aborted) {
      return Promise.reject(new Error("aborted"));
    }

    const request = AudioPlaybackRequestSchema.parse(input);
    const startedAt = this.#now();

    return waitForDelay(this.#playbackDelayMs, options?.signal).then(() =>
      AudioPlaybackResultSchema.parse({
        traceId: request.traceId,
        playerId: this.playerId,
        outputDeviceId: request.output.outputDeviceId,
        audio: request.audio,
        startedAt,
        finishedAt: this.#now(),
        playbackDurationMs: request.audio.durationMs,
      }),
    );
  }
}

function waitForDelay(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("aborted"));
  }

  if (delayMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new Error("aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function sanitizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}
