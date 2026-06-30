import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BotEvent } from "@dybot/contracts";
import { createRuntimeOrchestrator } from "@dybot/core";
import { createStorageService, type StorageService } from "@dybot/storage";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

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
});
