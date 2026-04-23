/**
 * AvailabilityChecker - Utilitaire partage
 *
 * Verifie les disponibilites des professeurs et des salles.
 */

import { disponibiliteCouvreDate } from "../professeurs/availability-temporal.js";

export class AvailabilityChecker {
  static profDisponible(
    idProf,
    date,
    heureDebut,
    heureFin,
    dispParProf,
    absencesParProf
  ) {
    const absences = absencesParProf.get(idProf) || [];
    const dateObj = AvailabilityChecker._dateSeulement(date);

    for (const absence of absences) {
      const debut = AvailabilityChecker._dateSeulement(absence.date_debut);
      const fin = AvailabilityChecker._dateSeulement(absence.date_fin);
      if (dateObj >= debut && dateObj <= fin) {
        return false;
      }
    }

    const disponibilites = dispParProf.get(idProf) || [];
    if (disponibilites.length === 0) {
      return true;
    }

    const jourSemaine = AvailabilityChecker._jourSemaine(date);
    const debutMin = AvailabilityChecker._heureVersMin(heureDebut);
    const finMin = AvailabilityChecker._heureVersMin(heureFin);

    return disponibilites.some(
      (disponibilite) =>
        Number(disponibilite.jour_semaine) === jourSemaine &&
        disponibiliteCouvreDate(disponibilite, date) &&
        AvailabilityChecker._heureVersMin(disponibilite.heure_debut) <= debutMin &&
        AvailabilityChecker._heureVersMin(disponibilite.heure_fin) >= finMin
    );
  }

  static salleDisponible(idSalle, date, indispoParSalle) {
    const indisponibilites = indispoParSalle.get(idSalle) || [];
    const dateObj = AvailabilityChecker._dateSeulement(date);

    for (const indisponibilite of indisponibilites) {
      const debut = AvailabilityChecker._dateSeulement(indisponibilite.date_debut);
      const fin = AvailabilityChecker._dateSeulement(indisponibilite.date_fin);
      if (dateObj >= debut && dateObj <= fin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Si des affectations explicites prof-cours existent, elles deviennent
   * la source de verite. Sinon on retombe sur la specialite texte.
   */
  static profCompatible(professeur, cours) {
    if (Number(cours?.est_en_ligne || 0) === 1) {
      return true;
    }

    const coursIds = AvailabilityChecker._lireCoursIds(professeur);
    if (coursIds.length > 0) {
      return coursIds.includes(Number(cours.id_cours));
    }

    const specialite = AvailabilityChecker._normaliser(professeur.specialite);
    if (!specialite) {
      return true;
    }

    const programme = AvailabilityChecker._normaliser(cours.programme);
    const nomCours = AvailabilityChecker._normaliser(cours.nom);

    if (specialite === programme || specialite === nomCours) {
      return true;
    }

    if (specialite.includes(programme) || programme.includes(specialite)) {
      return true;
    }

    if (specialite.includes(nomCours) || nomCours.includes(specialite)) {
      return true;
    }

    const motsSpecialite = specialite.split(/\s+/).filter((mot) => mot.length >= 4);
    const motsProgramme = programme.split(/\s+/).filter((mot) => mot.length >= 4);

    return (
      motsSpecialite.length > 0 &&
      motsProgramme.some((mot) => motsSpecialite.includes(mot))
    );
  }

  static salleCompatible(salle, cours, capaciteMinimale = 0) {
    if (cours.est_en_ligne) {
      return true;
    }

    const typeCompatible =
      AvailabilityChecker._normaliser(salle.type) ===
      AvailabilityChecker._normaliser(cours.type_salle);

    if (!typeCompatible) {
      return false;
    }

    const seuil = Math.max(0, Number(capaciteMinimale) || 0);
    if (seuil === 0) {
      return true;
    }

    return Number(salle.capacite || 0) >= seuil;
  }

  static genererJours(dateDebut, dateFin, inclureWeekend = false) {
    const jours = [];
    const courant = AvailabilityChecker._dateSeulement(dateDebut);
    const fin = AvailabilityChecker._dateSeulement(dateFin);

    if (Number.isNaN(courant.getTime()) || Number.isNaN(fin.getTime())) {
      return jours;
    }

    while (courant <= fin) {
      const jour = courant.getDay();
      if (inclureWeekend || (jour !== 0 && jour !== 6)) {
        jours.push(courant.toISOString().slice(0, 10));
      }
      courant.setDate(courant.getDate() + 1);
    }

    return jours;
  }

  static _jourSemaine(date) {
    const dateObj = AvailabilityChecker._dateSeulement(date);
    const jour = dateObj.getDay();
    return jour === 0 ? 7 : jour;
  }

  static _heureVersMin(heure) {
    const [heures, minutes = "0"] = String(heure).split(":");
    return parseInt(heures, 10) * 60 + parseInt(minutes, 10);
  }

  static _lireCoursIds(professeur) {
    if (Array.isArray(professeur?.cours_ids)) {
      return professeur.cours_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    }

    return String(professeur?.cours_ids || "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  static _normaliser(texte) {
    return String(texte || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  static _dateSeulement(value) {
    if (value instanceof Date) {
      return new Date(`${value.toISOString().slice(0, 10)}T00:00:00`);
    }

    const texte = String(value || "").trim();
    if (!texte) {
      return new Date(Number.NaN);
    }

    const dateIso = texte.includes("T") ? texte.slice(0, 10) : texte;
    const date = new Date(`${dateIso}T00:00:00`);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    const fallback = new Date(texte);
    if (Number.isNaN(fallback.getTime())) {
      return fallback;
    }

    return new Date(`${fallback.toISOString().slice(0, 10)}T00:00:00`);
  }
}
