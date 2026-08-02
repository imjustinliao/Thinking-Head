import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// Library build for the published package. The demo has its own config in demo/.
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
        react: fileURLToPath(new URL("src/react.ts", import.meta.url)),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
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
