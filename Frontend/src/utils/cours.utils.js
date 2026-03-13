export function construireLibelleCours(cours) {
  return `${cours.code} - ${cours.nom}`.trim();
}

export function extraireProgrammes(cours) {
  return [...new Set(cours.map((element) => element.programme).filter(Boolean))].sort(
    (programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr")
  );
}

export function extraireEtapes(cours) {
  return [...new Set(cours.map((element) => String(element.etape_etude)).filter(Boolean))].sort(
    (etapeA, etapeB) => Number(etapeA) - Number(etapeB)
  );
}

export function extraireTypesSalle(cours) {
  return [...new Set(cours.map((element) => element.type_salle).filter(Boolean))].sort(
    (typeA, typeB) => typeA.localeCompare(typeB, "fr")
  );
}

export function filtrerCours(cours, recherche, programme, etape) {
  const rechercheNormalisee = recherche.trim().toLowerCase();

  return cours.filter((element) => {
    const programmeOk = programme === "tous" || element.programme === programme;
    const etapeOk = etape === "toutes" || String(element.etape_etude) === etape;

    if (!programmeOk || !etapeOk) {
      return false;
    }

    if (!rechercheNormalisee) {
      return true;
    }

    return [
      element.code,
      element.nom,
      element.programme,
      String(element.etape_etude),
      element.type_salle,
      construireLibelleCours(element),
    ].some((valeur) => valeur?.toLowerCase().includes(rechercheNormalisee));
  });
}

export function calculerStatistiquesCours(cours) {
  const dureeTotale = cours.reduce(
    (somme, element) => somme + Number(element.duree || 0),
    0
  );

  return {
    total: cours.length,
    programmes: extraireProgrammes(cours).length,
    typesSalle: extraireTypesSalle(cours).length,
    dureeMoyenne: cours.length > 0 ? Math.round(dureeTotale / cours.length) : 0,
  };
}
