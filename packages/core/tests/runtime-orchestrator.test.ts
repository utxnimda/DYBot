import { MockAiProvider, type AiProvider, type AiProviderRequestOptions } from "@dybot/ai";
import {
  DouyuDanmakuEventSchema,
  DouyuRoomCaptureConfigSchema,
  createEventId,
  createTraceId,
  type AiEvent,
  type AiReplyRequest,
  type AiReplyResult,
  type BotEvent,
  type DouyuDanmakuEvent,
  type DouyuEvent,
} from "@dybot/contracts";
import {
  createDouyuRoomStatusEvent,
  type DouyuCaptureClient,
  type DouyuCaptureEventListener,
  type DouyuCaptureStatus,
} from "@dybot/douyu";
import { describe, expect, it } from "vitest";
import { AiReplyPipeline, KeywordAiReplyTriggerPolicy, createRuntimeOrchestrator } from "../src";

class FakeDouyuCaptureClient implements DouyuCaptureClient {
  readonly #events: DouyuEvent[];
  #listener: DouyuCaptureEventListener | null = null;

  constructor(events: DouyuEvent[] = [createDefaultRoomStatusEvent()]) {
    this.#events = events;
  }

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
    for (const event of this.#events) {
      this.#listener?.(event);
    }
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

  it("generates an AI reply event for triggered danmaku", async () => {
    const danmaku = createDanmakuEvent({ text: "@bot hello" });
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient([danmaku]),
      aiProvider: new MockAiProvider(),
      now: () => 10_000,
    });
    const aiEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.generated" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.generated" }> =>
        event.type === "ai.reply.generated",
    );

    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    const aiEvent = await aiEventPromise;

    expect(aiEvent.traceId).toBe(danmaku.traceId);
    expect(aiEvent.payload.task.roomId).toBe("123");
    expect(aiEvent.payload.task.triggerEventId).toBe(danmaku.payload.eventId);
    expect(aiEvent.payload.result.text).toContain("tester");
    expect(aiEvent.payload.result.promptSummary.messageCount).toBe(2);
    expect("prompt" in aiEvent.payload.result).toBe(false);
  });

  it("emits a recoverable AI failure event without blocking the runtime", async () => {
    const danmaku = createDanmakuEvent({ text: "@bot hello" });
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient([danmaku]),
      aiProvider: new FailingAiProvider(),
      now: () => 20_000,
    });
    const aiEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.failed" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.failed" }> =>
        event.type === "ai.reply.failed",
    );

    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    const aiEvent = await aiEventPromise;

    expect(runtime.getHealth().status).toBe("idle");
    expect(aiEvent.traceId).toBe(danmaku.traceId);
    expect(aiEvent.payload.error.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(aiEvent.payload.error.recoverable).toBe(true);
    expect(aiEvent.payload.error.message).toBe("provider offline");
  });

  it("emits an AI skipped event when the trigger policy does not match", async () => {
    const danmaku = createDanmakuEvent({ text: "hello without trigger keyword" });
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient([danmaku]),
      aiProvider: new MockAiProvider(),
      aiReplyPolicy: new KeywordAiReplyTriggerPolicy({ keywords: ["@bot"] }),
      now: () => 30_000,
    });
    const skippedEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.skipped" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.skipped" }> =>
        event.type === "ai.reply.skipped",
    );

    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    const skippedEvent = await skippedEventPromise;

    expect(skippedEvent.traceId).toBe(danmaku.traceId);
    expect(skippedEvent.payload.reason).toBe("policy_not_matched");
  });

  it("skips AI replies when the pipeline queue is full", async () => {
    const gate = createDeferred<undefined>();
    const provider = new DeferredAiProvider(gate.promise);
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient([
        createDanmakuEvent({ text: "@bot one" }),
        createDanmakuEvent({ text: "@bot two" }),
        createDanmakuEvent({ text: "@bot three" }),
      ]),
      aiProvider: provider,
      aiReplyPolicy: new KeywordAiReplyTriggerPolicy({ triggerAll: true }),
      aiMaxConcurrency: 1,
      aiMaxQueueLength: 1,
      now: () => 40_000,
    });
    const skippedEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.skipped" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.skipped" }> =>
        event.type === "ai.reply.skipped" && event.payload.reason === "queue_full",
    );
    const generatedEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.generated" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.generated" }> =>
        event.type === "ai.reply.generated",
    );

    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    const skippedEvent = await skippedEventPromise;
    gate.resolve(undefined);
    await generatedEventPromise;

    expect(skippedEvent.payload.reason).toBe("queue_full");
    expect(provider.requests).toHaveLength(1);
  });

  it("skips active AI replies when the runtime stops", async () => {
    const runtime = createRuntimeOrchestrator({
      douyuCapture: new FakeDouyuCaptureClient([createDanmakuEvent({ text: "@bot stop" })]),
      aiProvider: new AbortAwareAiProvider(),
      aiReplyPolicy: new KeywordAiReplyTriggerPolicy({ triggerAll: true }),
      now: () => 50_000,
    });
    const skippedEventPromise = waitForEvent<Extract<AiEvent, { type: "ai.reply.skipped" }>>(
      runtime,
      (event): event is Extract<AiEvent, { type: "ai.reply.skipped" }> =>
        event.type === "ai.reply.skipped" && event.payload.reason === "runtime_stopped",
    );

    runtime.start();
    await runtime.startDouyuCapture(DouyuRoomCaptureConfigSchema.parse({ roomId: "123" }));
    runtime.stop();
    const skippedEvent = await skippedEventPromise;

    expect(skippedEvent.payload.reason).toBe("runtime_stopped");
  });

  it("does not retain stopped danmaku in context after reset", async () => {
    const provider = new DeferredAiProvider(Promise.resolve(undefined));
    const events: AiEvent[] = [];
    const generatedEventPromise = waitForPipelineEvent<
      Extract<AiEvent, { type: "ai.reply.generated" }>
    >(
      events,
      (event): event is Extract<AiEvent, { type: "ai.reply.generated" }> =>
        event.type === "ai.reply.generated",
    );
    const pipeline = new AiReplyPipeline({
      provider,
      logger: createSilentLogger(),
      emitEvent: (event) => events.push(event),
      policy: new KeywordAiReplyTriggerPolicy({ triggerAll: true }),
      now: () => 60_000,
    });

    pipeline.stop();
    pipeline.handleDanmaku(createDanmakuEvent({ text: "stopped message" }));
    pipeline.reset();
    pipeline.handleDanmaku(createDanmakuEvent({ text: "@bot active" }));

    await generatedEventPromise;

    expect(events.at(0)?.type).toBe("ai.reply.skipped");
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests.at(0)?.recentDanmaku).toEqual([]);
  });
});

