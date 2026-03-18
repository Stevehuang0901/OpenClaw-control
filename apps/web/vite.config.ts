import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(webRoot, "../..");

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [projectRoot]
    },
    proxy: {
      "/api": "http://localhost:8787",
      "/socket.io": {
        target: "http://localhost:8787",
        ws: true
      }
    }
  },
  build: {
    outDir: path.resolve(webRoot, "../../dist/web"),
    emptyOutDir: true
  }
});
