import { DEFAULT_DOUYU_TEST_ROOM_ID } from "@dybot/contracts";
import { describe, expect, it } from "vitest";
import { getDefaultAppConfig, parseAppConfig } from "../src";

describe("app config defaults", () => {
  it("uses room 9999 as the default Douyu test room", () => {
    const config = getDefaultAppConfig();

    expect(config.douyu.defaultRoom.roomId).toBe(DEFAULT_DOUYU_TEST_ROOM_ID);
    expect(config.douyu.defaultRoom.host).toBe("danmuproxy.douyu.com");
    expect(config.douyu.defaultRoom.groupId).toBe("-9999");
  });

  it("fills Douyu capture defaults when only a room id is provided", () => {
    const config = parseAppConfig({
      douyu: {
        defaultRoom: {
          roomId: "9999",
        },
      },
    });

    expect(config.douyu.defaultRoom.port).toBe(8601);
    expect(config.douyu.defaultRoom.heartbeatIntervalMs).toBe(45_000);
    expect(config.douyu.defaultRoom.reconnect.enabled).toBe(true);
  });
});
