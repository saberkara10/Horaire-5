# Gestion des conflits d'utilisation

## Objectif

Le module de concurrence empeche deux utilisateurs de modifier la meme ressource critique au meme moment. Il couvre les ressources suivantes: horaire, professeur, groupe, salle, cours, planification et generation.

## Tables

- `resource_locks`: verrous temporaires actifs, avec utilisateur, role, session, date de creation, derniere activite et expiration.
- `resource_wait_queue`: file d'attente par ressource, avec ordre d'arrivee et statut `en_attente`, `actif`, `annule` ou `expire`.
- `user_presence`: presence par session Express, module courant, derniere activite et verrou courant.
- `activity_logs`: journalise les creations, blocages, expirations, liberations, files d'attente et connexions.

## Routes principales

- `GET /api/concurrency/availability?resource_type=salle&resource_id=1`
- `POST /api/concurrency/locks`
- `POST /api/concurrency/locks/:id/heartbeat`
- `DELETE /api/concurrency/locks/:id`
- `POST /api/concurrency/wait-queue`
- `DELETE /api/concurrency/wait-queue/:id`
- `POST /api/concurrency/presence/heartbeat`
- `GET /api/admin/concurrency` reserve a `ADMIN_RESPONSABLE`

## Scenarios de validation

1. Utilisateur A ouvre la modification d'une salle: un verrou `salle:{id}` est cree.
2. Utilisateur B ouvre la meme salle: l'API retourne `409` avec le message de ressource utilisee.
3. Utilisateur B choisit `Me placer en attente`: une entree `en_attente` est creee.
4. Utilisateur A ferme le formulaire ou se deconnecte: le verrou est libere et le prochain en file passe `actif`.
5. Si A reste inactif plus que `USER_PRESENCE_INACTIVITY_MINUTES`, ses verrous sont liberes automatiquement par le backend.
6. L'administrateur general consulte `/admin-concurrence` pour voir utilisateurs, verrous et files.

## Configuration

- `RESOURCE_LOCK_TTL_SECONDS`: duree d'un verrou, defaut 900 secondes.
- `RESOURCE_QUEUE_TTL_SECONDS`: duree d'une attente, defaut 1800 secondes.
- `USER_PRESENCE_INACTIVITY_MINUTES`: seuil d'inactivite, defaut 15 minutes.
