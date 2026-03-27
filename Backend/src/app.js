/**
 * Configuration principale de l'application Express.
 *
 * Initialise Express, securite, sessions, Passport et les routes metier.
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import dotenv from "dotenv";

import "../auth.js";
import { userAuth, userAdmin, userResponsable } from "../middlewares/auth.js";
import authRoutes from "../routes/auth.routes.js";
import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import horaireRoutes from "../routes/horaire.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";
import etudiantsRoutes from "../routes/etudiants.routes.js";
import pool from "../db.js";

dotenv.config();

const PROGRAMMES_OFFICIELS = {
  administration: "Techniques en administration des affaires",
  comptabilite: "Comptabilite et gestion",
  chaine: "Gestion de la chaine d'approvisionnement",
  marketing: "Marketing numerique",
  hotelier: "Gestion hoteliere",
  restauration: "Gestion des services de restauration",
  juridique: "Techniques juridiques",
  enfance: "Education en services a l'enfance",
  social: "Travail social",
  soins: "Soins infirmiers auxiliaires",
  laboratoire: "Techniques de laboratoire",
  informatique: "Programmation informatique",
  web: "Developpement Web",
  mobile: "Developpement mobile",
  ia: "Intelligence artificielle appliquee",
  donnees: "Analyse de donnees",
  reseautique:
    "Technologie des systemes informatiques - cybersecurite et reseautique",
  soutien: "Soutien informatique",
  design: "Design graphique",
  multimedia: "Production multimedia",
};

const PROGRAMMES_REFERENCE = [
  PROGRAMMES_OFFICIELS.administration,
  PROGRAMMES_OFFICIELS.comptabilite,
  PROGRAMMES_OFFICIELS.chaine,
  PROGRAMMES_OFFICIELS.marketing,
  PROGRAMMES_OFFICIELS.hotelier,
  PROGRAMMES_OFFICIELS.restauration,
  PROGRAMMES_OFFICIELS.juridique,
  PROGRAMMES_OFFICIELS.enfance,
  PROGRAMMES_OFFICIELS.social,
  PROGRAMMES_OFFICIELS.soins,
  PROGRAMMES_OFFICIELS.laboratoire,
  PROGRAMMES_OFFICIELS.informatique,
  PROGRAMMES_OFFICIELS.web,
  PROGRAMMES_OFFICIELS.mobile,
  PROGRAMMES_OFFICIELS.ia,
  PROGRAMMES_OFFICIELS.donnees,
  PROGRAMMES_OFFICIELS.reseautique,
  PROGRAMMES_OFFICIELS.soutien,
  PROGRAMMES_OFFICIELS.design,
  PROGRAMMES_OFFICIELS.multimedia,
];

function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliserNomProgramme(programme) {
  const valeur = normaliserTexte(programme);

  if (!valeur) {
    return "";
  }

  if (
    valeur === "commerce" ||
    valeur.includes("administration des affaires") ||
    valeur.includes("commerce international")
  ) {
    return PROGRAMMES_OFFICIELS.administration;
  }

  if (
    valeur.includes("comptabilite") ||
    valeur.includes("gestion financiere")
  ) {
    return PROGRAMMES_OFFICIELS.comptabilite;
  }

  if (
    valeur.includes("chaine d'approvisionnement") ||
    valeur.includes("logistique")
  ) {
    return PROGRAMMES_OFFICIELS.chaine;
  }

  if (valeur.includes("marketing")) {
    return PROGRAMMES_OFFICIELS.marketing;
  }

  if (
    valeur === "informatique" ||
    valeur.includes("programmation informatique") ||
    valeur.includes("programmation web") ||
    valeur.includes("programmation java") ||
    valeur.includes("programmation python") ||
    valeur.includes("programmation mobile") ||
    valeur.includes("programmation c#") ||
    valeur.includes("developpement")
  ) {
    return PROGRAMMES_OFFICIELS.informatique;
  }

  if (valeur.includes("developpement web")) {
    return PROGRAMMES_OFFICIELS.web;
  }

  if (valeur.includes("developpement mobile")) {
    return PROGRAMMES_OFFICIELS.mobile;
  }

  if (valeur.includes("intelligence artificielle")) {
    return PROGRAMMES_OFFICIELS.ia;
  }

  if (valeur.includes("analyse de donnees")) {
    return PROGRAMMES_OFFICIELS.donnees;
  }

  if (
    valeur === "reseau" ||
    valeur === "reseaux" ||
    valeur.includes("reseautique") ||
    valeur.includes("cybersecurite") ||
    valeur.includes("systemes informatiques")
  ) {
    return PROGRAMMES_OFFICIELS.reseautique;
  }

  if (valeur.includes("soutien informatique")) {
    return PROGRAMMES_OFFICIELS.soutien;
  }

  if (valeur.includes("design graphique")) {
    return PROGRAMMES_OFFICIELS.design;
  }

  if (valeur.includes("multimedia")) {
    return PROGRAMMES_OFFICIELS.multimedia;
  }

  if (valeur.includes("hoteli")) {
    return PROGRAMMES_OFFICIELS.hotelier;
  }

  if (valeur.includes("restauration")) {
    return PROGRAMMES_OFFICIELS.restauration;
  }

  if (valeur.includes("juridique")) {
    return PROGRAMMES_OFFICIELS.juridique;
  }

  if (valeur.includes("enfance")) {
    return PROGRAMMES_OFFICIELS.enfance;
  }

  if (valeur.includes("travail social")) {
    return PROGRAMMES_OFFICIELS.social;
  }

  if (valeur.includes("soins infirmiers")) {
    return PROGRAMMES_OFFICIELS.soins;
  }

  if (valeur.includes("laboratoire")) {
    return PROGRAMMES_OFFICIELS.laboratoire;
  }

  return String(programme).trim();
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET manquant dans .env");
}

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (request, response) => {
  response.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement",
  });
});

app.get("/api/test", (request, response) => {
  response.status(200).json({
    message: "La route de test fonctionne correctement",
  });
});

app.get("/api/groupes", async (request, response) => {
  try {
    const detailsDemandes = request.query.details === "1";
    const [groupes] = detailsDemandes
      ? await pool.query(
          `SELECT ge.id_groupes_etudiants,
                  ge.nom_groupe,
                  e.programme,
                  e.etape,
                  COUNT(e.id_etudiant) AS effectif
           FROM groupes_etudiants ge
           LEFT JOIN etudiants e
             ON e.id_groupes_etudiants = ge.id_groupes_etudiants
           GROUP BY ge.id_groupes_etudiants, ge.nom_groupe, e.programme, e.etape
           ORDER BY ge.nom_groupe ASC`
        )
      : await pool.query(
          "SELECT id_groupes_etudiants, nom_groupe FROM groupes_etudiants ORDER BY nom_groupe ASC"
        );

    response.status(200).json(groupes);
  } catch (error) {
    response.status(500).json({ message: "Erreur lors de la recuperation des groupes." });
  }
});

app.get("/api/programmes", async (request, response) => {
  try {
    const [programmes] = await pool.query(
      `SELECT DISTINCT programme
       FROM (
         SELECT programme
         FROM cours
         WHERE programme IS NOT NULL AND TRIM(programme) <> ''
         UNION
         SELECT programme
         FROM etudiants
         WHERE programme IS NOT NULL AND TRIM(programme) <> ''
         UNION
         SELECT specialite AS programme
         FROM professeurs
         WHERE specialite IS NOT NULL AND TRIM(specialite) <> ''
       ) AS programmes_uniques
       ORDER BY programme ASC`
    );

    const programmesNormalises = [
      ...new Set([
        ...PROGRAMMES_REFERENCE,
        ...programmes
          .map((programme) => normaliserNomProgramme(programme.programme))
          .filter(Boolean),
      ]),
    ].sort((programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr"));

    response.status(200).json(programmesNormalises);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Erreur lors de la recuperation des programmes." });
  }
});

authRoutes(app);
sallesRoutes(app);
coursRoutes(app);
professeursRoutes(app);
horaireRoutes(app);
etudiantsRoutes(app);

app.get("/admin-only", userAuth, userAdmin, (request, response) => {
  response.status(200).json({
    message: "OK ADMIN",
    user: request.user,
  });
});

app.get("/responsable-only", userAuth, userResponsable, (request, response) => {
  response.status(200).json({
    message: "OK RESPONSABLE",
    user: request.user,
  });
});

export default app;
