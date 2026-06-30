import { contextBridge, ipcRenderer } from "electron";
import {
  BotEventSchema,
  DouyuStartCaptureRequestSchema,
  HealthSnapshotSchema,
  IpcChannel,
  type BotEvent,
  type DybotDesktopApi,
} from "@dybot/contracts";

function parseHealthSnapshot(value: unknown) {
  return HealthSnapshotSchema.parse(value);
}

function parseDouyuCaptureConfig(value: unknown) {
  return DouyuStartCaptureRequestSchema.parse(value);
}

const api: DybotDesktopApi = {
  bot: {
    async getHealth() {
      return parseHealthSnapshot(await ipcRenderer.invoke(IpcChannel.BotGetHealth));
    },
    async start() {
      return parseHealthSnapshot(await ipcRenderer.invoke(IpcChannel.BotStart));
    },
    async stop() {
      return parseHealthSnapshot(await ipcRenderer.invoke(IpcChannel.BotStop));
    },
    douyu: {
      async getDefaultRoom() {
        return parseDouyuCaptureConfig(await ipcRenderer.invoke(IpcChannel.DouyuGetDefaultRoom));
      },
      async start(input) {
        const config = parseDouyuCaptureConfig(input);
        return parseHealthSnapshot(await ipcRenderer.invoke(IpcChannel.DouyuStart, config));
      },
      async stop() {
        return parseHealthSnapshot(await ipcRenderer.invoke(IpcChannel.DouyuStop));
      },
    },
    onEvent(listener: (event: BotEvent) => void) {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        const parsed = BotEventSchema.safeParse(payload);
        if (parsed.success) {
          listener(parsed.data);
        }
      };
      ipcRenderer.on(IpcChannel.BotEvent, handler);
      return () => ipcRenderer.off(IpcChannel.BotEvent, handler);
    },
  },
};

contextBridge.exposeInMainWorld("dybot", api);
