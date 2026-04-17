/**
 * Index de placement par ressource et par date.
 *
 * Ce module fournit une structure de données optimisée pour répondre rapidement
 * à la question centrale du scheduler : "Cette ressource est-elle disponible
 * ce jour-là à cet horaire ?"
 *
 * Structure interne (Map tripartite) :
 *  store
 *   └─ Map<resourceType>
 *       └─ Map<resourceId>
 *           └─ Map<date>
 *               └─ Array<placement>  (trié par heure_debut)
 *
 * Pourquoi cette structure ?
 *  - Accès O(1) par type + ID + date (vs O(n) si on cherchait dans un tableau plat)
 *  - Placements triés par heure pour faciliter la détection de conflits
 *  - Les types de ressources sont normalisés (alias "prof" → "professeur")
 *
 * Ressources gérées : professeurs, groupes d'étudiants, étudiants individuels.
 *
 * @module services/scheduler/constraints/ResourceDayPlacementIndex
 */
import { timeStringToMinutes } from "../time/TimeSlotUtils.js";

/**
 * Table de normalisation des types de ressources.
 * Permet d'accepter plusieurs noms pour le même type (français, anglais, abrégé).
 *
 * @type {Map<string, string>}
 */
const RESOURCE_TYPE_ALIASES = new Map([
  ["prof", "professeur"],
  ["professeur", "professeur"],
  ["teacher", "professeur"],
  ["groupe", "groupe"],
  ["group", "groupe"],
  ["etudiant", "etudiant"],
  ["student", "etudiant"],
]);

/**
 * Normalise un type de ressource vers sa forme canonique.
 *
 * @param {*} resourceType - Le type brut ("prof", "teacher", "groupe"...)
 * @returns {string} Le type normalisé ("professeur", "groupe", "etudiant")
 */
function normalizeResourceType(resourceType) {
  const normalized = String(resourceType || "").trim().toLowerCase();
  return RESOURCE_TYPE_ALIASES.get(normalized) ?? normalized;
}

/**
 * Normalise une date vers le format "YYYY-MM-DD".
 *
 * @param {*} dateValue - La date à normaliser
 * @returns {string} Les 10 premiers caractères de la date
 */
function normalizeDate(dateValue) {
  return String(dateValue || "").trim().slice(0, 10);
}

/**
 * Normalise un identifiant de ressource.
 *
 * Préfère les identifiants numériques (ID de BDD) pour la performance de comparaison.
 * Si la valeur n'est pas un nombre valide, retourne la chaîne nettoyée.
 *
 * @param {*} resourceId - L'identifiant brut
 * @returns {number|string} L'identifiant normalisé
 */
function normalizeResourceId(resourceId) {
  const numericId = Number(resourceId);
  return Number.isFinite(numericId) && numericId > 0
    ? numericId
    : String(resourceId || "").trim();
}

/**
 * Crée une copie superficielle d'un placement pour éviter les mutations accidentelles.
 *
 * @param {object} placement - Le placement à cloner
 * @returns {object} Copie du placement
 */
function clonePlacement(placement) {
  return {
    ...placement,
  };
}

/**
 * Comparateur pour trier les placements par heure de début croissante.
 *
 * En cas d'égalité sur heure_debut, on compare heure_fin puis l'ID d'affectation.
 * Ce tri stable garantit un ordre déterministe, important pour la détection de conflits.
 *
 * @param {object} leftPlacement - Premier placement
 * @param {object} rightPlacement - Second placement
 * @returns {number} Négatif si left avant right
 */
function comparePlacements(leftPlacement, rightPlacement) {
  const leftStartMinutes = timeStringToMinutes(leftPlacement?.heure_debut);
  const rightStartMinutes = timeStringToMinutes(rightPlacement?.heure_debut);

  if (leftStartMinutes !== rightStartMinutes) {
    return leftStartMinutes - rightStartMinutes;
  }

  const leftEndMinutes = timeStringToMinutes(leftPlacement?.heure_fin);
  const rightEndMinutes = timeStringToMinutes(rightPlacement?.heure_fin);

  if (leftEndMinutes !== rightEndMinutes) {
    return leftEndMinutes - rightEndMinutes;
  }

  // Tri tertiaire sur l'ID pour garantir la stabilité
  return String(
    leftPlacement?.id_affectation_cours ?? leftPlacement?.id ?? ""
  ).localeCompare(
    String(rightPlacement?.id_affectation_cours ?? rightPlacement?.id ?? ""),
    "fr"
  );
}

