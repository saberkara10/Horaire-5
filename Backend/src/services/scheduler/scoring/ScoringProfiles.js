/**
 * ScoringProfiles
 *
 * Ce module centralise les ponderations utilisees par scoring_v1.
 *
 * Responsabilites principales :
 * - definir les trois modes de lecture metier supportes par le score ;
 * - exposer un point d'entree stable pour le scoring global ;
 * - eviter de disperser les ponderations etudiant/professeur dans le code.
 *
 * Integration dans le systeme :
 * - ScheduleScorer l'utilise pour composer `scoreGlobal` ;
 * - PlacementEvaluator reutilise les memes ponderations pour rester coherent ;
 * - le mode `legacy` n'est volontairement pas defini ici, car il reste un mode
 *   moteur de retrocompatibilite et non un profil de scoring_v1.
 */

const SCORING_PROFILES = Object.freeze({
  etudiant: Object.freeze({
    mode: "etudiant",
    label: "Priorite etudiant",
    weights: Object.freeze({
      etudiant: 0.8,
      professeur: 0.2,
    }),
  }),
  professeur: Object.freeze({
    mode: "professeur",
    label: "Priorite professeur",
    weights: Object.freeze({
      etudiant: 0.2,
      professeur: 0.8,
    }),
  }),
  equilibre: Object.freeze({
    mode: "equilibre",
    label: "Equilibre",
    weights: Object.freeze({
      etudiant: 0.5,
      professeur: 0.5,
    }),
  }),
});

export class ScoringProfiles {
  /**
   * Retourne le profil correspondant a un mode de scoring_v1.
   *
   * @param {string} [mode="equilibre"] - mode demande.
   *
   * @returns {Object} Profil de scoring normalise.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : toute valeur inconnue retombe sur `equilibre`.
   */
  static get(mode = "equilibre") {
    const key = String(mode || "equilibre").trim().toLowerCase();
    return SCORING_PROFILES[key] || SCORING_PROFILES.equilibre;
  }

  /**
   * Liste les modes de scoring_v1 disponibles.
   *
   * @returns {string[]} Modes exposes par le score read-only.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : l'ordre retourne est stable et utilise dans les rapports.
   */
  static list() {
    return Object.keys(SCORING_PROFILES);
  }

  /**
   * Expose l'ensemble complet des profils de scoring.
   *
   * @returns {Object} Catalogue fige des profils.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : l'objet retourne est deja `Object.freeze`.
   */
  static all() {
    return SCORING_PROFILES;
  }
}

export { SCORING_PROFILES };
