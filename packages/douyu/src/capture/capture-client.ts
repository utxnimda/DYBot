import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import {
  DouyuRoomCaptureConfigSchema,
  type DouyuEvent,
  type DouyuRoomCaptureConfig,
} from "@dybot/contracts";
import { createLogger, type Logger } from "@dybot/logging";
import {
  createDouyuCaptureErrorEvent,
  createDouyuRoomStatusEvent,
  normalizeDouyuMessage,
} from "../normalizer/event-normalizer";
import {
  createHeartbeatRequest,
  createJoinGroupRequest,
  createLoginRequest,
  createLogoutRequest,
  encodeDouyuClientCommand,
} from "../protocol/commands";
import { decodeDouyuPackets } from "../protocol/packet";
import { parseStt } from "../protocol/stt";
import { calculateReconnectDelayMs } from "../reconnect/backoff";

export type DouyuCaptureStatus =
  "idle" | "connecting" | "running" | "stopping" | "stopped" | "error";
export type DouyuCaptureEventListener = (event: DouyuEvent) => void;

export interface DouyuCaptureClient {
  onEvent(listener: DouyuCaptureEventListener): () => void;
  getStatus(): DouyuCaptureStatus;
  start(config: DouyuRoomCaptureConfig): Promise<void>;
  stop(): Promise<void>;
}

export interface DouyuTcpCaptureClientOptions {
  readonly logger?: Logger;
  readonly socketFactory?: () => Socket;
}

export class DouyuTcpCaptureClient implements DouyuCaptureClient {
  readonly #events = new EventEmitter();
  readonly #logger: Logger;
  readonly #socketFactory: () => Socket;
  #status: DouyuCaptureStatus = "idle";
  #socket: Socket | null = null;
  #buffer = Buffer.alloc(0);
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #config: DouyuRoomCaptureConfig | null = null;
  #reconnectAttempts = 0;
  #stopping = false;

  constructor(options: DouyuTcpCaptureClientOptions = {}) {
    this.#logger = options.logger ?? createLogger({ module: "douyu" });
    this.#socketFactory = options.socketFactory ?? (() => new Socket());
  }

  onEvent(listener: DouyuCaptureEventListener): () => void {
    this.#events.on("event", listener);
    return () => this.#events.off("event", listener);
  }

  getStatus(): DouyuCaptureStatus {
    return this.#status;
  }

