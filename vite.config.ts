import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Göreli temel yol: GitHub Pages'in /depo-adi/ alt yolunda da, yerelde de çalışır (hash yönlendirme sayesinde).
  base: "./",
  publicDir: "brand-assets/gurmekasap",
  plugins: [react(), tailwindcss()],
  // Diğer yerel demolarla (5173, 5174) aynı anda çalışabilmesi için ayrı port.
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  preview: { host: "127.0.0.1", port: 5275, strictPort: true },
});
