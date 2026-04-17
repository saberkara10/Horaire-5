import pool from "../db.js";

const DESIRED_PROFESSORS = [
  {
    matricule: "AUTO-PROF-10",
    prenom: "Rayan",
    nom: "Nguyen",
    specialite:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB404", "CYB405", "CYB406", "CYB407"],
  },
  {
    matricule: "AUTO-PROF-11",
    prenom: "Maya",
    nom: "Benali",
    specialite: "Analyse de donnees",
    cours: ["DAT101", "DAT102", "DAT103", "DAT104", "DAT105", "DAT106"],
  },
  {
    matricule: "AUTO-PROF-12",
    prenom: "Samir",
    nom: "Rahmani",
    specialite: "Analyse de donnees",
    cours: ["DAT107", "DAT201", "DAT202", "DAT203", "DAT204", "DAT205"],
  },
  {
    matricule: "AUTO-PROF-13",
    prenom: "Ines",
    nom: "Lavoie",
    specialite: "Analyse de donnees",
    cours: ["DAT206", "DAT207", "DAT301", "DAT302", "DAT303", "DAT304"],
  },
  {
    matricule: "AUTO-PROF-14",
    prenom: "Nora",
    nom: "Garcia",
    specialite: "Analyse de donnees",
    cours: ["DAT305", "DAT306", "DAT307", "DAT401", "DAT402", "DAT403"],
  },
  {
    matricule: "AUTO-PROF-15",
    prenom: "Bilal",
    nom: "Park",
    specialite: "Analyse de donnees",
    cours: ["DAT404", "DAT405", "DAT406", "DAT407"],
  },
  {
    matricule: "AUTO-PROF-16",
    prenom: "Jade",
    nom: "Ahmed",
    specialite: "Intelligence artificielle appliquee",
    cours: ["AIA101", "AIA102", "AIA103", "AIA104", "AIA105", "AIA106"],
  },
  {
    matricule: "AUTO-PROF-17",
    prenom: "Farah",
    nom: "Liu",
    specialite: "Intelligence artificielle appliquee",
    cours: ["AIA107", "AIA201", "AIA202", "AIA203", "AIA204", "AIA205"],
  },
  {
    matricule: "AUTO-PROF-18",
    prenom: "Luca",
    nom: "Simard",
    specialite: "Intelligence artificielle appliquee",
    cours: ["AIA206", "AIA207", "AIA301", "AIA302", "AIA303", "AIA304"],
  },
  {
    matricule: "AUTO-PROF-19",
    prenom: "Adam",
    nom: "Ali",
    specialite: "Intelligence artificielle appliquee",
    cours: ["AIA305", "AIA306", "AIA307", "AIA401", "AIA402", "AIA403"],
  },
  {
    matricule: "AUTO-PROF-20",
    prenom: "Mia",
    nom: "Chen",
    specialite: "Intelligence artificielle appliquee",
    cours: ["AIA404", "AIA405", "AIA406", "AIA407"],
  },
  {
    matricule: "AUTO-PROF-22",
    prenom: "Aya",
    nom: "Yilmaz",
    specialite: "Techniques en administration des affaires",
    cours: ["ADM107", "ADM201", "ADM202", "ADM203", "ADM204", "ADM205"],
  },
  {
    matricule: "AUTO-PROF-23",
    prenom: "Meriem",
    nom: "Garneau",
    specialite: "Techniques en administration des affaires",
    cours: ["ADM206", "ADM207", "ADM301", "ADM302", "ADM303", "ADM304"],
  },
  {
    matricule: "AUTO-PROF-24",
    prenom: "Noah",
    nom: "Benoit",
    specialite: "Techniques en administration des affaires",
    cours: ["ADM305", "ADM306", "ADM307", "ADM401", "ADM402", "ADM403"],
  },
  {
    matricule: "AUTO-PROF-25",
    prenom: "Sophie",
    nom: "Bouchard",
    specialite: "Techniques en administration des affaires",
    cours: ["ADM404", "ADM405", "ADM406", "ADM407"],
  },
  {
    matricule: "AUTO-PROF-26",
    prenom: "Marc",
    nom: "Gagnon",
    specialite: "Gestion des services de restauration",
    cours: ["RES101", "RES102", "RES103", "RES104", "RES105", "RES106"],
  },
  {
    matricule: "AUTO-PROF-27",
    prenom: "Nadia",
    nom: "Roy",
    specialite: "Gestion des services de restauration",
    cours: ["RES107", "RES201", "RES202", "RES203", "RES204", "RES205"],
  },
  {
    matricule: "AUTO-PROF-28",
    prenom: "Karim",
    nom: "Lefebvre",
    specialite: "Gestion des services de restauration",
    cours: ["RES206", "RES207", "RES301", "RES302", "RES303", "RES304"],
  },
  {
    matricule: "AUTO-PROF-29",
    prenom: "Lea",
    nom: "Morin",
    specialite: "Gestion des services de restauration",
    cours: ["RES305", "RES306", "RES307", "RES401", "RES402", "RES403"],
  },
  {
    matricule: "AUTO-PROF-30",
    prenom: "Omar",
    nom: "Cote",
    specialite: "Gestion des services de restauration",
    cours: ["RES404", "RES405", "RES406", "RES407"],
  },
  {
    matricule: "AUTO-PROF-31",
    prenom: "Amine",
    nom: "Pelletier",
    specialite: "Soins infirmiers auxiliaires",
    cours: ["SIA101", "SIA102", "SIA103", "SIA104", "SIA105", "SIA106"],
  },
  {
    matricule: "AUTO-PROF-32",
    prenom: "Sara",
    nom: "Parent",
    specialite: "Soins infirmiers auxiliaires",
    cours: ["SIA107", "SIA201", "SIA202", "SIA203", "SIA204", "SIA205"],
  },
  {
    matricule: "AUTO-PROF-33",
    prenom: "Yasmine",
    nom: "Nguyen",
    specialite: "Soins infirmiers auxiliaires",
    cours: ["SIA206", "SIA207", "SIA301", "SIA302", "SIA303", "SIA304"],
  },
  {
    matricule: "AUTO-PROF-34",
    prenom: "Rayan",
    nom: "Benali",
    specialite: "Soins infirmiers auxiliaires",
    cours: ["SIA305", "SIA306", "SIA307", "SIA401", "SIA402", "SIA403"],
  },
  {
    matricule: "AUTO-PROF-35",
    prenom: "Maya",
    nom: "Rahmani",
    specialite: "Soins infirmiers auxiliaires",
    cours: ["SIA404", "SIA405", "SIA406", "SIA407"],
  },
  {
    matricule: "AUTO-PROF-36",
    prenom: "Samir",
    nom: "Lavoie",
    specialite: "Travail social",
    cours: ["TSO101", "TSO102", "TSO103", "TSO104", "TSO105", "TSO106"],
  },
  {
    matricule: "AUTO-PROF-37",
    prenom: "Ines",
    nom: "Garcia",
    specialite: "Travail social",
    cours: ["TSO107", "TSO201", "TSO202", "TSO203", "TSO204", "TSO205"],
  },
  {
    matricule: "AUTO-PROF-38",
    prenom: "Nora",
    nom: "Park",
    specialite: "Travail social",
    cours: ["TSO206", "TSO207", "TSO301", "TSO302", "TSO303", "TSO304"],
  },
  {
    matricule: "AUTO-PROF-39",
    prenom: "Bilal",
    nom: "Ahmed",
    specialite: "Travail social",
    cours: ["TSO305", "TSO306", "TSO307", "TSO401", "TSO402", "TSO403"],
  },
  {
    matricule: "AUTO-PROF-40",
    prenom: "Jade",
    nom: "Liu",
    specialite: "Travail social",
    cours: ["TSO404", "TSO405", "TSO406", "TSO407"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-01",
    prenom: "Farah",
    nom: "Simard",
    specialite: "Analyse de donnees",
    cours: ["DAT106", "DAT207", "DAT406"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-02",
    prenom: "Luca",
    nom: "Ali",
    specialite:
      "Programmation informatique, Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB107", "INF106", "INF307"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-03",
    prenom: "Adam",
    nom: "Chen",
    specialite: "Analyse de donnees, Travail social",
    cours: ["DAT107", "TSO307", "TSO406"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-04",
    prenom: "Mia",
    nom: "Traore",
    specialite: "Intelligence artificielle appliquee, Programmation informatique",
    cours: ["AIA106", "AIA205", "AIA206", "INF406"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-05",
    prenom: "Hamza",
    nom: "Yilmaz",
    specialite: "Analyse de donnees, Techniques en administration des affaires",
    cours: ["ADM107", "DAT205", "DAT405"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-06",
    prenom: "Aya",
    nom: "Garneau",
    specialite:
      "Gestion des services de restauration, Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB406", "RES106"],
  },
  {
    matricule: "AUTO-RESERVE-PROF-07",
    prenom: "Meriem",
    nom: "Benoit",
    specialite: "Travail social",
    cours: ["TSO207", "TSO304"],
  },
  {
    matricule: "CMRC06",
    prenom: "Abdelgheffar",
    nom: "Hamza",
    specialite: "Techniques en administration des affaires",
    cours: ["ADM101", "ADM102", "ADM103", "ADM104", "ADM105", "ADM106"],
  },
  {
    matricule: "INF01",
    prenom: "Rafik",
    nom: "Bedreddine",
    specialite: "Programmation informatique",
    cours: ["INF101", "INF102", "INF103", "INF104", "INF105", "INF106"],
  },
  {
    matricule: "INF02",
    prenom: "Saber",
    nom: "Kara",
    specialite:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB101", "CYB102", "CYB103", "CYB104", "CYB105", "CYB106"],
  },
  {
    matricule: "PROF1001",
    prenom: "Sophie",
    nom: "Tremblay",
    specialite: "Programmation informatique",
    cours: ["INF107", "INF201", "INF202", "INF203", "INF204", "INF205"],
  },
  {
    matricule: "PROF1002",
    prenom: "Marc",
    nom: "Bouchard",
    specialite: "Programmation informatique",
    cours: ["INF206", "INF207", "INF301", "INF302", "INF303", "INF304"],
  },
  {
    matricule: "PROF1003",
    prenom: "Nadia",
    nom: "Gagnon",
    specialite: "Programmation informatique",
    cours: ["INF305", "INF306", "INF307", "INF401", "INF402", "INF403"],
  },
  {
    matricule: "PROF1004",
    prenom: "Karim",
    nom: "Roy",
    specialite: "Programmation informatique",
    cours: ["INF404", "INF405", "INF406", "INF407"],
  },
  {
    matricule: "PROF1005",
    prenom: "Amine",
    nom: "Lefebvre",
    specialite:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB107", "CYB201", "CYB202", "CYB203", "CYB204", "CYB205"],
  },
  {
    matricule: "PROF1006",
    prenom: "Sarah",
    nom: "Morin",
    specialite:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB206", "CYB207", "CYB301", "CYB302", "CYB303", "CYB304"],
  },
  {
    matricule: "PROF1007",
    prenom: "Yacine",
    nom: "Cote",
    specialite:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    cours: ["CYB305", "CYB306", "CYB307", "CYB401", "CYB402", "CYB403"],
  },
];

function mapRowsByKey(rows, keyField) {
  return new Map(rows.map((row) => [String(row[keyField]), row]));
}

async function chargerCoursParCode(connection) {
  const codes = [...new Set(DESIRED_PROFESSORS.flatMap((prof) => prof.cours))];
  const placeholders = codes.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT id_cours, code
     FROM cours
     WHERE code IN (${placeholders})`,
    codes
  );

  const coursParCode = new Map(
    rows.map((row) => [String(row.code), Number(row.id_cours)])
  );
  const manquants = codes.filter((code) => !coursParCode.has(code));

  if (manquants.length > 0) {
    throw new Error(`Cours introuvables: ${manquants.join(", ")}`);
  }

  return coursParCode;
}

async function chargerProfesseursParMatricule(connection) {
  const [rows] = await connection.query(
    `SELECT id_professeur, matricule
     FROM professeurs`
  );

  return mapRowsByKey(rows, "matricule");
}

async function compterDisponibilites(connection, idProfesseur) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM disponibilites_professeurs
     WHERE id_professeur = ?`,
    [idProfesseur]
  );

  return Number(row.total || 0);
}

async function recopierDisponibilitesDepuisClone(connection, cible, sourceClone) {
  if (!sourceClone) {
    return 0;
  }

  const [rows] = await connection.query(
    `SELECT jour_semaine, heure_debut, heure_fin, date_debut_effet, date_fin_effet
     FROM disponibilites_professeurs
     WHERE id_professeur = ?
     ORDER BY jour_semaine ASC, heure_debut ASC`,
    [sourceClone]
  );

  for (const row of rows) {
    await connection.query(
      `INSERT IGNORE INTO disponibilites_professeurs (
         id_professeur,
         jour_semaine,
         heure_debut,
         heure_fin,
         date_debut_effet,
         date_fin_effet
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cible,
        Number(row.jour_semaine),
        row.heure_debut,
        row.heure_fin,
        row.date_debut_effet,
        row.date_fin_effet,
      ]
    );
  }

  return rows.length;
}

async function remplacerCours(connection, idProfesseur, idsCours) {
  await connection.query(
    `DELETE FROM professeur_cours
     WHERE id_professeur = ?`,
    [idProfesseur]
  );

  for (const idCours of idsCours) {
    await connection.query(
      `INSERT INTO professeur_cours (id_professeur, id_cours)
       VALUES (?, ?)`,
      [idProfesseur, idCours]
    );
  }
}

async function supprimerReliquatsBootstrap(connection, desiredMatricules) {
  const placeholders = desiredMatricules.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT p.id_professeur, p.matricule, COUNT(ac.id_affectation_cours) AS nb_affectations
     FROM professeurs p
     LEFT JOIN affectation_cours ac
       ON ac.id_professeur = p.id_professeur
     WHERE p.matricule LIKE 'AUTO-%'
       AND p.matricule NOT IN (${placeholders})
     GROUP BY p.id_professeur, p.matricule
     ORDER BY p.matricule ASC`,
    desiredMatricules
  );

  const bloques = rows.filter((row) => Number(row.nb_affectations || 0) > 0);

  if (bloques.length > 0) {
    throw new Error(
      `Suppression impossible pour des reliquats bootstrap deja affectes: ${bloques
        .map((row) => row.matricule)
        .join(", ")}`
    );
  }

  for (const row of rows) {
    await connection.query(
      `DELETE FROM disponibilites_professeurs
       WHERE id_professeur = ?`,
      [row.id_professeur]
    );
    await connection.query(
      `DELETE FROM professeur_cours
       WHERE id_professeur = ?`,
      [row.id_professeur]
    );
    await connection.query(
      `DELETE FROM professeurs
       WHERE id_professeur = ?`,
      [row.id_professeur]
    );
  }

  return rows.map((row) => row.matricule);
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const coursParCode = await chargerCoursParCode(connection);
    const professeursParMatricule = await chargerProfesseursParMatricule(connection);
    const desiredMatricules = DESIRED_PROFESSORS.map((prof) => prof.matricule);
    const rapport = {
      inseres: [],
      mis_a_jour: [],
      disponibilites_recopiees: [],
      reliquats_supprimes: [],
    };

    for (const definition of DESIRED_PROFESSORS) {
      const idsCours = definition.cours.map((code) => coursParCode.get(code));
      const existant = professeursParMatricule.get(definition.matricule);
      let idProfesseur = null;

      if (existant) {
        idProfesseur = Number(existant.id_professeur);
        await connection.query(
          `UPDATE professeurs
           SET nom = ?, prenom = ?, specialite = ?
           WHERE id_professeur = ?`,
          [
            definition.nom,
            definition.prenom,
            definition.specialite,
            idProfesseur,
          ]
        );
        rapport.mis_a_jour.push(definition.matricule);
      } else {
        const [result] = await connection.query(
          `INSERT INTO professeurs (matricule, nom, prenom, specialite)
           VALUES (?, ?, ?, ?)`,
          [
            definition.matricule,
            definition.nom,
            definition.prenom,
            definition.specialite,
          ]
        );
        idProfesseur = Number(result.insertId);
        professeursParMatricule.set(definition.matricule, {
          id_professeur: idProfesseur,
          matricule: definition.matricule,
        });
        rapport.inseres.push(definition.matricule);
      }

      await remplacerCours(connection, idProfesseur, idsCours);

      const nbDispos = await compterDisponibilites(connection, idProfesseur);
      if (nbDispos === 0) {
        const clone = professeursParMatricule.get(`DBL-${definition.matricule}`);
        const nbRecopiees = await recopierDisponibilitesDepuisClone(
          connection,
          idProfesseur,
          clone ? Number(clone.id_professeur) : null
        );

        if (nbRecopiees > 0) {
          rapport.disponibilites_recopiees.push({
            matricule: definition.matricule,
            source: `DBL-${definition.matricule}`,
            nombre: nbRecopiees,
          });
        }
      }
    }

    rapport.reliquats_supprimes = await supprimerReliquatsBootstrap(
      connection,
      desiredMatricules
    );

    await connection.commit();

    const [[totaux]] = await connection.query(
      `SELECT
         COUNT(*) AS total_professeurs,
         SUM(CASE WHEN matricule LIKE 'DBL-%' THEN 1 ELSE 0 END) AS total_dbl,
         SUM(CASE WHEN matricule IN (${desiredMatricules.map(() => "?").join(", ")}) THEN 1 ELSE 0 END) AS total_reference
       FROM professeurs`,
      desiredMatricules
    );

    console.log(
      JSON.stringify(
        {
          message: "Restauration des professeurs de reference terminee.",
          rapport,
          totaux: {
            total_professeurs: Number(totaux.total_professeurs || 0),
            total_dbl: Number(totaux.total_dbl || 0),
            total_reference: Number(totaux.total_reference || 0),
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

try {
  await main();
} finally {
  await pool.end();
}
