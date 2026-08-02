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
    alias: {
      "thinking-head/react": fileURLToPath(new URL("../src/react.ts", import.meta.url)),
      "thinking-head": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
});
