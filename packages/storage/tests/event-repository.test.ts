import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DouyuDanmakuEvent } from "@dybot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { createStorageService } from "../src";

const tempDirs: string[] = [];

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dybot-storage-"));
  tempDirs.push(dir);
  return join(dir, "dybot.sqlite");
}

function createDanmakuEvent(
  overrides: Partial<DouyuDanmakuEvent["payload"]> = {},
): DouyuDanmakuEvent {
  return {
    type: "douyu.danmaku",
    traceId: "trace_storage_test",
    payload: {
      eventId: "evt_storage_test",
      receivedAt: 1_782_800_000_000,
      roomId: "9999",
      rawType: "chatmsg",
      raw: { type: "chatmsg" },
      text: "hello storage",
      user: {
        userId: "user_1",
        nickname: "tester",
      },
      ...overrides,
    },
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("SqliteEventRepository", () => {
  it("stores and lists typed bot events", async () => {
    const service = await createStorageService({ filePath: createTempDatabasePath() });

    try {
      const inserted = await service.events.insert(createDanmakuEvent());
      const records = await service.events.list({
        roomId: "9999",
        eventTypes: ["douyu.danmaku"],
      });

      expect(inserted.eventId).toBe("evt_storage_test");
      expect(records).toHaveLength(1);
      expect(records[0]?.event.type).toBe("douyu.danmaku");
      expect(records[0]?.roomId).toBe("9999");
      expect(records[0]?.occurredAt).toBe(1_782_800_000_000);
    } finally {
      await service.close();
    }
  });

  it("returns the persisted event when inserting a duplicate event id", async () => {
    const service = await createStorageService({ filePath: createTempDatabasePath() });

    try {
      const first = await service.events.insert(createDanmakuEvent({ text: "first" }), 100);
      const duplicate = await service.events.insert(
        createDanmakuEvent({ receivedAt: 1_782_800_000_100, text: "duplicate" }),
        200,
      );
      const records = await service.events.list({ roomId: "9999" });

      expect(first.storedAt).toBe(100);
      expect(duplicate.storedAt).toBe(100);
      expect(duplicate.event.type).toBe("douyu.danmaku");
      if (duplicate.event.type === "douyu.danmaku") {
        expect(duplicate.event.payload.text).toBe("first");
      }
      expect(records).toHaveLength(1);
    } finally {
      await service.close();
    }
  });

  it("orders newest events first", async () => {
    const service = await createStorageService({ filePath: createTempDatabasePath() });

    try {
      await service.events.insert(createDanmakuEvent({ eventId: "evt_old", receivedAt: 100 }));
      await service.events.insert(createDanmakuEvent({ eventId: "evt_new", receivedAt: 200 }));

      const records = await service.events.list({ limit: 2 });

      expect(records.map((record) => record.eventId)).toEqual(["evt_new", "evt_old"]);
    } finally {
      await service.close();
    }
  });
});
