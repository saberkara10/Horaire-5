// Utilitaires purs du module etudiants. Ils regroupent la logique de
// presentation derivee pour garder les composants simples et declaratifs.
export function construireNomCompletEtudiant(etudiant) {
  return `${etudiant.prenom} ${etudiant.nom}`.trim();
}

export function construireInitialesEtudiant(etudiant) {
  return `${etudiant.prenom?.[0] || ""}${etudiant.nom?.[0] || ""}`.toUpperCase();
}

export function extraireGroupes(etudiants) {
  return [...new Set(etudiants.map((etudiant) => etudiant.groupe).filter(Boolean))].sort(
    (groupeA, groupeB) => groupeA.localeCompare(groupeB, "fr", { numeric: true })
  );
}

export function extraireProgrammesEtudiants(etudiants) {
  return [
    ...new Set(etudiants.map((etudiant) => etudiant.programme).filter(Boolean)),
  ].sort((programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr"));
}

export function filtrerEtudiants(etudiants, recherche, groupeSelectionne) {
  const rechercheNormalisee = recherche.trim().toLowerCase();

  return etudiants.filter((etudiant) => {
    if (groupeSelectionne !== "tous" && etudiant.groupe !== groupeSelectionne) {
      return false;
    }

    if (!rechercheNormalisee) {
      return true;
    }

    const valeursRecherche = [
      etudiant.matricule,
      etudiant.nom,
      etudiant.prenom,
      etudiant.groupe,
      etudiant.programme,
      String(etudiant.etape ?? ""),
      construireNomCompletEtudiant(etudiant),
    ];

    // La recherche est volontairement large pour couvrir les usages les plus
    // frequents sans imposer de filtres avances.
    return valeursRecherche.some((valeur) =>
      String(valeur).toLowerCase().includes(rechercheNormalisee)
    );
  });
}

export function calculerStatistiquesEtudiants(etudiants) {
  const groupes = extraireGroupes(etudiants);
  const programmes = extraireProgrammesEtudiants(etudiants);
  const etapes = new Set(etudiants.map((etudiant) => etudiant.etape).filter(Boolean));

  return {
    total: etudiants.length,
    groupes: groupes.length,
    programmes: programmes.length,
    etapes: etapes.size,
  };
}
