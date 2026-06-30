CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  room_id TEXT,
  occurred_at INTEGER NOT NULL,
  stored_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type_occurred_at ON events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_room_occurred_at ON events (room_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_trace_id ON events (trace_id);