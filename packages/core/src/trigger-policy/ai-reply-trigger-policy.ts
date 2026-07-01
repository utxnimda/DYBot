import type { DouyuDanmakuEvent } from "@dybot/contracts";

export type AiReplyTriggerSkipReason = "policy_not_matched" | "global_cooldown" | "user_cooldown";

export type AiReplyTriggerDecision =
  | {
      readonly triggered: true;
    }
  | {
      readonly triggered: false;
      readonly reason: AiReplyTriggerSkipReason;
    };

export interface AiReplyTriggerPolicy {
  evaluate(event: DouyuDanmakuEvent, now: number): AiReplyTriggerDecision;
}

export interface KeywordAiReplyTriggerPolicyOptions {
  readonly keywords?: readonly string[];
  readonly triggerAll?: boolean;
  readonly globalCooldownMs?: number;
  readonly userCooldownMs?: number;
}

export class KeywordAiReplyTriggerPolicy implements AiReplyTriggerPolicy {
  readonly #keywords: readonly string[];
  readonly #triggerAll: boolean;
  readonly #globalCooldownMs: number;
  readonly #userCooldownMs: number;
  readonly #lastTriggerAtByUser = new Map<string, number>();
  #lastTriggerAt: number | null = null;

  constructor(options: KeywordAiReplyTriggerPolicyOptions = {}) {
    this.#keywords = options.keywords ?? [];
    this.#triggerAll = options.triggerAll ?? this.#keywords.length === 0;
    this.#globalCooldownMs = sanitizeCooldown(options.globalCooldownMs);
    this.#userCooldownMs = sanitizeCooldown(options.userCooldownMs);
  }

  evaluate(event: DouyuDanmakuEvent, now: number): AiReplyTriggerDecision {
    if (!this.#matchesKeyword(event)) {
      return { triggered: false, reason: "policy_not_matched" };
    }

    if (this.#lastTriggerAt !== null && now - this.#lastTriggerAt < this.#globalCooldownMs) {
      return { triggered: false, reason: "global_cooldown" };
    }

    const userKey = getUserCooldownKey(event);
    const userLastTriggerAt = this.#lastTriggerAtByUser.get(userKey);
    if (userLastTriggerAt !== undefined && now - userLastTriggerAt < this.#userCooldownMs) {
      return { triggered: false, reason: "user_cooldown" };
    }

    this.#lastTriggerAt = now;
    this.#lastTriggerAtByUser.set(userKey, now);
    return { triggered: true };
  }

  #matchesKeyword(event: DouyuDanmakuEvent): boolean {
    if (this.#triggerAll) {
      return true;
    }

    const text = event.payload.text.toLocaleLowerCase();
    return this.#keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase()));
  }
}

export function createDefaultAiReplyTriggerPolicy(): AiReplyTriggerPolicy {
  return new KeywordAiReplyTriggerPolicy({ triggerAll: true, globalCooldownMs: 1_500 });
}

function sanitizeCooldown(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}

function getUserCooldownKey(event: DouyuDanmakuEvent): string {
  return event.payload.user.userId ?? event.payload.user.nickname ?? "anonymous";
}
