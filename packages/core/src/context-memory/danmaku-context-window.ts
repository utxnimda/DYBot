import type { DouyuDanmakuEvent } from "@dybot/contracts";

export class DanmakuContextWindow {
  readonly #limit: number;
  readonly #eventsByRoom = new Map<string, DouyuDanmakuEvent[]>();

  constructor(limit = 10) {
    this.#limit = sanitizeLimit(limit);
  }

  getRecent(roomId: string): DouyuDanmakuEvent[] {
    return [...(this.#eventsByRoom.get(roomId) ?? [])];
  }

  remember(event: DouyuDanmakuEvent): void {
    const roomId = event.payload.roomId;
    const nextEvents =
      this.#limit === 0 ? [] : [...this.getRecent(roomId), event].slice(-this.#limit);
    this.#eventsByRoom.set(roomId, nextEvents);
  }

  clear(): void {
    this.#eventsByRoom.clear();
  }
}

function sanitizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    return 10;
  }

  return Math.min(value, 20);
}
