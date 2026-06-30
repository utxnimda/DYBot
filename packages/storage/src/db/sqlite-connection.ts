import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { open, type Database } from "sqlite";
import type * as Sqlite3 from "sqlite3";

export interface OpenSqliteDatabaseOptions {
  readonly filePath: string;
  readonly readOnly?: boolean;
}

export type SqliteDatabase = Database;

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3") as typeof Sqlite3;

export async function openSqliteDatabase(
  options: OpenSqliteDatabaseOptions,
): Promise<SqliteDatabase> {
  if (options.filePath !== ":memory:") {
    mkdirSync(dirname(options.filePath), { recursive: true });
  }

  const database = await open({
    filename: options.filePath,
    driver: sqlite3.Database,
    mode: options.readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  });

  database.configure("busyTimeout", 5_000);
  await database.exec("PRAGMA foreign_keys = ON");

  if (options.filePath !== ":memory:" && options.readOnly !== true) {
    await database.exec("PRAGMA journal_mode = WAL");
  }

  return database;
}
