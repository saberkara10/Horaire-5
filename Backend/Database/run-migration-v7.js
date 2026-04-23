/**
 * Ancien alias de la commande historique "run v7 migration".
 *
 * Role:
 * - conserve un ancien chemin de commande locale
 * - redirige vers le moteur central de migration
 *
 * Impact sur le projet:
 * - ce wrapper n'ajoute aucun changement de schema par lui-meme
 * - les vrais changements sont definis dans `migration_v7.sql` et `migration_v7.js`
 */
import { runDeprecatedMigrationScript } from "./legacy-runner.js";

await runDeprecatedMigrationScript("run-migration-v7.js");
