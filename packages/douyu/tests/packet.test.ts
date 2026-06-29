import { describe, expect, it } from "vitest";
import { decodeDouyuPackets, encodeDouyuPacket } from "../src/protocol/packet";

describe("Douyu packet framing", () => {
  it("encodes and decodes a complete packet", () => {
    const frame = encodeDouyuPacket("type@=mrkl/");
    const decoded = decodeDouyuPackets(frame);

    expect(decoded.remaining.byteLength).toBe(0);
    expect(decoded.packets).toHaveLength(1);
    expect(decoded.packets.at(0)?.text).toBe("type@=mrkl/");
  });

  it("keeps incomplete packet bytes for the next read", () => {
    const frame = encodeDouyuPacket("type@=chatmsg/txt@=hello/");
    const first = decodeDouyuPackets(frame.subarray(0, 8));
    const second = decodeDouyuPackets(Buffer.concat([first.remaining, frame.subarray(8)]));

    expect(first.packets).toHaveLength(0);
    expect(first.remaining.byteLength).toBe(8);
    expect(second.packets.at(0)?.text).toBe("type@=chatmsg/txt@=hello/");
  });
});
