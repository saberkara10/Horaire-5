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

Le mecanisme officiel est maintenant le moteur central de migrations.

Depuis la racine du projet :

```bash
npm run migrate
```

Cette commande :

- cree la base si elle n'existe pas
- cree la table `migrations`
- detecte les versions deja appliquees
- applique uniquement les migrations manquantes dans le bon ordre

`Backend/Database/GDH5.sql` reste un snapshot historique, mais ce n'est plus
la procedure normale d'installation.

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
- Relancer `npm run migrate` apres toute nouvelle migration versionnee.
