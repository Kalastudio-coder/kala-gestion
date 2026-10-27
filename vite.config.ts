import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Rutas relativas: Electron abre dist/index.html desde el disco.
  base: "./",
  plugins: [react(), tailwindcss()],
});
