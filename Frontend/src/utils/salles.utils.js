/**
 * UTILS - Salles
 *
 * Ce module fournit les helpers
 * utilitaires lies aux salles.
 */
export function extraireTypes(salles) {
  const types = [...new Set(salles.map((salle) => salle.type))];
  return types.sort((a, b) => a.localeCompare(b, "fr"));
}

export function calculerStatistiques(salles) {
  return {
    total: salles.length,
    types: new Set(salles.map((salle) => salle.type)).size,
    capaciteTotale: salles.reduce((acc, salle) => acc + salle.capacite, 0),
  };
}

export function filtrerSalles(salles, recherche, typeSelectionne) {
  return salles.filter((salle) => {
    const correspondRecherche =
      !recherche ||
      salle.code.toLowerCase().includes(recherche.toLowerCase()) ||
      salle.type.toLowerCase().includes(recherche.toLowerCase());

    const correspondType =
      typeSelectionne === "tous" || salle.type === typeSelectionne;

    return correspondRecherche && correspondType;
  });
}
/**
 * UTILS - Salles
 *
 * Ce module fournit les helpers
 * utilitaires lies aux salles.
 */
