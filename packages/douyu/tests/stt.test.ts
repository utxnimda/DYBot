import { describe, expect, it } from "vitest";
import { parseStt, serializeStt } from "../src/protocol/stt";

describe("Douyu STT protocol", () => {
  it("serializes and parses escaped values", () => {
    const serialized = serializeStt({ type: "chatmsg", txt: "a/b@c", rid: 123 });

    expect(serialized).toBe("type@=chatmsg/txt@=a@Sb@Ac/rid@=123/");
    expect(parseStt(serialized)).toEqual({
      type: "chatmsg",
      txt: "a/b@c",
      rid: "123",
    });
  });

  it("rejects malformed segments", () => {
    expect(() => parseStt("type@=chatmsg/bad-segment/")).toThrow(/Invalid STT segment/u);
  });
});