/**
 * Détermine si deux placements représentent le même cours planifié.
 *
 * Stratégie de correspondance :
 *  1. Si les deux ont un ID d'affectation → comparer les IDs (fiable et rapide)
 *  2. Sinon → comparer date + heure_debut + heure_fin (pour les placements temporaires)
 *
 * @param {object} leftPlacement - Premier placement
 * @param {object} rightPlacement - Second placement
 * @returns {boolean} true si les deux placements représentent la même séance
 */
function placementsMatch(leftPlacement, rightPlacement) {
  if (!leftPlacement || !rightPlacement) {
    return false;
  }

  const leftId = leftPlacement.id_affectation_cours ?? leftPlacement.id;
  const rightId = rightPlacement.id_affectation_cours ?? rightPlacement.id;

  // Méthode fiable : comparaison sur l'ID persisté en BDD
  if (leftId != null && rightId != null) {
    return String(leftId) === String(rightId);
  }

  // Méthode de secours : correspondance sur date + horaire
  return (
    normalizeDate(leftPlacement.date) === normalizeDate(rightPlacement.date) &&
    String(leftPlacement.heure_debut || "").trim() ===
      String(rightPlacement.heure_debut || "").trim() &&
    String(leftPlacement.heure_fin || "").trim() ===
      String(rightPlacement.heure_fin || "").trim()
  );
}

/**
 * Normalise une entrée avant de l'insérer dans l'index.
 *
 * Une entrée peut contenir le placement directement ou dans un champ `placement`.
 * Cette fonction unifie les deux formats et valide que tous les champs requis
 * sont présents.
 *
 * @param {object|null} entry - L'entrée à normaliser
 * @returns {{ resourceType, resourceId, date, placement }|null} Entrée normalisée ou null
 */
function normalizeEntry(entry) {
  // Extraire le placement (direct ou imbriqué)
  const placement = entry?.placement ? entry.placement : entry;
  const resourceType = normalizeResourceType(entry?.resourceType);
  const resourceId = normalizeResourceId(entry?.resourceId);
  const date = normalizeDate(entry?.date ?? placement?.date);

  // Tous les champs sont requis pour indexer correctement
  if (!resourceType || !resourceId || !date || !placement) {
    return null;
  }

  return {
    resourceType,
    resourceId,
    date,
    placement: {
      ...clonePlacement(placement),
      date, // S'assurer que la date normalisée est dans le placement
    },
  };
}

/**
 * Index de placements organisé par ressource (type + ID) et par date.
 *
 * Utilisé par le scheduler pour vérifier les disponibilités en temps réel
 * pendant la phase d'affectation. Chaque ressource (professeur, groupe,
 * étudiant) a sa propre liste de placements par jour.
 *
 * @example
 * const index = new ResourceDayPlacementIndex();
 * index.add({ resourceType: "professeur", resourceId: 42, date: "2025-01-15", heure_debut: "08:00:00", heure_fin: "10:00:00" });
 * const occupations = index.get({ resourceType: "professeur", resourceId: 42, date: "2025-01-15" });
 */
export class ResourceDayPlacementIndex {
  /**
   * Initialise l'index avec des entrées optionnelles.
   *
   * @param {object[]} [initialEntries=[]] - Entrées à pré-charger dans l'index
   */
  constructor(initialEntries = []) {
    /**
     * Structure de stockage tripartite : type → ID → date → placements.
     * @type {Map<string, Map<number|string, Map<string, object[]>>>}
     */
    this.store = new Map();

    // Charger les entrées initiales
    for (const entry of initialEntries) {
      this.add(entry);
    }
  }

  /**
   * Ajoute un placement dans l'index.
   *
   * Si la ressource et la date existent déjà, le placement est ajouté à la liste
   * existante qui est re-triée par heure. Sinon, les niveaux manquants sont créés.
   *
   * @param {object} entry - Le placement à ajouter avec resourceType, resourceId, date
   * @returns {this} L'instance pour permettre le chaînage
   */
  add(entry) {
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry) {
      return this; // Entrée invalide ignorée silencieusement
    }

