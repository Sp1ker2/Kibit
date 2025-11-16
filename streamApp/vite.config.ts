import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "kibitkostreamappv.pp.ua",
      "localhost",
      ".localhost",
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  // Настройка для SPA роутинга - все маршруты должны возвращать index.html
  preview: {
    port: 5173,
    host: '0.0.0.0',
  },
})
