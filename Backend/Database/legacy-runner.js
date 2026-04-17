/**
 * Helper de lancement pour les anciennes commandes de migration.
 *
 * Role:
 * - garde les vieilles commandes de migration actives
 * - les redirige vers le moteur central
 * - demande au moteur d'afficher un avertissement de depreciation
 *
 * Impact sur le projet:
 * - ce fichier n'ajoute aucun changement de schema par lui-meme
 * - il preserve seulement la compatibilite avec d'anciens usages locaux
 */
import { runMigrations } from "./migration-engine.js";

export async function runDeprecatedMigrationScript(scriptName) {
  try {
    await runMigrations({
      deprecationSource: scriptName,
    });
    process.exitCode = 0;
  } catch (error) {
    console.error(`[migrate] ${error.message || error}`);
    process.exitCode = 1;
  }
}
