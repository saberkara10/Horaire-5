/**
 * MODEL - Gestion des salles
 *
 * Ce module regroupe :
 * - les operations CRUD sur les salles ;
 * - la lecture agregee de l'occupation hebdomadaire d'une salle ;
 * - le calcul des indicateurs V2 et du resume dynamique V3.
 *
 * Le format de sortie de l'occupation est volontairement aligne sur les autres
 * modules d'horaires du projet : une liste d'occupations detaillees, plus une
 * vue hebdomadaire exploitable directement par le frontend.
 */
import pool from "../../db.js";

const HEURE_DEBUT_JOURNEE = "08:00:00";
const HEURE_FIN_JOURNEE = "23:00:00";

const GROUPE_OCCUPATION_SQL = `
  SELECT ge.id_groupes_etudiants,
         ge.nom_groupe,
         ge.programme,
         ge.etape,
         ge.id_session,
         COALESCE(ge.est_groupe_special, 0) AS est_groupe_special,
         CASE
           WHEN COALESCE(ge.est_groupe_special, 0) = 1
             THEN COUNT(DISTINCT ae.id_etudiant)
           ELSE COUNT(DISTINCT e.id_etudiant)
         END AS effectif
  FROM groupes_etudiants ge
  LEFT JOIN etudiants e
    ON e.id_groupes_etudiants = ge.id_groupes_etudiants
  LEFT JOIN affectation_etudiants ae
    ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
   AND ae.id_session = ge.id_session
  GROUP BY ge.id_groupes_etudiants,
           ge.nom_groupe,
           ge.programme,
           ge.etape,
           ge.id_session,
           ge.est_groupe_special
`;

function creerErreurSalle(message, statusCode = 400) {
  const erreur = new Error(message);
  erreur.statusCode = statusCode;
  return erreur;
}

function normaliserHeure(heure) {
  const valeur = String(heure || "").trim();

  if (!valeur) {
    return "";
  }

  if (valeur.length === 5) {
    return `${valeur}:00`;
  }

  return valeur.slice(0, 8);
}

function heureVersMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function minutesVersHeure(minutes) {
  const heures = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;

  return `${String(heures).padStart(2, "0")}:${String(minutesRestantes).padStart(2, "0")}:00`;
}

function arrondirHeures(minutes) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

function arrondirTaux(valeur) {
  return Math.round(Number(valeur || 0) * 100) / 100;
}

function creerDateLocale(dateSource) {
  if (dateSource instanceof Date) {
    return new Date(
      dateSource.getFullYear(),
      dateSource.getMonth(),
      dateSource.getDate()
    );
  }

  const texte = String(dateSource || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, annee, mois, jour] = match;
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
}

