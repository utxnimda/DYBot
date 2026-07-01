import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { getDefaultAppConfig, resolveDefaultStorageDatabasePath } from "@dybot/app-config";
import { MockAiProvider } from "@dybot/ai";
import { DouyuRoomCaptureConfigSchema, IpcChannel, type BotEvent } from "@dybot/contracts";
import { createRuntimeOrchestrator, type RuntimeOrchestratorOptions } from "@dybot/core";
import { DouyuTcpCaptureClient } from "@dybot/douyu";
import { createLogger } from "@dybot/logging";
import { createStorageService, type StorageService } from "@dybot/storage";

const logger = createLogger({ module: "desktop-main" });
const appConfig = getDefaultAppConfig();
const douyuCapture = new DouyuTcpCaptureClient({ logger: createLogger({ module: "douyu" }) });
const runtimeOptions: RuntimeOrchestratorOptions = {
  logger: createLogger({ module: "runtime" }),
  douyuCapture,
};
if (appConfig.features.aiReply) {
  runtimeOptions.aiProvider = new MockAiProvider();
}
const runtime = createRuntimeOrchestrator(runtimeOptions);

let storageService: StorageService | null = null;
let runtimeEventUnsubscribe: (() => void) | null = null;
let isClosing = false;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "DYBot",
    backgroundColor: "#f5f7fb",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

async function initializeStorage(): Promise<StorageService> {
  const databasePath = resolveDefaultStorageDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  const service = await createStorageService({ filePath: databasePath });
  logger.info("storage.ready", "Storage database is ready");
  return service;
}

function attachRuntimeEventHandlers(storage: StorageService): void {
  if (runtimeEventUnsubscribe !== null) {
    return;
  }

  runtimeEventUnsubscribe = runtime.onEvent((event) => {
    void persistRuntimeEvent(storage, event);
    broadcastRuntimeEvent(event);
  });
}

async function persistRuntimeEvent(storage: StorageService, event: BotEvent): Promise<void> {
  try {
    await storage.events.insert(event);
  } catch (error: unknown) {
    logger.error("storage.event_persist_failed", "Failed to persist runtime event", {
      error: getErrorMessage(error),
      eventType: event.type,
      traceId: event.traceId,
    });
  }
}

function broadcastRuntimeEvent(event: BotEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannel.BotEvent, event);
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.BotGetHealth, () => runtime.getHealth());
  ipcMain.handle(IpcChannel.BotStart, () => runtime.start());
  ipcMain.handle(IpcChannel.BotStop, () => runtime.stop());
  ipcMain.handle(IpcChannel.DouyuGetDefaultRoom, () => appConfig.douyu.defaultRoom);
  ipcMain.handle(IpcChannel.DouyuStart, async (_event, input: unknown) => {
    const config = DouyuRoomCaptureConfigSchema.parse(input);
    runtime.start();
    return runtime.startDouyuCapture(config);
  });
  ipcMain.handle(IpcChannel.DouyuStop, () => runtime.stopDouyuCapture());
}

async function closeRuntimeResources(): Promise<void> {
  runtime.stop();

  if (runtimeEventUnsubscribe !== null) {
    runtimeEventUnsubscribe();
    runtimeEventUnsubscribe = null;
  }

  if (storageService !== null) {
    await storageService.close();
    storageService = null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

app
  .whenReady()
  .then(async () => {
    storageService = await initializeStorage();
    registerIpcHandlers();
    attachRuntimeEventHandlers(storageService);
    createMainWindow();
    logger.info("desktop.ready", "Desktop app is ready");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch((error: unknown) => {
    runtime.fail(error);
  });

app.on("before-quit", (event) => {
  if (isClosing) {
    return;
  }

  isClosing = true;
  event.preventDefault();
  void closeRuntimeResources().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
