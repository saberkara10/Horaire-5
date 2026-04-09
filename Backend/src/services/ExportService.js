/**
 * ExportService — Génération PDF et Excel d'horaires (niveau entreprise)
 *
 * Formats supportés : PDF (pdfkit), Excel (xlsx)
 * Types supportés   : groupe, professeur, étudiant
 */

import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

// ─── Palette & constantes de mise en page ────────────────────────────────────
const BRAND = {
  primary:   [37,  99, 235],   // #2563EB  bleu HORAIRE 5
  accent:    [99,  102, 241],  // #6366F1  indigo
  dark:      [15,  23,  42],   // #0F172A  presque noir
  muted:     [100, 116, 139],  // #64748B  gris bleu
  light:     [248, 250, 252],  // #F8FAFC  fond clair
  white:     [255, 255, 255],
  reprise:   [234, 88,  12],   // #EA580C  orange reprise
  surface:   [226, 232, 240],  // #E2E8D0  bordure douce
  success:   [22,  163, 74],   // #16A34A  vert
};

const PAGE_LANDSCAPE = { size: "A4", margins: { top: 48, bottom: 48, left: 40, right: 40 }, layout: "landscape" };
const PAGE_PORTRAIT  = { size: "A4", margins: { top: 48, bottom: 48, left: 50, right: 50 } };

