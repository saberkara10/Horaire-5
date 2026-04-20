/**
 * Configuration principale de l'application Express.
 *
 * Ce fichier orchestre tout le backend :
 *  - Sécurité HTTP (Helmet, CORS)
 *  - Compression des réponses (gzip)
 *  - Parsing du JSON
 *  - Sessions côté serveur (express-session)
 *  - Authentification (Passport.js avec stratégie locale)
 *  - Enregistrement de toutes les routes métier
 *
 * L'ordre des middlewares est important — ne pas le changer sans comprendre
 * les dépendances. Par exemple, Passport doit être initialisé APRÈS la session.
 *
 * @module app
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import dotenv from "dotenv";

// Charger la config Passport (stratégie locale email/password + sérialisation)
// Ce fichier doit être importé avant tout middleware Passport.
import "../auth.js";

// Middlewares d'autorisation réutilisables dans les routes
import { userAuth, userAdmin, userResponsable } from "../middlewares/auth.js";

// Toutes les routes regroupées par domaine métier
import authRoutes from "../routes/auth.routes.js";
import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import horaireRoutes from "../routes/horaire.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";
import etudiantsRoutes from "../routes/etudiants.routes.js";
import groupesRoutes from "../routes/groupes.routes.js";
import adminsRoutes from "../routes/admins.routes.js";
import dashboardRoutes from "../routes/dashboard.routes.js";
import schedulerRoutes from "../routes/scheduler.routes.js";
import exportRoutes from "../routes/export.routes.js";

// Pour la route /api/programmes qui interroge plusieurs tables à la fois
import pool from "../db.js";

// Charger les variables d'environnement (certains modules les lisent via dotenv.config()
// dans leur propre fichier, mais on le rappelle ici par sécurité)
dotenv.config({ quiet: true });

// Si SESSION_SECRET n'est pas défini, on utilise une valeur de dev.
// En production, cette variable DOIT être définie dans .env avec une valeur longue et aléatoire.
const SESSION_SECRET = process.env.SESSION_SECRET || "gdh_secret_dev";
const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = new Set(
  [process.env.CORS_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean)
);
const localhostDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const app = express();

// ── Middlewares de sécurité ────────────────────────────────────────────────

// Helmet ajoute automatiquement les en-têtes HTTP de sécurité recommandés
// (Content-Security-Policy, X-Frame-Options, etc.). À garder en tête de liste.
app.use(helmet());

// Compression gzip/brotli des réponses JSON et HTML — réduit la bande passante
// de manière transparente pour le client. Pas besoin de changer quoi que ce soit
// dans les routes, la compression se fait automatiquement.
app.use(compression());

// Permettre de lire le corps des requêtes en JSON (POST, PUT, PATCH).
// Sans ça, req.body serait toujours "undefined".
app.use(express.json());

// ── CORS (Cross-Origin Resource Sharing) ──────────────────────────────────
// En développement, le frontend tourne sur port 5173 (Vite) et le backend sur 3000.
// Sans CORS configuré, le navigateur bloque les requêtes entre ces deux origines.
// En production, remplacer par l'URL réelle du frontend dans CORS_ORIGIN.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        configuredOrigins.has(origin) ||
        (!isProduction && localhostDevOriginPattern.test(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Origine CORS non autorisee."));
    },
    credentials: true, // obligatoire pour que les cookies de session passent
  })
);

// ── Sessions côté serveur ──────────────────────────────────────────────────
// express-session stocke une référence de session dans un cookie côté client,
// et les données réelles en mémoire côté serveur.
//
// Options importantes :
//  - name: "sid"            → nom du cookie (évite l'identifiant par défaut "connect.sid")
//  - resave: false          → ne pas sauvegarder la session si elle n'a pas changé
//  - saveUninitialized: false → ne pas créer de session pour les requêtes anonymes
//  - cookie.httpOnly        → le cookie n'est pas accessible en JavaScript côté client
//  - cookie.maxAge          → 1 heure (3 600 000 ms)
//  - cookie.secure          → uniquement HTTPS en production (important !)
//  - cookie.sameSite: "lax" → protection basique contre le CSRF
app.use(
  session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60, // 1 heure
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// ── Passport (authentification) ────────────────────────────────────────────
// initialize() prépare Passport à traiter chaque requête.
// session() permet de restaurer l'utilisateur depuis la session à chaque requête
// (via deserializeUser défini dans auth.js).
app.use(passport.initialize());
app.use(passport.session());

// ── Routes utilitaires ─────────────────────────────────────────────────────

/**
 * Route de santé — vérifie que le serveur répond.
 * Utilisée par les outils de monitoring ou les load balancers
 * pour savoir si l'application est vivante.
 *
 * @route GET /api/health
 * @returns {object} 200 - { status: "OK", message }
 */
