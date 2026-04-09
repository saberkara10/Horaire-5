export function getProgrammesProfesseur(professeur) {
  return String(
    professeur?.programmes_assignes || professeur?.specialite || ""
  ).trim();
}

export function getLibelleProgrammesProfesseur(
  professeur,
  fallback = "Sans programme"
) {
  return getProgrammesProfesseur(professeur) || fallback;
}
