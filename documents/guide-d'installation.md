# Guide d'installation - Gestion des horaires

Ce document explique comment installer et lancer le projet.

---

## 1. Récupération du projet

Ouvrir un terminal :

git clone https://github.com/bedreddinerafik-jpg/horaires-5.git  
cd horaires-5  

---

## 2. Installation des dépendances

### Backend
cd Backend  
npm install  

### Frontend
cd Frontend  
npm install  

### Projet global
Revenir à la racine :

cd ..  
npm install  


## 3. Configuration du backend

Créer un fichier `.env` dans le dossier Backend :

PORT=3000
SESSION_SECRET=gdh_session_secret_2026
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=gdh5
DB_PORT=3306
CORS_ORIGIN=http://localhost:5173

---

## 4. Base de données

Démarrer MySQL puis , Importer le fichier `GDH5.sql` :

Méthode Workbench :
- ouvrir MySQL Workbench  
- importer le fichier SQL  

Méthode terminal :
mysql -u root -p < GDH5.sql  

---

## 5. Lancer le projet

Le projet permet de lancer le backend et le frontend en même temps.

Depuis la racine :

npm run dev  


## 6. Accès

Frontend : http://localhost:5173  
Backend : http://localhost:3000  

---

## 7. Compte administrateur

Email : admin@ecole.ca  
Mot de passe : Admin123!
## changer le mot de passe après connexion

---

## 8. Remarques

- Vérifier que MySQL est démarré  
- Vérifier le fichier `.env`  
- Vérifier les dépendances avec `npm install`  