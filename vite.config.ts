import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// Library build for the published package. The demo has its own config in demo/.
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
});
