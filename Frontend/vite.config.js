import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendTarget = process.env.VITE_BACKEND_TARGET || "https://localhost:3000";
const backendProxy = {
  target: backendTarget,
  changeOrigin: true,
  secure: false,
};
const configDir = dirname(fileURLToPath(import.meta.url));
const frontendKeyPath = resolve(configDir, "../Backend/security/localhost.key");
const frontendCertPath = resolve(configDir, "../Backend/security/localhost.cert");
const frontendHttps =
  existsSync(frontendKeyPath) && existsSync(frontendCertPath)
    ? {
        key: readFileSync(frontendKeyPath),
        cert: readFileSync(frontendCertPath),
      }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    https: frontendHttps,
    proxy: {
      "/api": backendProxy,
      "/auth": backendProxy,
    },
  },
});
