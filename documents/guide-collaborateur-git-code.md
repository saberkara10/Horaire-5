# Guide collaborateur - Git prive et codebase HORAIRE 5

Ce document sert d'onboarding rapide pour une personne qui rejoint le projet.
Il resume ce qu'il faut savoir sur le depot Git prive, la structure du code, le demarrage local et les points de vigilance.

Etat observe dans le depot le 2026-04-09.

## 1. Vue d'ensemble

`HORAIRE 5` est une application full stack de gestion academique.

Le projet couvre principalement:

- l'authentification et les roles
- la gestion des cours
- la gestion des professeurs et de leurs disponibilites
- la gestion des salles
- l'import des etudiants
- la formation et la gestion des groupes
- la generation automatique d'horaires
- le rattachement des cours echoues a reprendre
- l'export PDF et Excel des horaires

Stack principale:

- Backend: Node.js, Express, MySQL, Passport, express-session
- Frontend: React, Vite
- Tests: Jest + Supertest cote backend

## 2. Depot Git prive

Le remote principal observe dans ce depot est:

```text
origin https://github.com/bedreddinerafik-jpg/horaires-5.git
```

Ce depot est prive. Pour travailler dessus, il faut:

1. avoir ete ajoute comme collaborateur sur GitHub
2. etre authentifie sur GitHub dans le terminal ou dans l'IDE
3. pouvoir cloner, fetch et push sur le remote `origin`

Si l'acces n'est pas encore accorde, les operations Git distantes vont echouer meme si le code local est complet.

## 3. Etat Git observe

Branches observees le 2026-04-09:

- `main`
- `saber`
- `Jovani` sur le remote
- `backup_avant_reset`

Point important:

- `origin/HEAD` pointe vers `main`
- la branche `saber` a ete utilisee activement et contient des merges depuis `main`
- l'historique de commits n'est pas encore strictement normalise
- on voit a la fois des commits descriptifs, des merges et quelques commits tres generiques comme `.` ou `sprint 2 done`

Inference raisonnable:

- `main` semble etre la branche d'integration de reference
- `saber` est une branche de travail importante et recente

Recommendation pratique:

1. ne pas faire de `push --force` sur `main`, `saber` ou toute branche partagee sans validation explicite de l'equipe
2. faire un `git fetch --all --prune` avant toute nouvelle tache
3. verifier la branche active avec `git status --branch`
4. partir de `main` ou de la branche demandee par l'equipe avant de creer une branche de travail
5. garder des commits petits et lisibles meme si l'historique existant est heterogene

## 4. Workflow Git recommande pour un nouveau collaborateur

Workflow simple et sur:

```bash
git fetch --all --prune
git checkout main
git pull origin main
git checkout -b ton-sujet
```

Puis:

```bash
git status
git add <fichiers>
git commit -m "message clair"
git push -u origin ton-sujet
```

Avant de fusionner:

- relire `git diff`
- verifier si la branche cible a bouge
- eviter les gros commits melangeant backend, frontend, dist, logs et docs sans raison

## 5. Particularites du depot a connaitre avant de coder

Le `.gitignore` est minimal:

- `node_modules/`
- `.env`
- `.vscode/`

Consequence directe:

- `Frontend/dist/` est versionne
- `Backend/coverage/` est versionne
- `backend-dev.out.log` et `backend-dev.err.log` sont versionnes
- plusieurs fichiers `documents/` de debug, de jeu de donnees et de test sont versionnes

En pratique:

- ne pas supposer que tous les fichiers generes sont jetables
- ne pas supprimer en bloc `dist`, `coverage`, `logs` ou `documents` sans verifier l'impact Git
- faire attention aux fins de ligne CRLF/LF sur Windows, car Git signale deja des conversions sur plusieurs fichiers

## 6. Arborescence utile

Structure generale:

```text
horaires-5/
  Backend/
  Frontend/
  documents/
  docs/
  package.json
```

### Backend

`Backend/` contient:

- `src/app.js`: configuration Express principale
- `src/server.js`: demarrage HTTP
- `db.js`: pool MySQL
- `routes/`: endpoints HTTP par domaine
- `src/model/`: acces aux donnees
- `src/validations/`: validations d'entree
- `src/services/`: logique metier et services transverses
- `src/services/scheduler/`: moteur academique avance
- `src/services/professeurs/`: replanification et disponibilites
- `tests/`: suite Jest backend
- `Database/`: dump SQL et scripts de migration

### Frontend

`Frontend/` contient:

