/**
 * SimulatedAnnealing — Phase 6 du Scheduler Engine
 *
 * Optimiseur par recuit simulé pour améliorer la qualité de l'horaire
 * après la solution initiale greedy.
 *
 * Minimise les pénalités (soft constraints) tout en préservant
 * les contraintes dures via la ConstraintMatrix.
 *
 * Paramètres adaptatifs :
 *   - T_initial = 500
 *   - T_final   = 0.5
 *   - α (refroidissement) = 0.997
 *   - Opérateurs : swap_créneaux, move_cours
 */

import { ConstraintMatrix } from "./ConstraintMatrix.js";
import { AvailabilityChecker } from "./AvailabilityChecker.js";

export class SimulatedAnnealing {
  // Paramètres par défaut
  static T_INITIAL = 500;
  static T_FINAL   = 0.5;
  static ALPHA     = 0.997;
  static MAX_ITER_PAR_TEMP = 50;

  /**
   * Optimise la solution donnée.
   *
   * @param {Array} solution - Liste de placements [{id_cours, id_prof, id_salle, date, heure_debut, heure_fin, nom_groupe, ...}]
   * @param {ConstraintMatrix} matrix - Matrice initiale chargée avec la solution
   * @param {Object} context - { dispParProf, absencesParProf, indispoParSalle, salles, jours }
   * @param {Object} params - Paramètres SA optionnels
   * @param {Function|null} onProgress - Callback de progression
   * @returns {{ solution: Array, scoreInitial: number, scoreFinal: number, iterations: number }}
   */
  static optimiser(solution, matrix, context, params = {}, onProgress = null) {
    const T_initial = params.T_initial || SimulatedAnnealing.T_INITIAL;
    const T_final   = params.T_final   || SimulatedAnnealing.T_FINAL;
    const alpha     = params.alpha     || SimulatedAnnealing.ALPHA;
    const maxIterParTemp = params.maxIterParTemp || SimulatedAnnealing.MAX_ITER_PAR_TEMP;

    let solutionCourante = solution.map((p) => ({ ...p }));
    let scoreCourant = SimulatedAnnealing._evaluerSolution(solutionCourante, context);

    let meilleureSolution = solutionCourante.map((p) => ({ ...p }));
    let meilleurScore = scoreCourant;

    const scoreInitial = scoreCourant;
    let T = T_initial;
    let totalIterations = 0;

    while (T > T_final) {
      for (let i = 0; i < maxIterParTemp; i++) {
        // Choisir un opérateur aléatoire
        const operateur = Math.random() < 0.6 ? "move" : "swap";
        let nouvelleSolution;
        let delta;

        try {
          if (operateur === "move" && solutionCourante.length > 0) {
            nouvelleSolution = SimulatedAnnealing._operateurMove(
              solutionCourante, matrix, context
            );
          } else if (solutionCourante.length > 1) {
            nouvelleSolution = SimulatedAnnealing._operateurSwap(
              solutionCourante, matrix, context
            );
          } else {
            continue;
          }
        } catch {
          continue; // opérateur infaisable, passer
        }

        if (!nouvelleSolution) continue;

        const nouveauScore = SimulatedAnnealing._evaluerSolution(nouvelleSolution, context);
        delta = nouveauScore - scoreCourant;

        // Accepter si meilleur OU avec probabilité de Boltzmann
        if (delta > 0 || Math.random() < Math.exp(delta / T)) {
          solutionCourante = nouvelleSolution;
          scoreCourant = nouveauScore;

          if (scoreCourant > meilleurScore) {
            meilleureSolution = solutionCourante.map((p) => ({ ...p }));
            meilleurScore = scoreCourant;
          }
        }

        totalIterations++;
      }

      T *= alpha;

      if (onProgress && totalIterations % 500 === 0) {
        onProgress({
          temperature: T,
          scoreActuel: scoreCourant,
          meilleurScore,
          iterations: totalIterations,
        });
      }
    }

    return {
      solution: meilleureSolution,
      scoreInitial,
      scoreFinal: meilleurScore,
      iterations: totalIterations,
    };
  }

