# Guide d'installation - Gestion des horaires

Ce document explique comment installer et lancer le projet.

## 1. Recuperation du projet

```bash
git clone https://github.com/bedreddinerafik-jpg/horaires-5.git
cd horaires-5
```

## 2. Installation des dependances

```bash
npm install
cd Backend && npm install
cd ../Frontend && npm install
cd ..
```

## 3. Configuration du backend

Creer `Backend/.env` avec au minimum :

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

## 4. Base de donnees

Pour un nouveau testeur, il faut importer directement le fichier :

`Backend/Database/GDH5.sql`

Exemple :

```bash
mysql -u root -p < Backend/Database/GDH5.sql
```

Ce fichier :

- cree la base `gdh5`
- installe le schema complet attendu par le projet
- ajoute les donnees initiales utiles pour tester

## 5. Lancer le projet

Depuis la racine :

```bash
npm run dev
```

## 6. Acces

- Frontend : `http://localhost:5173`
- Backend : `http://localhost:3000`

## 7. Comptes par defaut

- Admin : `admin@ecole.ca` / `Admin123!`
- Responsable : `responsable@ecole.ca` / `Resp123!`

Changer ces mots de passe apres la premiere connexion si l'environnement sort
du cadre local.

## 8. Remarques

- Verifier que MySQL est demarre.
- Verifier `Backend/.env`.
- Le dossier `Backend/Database` est simplifie pour une installation neuve.
