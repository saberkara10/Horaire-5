# Documentation des generations d'horaires

## Objectif

Le module **Generations d'horaires** ajoute une couche professionnelle de sauvegarde, comparaison, duplication et restauration autour de l'horaire actif du scheduler, sans remplacer le moteur existant.

Chaque generation automatique reussie cree maintenant une **version persistante** de l'horaire courant. Cette version est independante, reutilisable et consultable depuis l'administration.

## Portee fonctionnelle

- Sauvegarde automatique de chaque generation globale reussie du scheduler.
- Conservation d'un historique complet par session.
- Consultation du detail d'une version.
- Comparaison de deux versions.
- Duplication d'une ancienne version en brouillon.
- Archivage logique d'une version.
- Restauration transactionnelle d'une version existante comme horaire actif.
- Journalisation des actions critiques dans le journal d'activite.
- Edition d'une note administrative sur chaque version.

## Tables ajoutees

La migration `v19` introduit les tables suivantes :

- `schedule_generations`
  Stocke l'entete metier d'une version : session, numero de version, statut, utilisateur, score, compteurs agreges, note et metadata.
- `schedule_generation_items`
  Stocke le contenu de la version :
  - les seances planifiees (`item_type = placement`)
  - les affectations individuelles/reprises (`item_type = student_assignment`)
- `schedule_generation_conflicts`
  Stocke les conflits et blocages detectes au moment de la generation.
- `schedule_generation_metrics`
  Stocke les metriques detaillees sous forme cle/valeur.
- `schedule_generation_actions`
  Stocke la trace des actions propres a une version : creation, duplication, archivage, restauration, mise a jour de note.

## Cycle de vie d'une generation

### 1. Generation automatique

Quand `POST /api/scheduler/generer` ou `GET /api/scheduler/generer-stream` termine avec succes :

1. le moteur ecrit l'horaire actif dans `affectation_cours`, `affectation_groupes`, `plages_horaires` et `affectation_etudiants` ;
2. le service `ScheduleGenerationService.captureCurrentGeneration()` charge un snapshot read-only de cet etat ;
3. ce snapshot est persiste dans les tables `schedule_generation_*` avec le statut `active`.

La version active precedente de la meme session est automatiquement requalifiee en `archived`.

### 2. Comparaison

La comparaison s'appuie sur une cle stable `comparison_key` construite a partir :

- du cours ;
- des groupes concernes ;
- de l'ordre logique de la seance dans la version.

Cela permet d'identifier :

- les seances ajoutees ou retirees ;
- les cours deplaces ;
- les changements de professeur ;
- les changements de salle.

### 3. Restauration

La restauration se fait en deux temps :

1. appel preview via `POST /api/schedule-generations/:id/restore` avec `{ "confirm": false }` ;
2. confirmation backend via `{ "confirm": true }`.

Avant l'application :

- la version cible est verifiee contre le catalogue courant ;
- les references manquantes bloquent la restauration ;
- les indisponibilites professeurs/salles sont remontees en avertissements ;
- une sauvegarde automatique de l'etat courant est creee avec `source_kind = pre_restore_backup`.

L'application reelle utilise une transaction SQL et le nettoyage par session deja present dans `SchedulerEngine._supprimerHoraireSession()`. En cas d'erreur, la restauration est annulee.

## Routes API

Toutes les routes sont reservees a `ADMIN_RESPONSABLE`.

- `GET /api/schedule-generations`
  Liste les versions.
- `GET /api/schedule-generations/:id`
  Retourne le detail complet d'une version.
- `PATCH /api/schedule-generations/:id`
  Met a jour le nom et la note de la version.
- `POST /api/schedule-generations/compare`
  Compare deux versions.
- `POST /api/schedule-generations/:id/restore`
  Previsualise puis restaure une version.
- `POST /api/schedule-generations/:id/duplicate`
  Cree une copie brouillon d'une version.
- `PATCH /api/schedule-generations/:id/archive`
  Archive une version non active.
- `DELETE /api/schedule-generations/:id`
  Suppression logique uniquement.

## Frontend

Une nouvelle page React `ScheduleGenerationsPage` expose :

- le tableau des versions ;
- les actions `Voir`, `Comparer`, `Restaurer`, `Dupliquer`, `Archiver` ;
- le detail metier et les metriques ;
- la note administrative ;
- un panneau de comparaison synthétique.

Le design respecte la palette existante La Cite via les variables globales deja presentes.

## Journal d'activite

Les actions suivantes sont journalisees :

- `GENERATE` pour la creation automatique ;
- `COMPARE` pour la comparaison de versions ;
- `DUPLICATE` pour la duplication ;
- `ARCHIVE` pour l'archivage ;
- `RESTORE` pour la restauration ;
- `DELETE` pour la suppression logique.

## Points d'attention

- Le module ne remplace pas `SchedulerEngine`.
- Il encapsule l'horaire officiel deja produit par le moteur.
- La restauration est scoped par session pour ne pas impacter les autres sessions.
- Les versions supprimees restent en base via `deleted_at` tant qu'aucun nettoyage physique n'est demande.
