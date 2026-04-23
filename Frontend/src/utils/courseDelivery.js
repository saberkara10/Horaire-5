function normaliserTexte(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isOnlineCourseLike(entity) {
  if (Number(entity?.est_en_ligne || 0) === 1) {
    return true;
  }

  const mode = normaliserTexte(entity?.mode_cours);
  const typeSalle = normaliserTexte(entity?.type_salle);
  const codeSalle = normaliserTexte(entity?.code_salle);

  return (
    mode === "en ligne" ||
    typeSalle.includes("en ligne") ||
    typeSalle.includes("distance") ||
    typeSalle.includes("virtuel") ||
    codeSalle === "en ligne"
  );
}

export function getCourseLocationLabel(entity) {
  if (isOnlineCourseLike(entity)) {
    return "En ligne";
  }

  return String(entity?.code_salle || "").trim() || "Salle a confirmer";
}

export function getCourseRoomTypeLabel(entity) {
  if (isOnlineCourseLike(entity)) {
    return "En ligne";
  }

  return String(entity?.type_salle || "").trim() || "";
}
