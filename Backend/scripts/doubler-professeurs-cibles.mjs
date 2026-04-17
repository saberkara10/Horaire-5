import pool from "../db.js";

const SOURCE_MATRICULES = [
  "AUTO-PROF-10",
  "AUTO-PROF-11",
  "AUTO-PROF-12",
  "AUTO-PROF-13",
  "AUTO-PROF-14",
  "AUTO-PROF-15",
  "AUTO-PROF-16",
  "AUTO-PROF-17",
  "AUTO-PROF-18",
  "AUTO-PROF-19",
  "AUTO-PROF-20",
  "AUTO-PROF-22",
  "AUTO-PROF-23",
  "AUTO-PROF-24",
  "AUTO-PROF-25",
  "AUTO-PROF-26",
  "AUTO-PROF-27",
  "AUTO-PROF-28",
  "AUTO-PROF-29",
  "AUTO-PROF-30",
  "AUTO-PROF-31",
  "AUTO-PROF-32",
  "AUTO-PROF-33",
  "AUTO-PROF-34",
  "AUTO-PROF-35",
  "AUTO-PROF-36",
  "AUTO-PROF-37",
  "AUTO-PROF-38",
  "AUTO-PROF-39",
  "AUTO-PROF-40",
  "AUTO-RESERVE-PROF-01",
  "AUTO-RESERVE-PROF-02",
  "AUTO-RESERVE-PROF-03",
  "AUTO-RESERVE-PROF-04",
  "AUTO-RESERVE-PROF-05",
  "AUTO-RESERVE-PROF-06",
  "AUTO-RESERVE-PROF-07",
  "CMRC06",
  "INF01",
  "INF02",
  "PROF1001",
  "PROF1002",
  "PROF1003",
  "PROF1004",
  "PROF1005",
  "PROF1006",
  "PROF1007",
];

const PRENOMS_CLONES = [
  "Aymen",
  "Imane",
  "Salma",
  "Walid",
  "Kenza",
  "Nassim",
  "Rim",
  "Idriss",
  "Nour",
  "Zakaria",
  "Chaima",
  "Anas",
  "Mouna",
  "Alae",
  "Siham",
  "Hicham",
  "Soukaina",
  "Younes",
  "Nesrine",
  "Ilham",
  "Tarek",
  "Loubna",
  "Samy",
  "Houda",
];

const NOMS_CLONES = [
  "Meziane",
  "Haddad",
  "Saidi",
  "Brahimi",
  "Cherkaoui",
  "Amrani",
  "Messaoudi",
  "Toumi",
  "Belaid",
  "Zerouali",
  "Khaldi",
  "Benkacem",
  "Ouali",
  "Mekki",
  "Ziani",
  "Bouras",
  "Aouad",
  "Kettani",
  "Bensalem",
  "Mokhtari",
  "Lamrani",
  "Allam",
  "Ferhati",
  "Meftah",
];

function normaliserTexte(valeur) {
  return String(valeur || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function creerCleIdentite(nom, prenom) {
  return `${normaliserTexte(prenom)}|${normaliserTexte(nom)}`;
}

function creerMatriculeClone(matriculeSource) {
  return `DBL-${String(matriculeSource || "").trim()}`;
}

function creerAllocateurIdentites(clesExistantes) {
  const cles = new Set(clesExistantes);
  let curseur = 0;
  const capacite = PRENOMS_CLONES.length * NOMS_CLONES.length;

  return () => {
    while (curseur < capacite) {
      const indexPrenom = curseur % PRENOMS_CLONES.length;
      const indexNom =
        Math.floor(curseur / PRENOMS_CLONES.length) % NOMS_CLONES.length;
      curseur += 1;

      const prenom = PRENOMS_CLONES[indexPrenom];
      const nom = NOMS_CLONES[indexNom];
      const cle = creerCleIdentite(nom, prenom);

      if (cles.has(cle)) {
        continue;
      }

      cles.add(cle);
      return { nom, prenom };
    }

    throw new Error(
      "Impossible de generer assez d'identites uniques pour les professeurs clones."
    );
  };
}

function creerMapListe(rows, keyField, valueFactory = (value) => value) {
  const map = new Map();

  for (const row of rows) {
    const cle = row[keyField];

    if (!map.has(cle)) {
      map.set(cle, []);
    }

    map.get(cle).push(valueFactory(row));
  }

  return map;
}

async function chargerProfesseursSources(connection) {
  const placeholders = SOURCE_MATRICULES.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT id_professeur, matricule, nom, prenom, specialite
     FROM professeurs
     WHERE matricule IN (${placeholders})`,
    SOURCE_MATRICULES
  );

  const professeursParMatricule = new Map(
    rows.map((row) => [String(row.matricule).trim(), row])
  );
  const manquants = SOURCE_MATRICULES.filter(
    (matricule) => !professeursParMatricule.has(matricule)
  );

  if (manquants.length > 0) {
    throw new Error(
      `Professeurs sources introuvables: ${manquants.join(", ")}`
    );
  }

  return SOURCE_MATRICULES.map((matricule) => professeursParMatricule.get(matricule));
}

async function verifierCiblesAbsentes(connection, matriculesCibles) {
  const placeholders = matriculesCibles.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT matricule
     FROM professeurs
     WHERE matricule IN (${placeholders})`,
    matriculesCibles
  );

  if (rows.length > 0) {
    throw new Error(
      `Le script semble deja avoir ete execute. Matricules deja presents: ${rows
        .map((row) => row.matricule)
        .join(", ")}`
    );
  }
}

async function chargerCoursParProfesseur(connection, idsProfesseurs) {
  const placeholders = idsProfesseurs.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT
       pc.id_professeur,
       pc.id_cours,
       c.code
     FROM professeur_cours pc
     JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE pc.id_professeur IN (${placeholders})
     ORDER BY pc.id_professeur ASC, c.code ASC`,
    idsProfesseurs
  );

  return creerMapListe(rows, "id_professeur", (row) => ({
    id_cours: Number(row.id_cours),
    code: String(row.code || "").trim(),
  }));
}

async function chargerDisponibilitesParProfesseur(connection, idsProfesseurs) {
  const placeholders = idsProfesseurs.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT
       id_professeur,
       jour_semaine,
       heure_debut,
       heure_fin,
       date_debut_effet,
       date_fin_effet
     FROM disponibilites_professeurs
     WHERE id_professeur IN (${placeholders})
     ORDER BY id_professeur ASC, jour_semaine ASC, heure_debut ASC`,
    idsProfesseurs
  );

  return creerMapListe(rows, "id_professeur", (row) => ({
    jour_semaine: Number(row.jour_semaine),
    heure_debut: row.heure_debut,
    heure_fin: row.heure_fin,
    date_debut_effet: row.date_debut_effet,
    date_fin_effet: row.date_fin_effet,
  }));
}

