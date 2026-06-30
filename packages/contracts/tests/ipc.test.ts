import { describe, expect, it } from "vitest";
import { DouyuStartCaptureRequestSchema, IpcChannel } from "../src";

describe("ipc contracts", () => {
  it("defines Douyu control channels", () => {
    expect(IpcChannel.DouyuGetDefaultRoom).toBe("bot:douyu:get-default-room");
    expect(IpcChannel.DouyuStart).toBe("bot:douyu:start");
    expect(IpcChannel.DouyuStop).toBe("bot:douyu:stop");
  });

  it("parses Douyu start requests with capture defaults", () => {
    const config = DouyuStartCaptureRequestSchema.parse({ roomId: "9999" });

    expect(config.roomId).toBe("9999");
    expect(config.host).toBe("danmuproxy.douyu.com");
    expect(config.port).toBe(8601);
    expect(config.groupId).toBe("-9999");
    expect(config.reconnect.enabled).toBe(true);
  });
});
