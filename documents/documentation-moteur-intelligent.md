# Documentation d'exploitation du moteur intelligent de planification

## 1. Objet

Cette documentation decrit l'usage concret du moteur intelligent expose
principalement sous `/api/scheduler`.

Elle couvre :

- les preconditions ;
- les variables de configuration ;
- les endpoints disponibles ;
- le contrat de generation ;
- la structure des rapports ;
- les codes de diagnostic ;
- le runbook d'exploitation de bout en bout ;
- les flux annexes de regeneration ciblee et de replanification locale.

## 2. Fichiers de reference

- `Backend/routes/scheduler.routes.js`
- `Backend/routes/groupes.routes.js`
- `Backend/routes/professeurs.routes.js`
- `Backend/src/services/scheduler/SchedulerEngine.js`
- `Backend/src/services/scheduler/SchedulerReportService.js`
- `Backend/src/services/scheduler/FailedCourseEngine.js`
- `Backend/src/services/scheduler/SchedulerConfig.js`
- `Backend/src/services/scheduler/AcademicCatalog.js`
- `Backend/src/services/professeurs/availability-rescheduler.js`
- `Frontend/src/pages/SchedulerPage.jsx`
- `Frontend/src/pages/DisponibilitesProfesseursPage.jsx`

## 3. Preconditions metier

Pour obtenir une generation exploitable, il faut au minimum :

- une session active ou un `id_session` valide ;
- des cours non archives sur la session cible ;
- au moins un professeur compatible pour les cours a planifier ;
- des salles compatibles pour les cours en presentiel ;
- des etudiants rattaches a la session cible ;
- des groupes ou, a defaut, des cohortes suffisantes pour que `GroupFormer`
  puisse former les groupes reels ;
- des associations `professeur_cours` si l'on veut un comportement strict et
  previsible.

Le bootstrap peut combler certaines lacunes structurelles, mais il ne remplace
pas une validation metier humaine du catalogue, des enseignants et des
disponibilites.

## 4. Configuration utile

### 4.1 Variables d'environnement reconnues

| Variable | Valeur par defaut | Effet |
|---|---:|---|
| `ENABLE_ONLINE_COURSES` | `false` | Active les cours en ligne dans le moteur principal, le fallback et les reprises |
| `SCHEDULER_TARGET_GROUP_SIZE` | `26` | Taille cible des groupes formes par `GroupFormer` |
| `SCHEDULER_MAX_GROUP_CAPACITY` | `30` | Capacite operationnelle maximale d'un groupe |
| `SCHEDULER_MAX_GROUPS_PER_PROFESSOR` | `16` | Plafond de groupes distincts par professeur dans le moteur principal |
| `SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR` | `16` | Plafond hebdomadaire principal de series par professeur |

### 4.2 Constantes structurantes du catalogue

Les constantes du catalogue restent actives en parallele des variables
d'environnement :

- `REQUIRED_WEEKLY_SESSIONS_PER_GROUP = 7`
- `TARGET_ACTIVE_DAYS_PER_GROUP = 4`
- `MAX_GROUP_SESSIONS_PER_DAY = 3`
- `MAX_PROFESSOR_SESSIONS_PER_DAY = 4`
- `MAX_COURSES_PER_PROFESSOR = 6`
- `MAX_GROUPS_PER_PROFESSOR = 12`
- `MAX_WEEKLY_SESSIONS_PER_PROFESSOR = 12`

En pratique, le moteur combine donc :

- des constantes structurelles du catalogue academique ;
- des plafonds surchargables par configuration.

### 4.3 Parametres API exposes mais limites

- `inclure_weekend` est accepte par l'API mais ignore par le moteur courant ;
- `sa_params` est accepte et historise, mais ne reactive pas le recuit simule
  dans le flux final.

## 5. Endpoints du module `/api/scheduler`

