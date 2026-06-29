import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { IpcChannel } from "@dybot/contracts";
import { createRuntimeOrchestrator } from "@dybot/core";
import { createLogger } from "@dybot/logging";

const logger = createLogger({ module: "desktop-main" });
const runtime = createRuntimeOrchestrator({ logger: createLogger({ module: "runtime" }) });

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
      preload: join(__dirname, "../preload/index.mjs"),
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

function broadcastRuntimeEvent(): void {
  runtime.onEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.BotEvent, event);
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.BotGetHealth, () => runtime.getHealth());
  ipcMain.handle(IpcChannel.BotStart, () => runtime.start());
  ipcMain.handle(IpcChannel.BotStop, () => runtime.stop());
}

app
  .whenReady()
  .then(() => {
    registerIpcHandlers();
    broadcastRuntimeEvent();
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
