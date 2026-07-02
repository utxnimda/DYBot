import type { AudioPlaybackRequest, AudioPlaybackResult } from "@dybot/contracts";

export interface AudioPlayerRequestOptions {
  readonly signal?: AbortSignal;
}

export interface AudioPlayer {
  readonly playerId: string;
  playAudio(
    request: AudioPlaybackRequest,
    options?: AudioPlayerRequestOptions,
  ): Promise<AudioPlaybackResult>;
}
