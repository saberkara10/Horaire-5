/**
 * Logique de nettoyage de donnees de la migration v4.
 *
 * Role:
 * - fusionne les professeurs en doublon avant d'imposer une unicite
 *
 * Impact sur le projet:
 * - evite que des doublons de professeurs polluent les affectations et
 *   disponibilites
 * - ajoute une cle unique sur `(nom, prenom)` dans `professeurs`
 */
function normaliserTexteIdentite(valeur) {
  return String(valeur || "")
    .trim()
    .replace(/\s+/g, " ");
}

function creerCleIdentiteProfesseur(professeur) {
  return [
    normaliserTexteIdentite(professeur?.prenom).toLowerCase(),
    normaliserTexteIdentite(professeur?.nom).toLowerCase(),
  ].join("|");
}

function matriculeEstAuto(matricule) {
  return /^AUTO-/i.test(String(matricule || "").trim());
}

async function disponibilitesOntEffet(connection, tools) {
  return (
    (await tools.columnExists(
      connection,
      "disponibilites_professeurs",
      "date_debut_effet"
    )) &&
    (await tools.columnExists(
      connection,
      "disponibilites_professeurs",
      "date_fin_effet"
    ))
  );
}

async function fusionnerDoublons(connection, tools) {
  const [professeurs] = await connection.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COUNT(DISTINCT ac.id_affectation_cours) AS nombre_affectations,
            COUNT(DISTINCT pc.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN affectation_cours ac
       ON ac.id_professeur = p.id_professeur
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY p.id_professeur ASC`
  );

  const groupes = new Map();

  for (const professeur of professeurs) {
    const cle = creerCleIdentiteProfesseur(professeur);
    if (!cle || cle === "|") {
      continue;
    }

    const groupe = groupes.get(cle) || [];
    groupe.push(professeur);
    groupes.set(cle, groupe);
  }

  const hasDisponibiliteEffet = await disponibilitesOntEffet(connection, tools);
  const hasAbsences = await tools.tableExists(connection, "absences_professeurs");

  for (const groupe of groupes.values()) {
    if (groupe.length <= 1) {
      continue;
    }

    const [professeurConserve, ...doublons] = [...groupe].sort(
      (professeurA, professeurB) => {
        const autoA = matriculeEstAuto(professeurA.matricule) ? 1 : 0;
        const autoB = matriculeEstAuto(professeurB.matricule) ? 1 : 0;

        if (autoA !== autoB) {
          return autoA - autoB;
        }

        if (
          Number(professeurA.nombre_affectations || 0) !==
          Number(professeurB.nombre_affectations || 0)
        ) {
          return (
            Number(professeurB.nombre_affectations || 0) -
            Number(professeurA.nombre_affectations || 0)
          );
        }

        if (
          Number(professeurA.nombre_cours || 0) !==
          Number(professeurB.nombre_cours || 0)
        ) {
          return (
            Number(professeurB.nombre_cours || 0) -
            Number(professeurA.nombre_cours || 0)
          );
        }

        return Number(professeurA.id_professeur) - Number(professeurB.id_professeur);
      }
    );

    for (const doublon of doublons) {
      await connection.query(
        `INSERT IGNORE INTO professeur_cours (id_professeur, id_cours)
         SELECT ?, id_cours
         FROM professeur_cours
         WHERE id_professeur = ?`,
        [professeurConserve.id_professeur, doublon.id_professeur]
      );

      if (hasDisponibiliteEffet) {
        await connection.query(
          `INSERT IGNORE INTO disponibilites_professeurs (
             id_professeur,
             jour_semaine,
             heure_debut,
             heure_fin,
             date_debut_effet,
             date_fin_effet
           )
           SELECT ?, jour_semaine, heure_debut, heure_fin, date_debut_effet, date_fin_effet
           FROM disponibilites_professeurs
           WHERE id_professeur = ?`,
          [professeurConserve.id_professeur, doublon.id_professeur]
        );
      } else {
        await connection.query(
          `INSERT IGNORE INTO disponibilites_professeurs (
             id_professeur,
             jour_semaine,
             heure_debut,
             heure_fin
           )
           SELECT ?, jour_semaine, heure_debut, heure_fin
           FROM disponibilites_professeurs
           WHERE id_professeur = ?`,
          [professeurConserve.id_professeur, doublon.id_professeur]
        );
      }

      await connection.query(
        `UPDATE affectation_cours
         SET id_professeur = ?
         WHERE id_professeur = ?`,
        [professeurConserve.id_professeur, doublon.id_professeur]
      );

      if (hasAbsences) {
        await connection.query(
          `UPDATE absences_professeurs
           SET id_professeur = ?
           WHERE id_professeur = ?`,
          [professeurConserve.id_professeur, doublon.id_professeur]
        );
      }

      if (!professeurConserve.specialite && doublon.specialite) {
        await connection.query(
          `UPDATE professeurs
           SET specialite = ?
           WHERE id_professeur = ?`,
          [doublon.specialite, professeurConserve.id_professeur]
        );
        professeurConserve.specialite = doublon.specialite;
      }

      await connection.query(
        `DELETE FROM disponibilites_professeurs
         WHERE id_professeur = ?`,
        [doublon.id_professeur]
      );
      await connection.query(
        `DELETE FROM professeur_cours
         WHERE id_professeur = ?`,
        [doublon.id_professeur]
      );
      await connection.query(
        `DELETE FROM professeurs
         WHERE id_professeur = ?
         LIMIT 1`,
        [doublon.id_professeur]
      );
    }
  }
}

export async function isApplied({ connection, tools }) {
  return tools.indexExists(
    connection,
    "professeurs",
    "uniq_professeur_nom_prenom"
  );
}

export async function up({ connection, tools }) {
  await tools.withTransaction(connection, async () => {
    await fusionnerDoublons(connection, tools);
    await tools.addIndexIfMissing(
      connection,
      "professeurs",
      "uniq_professeur_nom_prenom",
      `ALTER TABLE professeurs
       ADD UNIQUE KEY uniq_professeur_nom_prenom (nom, prenom)`
    );
  });
}
