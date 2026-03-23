export function validerAffectation(data) {
  const {
    id_cours,
    id_professeur,
    id_salle,
    date,
    heure_debut,
    heure_fin,
    id_groupes,
  } = data;

  if (!id_cours || !id_professeur || !id_salle) {
    throw new Error("Cours, professeur et salle obligatoires");
  }

  if (!date || !heure_debut || !heure_fin) {
    throw new Error("Date et heures obligatoires");
  }

  if (heure_fin <= heure_debut) {
    throw new Error("Heure fin doit etre superieure a heure debut");
  }

  if (!id_groupes || !Array.isArray(id_groupes) || id_groupes.length === 0) {
    throw new Error("Au moins un groupe obligatoire");
  }
}