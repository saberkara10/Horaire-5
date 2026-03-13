# horaires-5 — Gestion des horaires (Backend)

Ce dépôt contient le backend Node.js (Express) du projet "Gestion des horaires". Le backend utilise MySQL pour la persistance des données, bcrypt pour la gestion sécurisée des mots de passe, express-session pour la gestion des sessions et Jest + Supertest pour les tests automatisés. Ce document explique comment cloner, configurer, démarrer et tester le projet sous Windows avec CMD.

Prérequis

Installer les outils suivants :
- Node.js (18 ou plus)
- npm (inclus avec Node.js)
- MySQL (8 ou plus)
- Git

Vérification dans CMD :

node -v
npm -v
mysql --version
git --version

Si une commande n’est pas reconnue, installer l’outil correspondant avant de continuer.

Récupération du projet (Git)

Ouvrir CMD et se positionner dans un dossier de travail, par exemple :

cd C:\Projets

Cloner le dépôt :

git clone URL_DU_REPO

Entrer dans le projet :

cd horaires-5
cd Backend

Toutes les commandes suivantes doivent être exécutées depuis le dossier Backend, sauf mention contraire.

Base de données MySQL

Le projet utilise une base nommée gestion_horaires. Le script SQL est fourni dans :
Backend\Database\GDH5.sql

Étape 1 : ouvrir MySQL

mysql -u root -p

Étape 2 : créer la base (dans MySQL)

CREATE DATABASE IF NOT EXISTS gestion_horaires;
exit;

Étape 3 : importer le schéma (dans CMD, depuis Backend)

mysql -u root -p gestion_horaires < Database\GDH5.sql

Optionnel : vérifier que les tables existent (dans MySQL)

mysql -u root -p

USE gestion_horaires;
SHOW TABLES;
SELECT * FROM utilisateurs;
exit;

Configuration du fichier .env

Créer un fichier Backend\.env avec ces variables (adapter DB_PASSWORD si nécessaire) :

PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_horaires
SESSION_SECRET=cle-secrete-longue
NODE_ENV=development

Notes importantes :
- DB_NAME doit être exactement gestion_horaires si vous importez GDH5.sql tel quel.
- SESSION_SECRET est obligatoire pour express-session.
- PORT peut être changé si 3000 est déjà utilisé.

Installation des dépendances (npm)

Dans Backend :

npm install

Cette commande installe toutes les dépendances, notamment :
- express (API)
- mysql2 (connexion MySQL)
- bcrypt (hash/compare des mots de passe)
- express-session (sessions)
- jest + supertest (tests)

Si npm install échoue, vérifier :
- Node.js installé correctement
- connexion Internet
- droits d’accès sur le dossier

Démarrage du serveur

Dans Backend :

npm run dev

ou :

npm start

Si le serveur démarre, l’API est accessible par défaut sur :

http://localhost:3000

Vérification rapide (navigateur)

Ouvrir :

http://localhost:3000/api/health

Réponse attendue :

{ "status": "OK" }

Si cette route ne répond pas, vérifier :
- le serveur est bien lancé (fenêtre CMD)
- le port configuré dans .env
- aucune erreur MySQL dans la console

Authentification, bcrypt et sessions

Le module d’auth utilise bcrypt et les sessions :
- bcrypt sert à comparer le mot de passe fourni avec le hash stocké en base (colonne motdepasse).
- express-session stocke l’utilisateur connecté dans request.session.user après login.

Routes d’auth disponibles :
- POST /auth/login
- GET /auth/me
- POST /auth/logout

Exemple de requête login (Body JSON) :
{
  "email": "admin@ecole.ca",
  "password": "Admin123!"
}

Si le login réussit, une session est créée, et /auth/me retourne l’utilisateur connecté.

Création d’utilisateurs (si scripts fournis)

Si le projet contient des scripts de création (ex: Backend\scripts\admin.js et Backend\scripts\responsable.js), ils peuvent être exécutés ainsi depuis Backend :

node scripts\admin.js
node scripts\responsable.js

Ces scripts hachent le mot de passe avec bcrypt et insèrent l’utilisateur dans la table utilisateurs.

Routes principales

API système :
- GET /api/health

Cours :
- GET /api/cours
- POST /api/cours
- PUT /api/cours/:id
- DELETE /api/cours/:id

Professeurs :
- GET /api/professeurs
- POST /api/professeurs
- PUT /api/professeurs/:id
- DELETE /api/professeurs/:id

Authentification :
- POST /auth/login
- GET /auth/me
- POST /auth/logout

Tests automatisés (Jest + Supertest)

Le projet contient des tests dans le dossier Backend\tests. Les tests utilisent Jest et Supertest.

Pour lancer tous les tests (depuis Backend) :

npm test

Résultat attendu :
- Test Suites: X passed
- Tests: Y passed

Si les tests échouent, causes fréquentes :
- MySQL non démarré
- fichier .env absent ou incorrect
- base gestion_horaires non importée
- variables DB_* invalides
- port occupé
- scripts de test pointent vers une mauvaise entrée (app/server)

Conseils de dépannage MySQL

Si l’application ne se connecte pas à MySQL :
- vérifier DB_HOST (127.0.0.1 ou localhost)
- vérifier DB_PORT (3306 par défaut)
- vérifier DB_USER / DB_PASSWORD
- vérifier DB_NAME (gestion_horaires)
- vérifier que le service MySQL est démarré (Services Windows)

Si le port 3000 est déjà utilisé :
- changer PORT dans .env, par exemple PORT=3001
- relancer npm run dev
- tester http://localhost:3001/api/health

Fin

Après avoir :
- cloné le dépôt
- importé GDH5.sql
- créé Backend\.env
- installé npm
- démarré le serveur
- exécuté npm test

Le backend est prêt à être utilisé localement.