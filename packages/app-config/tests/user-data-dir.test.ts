import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDefaultStorageDatabasePath,
  resolveRuntimeDataDir,
  resolveUserDataDir,
} from "../src";

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

describe("storage runtime paths", () => {
  it("places runtime data below the user data root", () => {
    expect(
      resolveRuntimeDataDir({
        platform: "win32",
        env: { APPDATA: "C:\\Users\\demo\\AppData\\Roaming" },
      }),
    ).toBe(join("C:\\Users\\demo\\AppData\\Roaming", "DYBot", "data"));
  });

  it("resolves the default SQLite database path", () => {
    expect(resolveDefaultStorageDatabasePath({ portableRoot: "D:\\DYBot" })).toBe(
      join("D:\\DYBot", "data", "data", "dybot.sqlite"),
    );
  });
});
