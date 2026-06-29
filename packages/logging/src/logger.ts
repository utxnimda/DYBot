import type { BotModuleId, LogEntry, LogLevel } from "@dybot/contracts";
import { createTraceId } from "@dybot/contracts";
import { redactValue } from "./redaction";

export interface LogSink {
  write(entry: LogEntry): void;
}

export interface Logger {
  debug(event: string, message: string, context?: Record<string, unknown>): void;
  info(event: string, message: string, context?: Record<string, unknown>): void;
  warn(event: string, message: string, context?: Record<string, unknown>): void;
  error(event: string, message: string, context?: Record<string, unknown>): void;
}

export interface CreateLoggerOptions {
  module: BotModuleId;
  minLevel?: LogLevel;
  sink?: LogSink;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class ConsoleLogSink implements LogSink {
  write(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (entry.level === "error") {
      console.error(line);
      return;
    }
    if (entry.level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}

export class StructuredLogger implements Logger {
  readonly #module: BotModuleId;
  readonly #minLevel: LogLevel;
  readonly #sink: LogSink;

  constructor(options: CreateLoggerOptions) {
    this.#module = options.module;
    this.#minLevel = options.minLevel ?? "info";
    this.#sink = options.sink ?? new ConsoleLogSink();
  }

  debug(event: string, message: string, context?: Record<string, unknown>): void {
    this.#write("debug", event, message, context);
  }

  info(event: string, message: string, context?: Record<string, unknown>): void {
    this.#write("info", event, message, context);
  }

  warn(event: string, message: string, context?: Record<string, unknown>): void {
    this.#write("warn", event, message, context);
  }

  error(event: string, message: string, context?: Record<string, unknown>): void {
    this.#write("error", event, message, context);
  }

  #write(level: LogLevel, event: string, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.#minLevel]) return;

    this.#sink.write({
      ts: new Date().toISOString(),
      level,
      module: this.#module,
      event,
      message,
      traceId: createTraceId(),
      context: context ? (redactValue(context) as Record<string, unknown>) : undefined,
    });
  }
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return new StructuredLogger(options);
}
