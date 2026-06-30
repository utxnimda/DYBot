import type { SqliteDatabase } from "../db/sqlite-connection";
import { storageMigrations, type StorageMigration } from "./registry";

export interface StorageMigrationResult {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly appliedVersions: readonly number[];
}

interface UserVersionRow {
  readonly user_version: number;
}

export async function getStorageSchemaVersion(database: SqliteDatabase): Promise<number> {
  const row = await database.get<UserVersionRow>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

export async function runStorageMigrations(
  database: SqliteDatabase,
  migrations: readonly StorageMigration[] = storageMigrations,
): Promise<StorageMigrationResult> {
  validateMigrationSequence(migrations);

  const fromVersion = await getStorageSchemaVersion(database);
  const latestVersion = migrations.at(-1)?.version ?? 0;

  if (fromVersion > latestVersion) {
    throw new Error(
      `Database schema version ${String(fromVersion)} is newer than storage package ${String(latestVersion)}`,
    );
  }

  const pending = migrations.filter((migration) => migration.version > fromVersion);
  if (pending.length === 0) {
    return {
      fromVersion,
      toVersion: fromVersion,
      appliedVersions: [],
    };
  }

  const appliedVersions: number[] = [];
  let transactionStarted = false;

  try {
    await database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;

    for (const migration of pending) {
      await database.exec(migration.sql);
      await database.exec(`PRAGMA user_version = ${String(migration.version)}`);
      appliedVersions.push(migration.version);
    }

    await database.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await database.exec("ROLLBACK");
    }
    throw error;
  }

  return {
    fromVersion,
    toVersion: appliedVersions.at(-1) ?? fromVersion,
    appliedVersions,
  };
}

function validateMigrationSequence(migrations: readonly StorageMigration[]): void {
  let expectedVersion = 1;
  for (const migration of migrations) {
    if (migration.version !== expectedVersion) {
      throw new Error(`Storage migrations must be contiguous; expected ${String(expectedVersion)}`);
    }
    expectedVersion += 1;
  }
}
