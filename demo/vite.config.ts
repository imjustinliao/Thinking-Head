import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    // Point at package source, not dist, so every edit to the head is live in the demo
    // the moment it is saved — no build step in the loop.
    alias: {
      "thinking-head/dev": fileURLToPath(new URL("../src/dev.ts", import.meta.url)),
      "thinking-head": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
});
