import {
  BotEventSchema,
  StoredEventQuerySchema,
  StoredEventRecordSchema,
  createEventId,
  getBotEventMetadata,
  type BotEvent,
  type StoredEventQuery,
  type StoredEventRecord,
} from "@dybot/contracts";
import type { SqliteDatabase } from "../db/sqlite-connection";

interface EventRow {
  readonly event_id: string;
  readonly event_type: string;
  readonly trace_id: string;
  readonly room_id: string | null;
  readonly occurred_at: number;
  readonly stored_at: number;
  readonly payload_json: string;
}

const insertEventSql = `
  INSERT OR IGNORE INTO events (
    event_id,
    event_type,
    trace_id,
    room_id,
    occurred_at,
    stored_at,
    payload_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const selectEventByIdSql = `
  SELECT
    event_id,
    event_type,
    trace_id,
    room_id,
    occurred_at,
    stored_at,
    payload_json
  FROM events
  WHERE event_id = ?
  LIMIT 1
`;

export class SqliteEventRepository {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  async insert(event: BotEvent, storedAt = Date.now()): Promise<StoredEventRecord> {
    const parsedEvent = BotEventSchema.parse(event);
    const metadata = getBotEventMetadata(parsedEvent);
    const record = StoredEventRecordSchema.parse({
      eventId: metadata.sourceEventId ?? createEventId(),
      eventType: metadata.eventType,
      traceId: metadata.traceId,
      roomId: metadata.roomId,
      occurredAt: metadata.occurredAt,
      storedAt,
      event: parsedEvent,
    });

    const result = await this.#database.run(
      insertEventSql,
      record.eventId,
      record.eventType,
      record.traceId,
      record.roomId,
      record.occurredAt,
      record.storedAt,
      JSON.stringify(record.event),
    );

    if ((result.changes ?? 0) === 0) {
      const existing = await this.getById(record.eventId);
      if (existing !== null) {
        return existing;
      }
      throw new Error(
        `Event insert was ignored but no existing event was found: ${record.eventId}`,
      );
    }

    return record;
  }

  async getById(eventId: string): Promise<StoredEventRecord | null> {
    const row = await this.#database.get<EventRow>(selectEventByIdSql, eventId);
    return row === undefined ? null : rowToStoredEventRecord(row);
  }

  async list(query: Partial<StoredEventQuery> = {}): Promise<StoredEventRecord[]> {
    const parsedQuery = StoredEventQuerySchema.parse(query);
    const clauses: string[] = [];
    const parameters: Array<number | string> = [];

    if (parsedQuery.roomId !== undefined) {
      clauses.push("room_id = ?");
      parameters.push(parsedQuery.roomId);
    }

    if (parsedQuery.eventTypes !== undefined && parsedQuery.eventTypes.length > 0) {
      clauses.push(`event_type IN (${parsedQuery.eventTypes.map(() => "?").join(", ")})`);
      parameters.push(...parsedQuery.eventTypes);
    }

    parameters.push(parsedQuery.limit, parsedQuery.offset);

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.#database.all<EventRow[]>(
      `
        SELECT
          event_id,
          event_type,
          trace_id,
          room_id,
          occurred_at,
          stored_at,
          payload_json
        FROM events
        ${whereSql}
        ORDER BY occurred_at DESC, stored_at DESC
        LIMIT ? OFFSET ?
      `,
      ...parameters,
    );

    return rows.map(rowToStoredEventRecord);
  }
}

function rowToStoredEventRecord(row: EventRow): StoredEventRecord {
  const event = BotEventSchema.parse(JSON.parse(row.payload_json));
  return StoredEventRecordSchema.parse({
    eventId: row.event_id,
    eventType: row.event_type,
    traceId: row.trace_id,
    roomId: row.room_id,
    occurredAt: row.occurred_at,
    storedAt: row.stored_at,
    event,
  });
}