| Methode | Route | Acces | Usage |
|---|---|---|---|
| `POST` | `/api/scheduler/bootstrap` | `userAuth + userAdmin` | Assure le schema et le dataset operationnel |
| `GET` | `/api/scheduler/generer-stream` | `userAuth + userAdmin` | Lance une generation complete avec progression SSE |
| `POST` | `/api/scheduler/generer` | `userAuth + userAdmin` | Lance une generation complete sans SSE |
| `GET` | `/api/scheduler/rapports` | `userAuth + userAdminOrResponsable` | Liste les rapports enrichis |
| `GET` | `/api/scheduler/rapports/:id` | `userAuth + userAdminOrResponsable` | Lit un rapport detaille |
| `GET` | `/api/scheduler/sessions` | `userAuth + userAdminOrResponsable` | Liste les sessions |
| `POST` | `/api/scheduler/sessions` | `userAuth + userAdmin` | Cree et active une session |
| `PUT` | `/api/scheduler/sessions/:id/activer` | `userAuth + userAdmin` | Active une session existante |
| `GET` | `/api/scheduler/cours-echoues` | `userAuth + userAdminOrResponsable` | Liste les reprises de la session |
| `GET` | `/api/scheduler/debug/reprises` | `userAuth + userAdminOrResponsable` | Produit un diagnostic cible sur une reprise |
| `POST` | `/api/scheduler/cours-echoues` | `userAuth + userAdmin` | Cree ou reactive un cours echoue |
| `DELETE` | `/api/scheduler/cours-echoues/:id` | `userAuth + userAdmin` | Supprime un cours echoue |
| `GET` | `/api/scheduler/absences` | `userAuth + userAdminOrResponsable` | Liste les absences professeurs |
| `POST` | `/api/scheduler/absences` | `userAuth + userAdmin` | Cree une absence professeur |
| `DELETE` | `/api/scheduler/absences/:id` | `userAuth + userAdmin` | Supprime une absence professeur |
| `GET` | `/api/scheduler/salles-indisponibles` | `userAuth + userAdminOrResponsable` | Liste les indisponibilites de salles |
| `POST` | `/api/scheduler/salles-indisponibles` | `userAuth + userAdmin` | Cree une indisponibilite de salle |
| `DELETE` | `/api/scheduler/salles-indisponibles/:id` | `userAuth + userAdmin` | Supprime une indisponibilite de salle |
| `GET` | `/api/scheduler/prerequis` | `userAuth + userAdminOrResponsable` | Liste les prerequis de cours |
| `POST` | `/api/scheduler/prerequis` | `userAuth + userAdmin` | Cree ou met a jour un prerequis |
| `DELETE` | `/api/scheduler/prerequis/:id` | `userAuth + userAdmin` | Supprime un prerequis |

## 6. Endpoints annexes relies au scheduler

### 6.1 Regeneration ciblee par groupe

| Methode | Route | Acces | Usage |
|---|---|---|---|
| `POST` | `/api/groupes/generer-cible` | `userAuth + userAdminOrResponsable` | Regenerer plusieurs groupes cibles par `programme` et/ou `etape` |
| `POST` | `/api/groupes/:id/generer-horaire` | `userAuth + userAdminOrResponsable` | Regenerer l'horaire d'un groupe unique |

Notes d'exploitation :

- ces routes appellent `SchedulerEngine.genererGroupe()` ;
- elles ne creent pas de rapport dans `rapports_generation` dans l'etat actuel ;
- elles sont utiles pour corriger localement un groupe sans reconstruire toute
  la session.

### 6.2 Replanification locale des disponibilites professeurs

| Methode | Route | Usage |
|---|---|---|
| `GET` | `/api/professeurs/:id/disponibilites` | Lire les disponibilites detaillees et la semaine de reference |
| `GET` | `/api/professeurs/:id/disponibilites/journal` | Lire le journal de replanification |
| `PUT` | `/api/professeurs/:id/disponibilites` | Remplacer les disponibilites et declencher la replanification locale |
| `GET` | `/api/professeurs/:id/horaire` | Lire l'horaire courant du professeur |

