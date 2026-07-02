# @dybot/audio

Audio playback package for DYBot output devices, playback queues, player adapters, and volume controls.

Current scope:

- Provide a player interface for audio playback adapters.
- Provide a deterministic mock player for tests and early runtime pipeline work.
- Provide mock output devices for UI/runtime wiring before real device enumeration exists.
- Return playback task metadata only; real audio device selection and native playback are later work.

Boundaries:

- Renderer code must not import this package.
- This package does not know about Douyu, AI providers, TTS providers, prompts, or secrets.
- Real audio cache files, device-specific credentials, and user runtime settings must not be stored here.
