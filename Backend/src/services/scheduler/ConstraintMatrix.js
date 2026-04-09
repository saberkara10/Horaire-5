/**
 * ConstraintMatrix - Phase 3 du Scheduler Engine
 *
 * Construit des matrices de conflits en memoire pour eviter
 * des verifications repetitives sur la base.
 */

import {
  MAX_COURSES_PER_PROFESSOR,
  MAX_GROUPS_PER_PROFESSOR,
  MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
} from "./AcademicCatalog.js";

export class ConstraintMatrix {
  constructor() {
    this.salles = new Map();
    this.professeurs = new Map();
    this.groupes = new Map();
    this.etudiants = new Map();
    this.coursParProf = new Map();
    this.groupesParProf = new Map();
    this.seancesHebdomadairesParGroupe = new Map();
    this.seancesHebdomadairesParProfesseur = new Map();
  }

  static cle(date, heureDebut) {
    return `${date}|${heureDebut}`;
  }

  static clesSuperposees(date, heureDebut, heureFin) {
    const cles = [];
    const debutMin = ConstraintMatrix._heureVersMinutes(heureDebut);
    const finMin = ConstraintMatrix._heureVersMinutes(heureFin);

    for (let minute = debutMin; minute < finMin; minute += 30) {
      const heures = Math.floor(minute / 60).toString().padStart(2, "0");
      const minutes = (minute % 60).toString().padStart(2, "0");
      cles.push(`${date}|${heures}:${minutes}:00`);
    }

    return cles;
  }

  static _heureVersMinutes(heure) {
    const [heures, minutes = "0"] = String(heure).split(":");
    return parseInt(heures, 10) * 60 + parseInt(minutes, 10);
  }

  static cleSemaine(date) {
    const dateTexte = String(date || "").slice(0, 10);
    const dateObj = new Date(`${dateTexte}T00:00:00`);
    const jour = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
    dateObj.setDate(dateObj.getDate() - (jour - 1));
    const annee = dateObj.getFullYear();
    const mois = String(dateObj.getMonth() + 1).padStart(2, "0");
    const jourMois = String(dateObj.getDate()).padStart(2, "0");
    return `${annee}-${mois}-${jourMois}`;
  }