    const { resourceType, resourceId, date, placement } = normalizedEntry;
    const resourceStore = this.#ensureResourceStore(resourceType, resourceId);
    const dayPlacements = resourceStore.get(date) ?? [];

    dayPlacements.push(clonePlacement(placement));

    // Maintenir le tri chronologique après chaque ajout
    resourceStore.set(
      date,
      dayPlacements.sort(comparePlacements).map(clonePlacement)
    );

    return this;
  }

  /**
   * Supprime un placement de l'index.
   *
   * Identifie le placement à supprimer via placementsMatch() (par ID si disponible,
   * sinon par date+heure). Nettoie les niveaux vides après suppression pour
   * ne pas laisser de Maps vides dans l'arbre.
   *
   * @param {object} entry - Le placement à supprimer (mêmes champs que add())
   * @returns {number} Le nombre de placements supprimés (0 si non trouvé)
   */
  remove(entry) {
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry) {
      return 0;
    }

    const { resourceType, resourceId, date, placement } = normalizedEntry;
    const resourceStore = this.store.get(resourceType)?.get(resourceId);
    const dayPlacements = resourceStore?.get(date);

    if (!dayPlacements) {
      return 0; // Rien à supprimer
    }

    const remainingPlacements = dayPlacements.filter(
      (existingPlacement) => !placementsMatch(existingPlacement, placement)
    );
    const removedCount = dayPlacements.length - remainingPlacements.length;

    if (remainingPlacements.length > 0) {
      resourceStore.set(date, remainingPlacements.map(clonePlacement));
    } else {
      resourceStore.delete(date); // Supprimer la date si plus aucun placement
    }

    // Nettoyage des niveaux vides pour éviter les fuites mémoire
    if (resourceStore.size === 0) {
      this.store.get(resourceType)?.delete(resourceId);
    }

    if ((this.store.get(resourceType)?.size ?? 0) === 0) {
      this.store.delete(resourceType);
    }

    return removedCount;
  }

  /**
   * Retourne tous les placements d'une ressource pour une date donnée.
   *
   * @param {{ resourceType, resourceId, date }} params - Clés de recherche
   * @returns {object[]} Liste de placements (vide si aucun), triée par heure
   */
  get({ resourceType, resourceId, date }) {
    const normalizedType = normalizeResourceType(resourceType);
    const normalizedId = normalizeResourceId(resourceId);
    const normalizedDate = normalizeDate(date);

    const dayPlacements =
      this.store.get(normalizedType)?.get(normalizedId)?.get(normalizedDate) ?? [];

    return dayPlacements.map(clonePlacement); // Retourner des copies pour éviter les mutations
  }

  /**
   * Vérifie si une ressource a des placements pour une date donnée.
   *
   * @param {{ resourceType, resourceId, date }} params - Clés de recherche
   * @returns {boolean} true si au moins un placement existe
   */
  has({ resourceType, resourceId, date }) {
    return this.get({ resourceType, resourceId, date }).length > 0;
  }

  /**
   * Vide complètement l'index.
   * Utilisé en début de génération pour repartir d'un état clean.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Assure l'existence de la Map de stockage pour une ressource donnée.
   *
   * Crée les niveaux manquants (type → ID) si nécessaire.
   * Méthode privée (#) — usage interne uniquement.
   *
   * @param {string} resourceType - Type normalisé
   * @param {number|string} resourceId - ID normalisé
   * @returns {Map<string, object[]>} La Map date → placements de cette ressource
   */
  #ensureResourceStore(resourceType, resourceId) {
    if (!this.store.has(resourceType)) {
      this.store.set(resourceType, new Map());
    }

    const typeStore = this.store.get(resourceType);
    if (!typeStore.has(resourceId)) {
      typeStore.set(resourceId, new Map());
    }

    return typeStore.get(resourceId);
  }
}

/**
 * Fonction d'usine pour créer un ResourceDayPlacementIndex.
 *
 * Alias pratique pour éviter d'écrire `new ResourceDayPlacementIndex()` partout.
 *
 * @param {object[]} [initialEntries=[]] - Entrées initiales
 * @returns {ResourceDayPlacementIndex}
 */
export function createResourceDayPlacementIndex(initialEntries = []) {
  return new ResourceDayPlacementIndex(initialEntries);
}
