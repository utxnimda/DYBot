import type { AiReplyRequest, AiReplyResult } from "@dybot/contracts";

export interface AiProvider {
  readonly providerId: string;
  readonly model: string;
  generateReply(request: AiReplyRequest): Promise<AiReplyResult>;
}
