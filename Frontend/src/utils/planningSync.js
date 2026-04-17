/**
 * Utilitaire — Synchronisation temps réel du planning.
 *
 * Ce module permet de notifier tous les composants React ouverts (même dans
 * d'autres onglets du navigateur) qu'un planning a été modifié et qu'ils
 * doivent recharger leurs données.
 *
 * Pourquoi ce système existe-t-il ?
 * Quand un utilisateur effectue une action dans une page (ex: échange de cours d'un
 * étudiant, régénération d'un horaire), d'autres composants affichent peut-être
 * les mêmes données en parallèle (onglets ouverts, panneaux différents).
 * Ce module leur envoie un signal pour qu'ils se rafraîchissent automatiquement.
 *
 * Deux canaux sont utilisés :
 *  1. CustomEvent (window) → notifie les composants dans la même page/onglet
 *  2. BroadcastChannel     → notifie les autres onglets du même navigateur
 *
 * @module utils/planningSync
 */

/**
 * Nom de l'événement personnalisé dispatché sur window.
 * Tous les composants qui écoutent ce nom seront notifiés.
 *
 * @type {string}
 */
const PLANNING_SYNC_EVENT = "planning-sync";

/**
 * Nom du canal BroadcastChannel partagé entre tous les onglets.
 * Doit être le même partout pour que les onglets se trouvent.
 *
 * @type {string}
 */
const PLANNING_SYNC_CHANNEL = "planning-sync-channel";

/**
 * Identifiant unique de cette instance de la page (onglet courant).
 *
 * Utilisé pour ignorer ses propres messages BroadcastChannel :
 * quand on émet via le canal, on ne veut pas se notifier soi-même
 * (l'événement window suffit pour la même page).
 *
 * @type {string}
 */
const ORIGINE_SYNC = `planning-sync-${Math.random().toString(36).slice(2)}`;

/**
 * Cache du BroadcastChannel pour éviter de le recréer à chaque appel.
 * null si BroadcastChannel n'est pas disponible (environnement SSR, tests...).
 *
 * @type {BroadcastChannel|null}
 */
let channelCache = null;

/**
 * Obtient le BroadcastChannel partagé, en le créant si nécessaire.
 *
 * Retourne null si le code tourne côté serveur (SSR) ou dans un environnement
 * qui ne supporte pas BroadcastChannel (ex: vieux navigateurs ou tests Jest).
 *
 * @returns {BroadcastChannel|null} Le canal partagé, ou null si indisponible
 */
function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null; // Pas disponible côté serveur ou dans les tests Node
  }

  if (!channelCache) {
    channelCache = new BroadcastChannel(PLANNING_SYNC_CHANNEL);
  }

  return channelCache;
}

/**
 * Émet un signal de synchronisation du planning.
 *
 * Notifie deux audiences :
 *  1. Les composants dans la même page (via CustomEvent sur window)
 *  2. Les autres onglets ouverts (via BroadcastChannel)
 *
 * Le payload peut contenir des informations pour filtrer les rechargements —
 * par exemple, ne recharger que les données d'un étudiant spécifique plutôt
 * que tout le planning.
 *
 * @param {object} [payload={}] - Données optionnelles sur ce qui a changé
 * @param {number[]} [payload.etudiants_impactes] - IDs des étudiants concernés
 * @param {number[]} [payload.groupes_impactes] - IDs des groupes concernés
 * @param {object} [payload.synchronisation] - Données de sync du backend
 */
export function emettreSynchronisationPlanning(payload = {}) {
  if (typeof window === "undefined") {
    return; // Rien à faire côté serveur
  }

  const detail = {
    horodatage: new Date().toISOString(), // Pour le débogage et le tri des événements
    origine: ORIGINE_SYNC,               // Pour ignorer ses propres messages BroadcastChannel
    ...payload,
  };

  // Notifier les composants de la même page
  window.dispatchEvent(new CustomEvent(PLANNING_SYNC_EVENT, { detail }));

  // Notifier les autres onglets (BroadcastChannel ignore la même page)
  getChannel()?.postMessage(detail);
}

/**
 * Écoute les signaux de synchronisation et appelle le callback quand ils arrivent.
 *
 * S'abonne aux deux canaux (window et BroadcastChannel) et retourne une fonction
 * de nettoyage à appeler dans le return du useEffect() React pour éviter les fuites.
 *
 * Les messages provenant du même onglet via BroadcastChannel sont ignorés
 * (ORIGINE_SYNC !== detail.origine) car le CustomEvent les a déjà couverts.
 *
 * Exemple d'usage dans React :
 * ```js
 * useEffect(() => {
 *   return ecouterSynchronisationPlanning((payload) => {
 *     chargerDonnees(); // Recharger quand le planning change
 *   });
 * }, []);
 * ```
 *
 * @param {Function} callback - Fonction appelée à chaque signal reçu
 * @param {object|null} callback.payload - Les données transmises avec le signal
 * @returns {Function} Fonction de nettoyage à appeler dans useEffect()
 */
export function ecouterSynchronisationPlanning(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {}; // Retourner une fonction vide pour éviter les erreurs dans useEffect
  }

  // Gestionnaire pour les événements de la même page
  const gererEvenementFenetre = (event) => {
    callback(event.detail || null);
  };

  // Gestionnaire pour les messages des autres onglets
  const gererEvenementCanal = (event) => {
    const detail = event.data || null;

    // Ignorer les messages qu'on a nous-mêmes émis (traités par le CustomEvent)
    if (!detail || detail.origine === ORIGINE_SYNC) {
      return;
    }

    callback(detail);
  };

  window.addEventListener(PLANNING_SYNC_EVENT, gererEvenementFenetre);
  getChannel()?.addEventListener("message", gererEvenementCanal);

  // Retourner la fonction de nettoyage pour useEffect()
  return () => {
    window.removeEventListener(PLANNING_SYNC_EVENT, gererEvenementFenetre);
    getChannel()?.removeEventListener("message", gererEvenementCanal);
  };
}
