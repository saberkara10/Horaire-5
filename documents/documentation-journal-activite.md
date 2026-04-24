# Journal d'activite / Audit log

## Fichiers crees ou modifies

- `Backend/Database/migration_v17.sql`, `migration_v17.js`, `run-migration-v17.js` : creation de la table `activity_logs`.
- `Backend/src/model/activity-log.model.js` : acces SQL, filtres, pagination et statistiques.
- `Backend/src/services/activity-log.service.js` : journalisation reutilisable et masquage des donnees sensibles.
- `Backend/src/controllers/activity-log.controller.js` et `Backend/routes/activity-logs.routes.js` : API admin protegee.
- `Frontend/src/pages/ActivityLogsPage.jsx`, `Frontend/src/services/activityLogs.api.js`, `Frontend/src/styles/ActivityLogsPage.css` : page de consultation.
- Routes metier modifiees : authentification, cours, salles, professeurs, etudiants, groupes, scheduler et sous-admins.

## Table ajoutee

`activity_logs`

Colonnes principales : `id_log`, `user_id`, `user_name`, `user_role`, `action_type`, `module`, `target_type`, `target_id`, `description`, `old_value`, `new_value`, `status`, `error_message`, `ip_address`, `user_agent`, `created_at`.

Index : `created_at`, `user_id`, `action_type`, `module`, `status`.

## Routes ajoutees

- `GET /api/admin/activity-logs`
- `GET /api/admin/activity-logs/:id`
- `GET /api/admin/activity-logs/stats/summary`

Ces routes exigent une session active et le role `ADMIN_RESPONSABLE`.

## Evenements journalises

- Connexion reussie, connexion echouee, tentative bloquee et deconnexion.
- Creation, modification, suppression de cours, salles, professeurs, groupes et sous-admins.
- Import Excel de cours, salles, professeurs et etudiants.
- Generation automatique globale, generation ciblee et generation par groupe.
- Modification manuelle/intelligente d'une affectation horaire.
- Echange de cours entre etudiants.
- Suppression/reinitialisation des etudiants importes.
- Changement de disponibilites professeur.

## Comment tester

1. Appliquer la migration : `node Backend/Database/run-migration-v17.js`.
2. Se connecter avec le compte `ADMIN_RESPONSABLE`.
3. Ouvrir `Journal d'activite` dans le menu.
4. Faire une action metier, par exemple creer une salle ou lancer un import.
5. Revenir sur la page, rafraichir et verifier la ligne creee.
6. Tester les filtres : module, action, statut, dates, recherche texte et pagination.
7. Se connecter avec un role autre que `ADMIN_RESPONSABLE` et verifier que la page n'apparait pas, puis que `/api/admin/activity-logs` retourne un refus.

Les champs sensibles comme mots de passe, tokens, secrets, cookies et hashes sont masques avant insertion.
