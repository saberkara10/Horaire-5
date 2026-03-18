export function construireLibelleSalle(salle) {
  return `${salle.code} - ${salle.type}`.trim();
}

export function extraireTypesSalle(salles) {
  return [...new Set(salles.map((salle) => salle.type).filter(Boolean))].sort(
    (typeA, typeB) => typeA.localeCompare(typeB, "fr")
  );
}

export function filtrerSalles(salles, recherche, typeSelectionne) {
  const rechercheNormalisee = recherche.trim().toLowerCase();

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
    ].some((valeur) => valeur?.toLowerCase().includes(rechercheNormalisee));
  });
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
