import { describe, expect, it } from "vitest";
import { calculateReconnectDelayMs } from "../src/reconnect/backoff";

describe("Douyu reconnect backoff", () => {
  it("uses capped exponential delays", () => {
    expect(calculateReconnectDelayMs({ attempt: 0, initialDelayMs: 1000, maxDelayMs: 5000 })).toBe(
      1000,
    );
    expect(calculateReconnectDelayMs({ attempt: 2, initialDelayMs: 1000, maxDelayMs: 5000 })).toBe(
      4000,
    );
    expect(calculateReconnectDelayMs({ attempt: 5, initialDelayMs: 1000, maxDelayMs: 5000 })).toBe(
      5000,
    );
  });
});
