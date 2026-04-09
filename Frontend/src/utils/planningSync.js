const PLANNING_SYNC_EVENT = "planning-sync";
const PLANNING_SYNC_CHANNEL = "planning-sync-channel";
const ORIGINE_SYNC = `planning-sync-${Math.random().toString(36).slice(2)}`;

let channelCache = null;

function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (!channelCache) {
    channelCache = new BroadcastChannel(PLANNING_SYNC_CHANNEL);
  }

  return channelCache;
}

export function emettreSynchronisationPlanning(payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    horodatage: new Date().toISOString(),
    origine: ORIGINE_SYNC,
    ...payload,
  };

  window.dispatchEvent(new CustomEvent(PLANNING_SYNC_EVENT, { detail }));
  getChannel()?.postMessage(detail);
}

export function ecouterSynchronisationPlanning(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  const gererEvenementFenetre = (event) => {
    callback(event.detail || null);
  };
  const gererEvenementCanal = (event) => {
    const detail = event.data || null;

    if (!detail || detail.origine === ORIGINE_SYNC) {
      return;
    }

    callback(detail);
  };

  window.addEventListener(PLANNING_SYNC_EVENT, gererEvenementFenetre);
  getChannel()?.addEventListener("message", gererEvenementCanal);

  return () => {
    window.removeEventListener(PLANNING_SYNC_EVENT, gererEvenementFenetre);
    getChannel()?.removeEventListener("message", gererEvenementCanal);
  };
}
