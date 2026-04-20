/**
 * UTILS - Salles
 *
 * Ce module fournit les helpers
 * utilitaires lies aux salles.
 */

export const TYPES_SALLES = [
  "Salle de cours",
  "Laboratoire",
  "Atelier multimedia",
  "Salle reseautique",
];

export function construireLibelleSalle(salle) {
  return `${salle.code} - ${salle.type}`.trim();
}

export function extraireTypesSalle(salles) {
  return [...new Set(salles.map((salle) => salle.type).filter(Boolean))].sort(
    (typeA, typeB) => typeA.localeCompare(typeB, "fr")
  );
}

export function extraireTypes(salles) {
  return extraireTypesSalle(salles);
}

export function calculerStatistiquesSalles(salles) {
  const capaciteTotale = salles.reduce(
    (somme, salle) => somme + Number(salle.capacite || 0),
    0
  );

  return {
    total: salles.length,
    types: extraireTypesSalle(salles).length,
    capaciteTotale,
    capaciteMoyenne: salles.length > 0 ? Math.round(capaciteTotale / salles.length) : 0,
  };
}

export function calculerStatistiques(salles) {
  const statistiques = calculerStatistiquesSalles(salles);

  return {
    total: statistiques.total,
    types: statistiques.types,
    capaciteTotale: statistiques.capaciteTotale,
  };
}

export function filtrerSalles(salles, recherche, typeSelectionne) {
  const rechercheNormalisee = String(recherche || "").trim().toLowerCase();

  return salles.filter((salle) => {
    const typeOk = typeSelectionne === "tous" || salle.type === typeSelectionne;

    if (!typeOk) {
      return false;
    }

    if (!rechercheNormalisee) {
      return true;
    }

    return [
      salle.code,
      salle.type,
      String(salle.capacite),
      construireLibelleSalle(salle),
    ].some((valeur) => String(valeur || "").toLowerCase().includes(rechercheNormalisee));
  });
}
