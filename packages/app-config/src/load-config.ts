import { BotAppConfigSchema, type BotAppConfig } from "@dybot/contracts";
import { DEFAULT_APP_CONFIG } from "./defaults";

export function parseAppConfig(input: unknown): BotAppConfig {
  return BotAppConfigSchema.parse({
    ...DEFAULT_APP_CONFIG,
    ...(typeof input === "object" && input ? input : {}),
  });
}

export function getDefaultAppConfig(): BotAppConfig {
  return parseAppConfig(DEFAULT_APP_CONFIG);
}
