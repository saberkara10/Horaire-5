import fs from "node:fs/promises";
import path from "node:path";
import pool from "../db.js";
import { FailedCourseDebugService } from "../src/services/scheduler/FailedCourseDebugService.js";

function lireArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function formaterHeure(value) {
  return String(value || "").slice(0, 5);
}

function rendreMarkdown(rapport) {
  const lignes = [];
  lignes.push(`# Debug reprises - ${rapport.session.nom}`);
  lignes.push("");
  lignes.push(`Cas analyses: ${rapport.total_cas}`);
  lignes.push("");

  for (const diagnostic of rapport.diagnostics) {
    lignes.push(
      `## ${diagnostic.etudiant.matricule} - ${diagnostic.etudiant.prenom} ${diagnostic.etudiant.nom}`
    );
    lignes.push("");
    lignes.push(`- Groupe principal: ${diagnostic.etudiant.groupe_principal || "Aucun"}`);
    lignes.push(
      `- Cours echoue: ${diagnostic.cours_echoue.code} - ${diagnostic.cours_echoue.nom}`
    );
    lignes.push(`- Statut actuel: ${diagnostic.cours_echoue.statut}`);
    lignes.push(`- Conclusion: ${diagnostic.conclusion.resume}`);
    lignes.push(`- Cause principale: ${diagnostic.conclusion.cause_principale}`);
    lignes.push("");

    if (diagnostic.groupes_candidats.length === 0) {
      lignes.push("Aucun groupe candidat trouve.");
      lignes.push("");
      continue;
    }

    for (const groupe of diagnostic.groupes_candidats) {
      lignes.push(`### ${groupe.nom_groupe} (#${groupe.id_groupe})`);
      lignes.push("");
      lignes.push(`- Decision: ${groupe.decision}`);
      lignes.push(
        `- Capacite: ${groupe.effectif_total}/${groupe.max_etudiants_par_groupe} ` +
          `(principal ${groupe.effectif_principal}, reprises ${groupe.reprises_planifiees})`
      );
      lignes.push(`- Compatibilite horaire: ${groupe.compatibilite_horaire ? "oui" : "non"}`);
      lignes.push(`- Place disponible: ${groupe.place_disponible ? "oui" : "non"}`);

      if (groupe.raisons.length > 0) {
        lignes.push("- Raisons du rejet:");
        for (const raison of groupe.raisons) {
          lignes.push(`  - ${raison.code}: ${raison.message}`);
        }
      }

      lignes.push("- Plages horaires:");
      for (const plage of groupe.plages_horaires) {
        lignes.push(
          `  - ${plage.date} ${formaterHeure(plage.heure_debut)}-${formaterHeure(plage.heure_fin)}` +
            ` | ${plage.professeur || "Prof non renseigne"} | ${plage.salle || "Salle non renseignee"}`
        );
      }

      if (groupe.conflits.length > 0) {
        lignes.push("- Conflits detectes:");
        for (const conflit of groupe.conflits) {
          lignes.push(
            `  - ${conflit.date} ${formaterHeure(conflit.heure_debut)}-${formaterHeure(
              conflit.heure_fin
            )} avec ${conflit.conflit_avec.code_cours} - ${conflit.conflit_avec.nom_cours}` +
              ` (${conflit.conflit_avec.source_type}, ${conflit.conflit_avec.groupe_source})`
          );
        }
      }

      lignes.push("");
    }
  }

  return lignes.join("\n");
}

const codes = lireArg("codes");
const matricules = lireArg("matricules");
const idEtudiant = lireArg("id_etudiant");
const statut = lireArg("statut") || "resolution_manuelle";
const format = (lireArg("format") || "markdown").toLowerCase();
const out = lireArg("out");

try {
  const rapport = await FailedCourseDebugService.genererRapport({
    codes,
    matricules,
    idEtudiant,
    statut,
  });

  const contenu =
    format === "json"
      ? JSON.stringify(rapport, null, 2)
      : rendreMarkdown(rapport);

  if (out) {
    const cheminSortie = path.resolve(process.cwd(), out);
    await fs.writeFile(cheminSortie, contenu, "utf8");
    console.log(`Rapport ecrit: ${cheminSortie}`);
  } else {
    console.log(contenu);
  }
} finally {
  await pool.end();
}