app.get("/api/health", (request, response) => {
  response.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement",
  });
});

/**
 * Route de test simple — confirme que le routage Express fonctionne.
 * Sert principalement pendant le développement ou les tests manuels.
 *
 * @route GET /api/test
 * @returns {object} 200 - { message }
 */
app.get("/api/test", (request, response) => {
  response.status(200).json({
    message: "La route de test fonctionne correctement",
  });
});

/**
 * Liste unifiée de tous les programmes connus dans le système.
 *
 * On agrège depuis 4 sources différentes pour être exhaustif :
 *  1. programmes_reference  → programmes officiellement enregistrés
 *  2. cours                 → programmes liés aux cours existants
 *  3. etudiants             → programmes des étudiants importés
 *  4. professeurs.specialite → spécialités (utilisées comme programmes dans certains contextes)
 *
 * Le UNION déduplique automatiquement les valeurs identiques.
 * Le résultat final est trié alphabétiquement.
 *
 * @route GET /api/programmes
 * @returns {string[]} 200 - Liste triée des programmes uniques
 * @returns {object}   500 - Message d'erreur en cas de problème SQL
 */
app.get("/api/programmes", async (request, response) => {
  try {
    const [programmes] = await pool.query(
      `SELECT DISTINCT programme
       FROM (
         SELECT nom_programme AS programme
         FROM programmes_reference
         WHERE nom_programme IS NOT NULL AND TRIM(nom_programme) <> ''
         UNION
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

    // Nettoyer les valeurs retournées et retrier côté JS (au cas où la collation SQL diffère)
    const programmesDisponibles = programmes
      .map((programme) => String(programme.programme || "").trim())
      .filter(Boolean)
      .sort((programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr"));

    response.status(200).json(programmesDisponibles);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Erreur lors de la recuperation des programmes." });
  }
});

// ── Enregistrement des routes métier ──────────────────────────────────────
// Chaque module reçoit l'instance "app" et y attache ses propres routes.
// L'ordre n'a pas d'importance fonctionnelle ici, mais on les garde groupées
// par domaine pour la lisibilité.
authRoutes(app);           // /api/auth/* — connexion, déconnexion
sallesRoutes(app);         // /api/salles/* — gestion des salles
coursRoutes(app);          // /api/cours/* — gestion des cours
professeursRoutes(app);    // /api/professeurs/* — gestion des professeurs
horaireRoutes(app);        // /api/horaire/* — lecture des horaires générés
etudiantsRoutes(app);      // /api/etudiants/* — gestion et échanges de cours
groupesRoutes(app);        // /api/groupes/* — gestion des groupes d'étudiants
adminsRoutes(app);         // /api/admins/* — gestion des comptes admin
dashboardRoutes(app);      // /api/dashboard/* — statistiques globales
schedulerRoutes(app);      // /api/scheduler/* — génération d'horaires
exportRoutes(app);         // /api/export/* — export PDF et Excel

// ── Routes de test de rôles (développement uniquement) ───────────────────

/**
 * Route protégée réservée aux administrateurs.
 * Sert à vérifier que les middlewares de rôle fonctionnent correctement.
 * À supprimer ou restreindre en production.
 *
 * @route GET /admin-only
 * @middleware userAuth — vérifie que l'utilisateur est connecté
 * @middleware userAdmin — vérifie que l'utilisateur a le rôle admin
 * @returns {object} 200 - { message: "OK ADMIN", user }
 */
app.get("/admin-only", userAuth, userAdmin, (request, response) => {
  response.status(200).json({
    message: "OK ADMIN",
    user: request.user,
  });
});

/**
 * Route protégée réservée aux responsables de programme.
 * Même usage que /admin-only, pour tester le middleware userResponsable.
 *
 * @route GET /responsable-only
 * @middleware userAuth — vérifie que l'utilisateur est connecté
 * @middleware userResponsable — vérifie que l'utilisateur a le rôle responsable
 * @returns {object} 200 - { message: "OK RESPONSABLE", user }
 */
app.get("/responsable-only", userAuth, userResponsable, (request, response) => {
  response.status(200).json({
    message: "OK RESPONSABLE",
    user: request.user,
  });
});

export default app;
