import { describe, expect, it } from "vitest";
import { normalizeDouyuMessage } from "../src/normalizer/event-normalizer";
import { parseStt } from "../src/protocol/stt";
import { sampleChatMessageStt, sampleGiftMessageStt } from "./fixtures/sample-messages";

describe("Douyu event normalizer", () => {
  it("normalizes chat messages", () => {
    const event = normalizeDouyuMessage({
      roomId: "123",
      receivedAt: 1000,
      raw: parseStt(sampleChatMessageStt),
    });

    expect(event?.type).toBe("douyu.danmaku");
    if (event?.type !== "douyu.danmaku") {
      throw new Error("Expected douyu.danmaku event");
    }

    expect(event.payload.roomId).toBe("123");
    expect(event.payload.text).toBe("hello");
    expect(event.payload.user).toMatchObject({ userId: "42", nickname: "tester" });
    expect(event.payload.messageId).toBe("msg1");
  });

  it("normalizes gift messages", () => {
    const event = normalizeDouyuMessage({
      roomId: "123",
      receivedAt: 1000,
      raw: parseStt(sampleGiftMessageStt),
    });

    expect(event?.type).toBe("douyu.gift");
    if (event?.type !== "douyu.gift") {
      throw new Error("Expected douyu.gift event");
    }

    expect(event.payload.giftId).toBe("20003");
    expect(event.payload.giftName).toBe("rocket");
    expect(event.payload.count).toBe(3);
  });

  it("ignores unknown message types", () => {
    expect(
      normalizeDouyuMessage({
        roomId: "123",
        raw: parseStt("type@=unknown/rid@=123/"),
      }),
    ).toBeNull();
  });
});
