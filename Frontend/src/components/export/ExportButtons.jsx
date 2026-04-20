/**
 * Composant ExportButtons — Boutons d'export PDF & Excel premium
 *
 * Props :
 *   type         "groupe" | "professeur" | "etudiant"
 *   id           number — identifiant de l'entité
 *   nom          string — nom affiché dans le bouton et le nom de fichier
 *   disabled     boolean — désactiver si aucune donnée
 *   compact      boolean — affichage horizontal compact (pas de libellé long)
 */
import { useState } from "react";
import {
  exporterGroupePDF,
  exporterGroupeExcel,
  exporterProfesseurPDF,
  exporterProfesseurExcel,
  exporterEtudiantPDF,
  exporterEtudiantExcel,
} from "../../services/export.api.js";
import "../../styles/ExportButtons.css";

// ─── Constantes ───────────────────────────────────────────────────────────────

const HANDLERS = {
  groupe: { pdf: exporterGroupePDF, excel: exporterGroupeExcel },
  professeur: { pdf: exporterProfesseurPDF, excel: exporterProfesseurExcel },
  etudiant: { pdf: exporterEtudiantPDF, excel: exporterEtudiantExcel },
};

export function ExportButtons({ type, id, nom = "", disabled = false, compact = false, onError }) {
  const [loading, setLoading] = useState(null); // "pdf" | "excel" | null
  const [succes, setSucces] = useState(null);   // "pdf" | "excel" | null

  function renderFileIcon(format) {
    if (format === "excel") {
      return (
        <span className="export-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
            <path d="M4 2h8l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 0v4h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M7 13l1.5-2m0 0L10 13m-1.5-2V9m3 4l1.5-2m0 0L14 13m-1.5-2V9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          </svg>
        </span>
      );
    }

    return (
      <span className="export-icon">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
          <path d="M4 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l4 4v10a2 2 0 0 1-2 2H4zm8-14v3h3M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    );
  }

  async function handleExport(format) {
    if (!id || loading) return;
    const fn = HANDLERS[type]?.[format];
    if (!fn) return;

    setLoading(format);
    setSucces(null);
    try {
      await fn(id, nom);
      setSucces(format);
      setTimeout(() => setSucces(null), 2500);
    } catch (err) {
      onError?.(err.message || `Impossible d'exporter en ${format.toUpperCase()}.`);
    } finally {
      setLoading(null);
    }
  }

  const isDisabled = disabled || !id;

  return (
    <div className={`export-btns ${compact ? "export-btns--compact" : ""}`}>
      {!compact && <span className="export-btns__label">Exporter</span>}

      <button
        type="button"
        className={`export-btn export-btn--pdf ${succes === "pdf" ? "export-btn--ok" : ""}`}
        onClick={() => handleExport("pdf")}
        disabled={isDisabled || loading !== null}
        title="Télécharger l'horaire en PDF"
      >
        {loading === "pdf" ? (
          <span className="export-spinner" />
        ) : (
          renderFileIcon("pdf")
        )}
        <span>{compact ? "PDF" : "Télécharger PDF"}</span>
      </button>

      <button
        type="button"
        className={`export-btn export-btn--excel ${succes === "excel" ? "export-btn--ok" : ""}`}
        onClick={() => handleExport("excel")}
        disabled={isDisabled || loading !== null}
        title="Télécharger l'horaire en Excel"
      >
        {loading === "excel" ? (
          <span className="export-spinner" />
        ) : (
          renderFileIcon("excel")
        )}
        <span>{compact ? "Excel" : "Télécharger Excel"}</span>
      </button>
    </div>
  );
}
