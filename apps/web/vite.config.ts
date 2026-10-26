import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(root, "src") } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