class FailingAiProvider implements AiProvider {
  readonly providerId = "failing";
  readonly model = "failing-model";

  generateReply(): Promise<AiReplyResult> {
    return Promise.reject(new Error("provider offline"));
  }
}

class DeferredAiProvider implements AiProvider {
  readonly providerId = "deferred";
  readonly model = "deferred-model";
  readonly requests: AiReplyRequest[] = [];
  readonly #gate: Promise<void>;
  readonly #delegate = new MockAiProvider({ providerId: this.providerId, model: this.model });

  constructor(gate: Promise<void>) {
    this.#gate = gate;
  }

  async generateReply(request: AiReplyRequest): Promise<AiReplyResult> {
    this.requests.push(request);
    await this.#gate;
    return this.#delegate.generateReply(request);
  }
}

class AbortAwareAiProvider implements AiProvider {
  readonly providerId = "abort-aware";
  readonly model = "abort-aware-model";

  generateReply(
    request: AiReplyRequest,
    options?: AiProviderRequestOptions,
  ): Promise<AiReplyResult> {
    void request;
    return new Promise((resolve, reject) => {
      void resolve;
      options?.signal?.addEventListener(
        "abort",
        () => {
          reject(new Error("aborted"));
        },
        {
          once: true,
        },
      );
    });
  }
}

function isDouyuEvent(event: BotEvent): event is DouyuEvent {
  return (
    event.type === "douyu.danmaku" ||
    event.type === "douyu.gift" ||
    event.type === "douyu.user_entered" ||
    event.type === "douyu.room_status" ||
    event.type === "douyu.capture_error"
  );
}

function createDefaultRoomStatusEvent(): DouyuEvent {
  return createDouyuRoomStatusEvent({
    roomId: "123",
    status: "connected",
    receivedAt: 1000,
  });
}

function createDanmakuEvent(input: { text: string }): DouyuDanmakuEvent {
  return DouyuDanmakuEventSchema.parse({
    type: "douyu.danmaku",
    traceId: createTraceId(),
    payload: {
      eventId: createEventId(),
      receivedAt: 2000,
      roomId: "123",
      rawType: "chatmsg",
      raw: {
        type: "chatmsg",
        txt: input.text,
      },
      messageId: "msg_core_ai_reply",
      text: input.text,
      user: {
        userId: "42",
        nickname: "tester",
      },
    },
  });
}

function waitForEvent<TEvent extends BotEvent>(
  runtime: ReturnType<typeof createRuntimeOrchestrator>,
  predicate: (event: BotEvent) => event is TEvent,
): Promise<TEvent> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null;
    unsubscribe = runtime.onEvent((event) => {
      if (!predicate(event)) {
        return;
      }

      unsubscribe?.();
      resolve(event);
    });
  });
}

function waitForPipelineEvent<TEvent extends AiEvent>(
  events: AiEvent[],
  predicate: (event: AiEvent) => event is TEvent,
): Promise<TEvent> {
  return new Promise((resolve) => {
    const poll = (): void => {
      const event = events.find(predicate);
      if (event !== undefined) {
        resolve(event);
        return;
      }

      setTimeout(poll, 0);
    };

    poll();
  });
}

function createSilentLogger() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => {
    return undefined;
  };
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}
