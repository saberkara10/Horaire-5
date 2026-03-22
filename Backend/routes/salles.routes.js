/**
 * ROUTES - Module Salles
 *
 * Ce module definit toutes les routes HTTP liees aux salles.
 * Les validations sont appliquees avant l'appel au modele.
 */

// pas d'authentification sur ces routes pour usage local simple
import { codeSalleIsValide, typeSalleIsValide, capaciteSalleIsValide } from "../src/validations/salles.validation.js";
import { getAllSalles, getSalleById, addSalle, modifySalle, deleteSalle } from "../src/model/salle.js";

/**
 * Initialiser les routes des salles.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function sallesRoutes(app) {
    /**
     * GET /api/salles
     * Recuperer toutes les salles.
     */
    app.get("/api/salles", async (request, response) => {
        const salles = await getAllSalles();
        response.status(200).json(salles);
    });

    /**
     * GET /api/salles/:id
     * Recuperer une salle par son identifiant.
     */
    app.get("/api/salles/:id", async (request, response) => {
        const salle = await getSalleById(request.params.id);

        if (salle) {
            response.status(200).json(salle);
        }
        else {
            response.status(404).end();
        }
    });

    /**
     * POST /api/salles
     * Ajouter une nouvelle salle.
     */
    app.post(
        "/api/salles",
        codeSalleIsValide,
        typeSalleIsValide,
        capaciteSalleIsValide,
        async (request, response) => {
            try {
                await addSalle(
                    request.body.code,
                    request.body.type,
                    request.body.capacite
                );
                response.status(201).end();
            }
            catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    response.status(409).end();
                }
            }
        }
    );

    /**
     * PUT /api/salles/:id
     * Modifier une salle existante.
     */
    app.put(
        "/api/salles/:id",
        typeSalleIsValide,
        capaciteSalleIsValide,
        async (request, response) => {
            const salle = await getSalleById(request.params.id);

            if (!salle) {
                return response.status(404).end();
            }

            await modifySalle(
                request.params.id,
                request.body.type,
                request.body.capacite
            );

            response.status(200).end();
        }
    );

    /**
     * DELETE /api/salles/:id
     * Supprimer une salle.
     */
    app.delete("/api/salles/:id", async (request, response) => {
        const salle = await getSalleById(request.params.id);

        if (!salle) {
            return response.status(404).end();
        }

        await deleteSalle(request.params.id);
        response.status(200).end();
    });
}