- `src/App.jsx`: routage principal et garde de session
- `src/pages/`: ecrans applicatifs
- `src/components/`: composants UI et metier
- `src/services/`: appels API
- `src/utils/`: helpers frontend
- `src/styles/`: CSS par page et par composant
- `vite.config.js`: dev server et proxy vers le backend

### Documentation

Il existe deux zones de documentation:

- `documents/`: documentation fonctionnelle, conception, diagrammes, guides, jeux de donnees
- `docs/`: notes plus recentes ou complementaires

Si un comportement n'est pas clair, il faut regarder dans les deux.

## 7. Demarrage local

### Installation

Depuis la racine:

```bash
npm install
cd Backend && npm install
cd ../Frontend && npm install
```

Un raccourci existe a la racine:

```bash
npm run dev
```

Ce script lance backend et frontend en parallele via `concurrently`.

### Variables d'environnement backend

Le backend lit `Backend/.env`.

Variables minimales:

```env
PORT=3000
SESSION_SECRET=gdh_session_secret_2026
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=gdh5
DB_PORT=3306
CORS_ORIGIN=http://localhost:5173
```

Variables utiles pour le scheduler:

```env
ENABLE_ONLINE_COURSES=false
SCHEDULER_TARGET_GROUP_SIZE=26
SCHEDULER_MAX_GROUP_CAPACITY=30
SCHEDULER_MAX_GROUPS_PER_PROFESSOR=16
SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR=16
```

### Base de donnees

Source officielle des evolutions schema:

- `Backend/Database/migration_v1.sql` a `Backend/Database/migration_v11.sql`
- `Backend/Database/run-migrations.js`
- la table SQL `migrations`

Commande standard:

```bash
npm run migrate
```

Notes importantes:

- `Backend/Database/GDH5.sql` reste un snapshot historique, mais ce n'est plus la voie normale d'installation
- les anciens scripts `run_migration.js` et `run-migration-vX.js` sont deprecies et rediriges vers le moteur central

### Ports et proxy

- Frontend Vite: `http://localhost:5173`
- Backend Express: `http://localhost:3000`

Le frontend proxifie:

- `/api` vers `http://localhost:3000`
- `/auth` vers `http://localhost:3000`

## 8. Comptes et roles

Les roles observes dans le code:

- `ADMIN`
- `RESPONSABLE`
- `ADMIN_RESPONSABLE`

Regles cote backend:

- `userAuth`: utilisateur authentifie
- `userAdmin`: accepte `ADMIN`, `RESPONSABLE`, `ADMIN_RESPONSABLE`
- `userResponsable`: accepte `RESPONSABLE`, `ADMIN_RESPONSABLE`
- `userAdminOrResponsable`: accepte les trois

Comptes documentes dans le guide d'installation:

- admin: `admin@ecole.ca` / `Admin123!`
- responsable: `responsable@ecole.ca` / `Resp123!`

Mot de passe a changer apres connexion si le projet sort du cadre local.

## 9. Architecture backend

### Point d'entree

Le backend demarre depuis:

- `Backend/src/server.js`

La configuration applicative est centralisee dans:

- `Backend/src/app.js`

`app.js` initialise:

- `helmet`
- `compression`
- `express.json()`
- `cors`
- `express-session`
- `passport`
- les routes metier

### Authentification

Fichiers cles:

- `Backend/auth.js`
- `Backend/routes/auth.routes.js`
- `Backend/middlewares/auth.js`
- `Backend/src/model/utilisateur.js`
- `Backend/src/utils/passwords.js`

Le backend utilise:

- une strategie `passport-local`
- une session cookie nommee `sid`
- la serialisation/deserialisation utilisateur via Passport

Routes auth:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Organisation par domaine

Routes principales observees:

- `cours.routes.js`
- `professeurs.routes.js`
- `salles.routes.js`
- `etudiants.routes.js`
- `groupes.routes.js`
- `horaire.routes.js`
- `dashboard.routes.js`
- `scheduler.routes.js`
- `export.routes.js`
- `admins.routes.js`
- `admin.routes.js`

Point a noter:

- il existe a la fois `admin.routes.js` et `admins.routes.js`
- les deux touchent a l'administration
- il faut bien verifier quel module est utilise avant de modifier la gestion des comptes

### Pattern de code backend

Le pattern dominant est:

1. route Express
2. validation d'entree si necessaire
3. appel modele ou service
4. reponse JSON

La logique la plus simple vit dans `src/model/`.
La logique metier plus complexe vit dans `src/services/`.

## 10. Modules backend importants

### Etudiants

Fichier central:

- `Backend/routes/etudiants.routes.js`

Capacites principales:

