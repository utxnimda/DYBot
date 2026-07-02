import type { AiPromptMessage } from "@dybot/contracts";

const CHARS_PER_TOKEN_ESTIMATE = 4;
const MESSAGE_OVERHEAD_TOKENS = 4;

export function estimateTokenCount(text: string): number {
  const normalizedLength = text.trim().length;
  if (normalizedLength === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalizedLength / CHARS_PER_TOKEN_ESTIMATE));
}

export function estimatePromptTokens(messages: readonly AiPromptMessage[]): number {
  return messages.reduce(
    (total, message) => total + MESSAGE_OVERHEAD_TOKENS + estimateTokenCount(message.content),
    0,
  );
}
