import { createHash } from "node:crypto";
import {
  VoiceSynthesisRequestSchema,
  VoiceSynthesisResultSchema,
  createAudioAssetId,
  type VoiceOutputFormat,
  type VoiceSynthesisResult,
} from "@dybot/contracts";
import type { VoiceProvider, VoiceProviderRequestOptions } from "./provider";
import { cleanTextForSpeech } from "../text/speech-text";

export interface MockVoiceProviderOptions {
  readonly providerId?: string;
}

export class MockVoiceProvider implements VoiceProvider {
  readonly providerId: string;

  constructor(options: MockVoiceProviderOptions = {}) {
    this.providerId = options.providerId ?? "mock-tts";
  }

  synthesizeSpeech(
    input: unknown,
    options?: VoiceProviderRequestOptions,
  ): Promise<VoiceSynthesisResult> {
    const startedAt = Date.now();
    if (options?.signal?.aborted) {
      return Promise.reject(new Error("aborted"));
    }

    const request = VoiceSynthesisRequestSchema.parse(input);
    const text = cleanTextForSpeech(request.text);
    if (text.length === 0) {
      return Promise.reject(new Error("voice text is empty after cleaning"));
    }

    const outputFormat = request.voice.outputFormat;
    const voiceId = request.voice.voiceId;
    const cacheKey = createCacheKey(this.providerId, voiceId, outputFormat, text);
    const durationMs = estimateDurationMs(text);

    return Promise.resolve(
      VoiceSynthesisResultSchema.parse({
        traceId: request.traceId,
        providerId: this.providerId,
        voiceId,
        text,
        outputFormat,
        audio: {
          assetId: createAudioAssetId(),
          cacheKey,
          mimeType: getMimeType(outputFormat),
          byteLength: estimateByteLength(durationMs, outputFormat),
          durationMs,
          source: "mock",
        },
        latencyMs: Date.now() - startedAt,
        characterCount: text.length,
      }),
    );
  }
}

function createCacheKey(
  providerId: string,
  voiceId: string,
  outputFormat: VoiceOutputFormat,
  text: string,
): string {
  return createHash("sha256")
    .update(`${providerId}\0${voiceId}\0${outputFormat}\0${text}`)
    .digest("hex");
}

function estimateDurationMs(text: string): number {
  return Math.max(300, Math.ceil(text.length * 90));
}

function estimateByteLength(durationMs: number, outputFormat: VoiceOutputFormat): number {
  const bytesPerMs = outputFormat === "wav" ? 32 : 8;
  return Math.ceil(durationMs * bytesPerMs);
}

function getMimeType(outputFormat: VoiceOutputFormat): string {
  switch (outputFormat) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "ogg":
      return "audio/ogg";
  }
}
