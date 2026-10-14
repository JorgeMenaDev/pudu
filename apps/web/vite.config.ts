import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the packaged app can load index.html from disk.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true },
});
