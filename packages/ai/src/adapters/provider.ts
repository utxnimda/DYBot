import type { AiReplyRequest, AiReplyResult } from "@dybot/contracts";

export interface AiProviderRequestOptions {
  readonly signal?: AbortSignal;
}

export interface AiProvider {
  readonly providerId: string;
  readonly model: string;
  generateReply(
    request: AiReplyRequest,
    options?: AiProviderRequestOptions,
  ): Promise<AiReplyResult>;
}