- lister les etudiants
- lire un etudiant
- lire l'horaire complet d'un etudiant
- importer des etudiants depuis un fichier Excel
- supprimer les etudiants importes

Services utiles:

- `Backend/src/services/import-etudiants.service.js`
- `Backend/src/validations/import-etudiants.validation.js`

### Groupes

Le module groupes ne sert pas seulement a la lecture. Il gere aussi:

- creation manuelle
- nettoyage
- generation cible
- details d'un groupe
- planning du groupe
- affectation et deplacement d'etudiants
- generation d'horaire pour un groupe

Le fichier `Backend/routes/groupes.routes.js` est important et dense.

### Professeurs

Le module professeurs couvre:

- CRUD professeurs
- disponibilites
- replanification liee aux absences

Services utiles:

- `Backend/src/services/professeurs/availability-rescheduler.js`
- `Backend/src/services/professeurs/availability-replanning-journal.js`
- `Backend/src/services/professeurs/availability-temporal.js`

### Export

Le projet sait exporter les horaires:

- groupe en PDF et Excel
- professeur en PDF et Excel
- etudiant en PDF et Excel

Fichiers cles:

- `Backend/routes/export.routes.js`
- `Backend/src/services/ExportService.js`

## 11. Coeur technique du scheduler

Le sous-systeme le plus sensible du projet est dans:

- `Backend/src/services/scheduler/`

Fichiers principaux:

- `SchedulerEngine.js`: orchestrateur principal
- `ContextLoader.js`: chargement du contexte de generation
- `GroupFormer.js`: creation des groupes a partir des cohortes et reprises
- `ConstraintMatrix.js`: gestion des conflits et reservations
- `AvailabilityChecker.js`: compatibilite jours, salles, disponibilites
- `FailedCourseEngine.js`: rattachement des cours echoues
- `FailedCourseDebugService.js`: debug des reprises
- `SchedulerReportService.js`: lecture et enrichissement des rapports
- `SchedulerDataBootstrap.js`: bootstrap du dataset operationnel
- `SimulatedAnnealing.js`: optimisation
- `AcademicCatalog.js`: regles de structure academique
- `SchedulerConfig.js`: lecture des limites et toggles env

### Flux de generation observe

Le flux general est le suivant:

1. garantir le schema scheduler
2. lancer un bootstrap non bloquant du dataset operationnel
3. charger la session et toutes les donnees utiles
4. former les groupes avec `GroupFormer`
5. construire les matrices de contraintes
6. generer un motif hebdomadaire stable
7. rattacher les cours echoues avec `FailedCourseEngine`
8. optimiser la solution avec `SimulatedAnnealing`
9. persister les affectations et le rapport de generation

### Regles metier importantes deja visibles dans le code

- les cours en ligne sont desactives par defaut si `ENABLE_ONLINE_COURSES` n'est pas active
- la taille cible d'un groupe est 26
- la capacite operationnelle max d'un groupe est 30
- les cours echoues doivent etre rattaches a un groupe reel existant et non a un faux groupe artificiel
- la session active est centrale pour les affectations, rapports et exports

### Endpoints scheduler importants

Le backend expose notamment:

- `POST /api/scheduler/bootstrap`
- `GET /api/scheduler/generer-stream`
- `POST /api/scheduler/generer`
- `GET /api/scheduler/rapports`
- `GET /api/scheduler/rapports/:id`
- `GET /api/scheduler/sessions`
- `POST /api/scheduler/sessions`
- `PUT /api/scheduler/sessions/:id/activer`
- `GET/POST/DELETE /api/scheduler/cours-echoues`
- `GET /api/scheduler/debug/reprises`
- `GET/POST/DELETE /api/scheduler/absences`
- `GET/POST/DELETE /api/scheduler/salles-indisponibles`
- `GET/POST/DELETE /api/scheduler/prerequis`

## 12. Architecture frontend

Le frontend est une SPA React.

Point d'entree:

- `Frontend/src/main.jsx`
- `Frontend/src/App.jsx`

Le composant `App.jsx` gere:

- la verification de session au chargement
- la conservation de l'utilisateur connecte
- les gardes de routes selon le role

### Navigation principale observee

Ecrans principaux:

- `DashboardPage`
- `CoursPage`
- `ProfesseursPage`
- `DisponibilitesProfesseursPage`
- `SallesPage`
- `EtudiantsImportPage`
- `AffectationsPage`
- `HorairesProfesseursPage`
- `HorairesGroupesPage`
- `EtudiantsPage`
- `GestionGroupesPage`
- `AdminsPage`
- `SchedulerPage`
- `AdminResponsablePage`

Le shell de navigation se trouve dans:

