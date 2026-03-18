/**
 * ROUTES - Module Horaires
 *
 * Ce module definit toutes les routes HTTP liees aux horaires.
 */

import { userAuth } from "../middlewares/auth.js";
import {
    getAllAffectations,
    getAffectationById,
    addPlageHoraire,
    addAffectation,
    deleteAffectation,
    deleteAllAffectations,
    verifierConflitSalle,
    verifierConflitProfesseur,
} from "../src/model/horaire.js";

/**
 * Initialiser les routes des horaires.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function horaireRoutes(app) {
    /**
     * GET /api/horaires
     * Recuperer toutes les affectations de cours.
     */
    app.get("/api/horaires", userAuth, async (request, response) => {
        try {
            const affectations = await getAllAffectations();
            response.status(200).json(affectations);
        } catch (error) {
            console.error("Erreur consultation horaires :", error);
            response.status(500).end();
        }
    });

    /**
     * GET /api/horaires/:id
     * Recuperer une affectation par son identifiant.
     */
    app.get("/api/horaires/:id", userAuth, async (request, response) => {
        try {
            const affectation = await getAffectationById(request.params.id);

            if (affectation) {
                response.status(200).json(affectation);
            } else {
                response.status(404).end();
            }
        } catch (error) {
            console.error("Erreur consultation horaire :", error);
            response.status(500).end();
        }
    });

    /**
     * POST /api/horaires
     * Creer une affectation de cours (ajouter un creneau a l'horaire).
     */
    app.post("/api/horaires", userAuth, async (request, response) => {
        try {
            const { id_cours, id_professeur, id_salle, date, heure_debut, heure_fin } = request.body;

            // Valider les champs requis
            if (!id_cours || !id_professeur || !id_salle || !date || !heure_debut || !heure_fin) {
                return response.status(400).json({ message: "Champs manquants" });
            }

            // Creer la plage horaire
            const plageResult = await addPlageHoraire(date, heure_debut, heure_fin);
            const idPlage = plageResult.insertId;

            // Verifier conflit de salle
            const conflitSalle = await verifierConflitSalle(id_salle, idPlage);
            if (conflitSalle > 0) {
                return response.status(409).json({ message: "Salle deja occupee sur ce creneau" });
            }

            // Verifier conflit de professeur
            const conflitProf = await verifierConflitProfesseur(id_professeur, idPlage);
            if (conflitProf > 0) {
                return response.status(409).json({ message: "Professeur deja assigne sur ce creneau" });
            }

            // Creer l'affectation
            const result = await addAffectation(id_cours, id_professeur, id_salle, idPlage);

            response.status(201).json({ id_affectation_cours: result.insertId });
        } catch (error) {
            console.error("Erreur creation horaire :", error);
            response.status(500).end();
        }
    });

    /**
     * POST /api/horaires/generer
     * Generer automatiquement l'horaire pour tous les cours.
     */
    app.post("/api/horaires/generer", userAuth, async (request, response) => {
        try {
            const pool = (await import("../db.js")).default;

            // Recuperer cours, professeurs et salles
            const [cours] = await pool.query(
                `SELECT id_cours, code, nom, duree, type_salle FROM cours WHERE archive = 0;`
            );
            const [professeurs] = await pool.query(
                `SELECT id_professeur, nom, prenom, specialite FROM professeurs;`
            );
            const [salles] = await pool.query(
                `SELECT id_salle, code, type, capacite FROM salles;`
            );

            if (cours.length === 0 || professeurs.length === 0 || salles.length === 0) {
                return response.status(400).json({
                    message: "Il faut au moins 1 cours, 1 professeur et 1 salle"
                });
            }

            // Reset les horaires existants
            await deleteAllAffectations();

            const jours = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"];
            const heures = ["08:00", "10:00", "13:00", "15:00"];
            const affectationsCreees = [];

            for (let i = 0; i < cours.length; i++) {
                const coursActuel = cours[i];
                const jourIndex = i % jours.length;
                const heureIndex = Math.floor(i / jours.length) % heures.length;

                // Trouver une salle compatible
                const salleCompatible = salles.find(
                    (s) => s.type === coursActuel.type_salle
                ) || salles[i % salles.length];

                // Assigner un professeur
                const profAssigne = professeurs[i % professeurs.length];

                // Calculer heure de fin
                const [h, m] = heures[heureIndex].split(":").map(Number);
                const heureFin = `${(h + coursActuel.duree).toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

                // Creer la plage horaire
                const plageResult = await addPlageHoraire(
                    jours[jourIndex],
                    heures[heureIndex],
                    heureFin
                );

                // Creer l'affectation
                const affResult = await addAffectation(
                    coursActuel.id_cours,
                    profAssigne.id_professeur,
                    salleCompatible.id_salle,
                    plageResult.insertId
                );

                affectationsCreees.push({
                    id_affectation_cours: affResult.insertId,
                    cours: `${coursActuel.code} - ${coursActuel.nom}`,
                    professeur: `${profAssigne.prenom} ${profAssigne.nom}`,
                    salle: salleCompatible.code,
                    date: jours[jourIndex],
                    heure_debut: heures[heureIndex],
                    heure_fin: heureFin,
                });
            }

            response.status(201).json({
                message: `${affectationsCreees.length} affectations generees`,
                affectations: affectationsCreees,
            });
        } catch (error) {
            console.error("Erreur generation horaire :", error);
            response.status(500).end();
        }
    });

    /**
     * DELETE /api/horaires/:id
     * Supprimer une affectation de cours.
     */
    app.delete("/api/horaires/:id", userAuth, async (request, response) => {
        try {
            const affectation = await getAffectationById(request.params.id);

            if (!affectation) {
                return response.status(404).end();
            }

            await deleteAffectation(request.params.id);
            response.status(200).end();
        } catch (error) {
            console.error("Erreur suppression horaire :", error);
            response.status(500).end();
        }
    });

    /**
     * DELETE /api/horaires
     * Supprimer tous les horaires (reset).
     */
    app.delete("/api/horaires", userAuth, async (request, response) => {
        try {
            await deleteAllAffectations();
            response.status(200).json({ message: "Horaires reinitialises" });
        } catch (error) {
            console.error("Erreur reset horaires :", error);
            response.status(500).end();
        }
    });
}