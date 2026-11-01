import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { reportApi } from './server/api.mjs';

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["vue", "@yiitap/vue"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.js"],
    },
  },
  plugins: [vue(), reportApi()],
});