async function chargerIdentitesExistantes(connection) {
  const [rows] = await connection.query(
    `SELECT nom, prenom
     FROM professeurs`
  );

  return new Set(rows.map((row) => creerCleIdentite(row.nom, row.prenom)));
}

async function chargerTotalProfesseurs(connection) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM professeurs`
  );

  return Number(row.total || 0);
}

async function insererClone(
  connection,
  professeurSource,
  identiteClone,
  matriculeClone,
  cours,
  disponibilites
) {
  const [resultat] = await connection.query(
    `INSERT INTO professeurs (matricule, nom, prenom, specialite)
     VALUES (?, ?, ?, ?)`,
    [
      matriculeClone,
      identiteClone.nom,
      identiteClone.prenom,
      professeurSource.specialite || null,
    ]
  );

  const idProfesseurClone = Number(resultat.insertId);

  for (const coursProfesseur of cours) {
    await connection.query(
      `INSERT INTO professeur_cours (id_professeur, id_cours)
       VALUES (?, ?)`,
      [idProfesseurClone, Number(coursProfesseur.id_cours)]
    );
  }

  for (const disponibilite of disponibilites) {
    await connection.query(
      `INSERT INTO disponibilites_professeurs (
         id_professeur,
         jour_semaine,
         heure_debut,
         heure_fin,
         date_debut_effet,
         date_fin_effet
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idProfesseurClone,
        disponibilite.jour_semaine,
        disponibilite.heure_debut,
        disponibilite.heure_fin,
        disponibilite.date_debut_effet,
        disponibilite.date_fin_effet,
      ]
    );
  }

  return idProfesseurClone;
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const totalAvant = await chargerTotalProfesseurs(connection);
    const professeursSources = await chargerProfesseursSources(connection);
    const matriculesClones = professeursSources.map((professeur) =>
      creerMatriculeClone(professeur.matricule)
    );

    await verifierCiblesAbsentes(connection, matriculesClones);

    const idsSources = professeursSources.map((professeur) =>
      Number(professeur.id_professeur)
    );
    const coursParProfesseur = await chargerCoursParProfesseur(connection, idsSources);
    const disponibilitesParProfesseur = await chargerDisponibilitesParProfesseur(
      connection,
      idsSources
    );
    const allocateurIdentites = creerAllocateurIdentites(
      await chargerIdentitesExistantes(connection)
    );
    const creations = [];

    for (const professeurSource of professeursSources) {
      const identiteClone = allocateurIdentites();
      const matriculeClone = creerMatriculeClone(professeurSource.matricule);
      const cours = coursParProfesseur.get(Number(professeurSource.id_professeur)) || [];
      const disponibilites =
        disponibilitesParProfesseur.get(Number(professeurSource.id_professeur)) || [];

      const idProfesseurClone = await insererClone(
        connection,
        professeurSource,
        identiteClone,
        matriculeClone,
        cours,
        disponibilites
      );

      creations.push({
        id_professeur: idProfesseurClone,
        matricule: matriculeClone,
        nom: identiteClone.nom,
        prenom: identiteClone.prenom,
        specialite: professeurSource.specialite || null,
        source_matricule: professeurSource.matricule,
        nb_cours: cours.length,
        cours: cours.map((item) => item.code),
        nb_disponibilites: disponibilites.length,
      });
    }

    await connection.commit();

    const totalApres = totalAvant + creations.length;

    console.log(
      JSON.stringify(
        {
          message: "Duplication des professeurs ciblee terminee avec succes.",
          total_avant: totalAvant,
          total_crees: creations.length,
          total_apres: totalApres,
          creations,
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
