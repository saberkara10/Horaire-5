/**
 * Alias obsolete du point d'entree canonique des migrations.
 *
 * Role:
 * - conserve l'ancien chemin `Database/run-migrations.js`
 * - redirige l'execution vers le moteur central via l'aide de depreciation
 *
 * Impact sur le projet:
 * - ce fichier n'ajoute aucun changement de schema par lui-meme
 * - il garde les anciens scripts locaux fonctionnels tout en guidant vers
 *   `apply-schema-migrations.js`
 */
import { runDeprecatedMigrationScript } from "./legacy-runner.js";

await runDeprecatedMigrationScript("run-migrations.js");
