import { execFileSync } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);

function listerPidsWindows(port) {
  try {
    const script = [
      `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
      "if ($connections) {",
      "  $connections | Select-Object -ExpandProperty OwningProcess -Unique",
      "}",
    ].join(" ");
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

const pids =
  process.platform === "win32"
    ? listerPidsWindows(PORT)
    : listerPidsUnix(PORT);

for (const pid of pids) {
  tuerPid(pid);
}
