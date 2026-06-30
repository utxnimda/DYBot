import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getStorageSchemaVersion, openSqliteDatabase, runStorageMigrations } from "../src";

const tempDirs: string[] = [];

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dybot-storage-"));
  tempDirs.push(dir);
  return join(dir, "dybot.sqlite");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("storage migrations", () => {
  it("creates the events table and records the schema version", async () => {
    const database = await openSqliteDatabase({ filePath: createTempDatabasePath() });

    try {
      const result = await runStorageMigrations(database);
      const table = await database.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'",
      );

      expect(result.appliedVersions).toEqual([1]);
      await expect(getStorageSchemaVersion(database)).resolves.toBe(1);
      expect(table?.name).toBe("events");
    } finally {
      await database.close();
    }
  });

  it("is repeatable when migrations are already applied", async () => {
    const database = await openSqliteDatabase({ filePath: createTempDatabasePath() });

    try {
      await runStorageMigrations(database);
      const result = await runStorageMigrations(database);

      expect(result.appliedVersions).toEqual([]);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(1);
    } finally {
      await database.close();
    }
  });
});
