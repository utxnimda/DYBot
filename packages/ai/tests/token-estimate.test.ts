import { describe, expect, it } from "vitest";
import { estimatePromptTokens, estimateTokenCount } from "../src";

describe("token estimates", () => {
  it("estimates text tokens deterministically", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("hello")).toBe(2);
  });

  it("includes per-message overhead for prompt estimates", () => {
    expect(
      estimatePromptTokens([
        { role: "system", content: "hello" },
        { role: "user", content: "world" },
      ]),
    ).toBe(12);
  });
});
