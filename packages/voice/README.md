# @dybot/voice

TTS package for DYBot voice synthesis providers, text cleanup, voice selection, and audio asset metadata.

Current scope:

- Provide a provider interface for TTS adapters.
- Provide a deterministic mock provider for tests and early runtime pipeline work.
- Clean AI reply text before it enters TTS.
- Return audio asset metadata only; real audio files and playback queues are owned by later packages.

Boundaries:

- Renderer code must not import this package.
- Real TTS keys, tokens, cookies, model secrets, and generated audio cache files must not be stored here.
- Provider details must stay behind adapters and must not leak into core or UI code.