Le `PUT /api/professeurs/:id/disponibilites` peut retourner un payload
`replanification` dans la reponse, y compris en cas de resultat partiel ou
d'echec metier.

## 7. Contrat de generation complete

### 7.1 Requete `POST /api/scheduler/generer`

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

Remarques :

- `id_session` est optionnel ; sans lui, la session active est utilisee ;
- `inclure_weekend` est expose pour le contrat, mais le moteur courant le force
  a `false` ;
- `sa_params` est enregistre dans `details.sa_params_recus`, mais ne pilote pas
  une optimisation effective dans le flux final.

### 7.2 Flux SSE `GET /api/scheduler/generer-stream`

Parametres de requete supportes :

- `id_session`
- `inclure_weekend`
- `sa_params` encode en JSON

Evenements emis :

- `progress`
- `done`
- `error`

Exemple d'evenement `progress` :

```json
{
  "type": "progress",
  "phase": "PHASE_4",
  "message": "Construction du motif hebdomadaire recurrent...",
  "pct": 35
}
```

Exemple d'evenement final :

```json
{
  "type": "done",
  "rapport": {
    "score_qualite": 84,
    "nb_cours_planifies": 224,
    "nb_cours_non_planifies": 6
  }
}
```

### 7.3 Reponse `POST /api/scheduler/generer`

La reponse HTTP est de type :

```json
{
  "message": "224 affectations generees. Score qualite : 84/100",
  "rapport": {
    "session": {
      "id_session": 3,
      "nom": "Hiver 2026"
    },
    "score_qualite": 84,
    "score_initial": 79,
    "nb_cours_planifies": 224,
    "nb_cours_non_planifies": 6,
    "nb_cours_echoues_traites": 18,
    "nb_cours_en_ligne_generes": 0,
    "nb_groupes_speciaux": 0,
    "nb_resolutions_manuelles": 2,
    "affectations": [],
    "non_planifies": [],
    "resolutions_manuelles": [],
    "iterations_sa": 0,
    "groupes_crees": [],
    "details": {}
  }
}
```

## 8. Structure detaillee du rapport

### 8.1 Champs racine du rapport retourne par le moteur

| Champ | Description |
|---|---|
| `session` | Session cible du calcul |
| `score_qualite` | Score final sur 100 |
| `score_initial` | Score brut avant optimisation finale neutralisee |
| `nb_cours_planifies` | Nombre total de placements persistables |
| `nb_cours_non_planifies` | Nombre de cas restes sans solution |
| `nb_cours_echoues_traites` | Nombre de demandes de reprises analysees |
| `nb_cours_en_ligne_generes` | Nombre de placements en ligne ou hybrides retenus |
| `nb_groupes_speciaux` | Reserve pour les groupes speciaux, actuellement `0` dans le flux principal |
| `nb_resolutions_manuelles` | Nombre de reprises restees sans solution automatique |
| `affectations` | Placements retenus et enrichis avec `id_affectation_cours` |
| `non_planifies` | Diagnostics de cours restes sans solution |
| `resolutions_manuelles` | Diagnostics de reprises non rattachees |
| `iterations_sa` | Nombre d'iterations de recuit simule, actuellement `0` |
| `groupes_crees` | Resume des groupes formes ou projetes |
| `details` | Bloc metier complementaire |

### 8.2 Bloc `details`

Les champs les plus importants sont :

- `mode_planification`
- `semaine_type_repliquee`
- `optimisation_simulated_annealing`
- `weekend_autorise`
- `cours_en_ligne_actifs`
- `raison`
- `sa_params_recus`
- `qualite`
- `preference_stabilite_referencees`
- `reprises`
- `rapport_metier`

Exemple de structure :

