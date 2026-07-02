import type { VoiceSynthesisRequest, VoiceSynthesisResult } from "@dybot/contracts";

export interface VoiceProviderRequestOptions {
  readonly signal?: AbortSignal;
}

export interface VoiceProvider {
  readonly providerId: string;
  synthesizeSpeech(
    request: VoiceSynthesisRequest,
    options?: VoiceProviderRequestOptions,
  ): Promise<VoiceSynthesisResult>;
}