  async start(config: DouyuRoomCaptureConfig): Promise<void> {
    if (this.#status === "connecting" || this.#status === "running") {
      return;
    }

    this.#config = DouyuRoomCaptureConfigSchema.parse(config);
    this.#stopping = false;
    this.#status = "connecting";
    this.#clearReconnectTimer();

    try {
      await this.#connectSocket(this.#config);
      this.#sendCommand(createLoginRequest(this.#config.roomId));
      this.#sendCommand(createJoinGroupRequest(this.#config.roomId, this.#config.groupId));
      this.#startHeartbeat(this.#config);
      this.#status = "running";
      this.#reconnectAttempts = 0;
      this.#emitEvent(
        createDouyuRoomStatusEvent({
          roomId: this.#config.roomId,
          status: "joined_group",
          raw: { type: "client_status" },
          message: "Douyu room group joined",
        }),
      );
      this.#logger.info("douyu.capture.started", "Douyu capture started", {
        roomId: this.#config.roomId,
        host: this.#config.host,
        port: this.#config.port,
      });
    } catch (error) {
      this.#status = "error";
      this.#emitCaptureError("connect_failed", errorMessage(error), true);
      this.#scheduleReconnect();
    }
  }

  stop(): Promise<void> {
    this.#stopping = true;
    this.#status = "stopping";
    this.#clearHeartbeatTimer();
    this.#clearReconnectTimer();

    if (this.#socket !== null) {
      try {
        if (this.#socket.writable) {
          this.#sendCommand(createLogoutRequest());
        }
      } finally {
        this.#socket.destroy();
      }
    }

    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.#status = "stopped";

    if (this.#config !== null) {
      this.#emitEvent(
        createDouyuRoomStatusEvent({
          roomId: this.#config.roomId,
          status: "disconnected",
          raw: { type: "client_status" },
          message: "Douyu capture stopped",
        }),
      );
    }

    this.#logger.info("douyu.capture.stopped", "Douyu capture stopped");
    return Promise.resolve();
  }

  async #connectSocket(config: DouyuRoomCaptureConfig): Promise<void> {
    const socket = this.#socketFactory();
    this.#socket = socket;
    this.#buffer = Buffer.alloc(0);

    socket.on("data", (data) => {
      this.#handleData(data);
    });
    socket.on("close", () => {
      this.#handleClose();
    });
    socket.on("error", (error) => {
      this.#handleSocketError(error);
    });

    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        socket.off("connect", onConnect);
        socket.off("error", onError);
      };
      const onConnect = (): void => {
        cleanup();
        resolve();
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      socket.once("connect", onConnect);
      socket.once("error", onError);
      socket.connect(config.port, config.host);
    });

    this.#emitEvent(
      createDouyuRoomStatusEvent({
        roomId: config.roomId,
        status: "connected",
        raw: { type: "client_status" },
        message: "Douyu socket connected",
      }),
    );
  }

  #handleData(data: Buffer): void {
    const config = this.#config;
    if (config === null) {
      return;
    }

    try {
      const decoded = decodeDouyuPackets(Buffer.concat([this.#buffer, data]));
      this.#buffer = decoded.remaining;

      for (const packet of decoded.packets) {
        const raw = parseStt(packet.payload);
        const event = normalizeDouyuMessage({ roomId: config.roomId, raw });

        if (event !== null) {
          this.#emitEvent(event);
        }
      }
    } catch (error) {
      this.#buffer = Buffer.alloc(0);
      this.#emitCaptureError("protocol_error", errorMessage(error), true);
    }
  }

  #handleSocketError(error: Error): void {
    if (this.#config === null || this.#stopping) {
      return;
    }

    this.#logger.warn("douyu.socket.error", "Douyu socket emitted an error", {
      roomId: this.#config.roomId,
      error: error.message,
    });
    this.#emitCaptureError("socket_error", error.message, true);
  }

  #handleClose(): void {
    this.#clearHeartbeatTimer();
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);

    if (this.#config !== null) {
      this.#emitEvent(
        createDouyuRoomStatusEvent({
          roomId: this.#config.roomId,
          status: "disconnected",
          raw: { type: "client_status" },
          message: "Douyu socket closed",
        }),
      );
    }

    if (this.#stopping) {
      return;
    }

    this.#status = "error";
    this.#scheduleReconnect();
  }

  #sendCommand(command: string): void {
    if (this.#socket === null || !this.#socket.writable) {
      throw new Error("Douyu socket is not writable");
    }

    this.#socket.write(encodeDouyuClientCommand(command));
  }

  #startHeartbeat(config: DouyuRoomCaptureConfig): void {
    this.#clearHeartbeatTimer();
    this.#heartbeatTimer = setInterval(() => {
      try {
        this.#sendCommand(createHeartbeatRequest());
      } catch (error) {
        this.#emitCaptureError("socket_error", errorMessage(error), true);
      }
    }, config.heartbeatIntervalMs);
  }

  #scheduleReconnect(): void {
    const config = this.#config;
    if (config === null || this.#stopping || !config.reconnect.enabled) {
      return;
    }

    const nextAttempt = this.#reconnectAttempts + 1;
    if (nextAttempt > config.reconnect.maxAttempts) {
      this.#status = "error";
      this.#emitCaptureError("connect_failed", "Douyu reconnect attempts exhausted", false);
      return;
    }

    this.#reconnectAttempts = nextAttempt;
    const delayMs = calculateReconnectDelayMs({
      attempt: nextAttempt - 1,
      initialDelayMs: config.reconnect.initialDelayMs,
      maxDelayMs: config.reconnect.maxDelayMs,
    });

    this.#logger.warn("douyu.reconnect.scheduled", "Douyu reconnect scheduled", {
      roomId: config.roomId,
      attempt: nextAttempt,
      delayMs,
    });

    this.#clearReconnectTimer();
    this.#reconnectTimer = setTimeout(() => {
      void this.start(config);
    }, delayMs);
  }

  #emitCaptureError(
    code: Parameters<typeof createDouyuCaptureErrorEvent>[0]["code"],
    message: string,
    recoverable: boolean,
  ): void {
    if (this.#config === null) {
      return;
    }

    this.#emitEvent(
      createDouyuCaptureErrorEvent({
        roomId: this.#config.roomId,
        code,
        message,
        recoverable,
      }),
    );
  }

  #emitEvent(event: DouyuEvent): void {
    this.#events.emit("event", event);
  }

  #clearHeartbeatTimer(): void {
    if (this.#heartbeatTimer !== null) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Douyu capture error";
}
