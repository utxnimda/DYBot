import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const workspacePackages = [
  "@dybot/app-config",
  "@dybot/contracts",
  "@dybot/core",
  "@dybot/logging",
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/main/src/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/preload/src/index.ts"),
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
