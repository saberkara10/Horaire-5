# Documentation - Migrations et evolution de schema

## 1. Objet

Cette documentation couvre le systeme de migrations utilise par le projet pour
faire evoluer la base de donnees sans casser les modules applicatifs.

Le depot combine aujourd'hui deux mecanismes :

- des scripts de migration executes manuellement ;
- un bootstrap runtime qui assure certaines evolutions a l'execution.

## 2. Fichiers de reference

- `Backend/Database/run_migration.js`
- `Backend/Database/run-migration-v9.js`
- `Backend/Database/run-migration-v10.js`
- `Backend/Database/run-migration-v11.js`
- `Backend/Database/migration_v12.sql`
- `Backend/src/services/academic-scheduler-schema.js`

## 3. Role des scripts

### 3.1 Migration historique generale

`run_migration.js` applique la base fonctionnelle necessaire au projet :

- sessions ;
- prerequis ;
- cours echoues ;
- absences et indisponibilites ;
- rapports de generation ;
- enrichissements sur cours, groupes et utilisateurs.

### 3.2 Migrations ciblees recentes

- `run-migration-v10.js` : recurrences manuelles via `planification_series`
- `run-migration-v11.js` : echanges de cours entre etudiants
- `migration_v12.sql` : journal de replanification intelligente des affectations

## 4. Role du bootstrap runtime

`assurerSchemaSchedulerAcademique` complete le schema lorsque les flux avances
en ont besoin.

Il assure notamment :

- `affectation_etudiants`
- `echanges_cours_etudiants`
- l'evolution de `cours_echoues`
- `planification_series`
- `journal_modifications_affectations_scheduler`
- les index groupes par session

## 5. Pourquoi deux mecanismes

Le projet doit rester exploitable dans plusieurs contextes :

- base deja alimentee par un dump historique ;
- base mise a jour par scripts manuels ;
- environnement ou certaines evolutions recentes n'ont pas encore ete jouées.

Le bootstrap runtime reduit donc le risque de panne au demarrage sur les
modules avances.

## 6. Bonnes pratiques d'utilisation

1. executer d'abord les scripts de migration applicables a l'environnement ;
2. verifier que le backend demarre sans erreur de schema ;
3. laisser `assurerSchemaSchedulerAcademique` completer les details de
   compatibilite restants ;
4. ne pas supprimer manuellement les colonnes ou contraintes creees par ce service.

## 7. Tables et evolutions critiques

### 7.1 `affectation_etudiants`

Table de verite pour :

- reprises ;
- exceptions individuelles ;
- echanges de cours.

### 7.2 `echanges_cours_etudiants`

Journal metier des echanges executes entre deux etudiants.

### 7.3 `planification_series`

Supporte la recurrence explicite des planifications manuelles.

### 7.4 `cours_echoues.id_groupe_reprise`

Trace le groupe reel retenu pour une reprise planifiee.

### 7.5 `journal_modifications_affectations_scheduler`

Journalise les modifications intelligentes d'affectations avec :

- anciennes valeurs ;
- nouvelles valeurs ;
- rapport de simulation what-if ;
- portee appliquee ;
- utilisateur et date d'execution.

## 8. Limites actuelles

- il n'existe pas encore de registre unique de version de schema ;
- la logique est repartie entre scripts et bootstrap runtime ;
- les tests neutralisent volontairement le bootstrap runtime pour garder la
  maitrise du schema de test.

## 9. Points de vigilance

- tout changement sur `academic-scheduler-schema.js` doit rester idempotent ;
- les noms de contraintes et d'index doivent etre stables ;
- une migration script et le bootstrap runtime ne doivent pas entrer en conflit ;
- les nouveaux modules doivent documenter explicitement leurs dependances de schema.
