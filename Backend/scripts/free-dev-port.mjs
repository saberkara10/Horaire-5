import { execSync } from "node:child_process";
import process from "node:process";

function lirePort() {
  const valeur = Number(process.env.PORT || 3000);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : 3000;
}

function executerSilencieusement(commande) {
  try {
    return execSync(commande, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
  } catch {
    return "";
  }
}

function recupererPidsWindows(port) {
  const sortie = executerSilencieusement(`netstat -ano -p tcp | findstr :${port}`);
  const lignes = sortie
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  const pids = new Set();

  for (const ligne of lignes) {
    const segments = ligne.split(/\s+/);
    const etat = segments[3];
    const pid = Number(segments[4]);

    if (etat !== "LISTENING" || !Number.isInteger(pid) || pid <= 0) {
      continue;
    }

    pids.add(pid);
  }

  return [...pids];
}

function recupererPidsUnix(port) {
  const sortie = executerSilencieusement(`lsof -ti tcp:${port}`);
  return sortie
    .split(/\r?\n/)
    .map((ligne) => Number(ligne.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function tuerPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

function tuerPidWindows(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  try {
    execSync(`taskkill /PID ${pid} /F`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

const port = lirePort();
const pids =
  process.platform === "win32" ? recupererPidsWindows(port) : recupererPidsUnix(port);
const tueur = process.platform === "win32" ? tuerPidWindows : tuerPid;
const pidsTues = pids.filter((pid) => tueur(pid));

if (pidsTues.length > 0) {
  console.log(
    `[dev-port] Port ${port} libere. Processus arretes: ${pidsTues.join(", ")}.`
  );
}
