import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const coopCoep = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: coopCoep },
  preview: { headers: coopCoep },
  build: {
    target: "es2022",
    // El WASM de LibreOffice (~254 MB) se sirve aparte de /public, no bundleado
    chunkSizeWarningLimit: 1024,
  },
});
