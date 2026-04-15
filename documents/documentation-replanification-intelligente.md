# Documentation - Replanification intelligente

## 1. Objet

Cette documentation couvre l'API et le backend de modification intelligente
d'une affectation existante du scheduler.

Elle complete la planification manuelle classique : ici, toute mutation doit
passer par un dry-run explicable avant application reelle.

## 2. Fichiers de reference

- `Backend/src/services/scheduler/planning/ScheduleModificationService.js`
- `Backend/src/controllers/scheduler/ScheduleModificationController.js`
- `Backend/src/services/scheduler/simulation/ScenarioSimulator.js`
- `Backend/src/services/scheduler/planning/ScheduleMutationValidator.js`
- `Backend/routes/scheduler.routes.js`
- `Backend/Database/migration_v12.sql`

## 3. Endpoint

| Methode | Route | Usage |
|---|---|---|
| `POST` | `/api/scheduler/modify-assignment` | Replanifie une affectation existante apres simulation obligatoire |

## 4. Payload d'entree

```json
{
  "idSeance": 201,
  "modifications": {
    "id_salle": 3,
    "id_professeur": 20,
    "date": "2026-09-09",
    "heure_debut": "11:00:00",
    "heure_fin": "14:00:00"
  },
  "portee": "THIS_OCCURRENCE",
  "modeOptimisation": "equilibre",
  "confirmerDegradationScore": false
}
```

Champs supportes dans `modifications` :

- `id_salle` ou `idSalle`
- `id_professeur` ou `idProfesseur`
- `date`
- `heure_debut` et `heure_fin`

Champs explicitement refuses :

- `id_cours`
- `id_groupes_etudiants`

## 5. Portees

- `THIS_OCCURRENCE`
- `THIS_AND_FOLLOWING`
- `ALL_OCCURRENCES`
- `DATE_RANGE`

Exemple `DATE_RANGE` :

```json
{
  "portee": {
    "mode": "DATE_RANGE",
    "dateDebut": "2026-09-14",
    "dateFin": "2026-09-28"
  }
}
```

## 6. Reponse de succes

La reponse renvoie toujours trois blocs :

- `simulation` : rapport what-if complet avant ecriture ;
- `validation` : rappel du fait que la simulation obligatoire a ete executee ;
- `result` : mutations appliquees, historique et ressources impactees.

Exemple de structure :

```json
{
  "message": "Affectation modifiee avec succes.",
  "simulationObligatoireExecutee": true,
  "simulation": {
    "faisable": true,
    "difference": {
      "scoreGlobal": 4
    }
  },
  "warnings": [],
  "validation": {
    "simulationObligatoireExecutee": true,
    "scope": "THIS_OCCURRENCE"
  },
  "result": {
    "portee": "THIS_OCCURRENCE",
    "occurrences_modifiees": [],
    "historique": {
      "id_journal_modification_affectation": 1200
    }
  }
}
```

## 7. Regles metier clees

- aucune ecriture sans simulation prealable ;
- aucun contournement de `ScheduleMutationValidator` ;
- rollback complet si une ecriture SQL echoue ;
- les conflits groupe, professeur, salle et etudiant bloquent ;
- les reprises sont validees comme participants reels ;
- une forte degradation de score demande une confirmation explicite ;
- les nouvelles plages horaires sont recreees pour eviter les effets de bord.

## 8. Pourquoi snapshot + scoring

Le snapshot fige un etat officiel, clonable et stable. Il garantit que la
validation et le score avant/apres lisent exactement la meme realite metier.

Le scoring ne remplace pas la validation dure. Il sert a mesurer la qualite
relative d'une mutation faisable, notamment pour distinguer :

- un conflit bloquant ;
- une degradation de confort non bloquante ;
- une amelioration nette sur le mode cible.

## 9. Traçabilite et migration

La table `journal_modifications_affectations_scheduler` est creee par :

- `Backend/Database/migration_v12.sql` pour le schema versionne ;
- `assurerSchemaSchedulerAcademique` comme garde-fou runtime.

Cette table conserve l'etat avant/apres ainsi que le rapport de simulation qui
a justifie la modification appliquee.

## 10. Tests a retenir

- `Backend/tests/schedule-modification.service.test.js`
- `Backend/tests/scheduler.modify-assignment.routes.test.js`
- `Backend/tests/scenario-simulator.test.js`
- `Backend/tests/migration-engine.test.js`
