import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        embryo: resolve(import.meta.dirname, "embryo/index.html"),
      },
      output: {
        manualChunks: {
          three: ["three"],
          react: ["react", "react-dom"],
          translations: ["content", "interface", "viewer", "white-matter"].map(
            (name) => resolve(import.meta.dirname, `src/locales/${name}.en.ts`),
          ),
        },
      },
    },
  },
});
