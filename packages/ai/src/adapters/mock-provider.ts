import { AiReplyRequestSchema, AiReplyResultSchema, type AiReplyResult } from "@dybot/contracts";
import type { AiProvider } from "./provider";
import { buildReplyPrompt } from "../prompt/reply-prompt";
import { estimatePromptTokens, estimateTokenCount } from "../token/estimate";

export interface MockAiProviderOptions {
  readonly providerId?: string;
  readonly model?: string;
}

export class MockAiProvider implements AiProvider {
  readonly providerId: string;
  readonly model: string;

  constructor(options: MockAiProviderOptions = {}) {
    this.providerId = options.providerId ?? "mock";
    this.model = options.model ?? "mock-short-reply";
  }

  generateReply(input: unknown): Promise<AiReplyResult> {
    const startedAt = Date.now();
    const request = AiReplyRequestSchema.parse(input);
    const prompt = buildReplyPrompt(request);
    const text = clampReplyText(
      `Thanks ${displayName(request.trigger.payload.user.nickname)}, I saw your message.`,
      request.maxOutputChars,
    );

    return Promise.resolve(
      AiReplyResultSchema.parse({
        traceId: request.traceId,
        providerId: this.providerId,
        model: this.model,
        text,
        prompt,
        latencyMs: Date.now() - startedAt,
        estimatedInputTokens: estimatePromptTokens(prompt.messages),
        estimatedOutputTokens: estimateTokenCount(text),
        finishReason: text.length >= request.maxOutputChars ? "length" : "stop",
      }),
    );
  }
}

function displayName(name: string | undefined): string {
  const cleaned = name?.replace(/\p{Control}/gu, "").trim();
  if (cleaned === undefined || cleaned.length === 0) {
    return "viewer";
  }

  return cleaned.slice(0, 24);
}

function clampReplyText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars);
}
