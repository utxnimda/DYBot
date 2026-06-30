# @dybot/ai

AI package for prompt construction, provider adapters, token estimates, and reply generation.

Current scope:

- Build prompt messages with system rules and danmaku data separated.
- Provide a deterministic mock provider for tests and early pipeline work.
- Keep provider details out of renderer and UI code.

Boundaries:

- Renderer code must not import this package.
- Danmaku text is untrusted data and must never be merged into system instructions.
- Real provider keys, tokens, proxy credentials, and model secrets must not be stored here.
