import {
  AudioPlaybackRequestSchema,
  createAudioAssetId,
  createEventId,
  createTaskId,
  createTraceId,
} from "@dybot/contracts";
import { describe, expect, it } from "vitest";
import { MockAudioPlayer, listMockAudioOutputDevices } from "../src";

describe("listMockAudioOutputDevices", () => {
  it("returns a deterministic default output device", () => {
    expect(listMockAudioOutputDevices()).toEqual([
      {
        outputDeviceId: "mock-default-output",
        label: "Mock default output",
        isDefault: true,
      },
    ]);
  });
});

describe("MockAudioPlayer", () => {
  it("returns playback metadata without touching real audio devices", async () => {
    let now = 1000;
    const player = new MockAudioPlayer({ now: () => now });
    const request = createPlaybackRequest();

    const resultPromise = player.playAudio(request);
    now = 1500;
    const result = await resultPromise;

    expect(result.traceId).toBe(request.traceId);
    expect(result.playerId).toBe("mock-audio");
    expect(result.outputDeviceId).toBe("mock-default-output");
    expect(result.audio.assetId).toBe(request.audio.assetId);
    expect(result.startedAt).toBe(1000);
    expect(result.finishedAt).toBe(1500);
    expect(result.playbackDurationMs).toBe(request.audio.durationMs);
  });

  it("rejects when playback is aborted", async () => {
    const player = new MockAudioPlayer({ playbackDelayMs: 10 });
    const controller = new AbortController();
    const playbackPromise = player.playAudio(createPlaybackRequest(), {
      signal: controller.signal,
    });

    controller.abort();

    await expect(playbackPromise).rejects.toThrow("aborted");
  });
});

function createPlaybackRequest() {
  return AudioPlaybackRequestSchema.parse({
    traceId: createTraceId(),
    roomId: "9999",
    sourceEventId: createEventId(),
    sourceTaskId: createTaskId(),
    sourceType: "voice.synthesis.generated",
    audio: {
      assetId: createAudioAssetId(),
      cacheKey: "mock-cache-key",
      mimeType: "audio/wav",
      byteLength: 32000,
      durationMs: 1000,
      source: "mock",
    },
    output: {
      outputDeviceId: "mock-default-output",
    },
  });
}
