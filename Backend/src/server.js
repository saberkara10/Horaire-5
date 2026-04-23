/**
 * Point d'entree du serveur backend Express.
 *
 * Le backend demarre en HTTP local par defaut, ce qui correspond au flux
 * `npm run dev` du depot. Un demarrage HTTPS reste possible si
 * `HTTPS_ENABLED=true` et que les certificats locaux sont disponibles.
 *
 * @module server
 */

import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || "false").toLowerCase() === "true";
const DEFAULT_KEY_PATH = path.resolve(__dirname, "../security/localhost.key");
const DEFAULT_CERT_PATH = path.resolve(__dirname, "../security/localhost.cert");

function resolveHttpsPath(envValue, fallbackPath) {
  if (!envValue) {
    return fallbackPath;
  }

  return path.isAbsolute(envValue)
    ? envValue
    : path.resolve(process.cwd(), envValue);
}

async function loadHttpsCredentials() {
  const keyPath = resolveHttpsPath(process.env.HTTPS_KEY_PATH, DEFAULT_KEY_PATH);
  const certPath = resolveHttpsPath(process.env.HTTPS_CERT_PATH, DEFAULT_CERT_PATH);

  try {
    const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
    return { key, cert };
  } catch (error) {
    error.message =
      `Impossible de demarrer en HTTPS: certificat local introuvable ou illisible ` +
      `(${keyPath}, ${certPath}). ${error.message}`;
    throw error;
  }
}

async function startServer() {
  let protocol = "http";
  let server = http.createServer(app);

  if (HTTPS_ENABLED) {
    const credentials = await loadHttpsCredentials();
    protocol = "https";
    server = https.createServer(credentials, app);
  }

  server.listen(PORT, () => {
    console.log(`Serveur ${protocol.toUpperCase()} lance sur ${protocol}://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