  /**
   * Opérateur MOVE : déplace un cours vers un nouveau créneau.
   */
  static _operateurMove(solution, matrix, context) {
    const { jours, dispParProf, absencesParProf, indispoParSalle } = context;

    const idxPick = Math.floor(Math.random() * solution.length);
    const cible = solution[idxPick];

    if (cible.est_en_ligne && cible.est_groupe_special) return null; // ne pas toucher

    // Libérer le créneau actuel
    matrix.liberer(
      cible.id_salle, cible.id_professeur, cible.nom_groupe,
      cible.date, cible.heure_debut, cible.heure_fin, cible.id_cours
    );

    // Essayer un nouveau créneau aléatoire (10 tentatives)
    const creneaux = SimulatedAnnealing._CRENEAUX_POSSIBLES();
    for (let t = 0; t < 10; t++) {
      const jourIdx = Math.floor(Math.random() * jours.length);
      const creneauIdx = Math.floor(Math.random() * creneaux.length);
      const nouveauJour = jours[jourIdx];
      const { debut, fin } = creneaux[creneauIdx];

      // Vérifier contraintes dures
      const profOk = matrix.profLibre(cible.id_professeur, nouveauJour, debut, fin) &&
        AvailabilityChecker.profDisponible(cible.id_professeur, nouveauJour, debut, fin, dispParProf, absencesParProf);

      const salleOk = cible.est_en_ligne || (
        cible.id_salle !== null &&
        matrix.salleLibre(cible.id_salle, nouveauJour, debut, fin) &&
        AvailabilityChecker.salleDisponible(cible.id_salle, nouveauJour, indispoParSalle)
      );

      const groupeOk = matrix.groupeLibre(cible.nom_groupe, nouveauJour, debut, fin);

      if (profOk && salleOk && groupeOk) {
        matrix.reserver(
          cible.id_salle, cible.id_professeur, cible.nom_groupe,
          cible.id_cours, nouveauJour, debut, fin
        );
        const nouvelleSolution = solution.map((p, idx) =>
          idx === idxPick
            ? { ...p, date: nouveauJour, heure_debut: debut, heure_fin: fin }
            : p
        );
        return nouvelleSolution;
      }
    }

    // Remettre le créneau original si aucun déplacement possible
    matrix.reserver(
      cible.id_salle, cible.id_professeur, cible.nom_groupe,
      cible.id_cours, cible.date, cible.heure_debut, cible.heure_fin
    );
    return null;
  }

  /**
   * Opérateur SWAP : échange les créneaux de deux cours.
   */
  static _operateurSwap(solution, matrix, context) {
    const { dispParProf, absencesParProf, indispoParSalle } = context;

    const idx1 = Math.floor(Math.random() * solution.length);
    let idx2 = Math.floor(Math.random() * solution.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * solution.length);

    const c1 = solution[idx1];
    const c2 = solution[idx2];

    if (c1.est_groupe_special || c2.est_groupe_special) return null;

    // Vérifier faisabilité du swap
    // c1 prendrait le créneau de c2 et vice-versa
    matrix.liberer(c1.id_salle, c1.id_professeur, c1.nom_groupe, c1.date, c1.heure_debut, c1.heure_fin, c1.id_cours);
    matrix.liberer(c2.id_salle, c2.id_professeur, c2.nom_groupe, c2.date, c2.heure_debut, c2.heure_fin, c2.id_cours);

    const c1PeutPrendreC2 =
      matrix.profLibre(c1.id_professeur, c2.date, c2.heure_debut, c2.heure_fin) &&
      (c1.est_en_ligne || matrix.salleLibre(c1.id_salle, c2.date, c2.heure_debut, c2.heure_fin)) &&
      matrix.groupeLibre(c1.nom_groupe, c2.date, c2.heure_debut, c2.heure_fin) &&
      AvailabilityChecker.profDisponible(c1.id_professeur, c2.date, c2.heure_debut, c2.heure_fin, dispParProf, absencesParProf);

    const c2PeutPrendreC1 =
      matrix.profLibre(c2.id_professeur, c1.date, c1.heure_debut, c1.heure_fin) &&
      (c2.est_en_ligne || matrix.salleLibre(c2.id_salle, c1.date, c1.heure_debut, c1.heure_fin)) &&
      matrix.groupeLibre(c2.nom_groupe, c1.date, c1.heure_debut, c1.heure_fin) &&
      AvailabilityChecker.profDisponible(c2.id_professeur, c1.date, c1.heure_debut, c1.heure_fin, dispParProf, absencesParProf);

    if (c1PeutPrendreC2 && c2PeutPrendreC1) {
      matrix.reserver(c1.id_salle, c1.id_professeur, c1.nom_groupe, c1.id_cours, c2.date, c2.heure_debut, c2.heure_fin);
      matrix.reserver(c2.id_salle, c2.id_professeur, c2.nom_groupe, c2.id_cours, c1.date, c1.heure_debut, c1.heure_fin);

      const nouvelleSolution = solution.map((p, idx) => {
        if (idx === idx1) return { ...p, date: c2.date, heure_debut: c2.heure_debut, heure_fin: c2.heure_fin };
        if (idx === idx2) return { ...p, date: c1.date, heure_debut: c1.heure_debut, heure_fin: c1.heure_fin };
        return p;
      });
      return nouvelleSolution;
    }

    // Remettre
    matrix.reserver(c1.id_salle, c1.id_professeur, c1.nom_groupe, c1.id_cours, c1.date, c1.heure_debut, c1.heure_fin);
    matrix.reserver(c2.id_salle, c2.id_professeur, c2.nom_groupe, c2.id_cours, c2.date, c2.heure_debut, c2.heure_fin);
    return null;
  }

