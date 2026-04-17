/**
 * Point d'entree canonique des migrations.
 *
 * Role:
 * - c'est le fichier a lancer pour une mise a jour normale du schema
 * - il delegue tout le vrai travail a `migration-engine.js`
 *
 * Impact sur le projet:
 * - il n'ajoute aucune table ni colonne par lui-meme
 * - il applique toutes les migrations en attente dans le bon ordre
 */
import { runMigrations } from "./migration-engine.js";

try {
  await runMigrations();
  process.exitCode = 0;
} catch (error) {
  console.error(`[migrate] ${error.message || error}`);
  process.exitCode = 1;
}