function formaterDateIso(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function ajouterJours(date, nbJours) {
  const prochaineDate = new Date(date);
  prochaineDate.setDate(prochaineDate.getDate() + nbJours);
  return prochaineDate;
}

function getDebutSemaine(dateSource) {
  const date = creerDateLocale(dateSource);
  const jour = date.getDay();
  const diff = jour === 0 ? -6 : 1 - jour;

  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFinSemaine(dateSource) {
  return ajouterJours(getDebutSemaine(dateSource), 6);
}

function dateIsoValide(dateSource) {
  const date = creerDateLocale(dateSource);
  return !Number.isNaN(date.getTime());
}

function estDateDansIntervalle(dateIso, dateDebut, dateFin) {
  if (!dateIso) {
    return false;
  }

  if (dateDebut && dateIso < String(dateDebut)) {
    return false;
  }

  if (dateFin && dateIso > String(dateFin)) {
    return false;
  }

  return true;
}

function comparerOccupations(occupationA, occupationB) {
  if (occupationA.date !== occupationB.date) {
    return String(occupationA.date).localeCompare(String(occupationB.date), "fr");
  }

  if (occupationA.heure_debut !== occupationB.heure_debut) {
    return String(occupationA.heure_debut).localeCompare(
      String(occupationB.heure_debut),
      "fr"
    );
  }

  if (occupationA.heure_fin !== occupationB.heure_fin) {
    return String(occupationA.heure_fin).localeCompare(
      String(occupationB.heure_fin),
      "fr"
    );
  }

  return Number(occupationA.id_affectation_cours || 0) - Number(occupationB.id_affectation_cours || 0);
}

function normaliserListeValeurs(valeurs) {
  return [...new Set(
    (Array.isArray(valeurs) ? valeurs : [])
      .map((valeur) => String(valeur || "").trim())
      .filter(Boolean)
  )];
}

function normaliserEtape(valeur) {
  const texte = String(valeur ?? "").trim();
  return texte || null;
}

function construireOccupationBase(ligne) {
  return {
    id_affectation_cours: Number(ligne.id_affectation_cours),
    id_cours: Number(ligne.id_cours),
    code_cours: ligne.code_cours,
    nom_cours: ligne.nom_cours,
    programme_cours: ligne.programme_cours,
    etape_etude: normaliserEtape(ligne.etape_etude),
    type_cours: ligne.type_cours,
    id_professeur: Number(ligne.id_professeur),
    nom_professeur: ligne.nom_professeur,
    prenom_professeur: ligne.prenom_professeur,
    id_salle: Number(ligne.id_salle),
    code_salle: ligne.code_salle,
    type_salle: ligne.type_salle,
    capacite_salle: Number(ligne.capacite_salle || 0),
    id_plage_horaires: Number(ligne.id_plage_horaires),
    date: ligne.date,
    heure_debut: normaliserHeure(ligne.heure_debut),
    heure_fin: normaliserHeure(ligne.heure_fin),
    groupes: "",
    groupes_details: [],
    programmes: [],
    etapes: [],
    effectif_total: 0,
    capacite_restante: Number(ligne.capacite_salle || 0),
    est_reprise: false,
    conflit_detecte: false,
    statut: "occupee",
  };
}

function agregerOccupationSalle(lignes = []) {
  const occupationsParId = new Map();

  for (const ligne of lignes) {
    const idAffectation = Number(ligne.id_affectation_cours);

    if (!occupationsParId.has(idAffectation)) {
      occupationsParId.set(idAffectation, construireOccupationBase(ligne));
    }

    const occupation = occupationsParId.get(idAffectation);
    const idGroupe = Number(ligne.id_groupes_etudiants || 0);

    if (idGroupe > 0) {
      const dejaPresent = occupation.groupes_details.some(
        (groupe) => groupe.id_groupes_etudiants === idGroupe
      );

      if (!dejaPresent) {
        occupation.groupes_details.push({
          id_groupes_etudiants: idGroupe,
          nom_groupe: ligne.nom_groupe,
          programme: ligne.programme_groupe,
          etape: normaliserEtape(ligne.etape_groupe),
          effectif: Number(ligne.effectif_groupe || 0),
          est_groupe_special: Boolean(Number(ligne.est_groupe_special || 0)),
        });
      }
    }
  }

  const occupations = [...occupationsParId.values()]
    .map((occupation) => {
      const groupes = occupation.groupes_details;
      const programmes = normaliserListeValeurs([
        ...groupes.map((groupe) => groupe.programme),
        occupation.programme_cours,
      ]);
      const etapes = normaliserListeValeurs([
        ...groupes.map((groupe) => groupe.etape),
        occupation.etape_etude,
      ]);
      const effectifTotal = groupes.reduce(
        (total, groupe) => total + Number(groupe.effectif || 0),
        0
      );
      const estReprise = groupes.some((groupe) => groupe.est_groupe_special);

      return {
        ...occupation,
        groupes: groupes.length > 0
          ? groupes.map((groupe) => groupe.nom_groupe).join(", ")
          : "Aucun groupe",
        programmes,
        etapes,
        effectif_total: effectifTotal,
        capacite_restante: Math.max(
          0,
          Number(occupation.capacite_salle || 0) - effectifTotal
        ),
        est_reprise: estReprise,
      };
    })
    .sort(comparerOccupations);

  marquerConflitsOccupations(occupations);
  return occupations;
}

function marquerConflitsOccupations(occupations = []) {
  const occupationsParDate = new Map();

  for (const occupation of occupations) {
    const date = String(occupation.date || "");

    if (!occupationsParDate.has(date)) {
      occupationsParDate.set(date, []);
    }

    occupationsParDate.get(date).push(occupation);
  }

  for (const listeOccupations of occupationsParDate.values()) {
    const occupationsTriees = [...listeOccupations].sort(comparerOccupations);

    for (let index = 0; index < occupationsTriees.length; index += 1) {
      const occupationCourante = occupationsTriees[index];
      const debutCourant = heureVersMinutes(occupationCourante.heure_debut);
      const finCourante = heureVersMinutes(occupationCourante.heure_fin);

      for (let indexSuivant = index + 1; indexSuivant < occupationsTriees.length; indexSuivant += 1) {
        const occupationSuivante = occupationsTriees[indexSuivant];
        const debutSuivant = heureVersMinutes(occupationSuivante.heure_debut);

        if (debutSuivant >= finCourante) {
          break;
        }

        const finSuivante = heureVersMinutes(occupationSuivante.heure_fin);

        if (debutCourant < finSuivante && debutSuivant < finCourante) {
          occupationCourante.conflit_detecte = true;
          occupationCourante.statut = "conflit";
          occupationSuivante.conflit_detecte = true;
          occupationSuivante.statut = "conflit";
        }
      }
    }
  }
}

function construireCreneauLibre(date, jourSemaine, debutMinutes, finMinutes) {
  return {
    id_creneau: `libre-${date}-${debutMinutes}-${finMinutes}`,
    statut: "libre",
    date,
    jour_semaine: jourSemaine,
    heure_debut: minutesVersHeure(debutMinutes),
    heure_fin: minutesVersHeure(finMinutes),
    duree_minutes: Math.max(0, finMinutes - debutMinutes),
  };
}

function construireVueHebdomadaire(occupations = [], dateReference) {
  const debutSemaine = getDebutSemaine(dateReference);
  const finSemaine = getFinSemaine(dateReference);
  const debutSemaineIso = formaterDateIso(debutSemaine);
  const finSemaineIso = formaterDateIso(finSemaine);
  const debutJourneeMinutes = heureVersMinutes(HEURE_DEBUT_JOURNEE);
  const finJourneeMinutes = heureVersMinutes(HEURE_FIN_JOURNEE);
  const occupationsSemaine = occupations.filter(
    (occupation) =>
      occupation.date >= debutSemaineIso && occupation.date <= finSemaineIso
  );
  const occupationsParDate = new Map();

  for (const occupation of occupationsSemaine) {
    if (!occupationsParDate.has(occupation.date)) {
      occupationsParDate.set(occupation.date, []);
    }

    occupationsParDate.get(occupation.date).push(occupation);
  }

  const jours = [];

  for (let indexJour = 0; indexJour < 7; indexJour += 1) {
    const dateCourante = ajouterJours(debutSemaine, indexJour);
    const dateIso = formaterDateIso(dateCourante);
    const jourSemaine = indexJour + 1;
    const occupationsJour = [...(occupationsParDate.get(dateIso) || [])].sort(
      comparerOccupations
    );
    const creneaux = [];
    let curseurMinutes = debutJourneeMinutes;

    for (const occupation of occupationsJour) {
      const debutOccupation = Math.max(
        debutJourneeMinutes,
        heureVersMinutes(occupation.heure_debut)
      );
      const finOccupation = Math.min(
        finJourneeMinutes,
        heureVersMinutes(occupation.heure_fin)
      );

      if (debutOccupation > curseurMinutes) {
        creneaux.push(
          construireCreneauLibre(
            dateIso,
            jourSemaine,
            curseurMinutes,
            debutOccupation
          )
        );
      }

      creneaux.push({
        ...occupation,
        statut: occupation.conflit_detecte ? "conflit" : "occupee",
        jour_semaine: jourSemaine,
        duree_minutes: Math.max(0, finOccupation - debutOccupation),
      });

      curseurMinutes = Math.max(curseurMinutes, finOccupation);
    }

    if (curseurMinutes < finJourneeMinutes) {
      creneaux.push(
        construireCreneauLibre(
          dateIso,
          jourSemaine,
          curseurMinutes,
          finJourneeMinutes
        )
      );
    }

    jours.push({
      date: dateIso,
      jour_semaine: jourSemaine,
      creneaux,
    });
  }

  return {
    date_reference: formaterDateIso(creerDateLocale(dateReference)),
    debut_semaine: debutSemaineIso,
    fin_semaine: finSemaineIso,
    jours,
    occupations_semaine: occupationsSemaine,
  };
}

function calculerResumeOccupation(vueHebdomadaire, salle) {
  const jours = Array.isArray(vueHebdomadaire?.jours) ? vueHebdomadaire.jours : [];
  const occupationsSemaine = Array.isArray(vueHebdomadaire?.occupations_semaine)
    ? vueHebdomadaire.occupations_semaine
    : [];
  const volumeTotalMinutes = jours.length * (
    heureVersMinutes(HEURE_FIN_JOURNEE) - heureVersMinutes(HEURE_DEBUT_JOURNEE)
  );
  const volumeLibreMinutes = jours.reduce(
    (total, jour) =>
      total +
      (Array.isArray(jour.creneaux) ? jour.creneaux : [])
        .filter((creneau) => creneau.statut === "libre")
        .reduce(
          (sommeJour, creneau) =>
            sommeJour + Number(creneau.duree_minutes || 0),
          0
        ),
    0
  );
  const volumeOccupeMinutes = Math.max(0, volumeTotalMinutes - volumeLibreMinutes);
  const groupesDistincts = new Set();
  const programmes = new Set();
  const typesCours = new Set();

  for (const occupation of occupationsSemaine) {
    for (const groupe of occupation.groupes_details || []) {
      groupesDistincts.add(Number(groupe.id_groupes_etudiants));
    }

    for (const programme of occupation.programmes || []) {
      programmes.add(programme);
    }

    if (occupation.type_cours) {
      typesCours.add(occupation.type_cours);
    }
  }

  return {
    id_salle: Number(salle?.id_salle || 0) || null,
    creneaux_occupes: occupationsSemaine.length,
    creneaux_libres: jours.reduce(
      (total, jour) =>
        total +
        (jour.creneaux || []).filter((creneau) => creneau.statut === "libre").length,
      0
    ),
    volume_horaire_occupe_minutes: volumeOccupeMinutes,
    volume_horaire_occupe_heures: arrondirHeures(volumeOccupeMinutes),
    volume_horaire_libre_minutes: volumeLibreMinutes,
    volume_horaire_libre_heures: arrondirHeures(volumeLibreMinutes),
    taux_occupation: volumeTotalMinutes > 0
      ? arrondirTaux(volumeOccupeMinutes / volumeTotalMinutes)
      : 0,
    taux_occupation_pourcentage: volumeTotalMinutes > 0
      ? Math.round((volumeOccupeMinutes / volumeTotalMinutes) * 100)
      : 0,
    nb_conflits: occupationsSemaine.filter((occupation) => occupation.conflit_detecte).length,
    groupes_distincts: groupesDistincts.size,
    programmes: [...programmes].sort((programmeA, programmeB) =>
      String(programmeA).localeCompare(String(programmeB), "fr")
    ),
    types_cours: [...typesCours].sort((typeA, typeB) =>
      String(typeA).localeCompare(String(typeB), "fr")
    ),
    capacite_salle: Number(salle?.capacite || 0),
  };
}

function fusionnerIntervalles(intervalles = [], borneDebut = 0, borneFin = Number.MAX_SAFE_INTEGER) {
  const intervallesFiltres = intervalles
    .map((intervalle) => ({
      debut: Math.max(borneDebut, Number(intervalle.debut || 0)),
      fin: Math.min(borneFin, Number(intervalle.fin || 0)),
    }))
    .filter((intervalle) => intervalle.fin > intervalle.debut)
    .sort((intervalleA, intervalleB) => intervalleA.debut - intervalleB.debut);

  const intervallesFusionnes = [];

  for (const intervalle of intervallesFiltres) {
    const dernier = intervallesFusionnes[intervallesFusionnes.length - 1];

    if (!dernier || intervalle.debut > dernier.fin) {
      intervallesFusionnes.push({ ...intervalle });
      continue;
    }

    dernier.fin = Math.max(dernier.fin, intervalle.fin);
  }

  return intervallesFusionnes;
}

function calculerTempsReelOccupation(occupations = []) {
  const maintenant = new Date();
  const dateActuelleIso = formaterDateIso(maintenant);
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();
  const debutJourneeMinutes = heureVersMinutes(HEURE_DEBUT_JOURNEE);
  const finJourneeMinutes = heureVersMinutes(HEURE_FIN_JOURNEE);
  const occupationsTriees = [...occupations].sort(comparerOccupations);
  const occupationsActuelles = occupationsTriees.filter((occupation) => {
    if (occupation.date !== dateActuelleIso) {
      return false;
    }

    const debut = heureVersMinutes(occupation.heure_debut);
    const fin = heureVersMinutes(occupation.heure_fin);
    return minutesActuelles >= debut && minutesActuelles < fin;
  });
  const prochainCreneau =
    occupationsTriees.find((occupation) => {
      if (occupation.date > dateActuelleIso) {
        return true;
      }

      if (occupation.date < dateActuelleIso) {
        return false;
      }

      return heureVersMinutes(occupation.heure_debut) > minutesActuelles;
    }) || null;
  const occupationsRestantesJour = occupationsTriees
    .filter((occupation) => occupation.date === dateActuelleIso)
    .map((occupation) => ({
      debut: heureVersMinutes(occupation.heure_debut),
      fin: heureVersMinutes(occupation.heure_fin),
    }));
  const borneDebutDisponibilite = Math.max(minutesActuelles, debutJourneeMinutes);
  const intervallesOccupes = fusionnerIntervalles(
    occupationsRestantesJour,
    borneDebutDisponibilite,
    finJourneeMinutes
  );
  const minutesOccupeesRestantes = intervallesOccupes.reduce(
    (total, intervalle) => total + Math.max(0, intervalle.fin - intervalle.debut),
    0
  );
  const disponibiliteRestante = Math.max(
    0,
    finJourneeMinutes - borneDebutDisponibilite - minutesOccupeesRestantes
  );
  const statutActuel = occupationsActuelles.length > 1
    ? "conflit"
    : occupationsActuelles.length === 1
    ? "occupee"
    : "libre";

  return {
    horodatage: maintenant.toISOString(),
    statut: statutActuel,
    occupee_maintenant: occupationsActuelles.length > 0,
    conflit_maintenant: occupationsActuelles.length > 1,
    occupation_actuelle: occupationsActuelles[0] || null,
    occupations_actuelles: occupationsActuelles,
    prochain_creneau: prochainCreneau,
    disponibilite_restante_aujourdhui_minutes: disponibiliteRestante,
    disponibilite_restante_aujourdhui_heures: arrondirHeures(disponibiliteRestante),
  };
}

function determinerDateReference(session, occupations, dateReference) {
  if (dateReference && dateIsoValide(dateReference)) {
    return String(dateReference);
  }

  const aujourdHui = formaterDateIso(new Date());

  if (
    estDateDansIntervalle(aujourdHui, session?.date_debut, session?.date_fin)
  ) {
    return aujourdHui;
  }

  if (occupations[0]?.date) {
    return occupations[0].date;
  }

  if (session?.date_debut) {
    return String(session.date_debut);
  }

  return aujourdHui;
}

function determinerBornesNavigation(session, occupations, dateReference) {
  const premiereDate = session?.date_debut || occupations[0]?.date || dateReference;
  const derniereDate =
    session?.date_fin || occupations[occupations.length - 1]?.date || dateReference;

  return {
    premiere_semaine: formaterDateIso(getDebutSemaine(premiereDate)),
    derniere_semaine: formaterDateIso(getDebutSemaine(derniereDate)),
  };
}

async function recupererSessionOccupation(options = {}, executor = pool) {
  const idSession =
    options?.id_session !== undefined
      ? Number(options.id_session)
      : Number(options?.idSession);
  const aSessionExplicite = Number.isInteger(idSession) && idSession > 0;
  const [sessions] = await executor.query(
    `SELECT id_session, nom, date_debut, date_fin, active
     FROM sessions
     WHERE ${aSessionExplicite ? "id_session = ?" : "active = TRUE"}
     ORDER BY id_session DESC
     LIMIT 1`,
    aSessionExplicite ? [idSession] : []
  );

  if (sessions[0]) {
    return sessions[0];
  }

  if (aSessionExplicite) {
    throw creerErreurSalle("Session introuvable.", 404);
  }

  throw creerErreurSalle("Aucune session active n'est disponible.", 409);
}

async function recupererLignesOccupationSalle(idSalle, idSession, executor = pool) {
  const [lignes] = await executor.query(
    `SELECT ac.id_affectation_cours,
            c.id_cours,
            c.code AS code_cours,
            c.nom AS nom_cours,
            c.programme AS programme_cours,
            c.etape_etude,
            c.type_salle AS type_cours,
            p.id_professeur,
            p.nom AS nom_professeur,
            p.prenom AS prenom_professeur,
            s.id_salle,
            s.code AS code_salle,
            s.type AS type_salle,
            s.capacite AS capacite_salle,
            ph.id_plage_horaires,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin,
            gr.id_groupes_etudiants,
            gr.nom_groupe,
            gr.programme AS programme_groupe,
            gr.etape AS etape_groupe,
            gr.effectif AS effectif_groupe,
            gr.est_groupe_special
     FROM affectation_cours ac
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN professeurs p
       ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN (${GROUPE_OCCUPATION_SQL}) gr
       ON gr.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_salle = ?
       AND EXISTS (
         SELECT 1
         FROM affectation_groupes ag_session
         JOIN groupes_etudiants ge_session
           ON ge_session.id_groupes_etudiants = ag_session.id_groupes_etudiants
         WHERE ag_session.id_affectation_cours = ac.id_affectation_cours
           AND ge_session.id_session = ?
       )
     ORDER BY ph.date ASC, ph.heure_debut ASC, gr.nom_groupe ASC`,
    [Number(idSalle), Number(idSession)]
  );

  return lignes;
}

/**
 * Retourne la liste de toutes les salles.
 *
 * @returns {Promise<Array<Object>>} La liste triee des salles.
 */
export async function getAllSalles(executor = pool) {
  const [salles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     ORDER BY code;`
  );

  return salles;
}

/**
 * Retourne les types de salles distincts existants dans la base.
 *
 * Les types sont trimmes, dedoublonnes, filtrés (non vides)
 * et tries alphabetiquement avant renvoi.
 *
 * @returns {Promise<string[]>} Liste des types distincts.
 */
export async function getTypesSalles() {
  const [lignes] = await pool.query(
    `SELECT DISTINCT TRIM(type) AS type
     FROM salles
     WHERE type IS NOT NULL
       AND TRIM(type) <> ''
     ORDER BY type ASC;`
  );

  return lignes.map((ligne) => ligne.type);
}

/**
 * Retourne une salle par son identifiant.
 *
 * @param {number} idSalle Identifiant de la salle.
 * @returns {Promise<Object|undefined>} Salle trouvee ou undefined.
 */
export async function getSalleById(idSalle, executor = pool) {
  const [salles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     WHERE id_salle = ?;`,
    [idSalle]
  );

  return salles[0];
}

/**
 * Retourne une salle par son code.
 *
 * @param {string} codeSalle Code unique de la salle.
 * @returns {Promise<Object|undefined>} Salle trouvee ou undefined.
 */
export async function getSalleByCode(codeSalle, executor = pool) {
  const [salles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     WHERE code = ?;`,
    [codeSalle]
  );

  return salles[0];
}

/**
 * Cree une nouvelle salle.
 *
 * @param {string} code Code unique de la salle.
 * @param {string} type Type metier de la salle.
 * @param {number} capacite Capacite maximale de la salle.
 * @returns {Promise<Object>} Resultat SQL.
 */
export async function addSalle(code, type, capacite, executor = pool) {
  const [result] = await executor.query(
    `INSERT INTO salles (code, type, capacite)
     VALUES (?, ?, ?);`,
    [code, type, capacite]
  );

  return result;
}

/**
 * Modifie une salle existante.
 *
 * @param {number} idSalle Identifiant de la salle a modifier.
 * @param {string} type Nouveau type de salle.
 * @param {number} capacite Nouvelle capacite.
 * @returns {Promise<Object>} Resultat SQL.
 */
export async function modifySalle(idSalle, type, capacite, executor = pool) {
  const [result] = await executor.query(
    `UPDATE salles
     SET type = ?, capacite = ?
     WHERE id_salle = ?;`,
    [type, capacite, idSalle]
  );

  return result;
}

/**
 * Supprime une salle par son identifiant.
 *
 * @param {number} idSalle Identifiant de la salle.
 * @returns {Promise<Object>} Resultat SQL.
 */
export async function deleteSalle(idSalle) {
  const [result] = await pool.query(
    `DELETE FROM salles
     WHERE id_salle = ?;`,
    [idSalle]
  );

  return result;
}

/**
 * Verifie si une salle est deja utilisee dans une affectation.
 *
 * @param {number} idSalle Identifiant de la salle.
 * @returns {Promise<boolean>} true si la salle est deja affectee.
 */
export async function salleEstDejaAffectee(idSalle) {
  const [lignes] = await pool.query(
    `SELECT 1
     FROM affectation_cours
     WHERE id_salle = ?
     LIMIT 1;`,
    [idSalle]
  );

  return lignes.length > 0;
}

/**
 * Recompose l'occupation complete d'une salle pour une session academique.
 *
 * Cette vue consolide :
 * - toutes les occupations reelles de la salle sur la session cible ;
 * - une vue hebdomadaire avec creneaux "occupee/libre" ;
 * - les indicateurs d'occupation V2 ;
 * - le resume dynamique V3 calcule a partir de l'heure courante.
 *
 * Le frontend reutilise ensuite la meme liste d'occupations que les autres
 * ecrans d'horaires, puis recalcule localement la semaine affichee sans lancer
 * une nouvelle API a chaque navigation hebdomadaire.
 *
 * @param {number} idSalle Identifiant de la salle cible.
 * @param {Object} [options={}] Options de lecture.
 * @param {number} [options.id_session] Session cible. A defaut: session active.
 * @param {string} [options.date_reference] Date ISO de la semaine initiale.
 * @param {Object} [options.salle] Salle deja chargee par la route, pour eviter
 * une lecture SQL redondante.
 * @param {Object} [executor=pool] Executeur SQL injectable pour les tests.
 * @returns {Promise<Object>} Vue complete d'occupation de salle.
 */
export async function recupererOccupationSalle(idSalle, options = {}, executor = pool) {
  const salle = options?.salle || await getSalleById(Number(idSalle));

  if (!salle) {
    throw creerErreurSalle("Salle introuvable.", 404);
  }

  const session = await recupererSessionOccupation(options, executor);
  const lignesOccupation = await recupererLignesOccupationSalle(
    salle.id_salle,
    session.id_session,
    executor
  );
  const occupations = agregerOccupationSalle(lignesOccupation);
  const dateReference = determinerDateReference(
    session,
    occupations,
    options?.date_reference
  );
  const vueHebdomadaire = construireVueHebdomadaire(occupations, dateReference);
  const bornesNavigation = determinerBornesNavigation(
    session,
    occupations,
    dateReference
  );

  return {
    salle,
    session,
    occupations,
    vue_hebdomadaire: {
      ...vueHebdomadaire,
      ...bornesNavigation,
    },
    resume: calculerResumeOccupation(vueHebdomadaire, salle),
    temps_reel: calculerTempsReelOccupation(occupations),
  };
}
