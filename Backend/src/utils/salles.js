/**
 * UTILS - Types de salles
 *
 * Ce module centralise les types de salles autorises
 * ainsi que les plafonds de capacite associes.
 */

export const TYPES_SALLES = [
  "Salle standard",
  "Salle de reunion",
  "Laboratoire informatique",
  "Salle de conference",
  "Amphitheatre",
  "Laboratoire de soins",
  "Laboratoire de simulation",
  "Atelier technique",
  "Cuisine pedagogique",
  "Salle de restauration",
];

const TYPES_SALLES_CAPACITE_50 = new Set([
  "Salle de conference",
  "Amphitheatre",
]);

export function typeSalleValide(typeSalle) {
  return TYPES_SALLES.includes(String(typeSalle || "").trim());
}

export function capaciteMaximalePourType(typeSalle) {
  const typeNormalise = String(typeSalle || "").trim();
  return TYPES_SALLES_CAPACITE_50.has(typeNormalise) ? 50 : 30;
}

export function capaciteSalleValidePourType(typeSalle, capacite) {
  const capaciteNumerique = Number(capacite);

  return (
    Number.isInteger(capaciteNumerique) &&
    capaciteNumerique > 0 &&
    capaciteNumerique <= capaciteMaximalePourType(typeSalle)
  );
}

export function messageCapaciteSalle(typeSalle) {
  return `Capacite invalide pour ce type de salle (maximum ${capaciteMaximalePourType(typeSalle)}).`;
}