  /**
   * Fonction d'évaluation (score à maximiser).
   * Retourne un score numérique (plus grand = meilleur).
   */
  static _evaluerSolution(solution, context) {
    let score = 0;

    // Grouper les placements par groupe (pour évaluer les trous)
    const parGroupe = new Map();
    const parProf = new Map();

    for (const p of solution) {
      // --- Groupes ---
      if (!parGroupe.has(p.nom_groupe)) parGroupe.set(p.nom_groupe, []);
      parGroupe.get(p.nom_groupe).push(p);

      // --- Profs ---
      if (!parProf.has(p.id_professeur)) parProf.set(p.id_professeur, []);
      parProf.get(p.id_professeur).push(p);
    }

    // Évaluation par groupe (préférences étudiants)
    for (const [, placements] of parGroupe) {
      const parJour = SimulatedAnnealing._grouperParJour(placements);
      for (const [, coursJour] of parJour) {
        // Max 2 cours/jour
        if (coursJour.length <= 2) score += 5;
        else score -= 10 * (coursJour.length - 2);

        // Pas de trou dans la journée
        const heures = coursJour
          .map((p) => SimulatedAnnealing._heureVersMin(p.heure_debut))
          .sort((a, b) => a - b);
        let sansTrou = true;
        for (let i = 1; i < heures.length; i++) {
          if (heures[i] - heures[i - 1] > 180) { // >3h de trou
            sansTrou = false;
            score -= 15;
          }
        }
        if (sansTrou) score += 10;

        // Éviter cours isolé (avant 8h30 ou après 18h)
        for (const p of coursJour) {
          const hDebut = SimulatedAnnealing._heureVersMin(p.heure_debut);
          const hFin = SimulatedAnnealing._heureVersMin(p.heure_fin);
          if (hDebut < 8 * 60) score -= 10;
          if (hFin > 19 * 60) score -= 10;
        }
      }
    }

    // Évaluation par prof (préférences professeurs)
    for (const [, placements] of parProf) {
      const parJour = SimulatedAnnealing._grouperParJour(placements);
      for (const [, coursJour] of parJour) {
        const heures = coursJour.map((p) => SimulatedAnnealing._heureVersMin(p.heure_debut)).sort((a, b) => a - b);
        const fins = coursJour.map((p) => SimulatedAnnealing._heureVersMin(p.heure_fin)).sort((a, b) => a - b);

        // Éviter matin + soir (écart > 6h)
        if (heures.length >= 2) {
          const ecart = fins[fins.length - 1] - heures[0];
          if (ecart > 6 * 60) score -= 20;
        }

        // Éviter >2 cours consécutifs
        if (coursJour.length > 2) score -= 10 * (coursJour.length - 2);
        else score += 5;
      }
    }

    // Bonus répartition équilibrée sur la semaine
    score += SimulatedAnnealing._bonusRepartitionSemaine(solution);

    return score;
  }

  static _grouperParJour(placements) {
    const parJour = new Map();
    for (const p of placements) {
      if (!parJour.has(p.date)) parJour.set(p.date, []);
      parJour.get(p.date).push(p);
    }
    return parJour;
  }

  static _bonusRepartitionSemaine(solution) {
    const parJour = new Map();
    for (const p of solution) {
      if (!parJour.has(p.date)) parJour.set(p.date, 0);
      parJour.set(p.date, parJour.get(p.date) + 1);
    }
    if (parJour.size < 2) return 0;
    const valeurs = [...parJour.values()];
    const moy = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    const variance = valeurs.reduce((s, v) => s + (v - moy) ** 2, 0) / valeurs.length;
    return Math.max(0, 20 - variance); // moins de variance = meilleur
  }

  static _heureVersMin(heure) {
    const parts = String(heure).split(":");
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
  }

  static _CRENEAUX_POSSIBLES() {
    return [
      { debut: "08:00:00", fin: "11:00:00" },
      { debut: "11:00:00", fin: "14:00:00" },
      { debut: "14:00:00", fin: "17:00:00" },
      { debut: "17:00:00", fin: "20:00:00" },
      { debut: "09:00:00", fin: "12:00:00" },
      { debut: "13:00:00", fin: "16:00:00" },
    ];
  }
}