```json
{
  "mode_planification": "hebdomadaire_recurrent",
  "semaine_type_repliquee": true,
  "optimisation_simulated_annealing": false,
  "weekend_autorise": false,
  "cours_en_ligne_actifs": false,
  "raison": "Le motif hebdomadaire doit rester identique toute la session.",
  "sa_params_recus": {
    "maxIterParTemp": 50
  },
  "qualite": {
    "score": 84,
    "groupes_sous_charge_hebdo": 1,
    "taux_stabilite_reference": 0.92
  },
  "reprises": {
    "demandes_total": 18,
    "affectations_reussies": 16,
    "conflits": 2,
    "conflits_details": []
  }
}
```

### 8.3 Payload persiste dans `rapports_generation.details`

Le JSON persiste contient :

- `non_planifies`
- `resolutions_manuelles`
- `details`
- `rapport_metier`

`rapport_metier` est une vue compacte persistable contenant :

- `reprises_non_resolues`
- `cours_non_planifies`

Cette duplication est volontaire : elle facilite l'exploitation des rapports
sans devoir recalculer a chaud toute la structure du moteur.

## 9. Cycles de vie importants

### 9.1 Statuts des `cours_echoues`

Les statuts connus dans le projet sont :

- `a_reprendre`
- `planifie`
- `reussi`
- `en_ligne`
- `groupe_special`
- `resolution_manuelle`

Le scheduler planifie les statuts suivants :

- `a_reprendre`
- `planifie`
- `en_ligne`
- `groupe_special`
- `resolution_manuelle`

Transitions les plus importantes :

- creation ou reactivation d'un echec : `a_reprendre`
- rattachement a une section reelle : `planifie`
- impossibilite de rattachement : `resolution_manuelle`

### 9.2 Statuts du journal de replanification

Le journal des disponibilites utilise :

- `AUCUN_IMPACT`
- `SUCCES`
- `PARTIEL`
- `ECHEC`

Interpretation :

- `AUCUN_IMPACT` : aucune seance future n'a ete touchee ;
- `SUCCES` : toutes les seances impactees ont ete replacees ;
- `PARTIEL` : certaines seances ont ete replacees, d'autres retirees ;
- `ECHEC` : aucune solution automatique stable n'a ete trouvee.

## 10. Codes de diagnostic a connaitre

### 10.1 Diagnostics de non planification

| Code | Produit par | Signification |
|---|---|---|
| `AUCUN_PROFESSEUR_COMPATIBLE` | `SchedulerEngine._diagnosticPrecis` | Aucun enseignant admissible pour le cours |
| `SALLE_INSUFFISANTE` | `SchedulerEngine._diagnosticPrecis` | Aucune salle du bon type avec capacite suffisante |
| `ETUDIANTS_OCCUPES` | `SchedulerEngine._diagnosticPrecis` | Les etudiants du cours sont deja engages sur les creneaux candidats |
| `GROUPE_SATURE` | `SchedulerEngine._diagnosticPrecis` | Le groupe est deja trop charge sur les creneaux disponibles |
| `PROFESSEURS_SATURES` | `SchedulerEngine._diagnosticPrecis` | Les professeurs compatibles sont tous bloques ou a plafond |
| `SALLES_SATUREES` | `SchedulerEngine._diagnosticPrecis` | Les salles compatibles sont toutes occupees |
| `GARANTIE_*` | `SchedulerEngine._passeDeGarantieGroupes` | Echec pendant la passe de garantie des 7 cours |

### 10.2 Diagnostics de reprises

| Code | Produit par | Signification |
|---|---|---|
| `COURS_INTROUVABLE` | `FailedCourseEngine` | Le cours n'existe plus dans le catalogue |
| `COURS_EN_LIGNE_DESACTIVE` | `FailedCourseEngine` | Le cours est uniquement en ligne alors que le flag global est inactif |
| `AUCUN_GROUPE_REEL` | `FailedCourseEngine` | Aucune section reelle n'existe dans la session courante |
| `CONFLIT_HORAIRE` | `FailedCourseEngine` | Toutes les sections candidates entrent en conflit avec l'horaire de l'etudiant |
| `GROUPES_COMPLETS` | `FailedCourseEngine` | Toutes les sections candidates sont pleines |
| `CONFLIT_HORAIRE_ET_CAPACITE` | `FailedCourseEngine` | Les sections restantes sont soit en conflit soit pleines |
| `AUCUNE_SECTION_COMPATIBLE` | `FailedCourseEngine` | Aucun rattachement stable n'a ete trouve |

