import { execFileSync } from "node:child_process";
import process from "node:process";

function lirePort() {
  const valeur = Number(process.env.PORT || 3000);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : 3000;
}

function listerPidsWindows(port) {
  try {
    const script = [
      `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
      "if ($connections) {",
      "  $connections | Select-Object -ExpandProperty OwningProcess -Unique",
      "}",
    ].join("; ");
    const resultat = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );

    return resultat
      .split(/\r?\n/)
      .map((ligne) => Number(String(ligne).trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function listerPidsUnix(port) {
  try {
    const resultat = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return resultat
      .split(/\r?\n/)
      .map((ligne) => Number(String(ligne).trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function tuerPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      return true;
    }
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

const port = lirePort();
const pids =
  process.platform === "win32"
    ? listerPidsWindows(port)
    : listerPidsUnix(port);
const pidsTues = pids.filter((pid) => tuerPid(pid));

if (pidsTues.length > 0) {
  console.log(
    `[dev-port] Port ${port} libere. Processus arretes: ${pidsTues.join(", ")}.`
  );
}
