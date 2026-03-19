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
    strictPort: false,
    fs: {
      allow: [projectRoot]
    },
    proxy: {
      "/api": "http://localhost:8791",
      "/socket.io": {
        target: "http://localhost:8791",
        ws: true
      }
    }
  },
  build: {
    outDir: path.resolve(webRoot, "../../dist/web"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "three-runtime";
          }

          if (id.includes("apps/web/src/components/OfficeWorld3D")) {
            return "office-world";
          }
        }
      }
    }
  }
});
