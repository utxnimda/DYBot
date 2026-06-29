import { describe, expect, it } from "vitest";
import { resolveUserDataDir } from "../src";

describe("resolveUserDataDir", () => {
  it("uses APPDATA on Windows", () => {
    expect(
      resolveUserDataDir({
        platform: "win32",
        env: { APPDATA: "C:\\Users\\demo\\AppData\\Roaming" },
      }),
    ).toContain("DYBot");
  });

  it("uses portable data when portableRoot is provided", () => {
    expect(resolveUserDataDir({ portableRoot: "D:\\DYBot" })).toBe("D:\\DYBot\\data");
  });
});
