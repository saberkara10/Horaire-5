export function construireNomComplet(professeur) {
  return `${professeur.prenom} ${professeur.nom}`.trim();
}

export function construireInitiales(professeur) {
  return `${professeur.prenom?.[0] || ""}${professeur.nom?.[0] || ""}`.toUpperCase();
}

export function extraireSpecialites(professeurs) {
  return [
    ...new Set(
      professeurs
        .map((professeur) => professeur.specialite?.trim())
        .filter(Boolean)
    ),
  ].sort((specialiteA, specialiteB) =>
    specialiteA.localeCompare(specialiteB, "fr")
  );
}

export function filtrerProfesseurs(professeurs, recherche, specialite) {
  const rechercheNormalisee = recherche.trim().toLowerCase();

  return professeurs.filter((professeur) => {
    const estDansSpecialite =
      specialite === "toutes" || professeur.specialite === specialite;

    if (!estDansSpecialite) {
      return false;
    }

    if (!rechercheNormalisee) {
      return true;
    }

    const valeursRecherche = [
      professeur.matricule,
      professeur.nom,
      professeur.prenom,
      professeur.specialite || "",
      construireNomComplet(professeur),
    ];

    return valeursRecherche.some((valeur) =>
      valeur.toLowerCase().includes(rechercheNormalisee)
    );
  });
}

export function calculerStatistiques(professeurs) {
  const nombreAvecSpecialite = professeurs.filter(
    (professeur) => professeur.specialite && professeur.specialite.trim() !== ""
  ).length;

  return {
    total: professeurs.length,
    avecSpecialite: nombreAvecSpecialite,
    sansSpecialite: professeurs.length - nombreAvecSpecialite,
    specialites: extraireSpecialites(professeurs).length,
  };
}