- `Frontend/src/components/layout/AppShell.jsx`

### Appels API frontend

Le service central est:

- `Frontend/src/services/api.js`

Caracteristiques importantes:

- tous les appels utilisent `credentials: include`
- les erreurs HTTP sont transformees en exceptions avec `message`, `status` et details utiles

Services frontend observes:

- `auth.api.js`
- `cours.api.js`
- `professeurs.api.js`
- `salles.api.js`
- `horaire.api.js`
- `groupes.api.js`
- `etudiants.api.js`
- `dashboard.api.js`
- `scheduler.api.js`
- `export.api.js`
- `admins.api.js`

## 13. Base de donnees et schema

Le projet s'appuie sur MySQL.

Elements a connaitre:

- `Backend/db.js` cree un pool de connexions
- la base attendue dans la doc actuelle est `gdh5`
- le schema canonique est pilote par la chaine de migrations versionnees
- `GDH5.sql` reste un snapshot historique de reference

Les migrations couvrent notamment:

- la table `affectation_etudiants`
- des indexes sur `groupes_etudiants`
- la colonne `id_groupe_reprise` sur `cours_echoues`

Implication pratique:

- si un bug touche les affectations individuelles ou les reprises, il faut verifier la version de schema en base via la table `migrations` et la migration concernee dans `Backend/Database/`

## 14. Tests

Les tests automatiques sont surtout cote backend.

Commande:

```bash
cd Backend
npm test
```

Observations:

- le backend utilise Jest en mode ESM
- `Backend/tests/setupTests.js` filtre une partie du bruit console
- il existe beaucoup de tests metier sur cours, groupes, horaires, import et scheduler
- je n'ai pas observe de suite frontend equivalente dans `Frontend/`

## 15. Documentation deja presente dans le repo

Dans `documents/`, il y a deja:

- un guide d'installation
- un guide de tests
- des documents de conception
- des documentations techniques par module
- des diagrammes Mermaid et SVG
- des jeux de donnees d'import Excel
- des traces de debug sur les reprises

Dans `docs/`, on trouve notamment:

- `guide-utilisation-horaires.md`
- `brief-agent-recherche-horaire5.md`

Pour comprendre une fonctionnalite rapidement, commencer en general par:

1. le document correspondant dans `documents/`
2. la route backend du module
3. le service associe
4. la page frontend reliee

## 16. Points de vigilance techniques

Ce qu'un nouveau collaborateur doit savoir tout de suite:

- le scheduler est la zone la plus complexe et la plus sensible du projet
- la base de donnees est essentielle pour presque tout, donc il faut toujours verifier l'etat de la session active
- le repo versionne aussi des artefacts generes, ce qui augmente le risque de commits parasites
- la documentation est riche mais repartie entre `documents/` et `docs/`
- certaines zones historiques coexistent encore, par exemple `admin.routes.js` et `admins.routes.js`

## 17. Premiere checklist pour une nouvelle personne

1. obtenir l'acces GitHub au depot prive
2. cloner le repo et installer les dependances
3. creer `Backend/.env`
4. lancer `npm run migrate`
5. lancer `npm run dev` depuis la racine
6. verifier `http://localhost:5173` et `http://localhost:3000/api/health`
7. tester la connexion via `admin@ecole.ca` ou `responsable@ecole.ca`
8. lire ce document puis le guide d'installation et le guide de tests
9. regarder `Backend/src/app.js`, `Frontend/src/App.jsx` et `Backend/routes/scheduler.routes.js`
10. avant toute modification, verifier la branche courante et l'etat Git

## 18. Fichiers a lire en priorite

Si tu dois comprendre le projet vite, lis dans cet ordre:

1. `Backend/src/app.js`
2. `Frontend/src/App.jsx`
3. `Backend/routes/scheduler.routes.js`
4. `Backend/src/services/scheduler/SchedulerEngine.js`
5. `Backend/src/services/scheduler/GroupFormer.js`
6. `Backend/src/services/scheduler/FailedCourseEngine.js`
7. `Backend/src/services/scheduler/SchedulerReportService.js`
8. `Backend/routes/groupes.routes.js`
9. `Backend/routes/etudiants.routes.js`
10. `Frontend/src/components/layout/AppShell.jsx`

## 19. Resume ultra-court

Si tu ne retiens que l'essentiel:

- repo GitHub prive, acces collaborateur obligatoire
- backend Express + MySQL, frontend React + Vite
- le scheduler est le coeur metier complexe
- la session active gouverne une grande partie du comportement
- attention: des artefacts generes sont versionnes dans Git
- commence toujours par verifier la branche, la DB locale et les docs existantes
