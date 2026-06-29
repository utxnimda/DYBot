# AI Agent Instructions

This repository is the DYBot desktop assistant project. It is a TypeScript + Electron + Vue/Vite desktop application, not a remote web page.

## Mandatory Reading Before Code Changes

Before making any code, configuration, dependency, script, directory, or build-system change, read:

1. `docs/ai-coding-rules.md`
2. `docs/engineering-foundation.md`
3. `docs/project-structure.md`
4. `docs/desktop-bot-assistant-architecture.md`
5. `docs/adr/0001-electron-typescript-vue.md`

If the change touches a package that has its own `README.md` or local instructions, read those too.

## Non-Negotiable Rules

- Do not write code before reading the required docs.
- Respect the directory structure in `docs/project-structure.md`.
- Keep Electron `main`, `preload`, and `renderer` physically and logically isolated.
- Renderer code must not access Node APIs, files, databases, sockets, or secrets directly.
- Use typed contracts from `packages/contracts` for IPC and cross-module events.
- Validate external input with schema before it enters business logic.
- Keep runtime user config, secrets, logs, and databases out of the repository.
- Never commit real API keys, cookies, tokens, private keys, logs, or local databases.
- Add or update tests for behavior changes.
- Update docs when structure, contracts, config, migrations, providers, or release flow changes.

## Directory Rules

- Root `config/` is for engineering configuration only.
- Package-level `config/` is for code-shipped defaults, schema, presets, and templates only.
- Runtime user data belongs under the application data directory, not the repo.
- The runtime config package is `packages/app-config`, not `packages/config`.

## Completion Requirements

When finishing a task, report:

- Files changed.
- Verification run.
- Verification skipped and why.
- Remaining risks or follow-up work.
