import { DouyuRoomCaptureConfigSchema, type BotEvent, type DouyuEvent } from "@dybot/contracts";
import {
  createDouyuRoomStatusEvent,
  type DouyuCaptureClient,
  type DouyuCaptureEventListener,
  type DouyuCaptureStatus,
} from "@dybot/douyu";
import { describe, expect, it } from "vitest";
import { createRuntimeOrchestrator } from "../src";

class FakeDouyuCaptureClient implements DouyuCaptureClient {
  #listener: DouyuCaptureEventListener | null = null;

  onEvent(listener: DouyuCaptureEventListener): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = null;
    };
  }

  getStatus(): DouyuCaptureStatus {
    return "idle";
  }

  start(): Promise<void> {
    this.#listener?.(
      createDouyuRoomStatusEvent({
        roomId: "123",
        status: "connected",
        receivedAt: 1000,
      }),
    );
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }
}

describe("RuntimeOrchestrator", () => {
  it("emits runtime status changes", () => {
    const runtime = createRuntimeOrchestrator();
    const eventTypes: string[] = [];
    const unsubscribe = runtime.onEvent((event) => eventTypes.push(event.type));

    runtime.start();
    runtime.stop();
    unsubscribe();

    expect(eventTypes).toEqual([
      "runtime.status",
      "runtime.status",
      "runtime.status",
      "runtime.status",
    ]);
    expect(runtime.getHealth().status).toBe("stopped");
  });

  it("forwards Douyu capture events", async () => {
    const runtime = createRuntimeOrchestrator({ douyuCapture: new FakeDouyuCaptureClient() });
    const events: DouyuEvent[] = [];
    const unsubscribe = runtime.onEvent((event) => {
      if (isDouyuEvent(event)) {
        events.push(event);
      }
    });

    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    unsubscribe();

    expect(events).toHaveLength(1);
    expect(events.at(0)?.type).toBe("douyu.room_status");
  });
});

function isDouyuEvent(event: BotEvent): event is DouyuEvent {
  return (
    event.type === "douyu.danmaku" ||
    event.type === "douyu.gift" ||
    event.type === "douyu.user_entered" ||
    event.type === "douyu.room_status" ||
    event.type === "douyu.capture_error"
  );
}
