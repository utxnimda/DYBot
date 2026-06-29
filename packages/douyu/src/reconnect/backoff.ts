export interface ReconnectBackoffInput {
  readonly attempt: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
}

export function calculateReconnectDelayMs(input: ReconnectBackoffInput): number {
  const safeAttempt = Math.max(0, input.attempt);
  const baseDelay = input.initialDelayMs * 2 ** safeAttempt;
  return Math.min(input.maxDelayMs, baseDelay);
}
