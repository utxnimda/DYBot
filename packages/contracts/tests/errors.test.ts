import { describe, expect, it } from "vitest";
import { BotErrorSchema, createBotError, createTraceId } from "../src";

describe("createBotError", () => {
  it("creates a schema-valid bot error", () => {
    const error = createBotError({
      code: "RUNTIME_ERROR",
      message: "Runtime failed",
      traceId: createTraceId(),
    });

    expect(BotErrorSchema.parse(error)).toMatchObject({
      code: "RUNTIME_ERROR",
      message: "Runtime failed",
      recoverable: true,
    });
  });
});
