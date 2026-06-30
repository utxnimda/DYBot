import type { SqliteDatabase } from "./db/sqlite-connection";
import { openSqliteDatabase } from "./db/sqlite-connection";
import { runStorageMigrations } from "./migrations/migrator";
import { SqliteEventRepository } from "./repositories/event-repository";

export interface CreateStorageServiceOptions {
  readonly filePath: string;
}

export interface StorageService {
  readonly database: SqliteDatabase;
  readonly events: SqliteEventRepository;
  close(): Promise<void>;
}

export async function createStorageService(
  options: CreateStorageServiceOptions,
): Promise<StorageService> {
  const database = await openSqliteDatabase({ filePath: options.filePath });
  await runStorageMigrations(database);

  return {
    database,
    events: new SqliteEventRepository(database),
    close() {
      return database.close();
    },
  };
}
