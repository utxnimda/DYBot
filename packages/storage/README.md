# @dybot/storage

Async SQLite storage package for DYBot runtime data.

Current driver stack:

- `sqlite`: Promise-based SQLite wrapper.
- `sqlite3`: native SQLite driver loaded from Electron main/Node runtime.

Responsibilities:

- Own SQLite connection setup, migrations, repositories, and backup helpers.
- Store normalized events from `@dybot/contracts` without exposing SQL to UI code.
- Keep runtime database files under the application data directory, not inside the repository.

Boundaries:

- Renderer code must not import this package.
- This package does not capture Douyu messages, call AI/TTS providers, or play audio.
- Database migrations must be versioned and repeatable.
- Real user databases, logs, and exported runtime data must never be committed.
