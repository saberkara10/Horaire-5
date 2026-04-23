/**
 * Ancien point d'entree legacy des migrations.
 *
 * Role:
 * - conserve le tres ancien nom de commande `run_migration.js`
 * - redirige vers le moteur moderne via `legacy-runner.js`
 *
 * Impact sur le projet:
 * - ce fichier n'ajoute aucun changement de schema par lui-meme
 * - il evite simplement de casser de vieux usages et scripts
 */
import { runDeprecatedMigrationScript } from "./legacy-runner.js";

await runDeprecatedMigrationScript("run_migration.js");