## 11. Runbook d'exploitation recommande

1. Creer ou activer la session cible avec `/api/scheduler/sessions`.
2. Lancer `/api/scheduler/bootstrap` si l'environnement est incomplet ou vierge.
3. Verifier les cours, les associations `professeur_cours`, les salles et les disponibilites.
4. Enregistrer les `cours_echoues`, absences professeurs, indisponibilites salles et prerequis si necessaire.
5. Lancer la generation complete via `/api/scheduler/generer` ou `/api/scheduler/generer-stream`.
6. Lire le rapport de synthese puis le detail via `/api/scheduler/rapports/:id`.
7. Corriger les blocages metier selon les codes de diagnostic.
8. Utiliser `/api/groupes/generer-cible` ou `/api/groupes/:id/generer-horaire` pour des corrections localisees.
9. Utiliser `PUT /api/professeurs/:id/disponibilites` quand le probleme provient d'un enseignant et qu'une replanification locale suffit.
10. Relancer une generation complete quand les contraintes structurelles ont change.

## 12. Troubleshooting rapide

### Aucune session active

Symptome :

- erreur `Aucune session active`.

Actions :

- creer une session ;
- ou activer une session existante.

### Aucun cours planifiable

Symptome :

- erreur `Aucun cours planifiable`.

Actions :

- verifier les cours non archives ;
- verifier `ENABLE_ONLINE_COURSES` si le catalogue cible contient des cours en ligne ;
- verifier le bootstrap du catalogue.

### Beaucoup de `AUCUN_PROFESSEUR_COMPATIBLE`

Actions :

- completer `professeur_cours` ;
- verifier la specialite des professeurs ;
- verifier que les professeurs du bootstrap n'ont pas ete nettoyes ou archives.

### Beaucoup de `PROFESSEURS_SATURES`

Actions :

- augmenter la capacite enseignant via la configuration ;
- ajouter des enseignants ;
- ouvrir des disponibilites supplementaires.

### Beaucoup de `SALLES_SATUREES` ou `SALLE_INSUFFISANTE`

Actions :

- ajouter ou requalifier des salles ;
- corriger la capacite ;
- verifier les indisponibilites salles.

### Reprises restees en `resolution_manuelle`

Actions :

- consulter `/api/scheduler/debug/reprises` ;
- verifier les conflits avec l'horaire principal de l'etudiant ;
- verifier la capacite restante des sections candidates ;
- regenerer le groupe cible si une correction locale suffit.

### Replanification `PARTIEL` ou `ECHEC`

Actions :

- elargir la plage de disponibilites du professeur ;
- corriger les indisponibilites salles ;
- verifier les groupes impactes et les plafonds hebdomadaires ;
- accepter que les seances retirees doivent etre regenerees ou replanifiees
  manuellement.

## 13. Notes d'alignement avec le code actuel

- la route SSE reelle est `GET /api/scheduler/generer-stream` ;
- `inclure_weekend` est expose mais neutralise dans le moteur principal ;
- le recuit simule est present dans le depot mais inactif dans le flux final ;
- la generation complete ecrit dans `rapports_generation`, pas la generation ciblee ;
- `SchedulerReportService` enrichit les rapports avec suggestions manuelles,
  professeurs compatibles et salles compatibles ;
- la replanification locale peut retirer des seances invalides pour conserver un
  horaire coherent ;
- `assurerSchemaSchedulerAcademique()` est ignore en environnement de test.
