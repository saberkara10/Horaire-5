/**
 * UTIL - Optimization modes
 *
 * Cette source de verite commune aligne les ecrans de generation et de
 * replanification sur les memes modes d'optimisation du moteur. Le frontend
 * affiche des libelles metier stables tandis que le backend conserve
 * l'autorite finale de normalisation via PlacementEvaluator.
 */

export const OPTIMIZATION_MODE_OPTIONS = [
  {
    value: "legacy",
    label: "Legacy",
    description:
      "Conserve le comportement historique pour rester compatible avec les usages existants.",
  },
  {
    value: "etudiant",
    label: "Etudiant",
    description:
      "Privilegie le confort et la compacite cote etudiant.",
  },
  {
    value: "professeur",
    label: "Professeur",
    description:
      "Privilegie la lisibilite et la compacite cote professeur.",
  },
  {
    value: "equilibre",
    label: "Equilibre",
    description:
      "Recherche un compromis entre les contraintes de confort et d'exploitation.",
  },
];

/**
 * Retourne l'option d'optimisation correspondant a une valeur.
 *
 * @param {string} value - mode souhaite.
 * @returns {Object} Option frontend normalisee.
 */
export function resoudreOptionModeOptimisation(value) {
  return (
    OPTIMIZATION_MODE_OPTIONS.find((option) => option.value === value) ||
    OPTIMIZATION_MODE_OPTIONS[0]
  );
}

/**
 * Retourne le libelle lisible d'un mode d'optimisation.
 *
 * @param {string} value - mode souhaite.
 * @returns {string} Libelle metier.
 */
export function formaterLibelleModeOptimisation(value) {
  return resoudreOptionModeOptimisation(value).label;
}