// ─── Helpers horaire ─────────────────────────────────────────────────────────
function h5(s) { return String(s || "").slice(0, 5); }
function nomFichier(type, identifiant, session, ext) {
  const slug = String(identifiant || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const sess = String(session || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `horaire-${type}-${slug}${sess ? `-${sess}` : ""}.${ext}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}

function today() {
  return new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PDF — Utilitaires de dessin bas niveau
// ═══════════════════════════════════════════════════════════════════════════════

/** Dessine un en-tête premium « HORAIRE 5 » */
function drawPDFHeader(doc, { type, identifiant, programme, etape, session, nomSupplementaire }) {
  const w = doc.page.width;
  const ml = doc.page.margins.left;
  const mr = doc.page.margins.right;
  const usableW = w - ml - mr;

  // Bande de fond
  doc.save();
  doc.rect(0, 0, w, 90).fill(BRAND.dark.map ? `rgb(${BRAND.dark.join(",")})` : "#0F172A");

  // Accentuation bleue à gauche
  doc.rect(0, 0, 6, 90).fill(`rgb(${BRAND.primary.join(",")})`);
  doc.restore();

  // Logo texte HORAIRE 5
  doc.font("Helvetica-Bold").fontSize(17).fillColor(`rgb(${BRAND.primary.join(",")})`)
     .text("HORAIRE 5", ml, 18, { lineBreak: false });

  // Séparateur vertical
  doc.moveTo(ml + 105, 22).lineTo(ml + 105, 52)
     .strokeColor(`rgb(${BRAND.muted.join(",")})`)
     .lineWidth(1).stroke();

  // Type + identifiant
  const typeLabel = { groupe: "Horaire du groupe", professeur: "Horaire du professeur", etudiant: "Horaire de l'étudiant" }[type] || "Horaire";
  doc.font("Helvetica").fontSize(9).fillColor(`rgb(${BRAND.muted.join(",")})`)
     .text(typeLabel.toUpperCase(), ml + 115, 18, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#FFFFFF")
     .text(identifiant, ml + 115, 30, { lineBreak: false });

  // Métadonnées droite
  const meta = [];
  if (programme) meta.push(`Programme : ${programme}`);
  if (etape != null) meta.push(`Étape : ${etape}`);
  if (session) meta.push(`Session : ${session}`);
  if (nomSupplementaire) meta.push(nomSupplementaire);
  meta.push(`Exporté le : ${today()}`);

  doc.font("Helvetica").fontSize(8).fillColor(`rgb(${BRAND.muted.join(",")})`)
     .text(meta.join("   |   "), ml + 115, 58, { width: usableW - 120, lineBreak: false });

  doc.y = 108;
}

/** Dessine un en-tête de section (titre de liste/tableau) */
function drawSectionTitle(doc, text) {
  const ml = doc.page.margins.left;
  const usableW = doc.page.width - ml - doc.page.margins.right;
  doc.moveDown(0.3);
  doc.rect(ml, doc.y, usableW, 22).fill(`rgb(${BRAND.primary.join(",")})`);
  doc.font("Helvetica-Bold").fontSize(9.5)
     .fillColor("#FFFFFF")
     .text(text.toUpperCase(), ml + 10, doc.y - 16, { lineBreak: false });
  doc.moveDown(0.5);
}

/** Dessine le tableau des séances (liste détaillée) */
function drawHoraireTable(doc, seances, colonnes) {
  const ml = doc.page.margins.left;
  const mr = doc.page.margins.right;
  const usableW = doc.page.width - ml - mr;

  // Calculer largeurs relatives
  const totalRatio = colonnes.reduce((s, c) => s + c.ratio, 0);
  const widths = colonnes.map(c => Math.floor((c.ratio / totalRatio) * usableW));

  const ROW_H = 18;
  const FONT_SIZE = 8;

  // En-tête tableau
  let x = ml;
  let y = doc.y;
  colonnes.forEach((col, i) => {
    doc.rect(x, y, widths[i], 22).fill(`rgb(${BRAND.dark.join(",")})`);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF")
       .text(col.label, x + 4, y + 7, { width: widths[i] - 8, lineBreak: false });
    x += widths[i];
  });
  y += 22;

  // Lignes
  seances.forEach((seance, idx) => {
    if (y + ROW_H > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      drawPDFHeader(doc, seance.__headerMeta__ || {});
      y = doc.y;
      // Ré-afficher en-tête tableau
      x = ml;
      colonnes.forEach((col, i) => {
        doc.rect(x, y, widths[i], 22).fill(`rgb(${BRAND.dark.join(",")})`);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF")
           .text(col.label, x + 4, y + 7, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      y += 22;
    }

    // Fond alterné
    const bg = idx % 2 === 0 ? BRAND.white : BRAND.light;
    x = ml;
    colonnes.forEach((_, i) => {
      doc.rect(x, y, widths[i], ROW_H).fill(`rgb(${bg.join(",")})`);
      x += widths[i];
    });

    // Texte
    x = ml;
    const est_reprise = Boolean(seance.est_reprise);
    colonnes.forEach((col, i) => {
      const val = String(col.value(seance) || "—");
      const color = est_reprise && col.key === "cours"
        ? `rgb(${BRAND.reprise.join(",")})`
        : `rgb(${BRAND.dark.join(",")})`;
      doc.font(est_reprise && col.key === "cours" ? "Helvetica-Bold" : "Helvetica")
         .fontSize(FONT_SIZE).fillColor(color)
         .text(val, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false, ellipsis: true });
      if (est_reprise && col.key === "cours") {
        // petit badge REPRISE
        doc.fontSize(6).fillColor(`rgb(${BRAND.reprise.join(",")})`)
           .text("REPRISE", x + 4, y + 12, { lineBreak: false });
      }
      x += widths[i];
    });

    // Bordure inférieure
    doc.moveTo(ml, y + ROW_H).lineTo(ml + usableW, y + ROW_H)
       .strokeColor(`rgb(${BRAND.surface.join(",")})`)
       .lineWidth(0.5).stroke();

    y += ROW_H;
  });

  doc.y = y + 8;
}

/** Pied de page numéroté */
function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pw = doc.page.width;
    const ph = doc.page.height;
    const mb = doc.page.margins.bottom;
    doc.font("Helvetica").fontSize(7)
       .fillColor(`rgb(${BRAND.muted.join(",")})`)
       .text(`HORAIRE 5 — Document généré automatiquement le ${today()}`,
         doc.page.margins.left, ph - mb + 8, { lineBreak: false })
       .text(`Page ${i + 1} / ${range.count}`,
         doc.page.margins.left, ph - mb + 8,
         { width: pw - doc.page.margins.left - doc.page.margins.right, align: "right", lineBreak: false });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT GROUPE — PDF
// ═══════════════════════════════════════════════════════════════════════════════
export async function genererPDFGroupe({ groupe, horaire }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE_LANDSCAPE, bufferPages: true, info: { Title: `Horaire ${groupe.nom_groupe}`, Author: "HORAIRE 5" } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const meta = {
      type: "groupe",
      identifiant: groupe.nom_groupe,
      programme: groupe.programme || null,
      etape: groupe.etape || null,
      session: groupe.session || null,
    };
    drawPDFHeader(doc, meta);
    drawSectionTitle(doc, `Planning du groupe ${groupe.nom_groupe} — ${horaire.length} séance(s)`);

    if (horaire.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(`rgb(${BRAND.muted.join(",")})`)
         .text("Aucune séance planifiée pour ce groupe.", { align: "center" });
    } else {
      const seancesAvecMeta = horaire.map(s => ({ ...s, __headerMeta__: meta }));
      drawHoraireTable(doc, seancesAvecMeta, [
        { key: "date",   label: "Date",          ratio: 3, value: s => formatDateLong(s.date) },
        { key: "debut",  label: "Début",         ratio: 1, value: s => h5(s.heure_debut) },
        { key: "fin",    label: "Fin",           ratio: 1, value: s => h5(s.heure_fin) },
        { key: "cours",  label: "Cours",         ratio: 4, value: s => `${s.code_cours} — ${s.nom_cours}` },
        { key: "prof",   label: "Professeur",    ratio: 2.5, value: s => `${s.prenom_professeur || ""} ${s.nom_professeur || ""}`.trim() },
        { key: "salle",  label: "Salle",         ratio: 1.5, value: s => `${s.code_salle || "—"} (${s.type_salle || ""})` },
      ]);
    }

    addFooters(doc);
    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT PROFESSEUR — PDF
// ═══════════════════════════════════════════════════════════════════════════════
export async function genererPDFProfesseur({ professeur, horaire }) {
  return new Promise((resolve, reject) => {
    const nomComplet = `${professeur.prenom || ""} ${professeur.nom || ""}`.trim();
    const doc = new PDFDocument({ ...PAGE_LANDSCAPE, bufferPages: true, info: { Title: `Horaire ${nomComplet}`, Author: "HORAIRE 5" } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const meta = {
      type: "professeur",
      identifiant: nomComplet,
      programme: professeur.specialite || null,
      session: professeur.session || null,
      nomSupplementaire: professeur.matricule ? `Matricule : ${professeur.matricule}` : null,
    };
    drawPDFHeader(doc, meta);
    drawSectionTitle(doc, `Planning de ${nomComplet} — ${horaire.length} séance(s)`);

    if (horaire.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(`rgb(${BRAND.muted.join(",")})`)
         .text("Aucune séance planifiée pour cet enseignant.", { align: "center" });
    } else {
      const seancesAvecMeta = horaire.map(s => ({ ...s, __headerMeta__: meta }));
      drawHoraireTable(doc, seancesAvecMeta, [
        { key: "date",    label: "Date",        ratio: 3,   value: s => formatDateLong(s.date) },
        { key: "debut",   label: "Début",       ratio: 1,   value: s => h5(s.heure_debut) },
        { key: "fin",     label: "Fin",         ratio: 1,   value: s => h5(s.heure_fin) },
        { key: "cours",   label: "Cours",       ratio: 4,   value: s => `${s.code_cours} — ${s.nom_cours}` },
        { key: "groupes", label: "Groupe(s)",   ratio: 2.5, value: s => s.groupes || s.nom_groupe || "—" },
        { key: "salle",   label: "Salle",       ratio: 1.5, value: s => s.code_salle || "—" },
      ]);
    }

    addFooters(doc);
    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT ÉTUDIANT — PDF
// ═══════════════════════════════════════════════════════════════════════════════
export async function genererPDFEtudiant({ etudiant, horaire, horaire_reprises, reprises }) {
  return new Promise((resolve, reject) => {
    const nomComplet = `${etudiant.prenom || ""} ${etudiant.nom || ""}`.trim();
    const doc = new PDFDocument({ ...PAGE_LANDSCAPE, bufferPages: true, info: { Title: `Horaire ${nomComplet}`, Author: "HORAIRE 5" } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const horaireTotal = [...(horaire || []), ...(horaire_reprises || [])].sort((a, b) => {
      const da = String(a.date || ""); const db = String(b.date || "");
      if (da !== db) return da.localeCompare(db);
      return String(a.heure_debut || "").localeCompare(String(b.heure_debut || ""));
    });

    const meta = {
      type: "etudiant",
      identifiant: nomComplet,
      programme: etudiant.programme || null,
      etape: etudiant.etape || null,
      session: etudiant.session ? `${etudiant.session} ${etudiant.annee || ""}`.trim() : null,
      nomSupplementaire: etudiant.groupe ? `Groupe : ${etudiant.groupe}` : null,
    };
    drawPDFHeader(doc, meta);
    drawSectionTitle(doc, `Horaire complet — ${horaireTotal.length} séance(s) dont ${(horaire_reprises || []).length} reprise(s)`);

    if (horaireTotal.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(`rgb(${BRAND.muted.join(",")})`)
         .text("Aucune séance planifiée pour cet étudiant.", { align: "center" });
    } else {
      const seancesAvecMeta = horaireTotal.map(s => ({ ...s, __headerMeta__: meta }));
      drawHoraireTable(doc, seancesAvecMeta, [
        { key: "date",    label: "Date",          ratio: 3,   value: s => formatDateLong(s.date) },
        { key: "debut",   label: "Début",         ratio: 1,   value: s => h5(s.heure_debut) },
        { key: "fin",     label: "Fin",           ratio: 1,   value: s => h5(s.heure_fin) },
        { key: "cours",   label: "Cours",         ratio: 3.5, value: s => `${s.code_cours || ""} — ${s.nom_cours || ""}` },
        { key: "type",    label: "Type",          ratio: 1.5, value: s => s.est_reprise ? "REPRISE" : "Régulier" },
        { key: "groupe",  label: "Groupe suivi",  ratio: 2,   value: s => s.groupe_source || s.nom_groupe || "—" },
        { key: "salle",   label: "Salle",         ratio: 1.5, value: s => s.code_salle || "—" },
        { key: "prof",    label: "Professeur",    ratio: 2,   value: s => `${s.prenom_professeur || ""} ${s.nom_professeur || ""}`.trim() },
      ]);
    }

    // Section reprises en attente
    const reprisesEnAttente = (reprises || []).filter(r => r.statut === "a_reprendre");
    if (reprisesEnAttente.length > 0) {
      doc.moveDown(1);
      drawSectionTitle(doc, `Cours échoués à reprendre — ${reprisesEnAttente.length} cours`);
      drawHoraireTable(doc, reprisesEnAttente.map(r => ({
        date: null, heure_debut: null, heure_fin: null,
        code_cours: r.code_cours, nom_cours: r.nom_cours,
        est_reprise: true,
        note_echec: r.note_echec,
        groupe_source: r.groupe_reprise || "Non assigné",
        code_salle: null, nom_professeur: null,
        __headerMeta__: meta,
      })), [
        { key: "cours",   label: "Cours",         ratio: 4, value: s => `${s.code_cours} — ${s.nom_cours}` },
        { key: "etape",   label: "Étape",         ratio: 1, value: s => s.etape_etude || "—" },
        { key: "note",    label: "Note échec",    ratio: 1.5, value: s => s.note_echec != null ? `${s.note_echec}/100` : "—" },
        { key: "groupe",  label: "Groupe reprise",ratio: 3, value: s => s.groupe_source },
        { key: "statut",  label: "Statut",        ratio: 2, value: () => "À reprendre" },
      ]);
    }

    addFooters(doc);
    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT GROUPE — EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export function genererExcelGroupe({ groupe, horaire }) {
  const wb = XLSX.utils.book_new();

  // ── Feuille 1 : Données détaillées ──
  const rows = horaire.map(s => ({
    "Jour":            formatDateLong(s.date),
    "Date":            s.date || "",
    "Heure début":     h5(s.heure_debut),
    "Heure fin":       h5(s.heure_fin),
    "Code cours":      s.code_cours || "",
    "Nom du cours":    s.nom_cours || "",
    "Professeur":      `${s.prenom_professeur || ""} ${s.nom_professeur || ""}`.trim(),
    "Salle":           s.code_salle || "",
    "Type salle":      s.type_salle || "",
    "Groupe":          groupe.nom_groupe,
    "Programme":       groupe.programme || "",
    "Étape":           groupe.etape || "",
    "Remarque":        "",
  }));

  const ws = XLSX.utils.json_to_sheet([]);
  // En-tête section info
  XLSX.utils.sheet_add_aoa(ws, [
    ["HORAIRE 5 — Horaire du groupe"],
    [`Groupe : ${groupe.nom_groupe}   |   Programme : ${groupe.programme || "—"}   |   Étape : ${groupe.etape || "—"}   |   Exporté le : ${today()}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A4", skipHeader: false });
  styleExcelSheet(ws, rows.length + 4);
  XLSX.utils.book_append_sheet(wb, ws, "Horaire");

  // ── Feuille 2 : Vue synthèse par semaine ──
  const parSemaine = {};
  horaire.forEach(s => {
    const d = new Date(s.date + "T00:00:00");
    const lundi = new Date(d);
    lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
    const cleSemaine = lundi.toISOString().slice(0, 10);
    if (!parSemaine[cleSemaine]) parSemaine[cleSemaine] = [];
    parSemaine[cleSemaine].push(s);
  });
  const semaines = Object.entries(parSemaine).sort(([a], [b]) => a.localeCompare(b));
  const synthRows = semaines.map(([lundi, ses]) => ({
    "Semaine (lundi)": lundi,
    "Nb séances": ses.length,
    "Cours": [...new Set(ses.map(s => s.code_cours))].join(", "),
    "Salles": [...new Set(ses.map(s => s.code_salle).filter(Boolean))].join(", "),
  }));
  const ws2 = XLSX.utils.json_to_sheet(synthRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Synthèse semaines");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT PROFESSEUR — EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export function genererExcelProfesseur({ professeur, horaire }) {
  const wb = XLSX.utils.book_new();
  const nomComplet = `${professeur.prenom || ""} ${professeur.nom || ""}`.trim();

  const rows = horaire.map(s => ({
    "Jour":            formatDateLong(s.date),
    "Date":            s.date || "",
    "Heure début":     h5(s.heure_debut),
    "Heure fin":       h5(s.heure_fin),
    "Code cours":      s.code_cours || "",
    "Nom du cours":    s.nom_cours || "",
    "Groupe(s)":       s.groupes || s.nom_groupe || "",
    "Salle":           s.code_salle || "",
    "Type salle":      s.type_salle || "",
    "Professeur":      nomComplet,
    "Matricule":       professeur.matricule || "",
    "Spécialité":      professeur.specialite || "",
    "Remarque":        "",
  }));

  const ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.sheet_add_aoa(ws, [
    ["HORAIRE 5 — Horaire du professeur"],
    [`Professeur : ${nomComplet}   |   Matricule : ${professeur.matricule || "—"}   |   Exporté le : ${today()}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A4" });
  styleExcelSheet(ws, rows.length + 4);
  XLSX.utils.book_append_sheet(wb, ws, "Horaire");

  // Synthèse charge horaire
  const parCours = {};
  horaire.forEach(s => {
    if (!parCours[s.code_cours]) parCours[s.code_cours] = { code: s.code_cours, nom: s.nom_cours, nb: 0 };
    parCours[s.code_cours].nb++;
  });
  const chargeRows = Object.values(parCours).map(c => ({
    "Code": c.code, "Cours": c.nom, "Nb séances": c.nb,
  }));
  const ws2 = XLSX.utils.json_to_sheet(chargeRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Charge horaire");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT ÉTUDIANT — EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export function genererExcelEtudiant({ etudiant, horaire, horaire_reprises, reprises }) {
  const wb = XLSX.utils.book_new();
  const nomComplet = `${etudiant.prenom || ""} ${etudiant.nom || ""}`.trim();

  // Feuille 1 : Horaire complet fusionné
  const horaireTotal = [...(horaire || []), ...(horaire_reprises || [])].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.heure_debut || "").localeCompare(String(b.heure_debut || ""))
  );

  const rows = horaireTotal.map(s => ({
    "Jour":             formatDateLong(s.date),
    "Date":             s.date || "",
    "Heure début":      h5(s.heure_debut),
    "Heure fin":        h5(s.heure_fin),
    "Code cours":       s.code_cours || "",
    "Nom du cours":     s.nom_cours || "",
    "Type":             s.est_reprise ? "REPRISE" : "Régulier",
    "Groupe suivi":     s.groupe_source || s.nom_groupe || "",
    "Salle":            s.code_salle || "",
    "Professeur":       `${s.prenom_professeur || ""} ${s.nom_professeur || ""}`.trim(),
    "Statut reprise":   s.statut_reprise || "",
    "Remarque":         "",
  }));

  const ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.sheet_add_aoa(ws, [
    ["HORAIRE 5 — Horaire de l'étudiant"],
    [`Étudiant : ${nomComplet}   |   Matricule : ${etudiant.matricule || "—"}   |   Groupe : ${etudiant.groupe || "—"}   |   Étape : ${etudiant.etape || "—"}   |   Exporté le : ${today()}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A4" });
  styleExcelSheet(ws, rows.length + 4);
  XLSX.utils.book_append_sheet(wb, ws, "Horaire complet");

  // Feuille 2 : Cours à reprendre
  const reprisesRows = (reprises || []).map(r => ({
    "Code cours":      r.code_cours || "",
    "Nom du cours":    r.nom_cours || "",
    "Étape":           r.etape_etude || "",
    "Note d'échec":    r.note_echec != null ? r.note_echec : "",
    "Statut":          r.statut || "a_reprendre",
    "Groupe reprise":  r.groupe_reprise || "Non assigné",
  }));
  if (reprisesRows.length > 0) {
    const wsR = XLSX.utils.json_to_sheet(reprisesRows);
    XLSX.utils.book_append_sheet(wb, wsR, "Cours à reprendre");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Style basique feuille Excel (largeurs colonnes)
// ═══════════════════════════════════════════════════════════════════════════════
function styleExcelSheet(ws, totalRows) {
  ws["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 8  }, { wch: 8  }, { wch: 10 },
    { wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 20 }, { wch: 10 }, { wch: 18 },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 4 }; // figer les 3 lignes d'en-tête
}
