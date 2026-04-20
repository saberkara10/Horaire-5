/**
 * PAGE - Import Excel
 *
 * Cette page gere les imports
 * de donnees depuis des fichiers Excel.
 */
import { useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import * as XLSX from "xlsx";

export function ImportExcelPage({ moduleActif, onChangerModule }) {
  const [importType, setImportType] = useState("professeurs");
  const [message, setMessage] = useState("");

  const API_URLS = {
    professeurs: "http://localhost:3000/api/professeurs",
    cours: "http://localhost:3000/api/cours",
    salles: "http://localhost:3000/api/salles",
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        let importes = 0;
        let erreurs = 0;

        for (const row of jsonData) {
          try {
            const response = await fetch(API_URLS[importType], {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(row),
            });

            if (response.ok || response.status === 201) {
              importes++;
            } else {
              erreurs++;
            }
          } catch {
            erreurs++;
          }
        }

        if (erreurs === 0) {
          setMessage(`success:${importes} éléments importés avec succès !`);
        } else {
          setMessage(`warning:${importes} importés, ${erreurs} erreurs`);
        }

        setTimeout(() => setMessage(""), 5000);
      } catch (error) {
        setMessage("error:Erreur lors de l'importation du fichier");
      }
    };
    reader.readAsBinaryString(file);
  };

  const formats = {
    professeurs: ["matricule, nom, prenom, specialite"],
    cours: ["code, nom, duree, programme, etape_etude, type_salle"],
    salles: ["code, type, capacite"],
  };

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="import-page">
        <h1 className="import-title">Import Excel</h1>

        <div className="import-card">
          <div className="import-field">
            <label>Type de données à importer</label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value)}
            >
              <option value="professeurs">Professeurs</option>
              <option value="cours">Cours</option>
              <option value="salles">Salles</option>
            </select>
          </div>

          <div className="import-dropzone">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <div className="import-dropzone-icon" aria-hidden="true">XLS</div>
              <p className="import-dropzone-text">Cliquez pour sélectionner un fichier Excel</p>
              <p className="import-dropzone-hint">Formats acceptés: .xlsx, .xls, .csv</p>
            </label>
          </div>

          {message && (
            <div className={`import-message import-message-${message.split(":")[0]}`}>
              {message.split(":")[1]}
            </div>
          )}

          <div className="import-format">
            <h3>Format attendu pour {importType}:</h3>
            <p>Colonnes requises:</p>
            <ul>
              {formats[importType].map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
/**
 * PAGE - Import Excel
 *
 * Cette page gere les imports
 * de donnees depuis des fichiers Excel.
 */
