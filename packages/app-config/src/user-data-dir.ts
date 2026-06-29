import { homedir } from "node:os";
import { join } from "node:path";

export interface ResolveUserDataDirOptions {
  appName?: string;
  portableRoot?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}

export function resolveUserDataDir(options: ResolveUserDataDirOptions = {}): string {
  const appName = options.appName ?? "DYBot";
  if (options.portableRoot) {
    return join(options.portableRoot, "data");
  }

  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;

  if (platform === "win32") {
    return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), appName);
  }

  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", appName);
  }

  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), appName);
}
