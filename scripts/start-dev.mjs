import { spawn } from "node:child_process";
import process from "node:process";

const BACKEND_PORT = Number(process.env.PORT || 3000);
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;
const STARTUP_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 500;
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const windowsShellExecutable = process.env.ComSpec || "cmd.exe";

let backendProcess = null;
let frontendProcess = null;
let shuttingDown = false;

function spawnNpm(args, label) {
  const child =
    process.platform === "win32"
      ? spawn(windowsShellExecutable, ["/d", "/s", "/c", npmExecutable, ...args], {
          cwd: process.cwd(),
          stdio: ["inherit", "pipe", "pipe"],
        })
      : spawn(npmExecutable, args, {
          cwd: process.cwd(),
          stdio: ["inherit", "pipe", "pipe"],
        });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (label === "backend" && !frontendProcess) {
      console.error(
        `Le backend s'est arrete avant d'etre pret (code=${code ?? "null"}, signal=${signal ?? "null"}).`
      );
      shutdown(code ?? 1);
      return;
    }

    shutdown(code ?? 0);
  });

  return child;
}

async function waitForBackend() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Le backend n'est pas encore pret.
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Le backend n'a pas repondu sur ${HEALTH_URL} apres ${STARTUP_TIMEOUT_MS / 1000}s.`
  );
}

function terminateChild(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Ignorer les erreurs de terminaison.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  terminateChild(frontendProcess);
  terminateChild(backendProcess);
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  backendProcess = spawnNpm(["--prefix", "Backend", "run", "dev"], "backend");

  try {
    await waitForBackend();
  } catch (error) {
    console.error(error.message);
    shutdown(1);
    return;
  }

  frontendProcess = spawnNpm(["--prefix", "Frontend", "run", "dev"], "frontend");
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
