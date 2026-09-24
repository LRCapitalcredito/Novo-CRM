import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { previewPlugin } from "./server/preview";
export default defineConfig({
  plugins: [react(), previewPlugin()],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
        },
      },
    },
  },
});
