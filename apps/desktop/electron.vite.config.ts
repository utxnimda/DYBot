import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const workspacePackages = [
  "@dybot/app-config",
  "@dybot/ai",
  "@dybot/audio",
  "@dybot/contracts",
  "@dybot/core",
  "@dybot/douyu",
  "@dybot/logging",
  "@dybot/storage",
  "@dybot/voice",
];

const nativeRuntimeDependencies = ["sqlite3"];
const externalizeOptions = {
  exclude: workspacePackages,
  include: nativeRuntimeDependencies,
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(externalizeOptions)],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/main/src/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(externalizeOptions)],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/preload/src/index.ts"),
        output: {
          // Sandboxed Electron preload scripts cannot run ESM imports reliably.
          entryFileNames: "[name].cjs",
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    plugins: [vue()],
    root: resolve(__dirname, "renderer"),
    build: {
      rollupOptions: {
        input: resolve(__dirname, "renderer/index.html"),
      },
    },
  },
});