  salleLibre(idSalle, date, heureDebut, heureFin) {
    const occupe = this.salles.get(String(idSalle));
    if (!occupe) {
      return true;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    return !cles.some((cle) => occupe.has(cle));
  }

  profLibre(idProf, date, heureDebut, heureFin) {
    const occupe = this.professeurs.get(String(idProf));
    if (!occupe) {
      return true;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    return !cles.some((cle) => occupe.has(cle));
  }

  groupeLibre(idGroupe, date, heureDebut, heureFin) {
    const occupe = this.groupes.get(String(idGroupe));
    if (!occupe) {
      return true;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    return !cles.some((cle) => occupe.has(cle));
  }

  /**
   * Le plafond de cours differents par professeur est applique sur
   * le nombre de cours distincts planifies pour une meme session.
   */
  profPeutEnseignerCours(idProf, idCours) {
    const coursProf = this.coursParProf.get(String(idProf)) || new Map();
    const maxCoursDifferents = MAX_COURSES_PER_PROFESSOR;

    if (coursProf.has(idCours)) {
      return true;
    }

    return coursProf.size < maxCoursDifferents;
  }

  profPeutPrendreGroupe(
    idProf,
    idGroupe,
    maxGroupes = MAX_GROUPS_PER_PROFESSOR
  ) {
    if (idGroupe == null) {
      return true;
    }

    const groupesProf = this.groupesParProf.get(String(idProf)) || new Map();
    const groupeKey = String(idGroupe);

    if (groupesProf.has(groupeKey)) {
      return true;
    }

    return groupesProf.size < maxGroupes;
  }

  etudiantsLibres(studentIds, date, heureDebut, heureFin) {
    const ids = Array.isArray(studentIds)
      ? studentIds.filter((id) => id != null && id !== "")
      : [];

    if (ids.length === 0) {
      return true;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);

    return ids.every((idEtudiant) => {
      const occupe = this.etudiants.get(String(idEtudiant));
      return !occupe || !cles.some((cle) => occupe.has(cle));
    });
  }

  groupePeutAjouterSeanceSemaine(idGroupe, date, maximumHebdomadaire) {
    if (idGroupe == null) {
      return true;
    }

    return (
      this.groupeSeancesSemaine(idGroupe, date) < Number(maximumHebdomadaire || 0)
    );
  }

  groupeSeancesSemaine(idGroupe, date) {
    if (idGroupe == null) {
      return 0;
    }

    const cleGroupe = String(idGroupe);
    const parSemaine = this.seancesHebdomadairesParGroupe.get(cleGroupe);

    if (!parSemaine) {
      return 0;
    }

    return parSemaine.get(ConstraintMatrix.cleSemaine(date)) || 0;
  }

  profPeutAjouterSeanceSemaine(
    idProf,
    date,
    maximumHebdomadaire = MAX_WEEKLY_SESSIONS_PER_PROFESSOR
  ) {
    if (idProf == null) {
      return true;
    }

    return (
      this.profSeancesSemaine(idProf, date) < Number(maximumHebdomadaire || 0)
    );
  }

  profSeancesSemaine(idProf, date) {
    if (idProf == null) {
      return 0;
    }

    const cleProf = String(idProf);
    const parSemaine = this.seancesHebdomadairesParProfesseur.get(cleProf);

    if (!parSemaine) {
      return 0;
    }

    return parSemaine.get(ConstraintMatrix.cleSemaine(date)) || 0;
  }

  reserver(
    idSalle,
    idProf,
    idGroupe,
    idCours,
    date,
    heureDebut,
    heureFin,
    options = {}
  ) {
    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    const studentIds = Array.isArray(options.studentIds) ? options.studentIds : [];

    if (idSalle !== null) {
      const salleKey = String(idSalle);
      if (!this.salles.has(salleKey)) {
        this.salles.set(salleKey, new Set());
      }
      cles.forEach((cle) => this.salles.get(salleKey).add(cle));
    }

    {
      const profKey = String(idProf);
      if (!this.professeurs.has(profKey)) {
        this.professeurs.set(profKey, new Set());
      }
      cles.forEach((cle) => this.professeurs.get(profKey).add(cle));

      if (!this.coursParProf.has(profKey)) {
        this.coursParProf.set(profKey, new Map());
      }
      const coursMap = this.coursParProf.get(profKey);
      coursMap.set(idCours, (coursMap.get(idCours) || 0) + 1);

      if (idGroupe !== null) {
        if (!this.groupesParProf.has(profKey)) {
          this.groupesParProf.set(profKey, new Map());
        }
        const groupesMap = this.groupesParProf.get(profKey);
        const groupeKey = String(idGroupe);
        groupesMap.set(groupeKey, (groupesMap.get(groupeKey) || 0) + 1);
      }

      if (!this.seancesHebdomadairesParProfesseur.has(profKey)) {
        this.seancesHebdomadairesParProfesseur.set(profKey, new Map());
      }
      const semaineKey = ConstraintMatrix.cleSemaine(date);
      const seancesParSemaine = this.seancesHebdomadairesParProfesseur.get(profKey);
      seancesParSemaine.set(
        semaineKey,
        (seancesParSemaine.get(semaineKey) || 0) + 1
      );
    }

    if (idGroupe !== null) {
      const groupeKey = String(idGroupe);
      if (!this.groupes.has(groupeKey)) {
        this.groupes.set(groupeKey, new Set());
      }
      cles.forEach((cle) => this.groupes.get(groupeKey).add(cle));

      if (!this.seancesHebdomadairesParGroupe.has(groupeKey)) {
        this.seancesHebdomadairesParGroupe.set(groupeKey, new Map());
      }
      const semaineKey = ConstraintMatrix.cleSemaine(date);
      const parSemaine = this.seancesHebdomadairesParGroupe.get(groupeKey);
      parSemaine.set(semaineKey, (parSemaine.get(semaineKey) || 0) + 1);
    }

    for (const idEtudiant of studentIds) {
      const etudiantKey = String(idEtudiant);
      if (!this.etudiants.has(etudiantKey)) {
        this.etudiants.set(etudiantKey, new Set());
      }
      cles.forEach((cle) => this.etudiants.get(etudiantKey).add(cle));
    }
  }

  reserverEtudiants(studentIds, date, heureDebut, heureFin) {
    const ids = Array.isArray(studentIds)
      ? studentIds.filter((id) => id != null && id !== "")
      : [];

    if (ids.length === 0) {
      return;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    for (const idEtudiant of ids) {
      const etudiantKey = String(idEtudiant);
      if (!this.etudiants.has(etudiantKey)) {
        this.etudiants.set(etudiantKey, new Set());
      }
      cles.forEach((cle) => this.etudiants.get(etudiantKey).add(cle));
    }
  }

  liberer(
    idSalle,
    idProf,
    idGroupe,
    date,
    heureDebut,
    heureFin,
    idCours = null,
    options = {}
  ) {
    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    const studentIds = Array.isArray(options.studentIds) ? options.studentIds : [];

    if (idSalle !== null) {
      const salleKey = String(idSalle);
      if (this.salles.has(salleKey)) {
        cles.forEach((cle) => this.salles.get(salleKey).delete(cle));
      }
    }

    {
      const profKey = String(idProf);
      if (this.professeurs.has(profKey)) {
        cles.forEach((cle) => this.professeurs.get(profKey).delete(cle));
      }

      if (idCours !== null) {
        const coursMap = this.coursParProf.get(profKey);
        if (coursMap?.has(idCours)) {
          const restant = coursMap.get(idCours) - 1;
          if (restant <= 0) {
            coursMap.delete(idCours);
          } else {
            coursMap.set(idCours, restant);
          }
        }
      }

      if (idGroupe !== null) {
        const groupesMap = this.groupesParProf.get(profKey);
        const groupeKey = String(idGroupe);

        if (groupesMap?.has(groupeKey)) {
          const restant = groupesMap.get(groupeKey) - 1;
          if (restant <= 0) {
            groupesMap.delete(groupeKey);
          } else {
            groupesMap.set(groupeKey, restant);
          }
        }
      }

      const seancesParSemaine = this.seancesHebdomadairesParProfesseur.get(profKey);
      if (seancesParSemaine) {
        const semaineKey = ConstraintMatrix.cleSemaine(date);
        const restant = (seancesParSemaine.get(semaineKey) || 0) - 1;
        if (restant <= 0) {
          seancesParSemaine.delete(semaineKey);
        } else {
          seancesParSemaine.set(semaineKey, restant);
        }
      }
    }

    if (idGroupe !== null) {
      const groupeKey = String(idGroupe);
      if (this.groupes.has(groupeKey)) {
        cles.forEach((cle) => this.groupes.get(groupeKey).delete(cle));
      }

      const parSemaine = this.seancesHebdomadairesParGroupe.get(groupeKey);
      if (parSemaine) {
        const semaineKey = ConstraintMatrix.cleSemaine(date);
        const restant = (parSemaine.get(semaineKey) || 0) - 1;
        if (restant <= 0) {
          parSemaine.delete(semaineKey);
        } else {
          parSemaine.set(semaineKey, restant);
        }
      }
    }

    for (const idEtudiant of studentIds) {
      const etudiantKey = String(idEtudiant);
      if (this.etudiants.has(etudiantKey)) {
        cles.forEach((cle) => this.etudiants.get(etudiantKey).delete(cle));
      }
    }
  }

  libererEtudiants(studentIds, date, heureDebut, heureFin) {
    const ids = Array.isArray(studentIds)
      ? studentIds.filter((id) => id != null && id !== "")
      : [];

    if (ids.length === 0) {
      return;
    }

    const cles = ConstraintMatrix.clesSuperposees(date, heureDebut, heureFin);
    for (const idEtudiant of ids) {
      const etudiantKey = String(idEtudiant);
      if (!this.etudiants.has(etudiantKey)) {
        continue;
      }
      cles.forEach((cle) => this.etudiants.get(etudiantKey).delete(cle));
    }
  }

  chargerDepuisAffectations(affectations) {
    for (const affectation of affectations) {
      this.reserver(
        affectation.id_salle,
        affectation.id_professeur,
        affectation.id_groupe,
        affectation.id_cours,
        affectation.date,
        affectation.heure_debut,
        affectation.heure_fin
      );
    }
  }

  creneauxProfDansjournee(idProf, date) {
    const occupe = this.professeurs.get(String(idProf));
    if (!occupe) {
      return [];
    }

    return [...occupe]
      .filter((cle) => cle.startsWith(date))
      .map((cle) => cle.split("|")[1]);
  }

  creneauxEtudiantDansjournee(idEtudiant, date) {
    const occupe = this.etudiants.get(String(idEtudiant));
    if (!occupe) {
      return [];
    }

    return [...occupe]
      .filter((cle) => cle.startsWith(date))
      .map((cle) => cle.split("|")[1]);
  }
}
