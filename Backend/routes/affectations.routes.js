import { creerAffectation } from "../src/model/affectations.model.js";
import { validerAffectation } from "../src/validations/affectations.validation.js";

async function postAffectation(request, response) {
  try {
    validerAffectation(request.body);

    const resultat = await creerAffectation(request.body);

    response.status(201).json({
      message: "Affectation creee",
      ...resultat,
    });
  } catch (error) {
    response.status(400).json({
      message: error.message,
    });
  }
}

export default function affectationsRoutes(app) {
  app.post("/api/affectations", postAffectation);
}