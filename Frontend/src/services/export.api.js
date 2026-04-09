/**
 * Service API — Export d'horaires
 *
 * Déclenche le téléchargement direct d'un fichier PDF ou Excel
 * depuis les routes backend /api/export/*.
 */

const BASE = "/api/export";

/**
 * Télécharge un fichier depuis une URL backend.
 * Crée un lien <a> temporaire et simule un clic.
 */
async function telecharger(url, nomFichierSuggere) {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  // Récupérer le nom de fichier depuis Content-Disposition si disponible
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  const filename = match?.[1]?.trim() || nomFichierSuggere;

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Nettoyage différé
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    document.body.removeChild(a);
  }, 300);
}

// ─── Exports Groupe ────────────────────────────────────────────────────────────
export async function exporterGroupePDF(idGroupe, nomGroupe = "groupe") {
  await telecharger(
    `${BASE}/groupe/${idGroupe}/pdf`,
    `horaire-groupe-${slugify(nomGroupe)}.pdf`
  );
}

export async function exporterGroupeExcel(idGroupe, nomGroupe = "groupe") {
  await telecharger(
    `${BASE}/groupe/${idGroupe}/excel`,
    `horaire-groupe-${slugify(nomGroupe)}.xlsx`
  );
}

// ─── Exports Professeur ────────────────────────────────────────────────────────
export async function exporterProfesseurPDF(idProfesseur, nomProf = "professeur") {
  await telecharger(
    `${BASE}/professeur/${idProfesseur}/pdf`,
    `horaire-professeur-${slugify(nomProf)}.pdf`
  );
}

export async function exporterProfesseurExcel(idProfesseur, nomProf = "professeur") {
  await telecharger(
    `${BASE}/professeur/${idProfesseur}/excel`,
    `horaire-professeur-${slugify(nomProf)}.xlsx`
  );
}

// ─── Exports Étudiant ──────────────────────────────────────────────────────────
export async function exporterEtudiantPDF(idEtudiant, nomEtudiant = "etudiant") {
  await telecharger(
    `${BASE}/etudiant/${idEtudiant}/pdf`,
    `horaire-etudiant-${slugify(nomEtudiant)}.pdf`
  );
}

export async function exporterEtudiantExcel(idEtudiant, nomEtudiant = "etudiant") {
  await telecharger(
    `${BASE}/etudiant/${idEtudiant}/excel`,
    `horaire-etudiant-${slugify(nomEtudiant)}.xlsx`
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
