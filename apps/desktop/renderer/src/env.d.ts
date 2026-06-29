/// <reference types="vite/client" />

import type { DybotDesktopApi } from "@dybot/contracts";

declare global {
  interface Window {
    dybot: DybotDesktopApi;
  }
}

export {};
