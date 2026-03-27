# Documentation frontend

## Role du frontend

Le frontend fournit l'interface utilisateur du projet. Il est implemente avec React, React Router et Vite.

## Point d'entree

- `Frontend/src/main.jsx` initialise l'application ;
- `Frontend/src/App.jsx` gere la session et les routes principales.

## Organisation du dossier `Frontend/src`

- `components/layout` : structure commune de navigation ;
- `pages` : ecrans fonctionnels ;
- `services` : appels vers le backend ;
- `styles` : feuilles de style globales et specifiques.

## Pages presentes dans le depot

### `LoginPage`

- affiche le formulaire de connexion ;
- appelle `POST /auth/login` puis `GET /auth/me`.

### `DashboardPage`

- charge des donnees de synthese ;
- tente de lire cours, professeurs, salles et etudiants.

### `CoursPage`

- consomme le module `cours.api.js` ;
- permet les operations CRUD sur les cours.

### `ProfesseursPage`

- consomme le module `professeurs.api.js` ;
- permet les operations CRUD sur les professeurs.

### `SallesPage`

- consomme `salles.api.js` ;
- depend de routes backend non branchees dans l'entree par defaut.

### `EtudiantsImportPage`

- permet la selection d'un fichier etudiant ;
- depend de routes backend d'import non branchees dans l'entree par defaut.

### `PlanningEtudiantPage`

- affiche une vue liste et une vue calendrier ;
- depend de la route backend de planning etudiant, non branchee dans l'entree par defaut.

### `AffectationsPage`

- consomme `/api/groupes` et `/api/affectations` ;
- depend de routes backend non branchees dans l'entree par defaut.

## Services frontend

### `api.js`

Centralise les appels `fetch` et remonte les erreurs HTTP.

### `auth.api.js`

Expose :

- la connexion ;
- la lecture de l'utilisateur connecte ;
- la deconnexion.

### `cours.api.js`

Expose le CRUD du module cours.

### `professeurs.api.js`

Expose le CRUD du module professeurs.

### `salles.api.js`

Expose le contrat prevu pour le module salles.

### `etudiantsService.js`

Expose :

- la liste des etudiants ;
- l'import des etudiants ;
- le planning d'un etudiant.

## Configuration reseau

Le frontend utilise des chemins relatifs `/api/...` et `/auth/...`.

En developpement, `Frontend/vite.config.js` configure un proxy vers `http://localhost:3000`.

Le fichier `Frontend/.env.example` est present dans le depot, mais le code frontend actuel ne lit pas directement `VITE_API_BASE_URL`.

## Lancement

Depuis `Frontend` :

```bash
npm install
npm run dev
```

Application accessible sur `http://localhost:5173`.

## Limites actuelles

Le depot ne fournit pas encore :

- de tests frontend automatises ;
- une integration complete entre toutes les pages du frontend et le backend lance par defaut.
