import { describe, expect, it } from "vitest";
import { redactValue } from "../src";

describe("redactValue", () => {
  it("redacts secret-like keys recursively", () => {
    expect(
      redactValue({
        apiKey: "sk-test",
        nested: {
          token: "abc",
          visible: "ok",
        },
      }),
    ).toEqual({
      apiKey: "[redacted]",
      nested: {
        token: "[redacted]",
        visible: "ok",
      },
    });
  });
});
