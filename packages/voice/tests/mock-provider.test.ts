import {
  VoiceSynthesisRequestSchema,
  createEventId,
  createTaskId,
  createTraceId,
} from "@dybot/contracts";
import { describe, expect, it } from "vitest";
import { MockVoiceProvider, cleanTextForSpeech } from "../src";

describe("cleanTextForSpeech", () => {
  it("removes URLs, control characters, and repeated whitespace", () => {
    expect(cleanTextForSpeech("hello https://example.com\u0000   world")).toBe("hello link world");
  });
});

describe("MockVoiceProvider", () => {
  it("returns deterministic mock audio metadata without generating files", async () => {
    const provider = new MockVoiceProvider();
    const request = VoiceSynthesisRequestSchema.parse({
      traceId: createTraceId(),
      roomId: "9999",
      sourceEventId: createEventId(),
      sourceTaskId: createTaskId(),
      sourceType: "ai.reply.generated",
      text: "hello https://example.com world",
      voice: {
        voiceId: "mock-voice",
        outputFormat: "wav",
      },
    });

    const first = await provider.synthesizeSpeech(request);
    const second = await provider.synthesizeSpeech(request);

    expect(first.traceId).toBe(request.traceId);
    expect(first.providerId).toBe("mock-tts");
    expect(first.voiceId).toBe("mock-voice");
    expect(first.outputFormat).toBe("wav");
    expect(first.text).toBe("hello link world");
    expect(first.audio.source).toBe("mock");
    expect(first.audio.mimeType).toBe("audio/wav");
    expect(first.audio.cacheKey).toBe(second.audio.cacheKey);
    expect(first.audio.assetId).not.toBe(second.audio.assetId);
  });
});
