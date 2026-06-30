import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DouyuRoomCaptureConfigSchema, type BotEvent, type DouyuEvent } from "@dybot/contracts";
import { createRuntimeOrchestrator } from "@dybot/core";
import {
  createDouyuCaptureErrorEvent,
  normalizeDouyuMessage,
  parseStt,
  type DouyuCaptureClient,
  type DouyuCaptureEventListener,
  type DouyuCaptureStatus,
} from "@dybot/douyu";
import { createStorageService, type StorageService } from "@dybot/storage";
import { afterEach, describe, expect, it } from "vitest";
import {
  douyuReplayCaptureErrorFixture,
  douyuReplayRoomId,
  douyuReplaySttFixtures,
} from "../fixtures/douyu-replay";

const tempDirs: string[] = [];

class FakeDouyuCaptureClient implements DouyuCaptureClient {
  readonly #events: DouyuEvent[];
  #listener: DouyuCaptureEventListener | null = null;

  constructor(events: DouyuEvent[]) {
    this.#events = events;
  }

  onEvent(listener: DouyuCaptureEventListener): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = null;
    };
  }

  getStatus(): DouyuCaptureStatus {
    return "idle";
  }

  start(): Promise<void> {
    for (const event of this.#events) {
      this.#listener?.(event);
    }
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }
}

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dybot-storage-integration-"));
  tempDirs.push(dir);
  return join(dir, "dybot.sqlite");
}

function persistEvent(service: StorageService, event: BotEvent): Promise<void> {
  return service.events.insert(event).then(() => undefined);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("runtime event storage integration", () => {
  it("persists runtime events emitted by the orchestrator", async () => {
    const service = await createStorageService({ filePath: createTempDatabasePath() });
    const runtime = createRuntimeOrchestrator();
    const persistedEvents: Array<Promise<void>> = [];
    const unsubscribe = runtime.onEvent((event) => {
      persistedEvents.push(persistEvent(service, event));
    });

    try {
      runtime.start();
      runtime.stop();
      await Promise.all(persistedEvents);

      const records = await service.events.list({ eventTypes: ["runtime.status"] });

      expect(records.length).toBeGreaterThanOrEqual(4);
      expect(records.every((record) => record.event.type === "runtime.status")).toBe(true);
    } finally {
      unsubscribe();
      await service.close();
    }
  });

  it("persists Douyu events forwarded by the orchestrator", async () => {
    const service = await createStorageService({ filePath: createTempDatabasePath() });
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient(createDouyuReplayEvents()),
    });
    const persistedEvents: Array<Promise<void>> = [];
    const unsubscribe = runtime.onEvent((event) => {
      persistedEvents.push(persistEvent(service, event));
    });

    try {
      await runtime.startDouyuCapture(
        DouyuRoomCaptureConfigSchema.parse({ roomId: douyuReplayRoomId }),
      );
      await Promise.all(persistedEvents);

      const roomRecords = await service.events.list({ roomId: douyuReplayRoomId });

      expect(roomRecords.map((record) => record.event.type).sort()).toEqual([
        "douyu.capture_error",
        "douyu.danmaku",
        "douyu.gift",
        "douyu.room_status",
        "douyu.user_entered",
      ]);
      expect(roomRecords.every((record) => record.roomId === douyuReplayRoomId)).toBe(true);

      const danmakuEvent = await getSingleStoredEvent(service, "douyu.danmaku");
      expect(danmakuEvent.payload.text).toBe("hello from replay");

      const giftEvent = await getSingleStoredEvent(service, "douyu.gift");
      expect(giftEvent.payload.giftName).toBe("rocket");
      expect(giftEvent.payload.count).toBe(2);

      const userEnteredEvent = await getSingleStoredEvent(service, "douyu.user_entered");
      expect(userEnteredEvent.payload.user.nickname).toBe("visitor");

      const roomStatusEvent = await getSingleStoredEvent(service, "douyu.room_status");
      expect(roomStatusEvent.payload.status).toBe("login_ok");

      const captureErrorEvent = await getSingleStoredEvent(service, "douyu.capture_error");
      expect(captureErrorEvent.payload.message).toBe("fake capture socket error");
      expect(captureErrorEvent.payload.recoverable).toBe(true);

      const firstPage = await service.events.list({ roomId: douyuReplayRoomId, limit: 2 });
      const secondPage = await service.events.list({
        roomId: douyuReplayRoomId,
        limit: 2,
        offset: 2,
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);
      expect(new Set([...firstPage, ...secondPage].map((record) => record.eventId)).size).toBe(4);
    } finally {
      unsubscribe();
      await service.close();
    }
  });
});

async function getSingleStoredEvent<TEventType extends DouyuEvent["type"]>(
  service: StorageService,
  eventType: TEventType,
): Promise<Extract<DouyuEvent, { type: TEventType }>> {
  const records = await service.events.list({
    roomId: douyuReplayRoomId,
    eventTypes: [eventType],
  });
  const event = records[0]?.event;

  expect(records).toHaveLength(1);
  if (event?.type !== eventType) {
    throw new Error(`Expected stored ${eventType} event`);
  }

  return event as Extract<DouyuEvent, { type: TEventType }>;
}

function createDouyuReplayEvents(): DouyuEvent[] {
  const normalizedEvents = douyuReplaySttFixtures.map((fixture) => {
    const event = normalizeDouyuMessage({
      roomId: douyuReplayRoomId,
      receivedAt: fixture.receivedAt,
      raw: parseStt(fixture.stt),
    });

    if (event === null) {
      throw new Error(`Expected ${fixture.expectedType} fixture to normalize into an event`);
    }

    expect(event.type).toBe(fixture.expectedType);
    return event;
  });
  const captureError = createDouyuCaptureErrorEvent({
    roomId: douyuReplayRoomId,
    receivedAt: douyuReplayCaptureErrorFixture.receivedAt,
    code: douyuReplayCaptureErrorFixture.code,
    message: douyuReplayCaptureErrorFixture.message,
    recoverable: douyuReplayCaptureErrorFixture.recoverable,
  });

  return [...normalizedEvents, captureError];
}
