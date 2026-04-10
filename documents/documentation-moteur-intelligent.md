# Documentation - Moteur intelligent de planification

## 1. Objet

Cette documentation couvre le module expose sous `/api/scheduler`.

Elle decrit :

- les preconditions d'execution ;
- le contrat API ;
- les structures de rapport ;
- les diagnostics metier produits par le moteur.

## 2. Fichiers de reference

- `Backend/routes/scheduler.routes.js`
- `Backend/src/services/scheduler/SchedulerEngine.js`
- `Backend/src/services/scheduler/SchedulerReportService.js`
- `Backend/src/services/scheduler/FailedCourseEngine.js`
- `Backend/src/services/academic-scheduler-schema.js`

## 3. Preconditions

Pour produire une generation exploitable, il faut idealement :

- une session active ou un `id_session` valide ;
- un catalogue de cours actif ;
- des professeurs ;
- des salles pour le presentiel ;
- des associations `professeur_cours` ;
- des etudiants rattaches a la session cible.

## 4. Configuration utile

Le comportement depend de :

- `ENABLE_ONLINE_COURSES`
- `SCHEDULER_TARGET_GROUP_SIZE`
- `SCHEDULER_MAX_GROUP_CAPACITY`
- `SCHEDULER_MAX_GROUPS_PER_PROFESSOR`
- `SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR`

Les constantes metier fixes sont centralisees dans :

- `Backend/src/services/scheduler/SchedulerConfig.js`
- `Backend/src/services/scheduler/AcademicCatalog.js`

## 5. Routes exposees

### `POST /api/scheduler/bootstrap`

Role :

- assurer le schema academique ;
- completer le jeu de donnees operationnel.

Acces :

- `userAuth`
- `userAdmin`

### `GET /api/scheduler/generer-stream`

Role :

- lancer la generation avec streaming d'avancement.

Evenements emis :

- `progress`
- `done`
- `error`

### `POST /api/scheduler/generer`

Payload type :

```json
{
  "id_session": 3,
  "inclure_weekend": false,
  "sa_params": {
    "maxIterParTemp": 50
  }
}
```

La reponse contient un objet `rapport`.

### `GET /api/scheduler/rapports`

Retourne les derniers rapports de generation, enrichis avec :

- `resume_metier.raisons_non_planifiees`
- `resume_metier.raisons_reprises`

### `GET /api/scheduler/rapports/:id`

Retourne un rapport detaille avec :

- `details_bruts`
- `reprises_non_resolues`
- `cours_non_planifies`
- `resume_metier`

### `GET /api/scheduler/sessions`

Liste les sessions academiques.

### `POST /api/scheduler/sessions`

Payload minimal :

```json
{
  "nom": "Hiver 2026",
  "date_debut": "2026-01-12",
  "date_fin": "2026-05-01"
}
```

### `PUT /api/scheduler/sessions/:id/activer`

Desactive les autres sessions puis active la session cible.

### `GET /api/scheduler/cours-echoues`

Liste les reprises planifiables et leur contexte.

### `POST /api/scheduler/cours-echoues`

Payload minimal :

```json
{
  "id_etudiant": 12,
  "id_cours": 5,
  "id_session": 3,
  "note_echec": 42
}
```

### `DELETE /api/scheduler/cours-echoues/:id`

Supprime un enregistrement de reprise.

### `GET /api/scheduler/debug/reprises`

Produit un diagnostic cible sur une reprise ou un etudiant.

### `GET /api/scheduler/absences`

Liste les absences de professeurs.

### `POST /api/scheduler/absences`

Payload minimal :

```json
{
  "id_professeur": 8,
  "date_debut": "2026-03-10",
  "date_fin": "2026-03-12",
  "type": "maladie",
  "commentaire": "Arret court"
}
```

### `DELETE /api/scheduler/absences/:id`

Supprime une absence.

### `GET /api/scheduler/salles-indisponibles`

Liste les indisponibilites de salles.

### `POST /api/scheduler/salles-indisponibles`

Payload minimal :

```json
{
  "id_salle": 4,
  "date_debut": "2026-03-14",
  "date_fin": "2026-03-16",
  "raison": "maintenance",
  "commentaire": "Reseau hors service"
}
```

### `DELETE /api/scheduler/salles-indisponibles/:id`

Supprime une indisponibilite.

### `GET /api/scheduler/prerequis`

Liste les prerequis de cours.

### `POST /api/scheduler/prerequis`

Payload minimal :

```json
{
  "id_cours_prerequis": 3,
  "id_cours_suivant": 8,
  "est_bloquant": true
}
```

### `DELETE /api/scheduler/prerequis/:id`

Supprime un prerequis.

## 6. Structure du rapport de generation

Le coeur du contrat applicatif est le `rapport`.

Champs a surveiller :

- `session`
- `score_qualite`
- `score_initial`
- `nb_cours_planifies`
- `nb_cours_non_planifies`
- `nb_cours_echoues_traites`
- `nb_cours_en_ligne_generes`
- `nb_resolutions_manuelles`
- `affectations`
- `non_planifies`
- `resolutions_manuelles`
- `groupes_crees`
- `details.qualite`
- `details.reprises`

## 7. Raisons metier les plus importantes

Le moteur produit des codes de diagnostic explicites.

Les plus critiques sont :

- `AUCUN_PROFESSEUR_COMPATIBLE`
- `PROFESSEURS_SATURES`
- `SALLE_INSUFFISANTE`
- `SALLES_SATUREES`
- `GROUPE_SATURE`
- `ETUDIANTS_OCCUPES`
- `AUCUN_GROUPE_REEL`
- `CONFLIT_HORAIRE`
- `GROUPES_COMPLETS`

## 8. Observations importantes

- Le recuit simule est present dans le code mais neutralise dans le flux principal.
- Le moteur detruit puis reconstruit l'horaire de la session cible dans sa transaction.
- Les groupes peuvent etre recrees ou mises a jour avant la persistence finale.
- Les rapports de generation font partie de la sortie fonctionnelle et ne sont pas un simple log technique.

## 9. Usage recommande

Ordre de travail conseille :

1. Verifier ou creer la session active.
2. Lancer le bootstrap si l'environnement est vierge.
3. Verifier cours, associations professeurs-cours et salles.
4. Lancer la generation.
5. Lire le rapport detaille.
6. Corriger les blocages metier avant une nouvelle generation.
