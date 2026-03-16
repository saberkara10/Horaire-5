# Guide de démarrage du projet Gestion des horaires
## Guide de prise en main pour un nouveau développeur

Bienvenue dans le projet **Gestion des horaires**.

Si tu récupères ce projet pour la première fois, ce document est là pour t’expliquer **quoi faire, dans quel ordre**, afin de réussir à exécuter le backend correctement sur ton ordinateur.

L’objectif n’est pas de t’expliquer toute l’architecture interne du code dès le début.  
L’objectif est d’abord de te montrer **les tâches concrètes à faire** pour :

- récupérer le projet depuis GitHub
- l’ouvrir dans VS Code
- installer les dépendances
- préparer la configuration
- préparer la base de données
- lancer le serveur
- tester que tout fonctionne

L’idée principale à retenir est la suivante :

**Quand tu arrives sur un projet existant, tu ne commences pas par coder.  
Tu commences par réussir à le faire fonctionner.**

---

# 1. Première tâche : récupérer le projet depuis GitHub

La première étape consiste à récupérer le projet sur ton ordinateur.

Pour cela, il faut utiliser **Git**.

Ouvre un terminal, par exemple :

- l’invite de commandes Windows
- PowerShell
- ou le terminal intégré de VS Code

Ensuite, place-toi dans le dossier où tu veux enregistrer le projet.

Par exemple :

```bash
cd Desktop
```

ou :

```bash
cd Documents
```

Quand tu es dans le bon dossier, clone le projet avec la commande suivante :

```bash
git clone https://github.com/bedreddinerafik-jpg/horaires-5.git
```

Cette commande va télécharger tout le projet sur ton ordinateur.

Quand le clonage est terminé, entre dans le dossier du projet :

```bash
cd horaires-5
```

À partir de ce moment, tu es dans la racine du projet.

---

# 2. Deuxième tâche : ouvrir le projet dans VS Code

Une fois dans le dossier du projet, ouvre-le dans Visual Studio Code.

Tu peux le faire avec la commande suivante :

```bash
code .
```

Si cette commande ne fonctionne pas sur ton ordinateur, ce n’est pas grave.  
Tu peux aussi ouvrir VS Code manuellement puis faire :

1. **File**
2. **Open Folder**
3. sélectionner le dossier du projet

Quand le projet est ouvert, tu peux voir sa structure dans la barre latérale gauche.

Tu dois normalement retrouver au minimum une structure semblable à celle-ci :

```text
gestion-horaires/
├── Backend/
├── Documents/
├── Frontend/
```

Le dossier qui nous intéresse en premier est le dossier **Backend**.

Pourquoi ?

Parce que c’est le backend qu’il faut faire fonctionner avant tout le reste.

---

# 3. Troisième tâche : entrer dans le dossier Backend

Maintenant que le projet est ouvert, il faut se placer dans le dossier qui contient le serveur.

Dans le terminal, exécute :

```bash
cd Backend
```

À partir de maintenant, toutes les commandes liées au serveur doivent être exécutées dans ce dossier.

Le point important ici est simple :

**si tu n’es pas dans `Backend`, les commandes npm peuvent ne pas fonctionner correctement.**

---

# 4. Quatrième tâche : installer les dépendances du backend

Quand un projet Node.js est cloné, les dépendances ne sont pas installées automatiquement.

Il faut donc les installer manuellement avec npm.

Dans le dossier `Backend`, exécute cette commande :

```bash
npm install
```

Cette commande lit le fichier `package.json` et installe toutes les bibliothèques nécessaires au projet.

Quand l’installation se termine, un dossier `node_modules` apparaît normalement dans `Backend`.

Ce dossier contient tous les paquets nécessaires au fonctionnement du backend.

Si la commande fonctionne bien, tu peux passer à l’étape suivante.

Si la commande échoue, vérifie les points suivants :

- Node.js est-il bien installé ?
- npm fonctionne-t-il correctement ?
- es-tu bien dans le dossier `Backend` ?
- y a-t-il une erreur précise affichée dans le terminal ?

Tu peux vérifier que Node.js et npm sont installés avec :

```bash
node -v
npm -v
```

Si une version s’affiche pour les deux, c’est bon.

---

# 5. Cinquième tâche : regarder les commandes disponibles dans package.json

Avant de lancer le projet, il est important de comprendre quelles commandes npm sont prévues.

Dans `Backend`, ouvre le fichier :

```text
package.json
```

Tu y trouveras une section appelée `scripts`.

Elle ressemble généralement à ceci :

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "test": "jest"
}
```

Cette section indique les commandes principales du projet.

Voici à quoi elles servent :

## Lancer le serveur normalement

```bash
npm start
```

## Lancer le serveur en mode développement

```bash
npm run dev
```

# 6. Sixième tâche : comprendre que le projet n’est pas encore prêt à démarrer

À ce stade, beaucoup de nouveaux développeurs pensent qu’ils peuvent directement faire :

```bash
npm start
```

Mais dans un projet avec base de données, il manque encore plusieurs choses.

Même si `npm install` est terminé, le projet n’est pas encore prêt.

Avant de lancer le serveur, il faut encore :

- créer le fichier `.env`
- démarrer MySQL
- créer la base de données
- importer le script SQL
- vérifier que la connexion à la base fonctionne

Autrement dit :

**l’installation npm seule ne suffit pas pour exécuter ce projet.**

---

# 7. Septième tâche : créer le fichier .env

Le backend a besoin d’un fichier `.env`.

Ce fichier sert à stocker la configuration locale du projet, notamment :

- le port du serveur
- les informations de connexion à la base de données
- le secret utilisé pour les sessions

Le fichier doit être créé ici :

```text
Backend/.env
```

Dans VS Code :

1. clic droit sur le dossier `Backend`
2. cliquer sur **New File**
3. nommer le fichier exactement :

```text
.env
```

Ensuite, colle ce contenu dedans :

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=gestion_horaires
DB_USER=root
DB_PASSWORD=


SESSION_SECRET=un_secret_tres_long_et_difficile_a_deviner
```

# 8. Huitième tâche : démarrer MySQL

Avant de lancer le serveur Node.js, il faut que MySQL soit actif.

Tu peux démarrer MySQL selon ton installation locale.

Par exemple :

- via MySQL Workbench
- via les services Windows
- via XAMPP ou WAMP si tu utilises cela

Le point important est simple :

**si MySQL n’est pas démarré, le backend ne pourra pas se connecter à la base.**

Avant d’aller plus loin, vérifie que tu peux ouvrir MySQL Workbench et te connecter à ton serveur local.

---

# 9. Neuvième tâche : créer la base de données du projet

Une fois MySQL démarré, il faut créer la base utilisée par le projet.

Ouvre MySQL Workbench.

Connecte-toi à ton serveur local.

Ensuite, ouvre un nouvel onglet SQL et exécute cette commande :

```sql
CREATE DATABASE IF NOT EXISTS gestion_horaires;
```

Cette commande crée la base si elle n’existe pas encore.

Pourquoi cette étape est importante ?

Parce que le backend attend une base nommée :

```text
gestion_horaires
```

Si cette base n’existe pas, la connexion échouera.

---

# 10. Dixième tâche : importer le fichier SQL du projet

Le projet contient un script SQL, généralement nommé :

```text
GDH5.sql
```

Ce fichier sert à créer les tables nécessaires au fonctionnement du backend.

C’est une étape indispensable.

Même si la base `gestion_horaires` existe, elle sera vide tant que le script SQL n’aura pas été importé.

## Méthode recommandée avec MySQL Workbench

Voici les étapes :

1. ouvrir **MySQL Workbench**
2. se connecter au serveur local
3. aller dans **Data Import**
4. choisir **Import from Self-Contained File**
5. sélectionner le fichier `GDH5.sql`
6. choisir la base cible `gestion_horaires`
7. cliquer sur **Start Import**

# 11. Onzième tâche : vérifier que la base contient bien les tables

Après l’importation, il faut vérifier que tout s’est bien passé.

Dans MySQL Workbench :

1. rafraîchis la liste des schémas
2. ouvre la base `gestion_horaires`
3. ouvre la section **Tables**

Tu dois voir apparaître les tables du projet.

Cette vérification est importante parce qu’elle te confirme que la base est prête avant même de démarrer le backend.

---

# 12. Douzième tâche : tester d’abord la connexion à la base

Avant de lancer complètement le serveur, il est conseillé de vérifier que Node.js peut bien se connecter à MySQL.

Cette étape permet de savoir rapidement si le problème vient :

- du `.env`
- de MySQL
- du mot de passe
- du nom de la base

Dans `Backend`, te trouve un fichier nommé :

```text
test-db.js
```


Ensuite, dans le terminal, exécute :

```bash
node test-db.js
```

Si tout est correct, tu dois voir un message comme :

```text
Connexion MySQL OK 
```

Cela signifie que :

- MySQL est bien démarré
- le `.env` est bien configuré
- la base existe
- les identifiants sont corrects


# 14. Quatorzième tâche : lancer le serveur backend

Quand les étapes précédentes sont faites, tu peux maintenant lancer le serveur.

Dans le dossier `Backend`, exécute :

```bash
npm start
```

Si le projet possède un mode développement, tu peux aussi utiliser :

```bash
npm run dev
```

Le résultat attendu est que le serveur démarre sans erreur bloquante.

En général, il écoutera sur :

```text
http://localhost:3000
```

---

# 15. Quinzième tâche : vérifier que le serveur répond

Une fois le serveur lancé, tu peux faire une première vérification simple.

Dans ton navigateur, ouvre :

```text
http://localhost:3000
```

Selon la configuration du projet, cette page peut :

- afficher un petit message


# 16. Seizième tâche : commencer par tester les routes les plus simples

Quand un nouveau développeur arrive sur un projet, il ne doit pas commencer par les parties les plus complexes.

Il vaut mieux commencer par les routes les plus simples.

L’ordre conseillé est le suivant :

1. routes de lecture `GET`
2. routes de création `POST`
3. routes de modification `PUT`
4. routes de suppression `DELETE`
5. authentification en dernier

Cette méthode permet de valider progressivement que le backend fonctionne.

---

# 17. Dix-septième tâche : tester les routes avec Postman

Ouvre Postman.

Commence par une requête simple :

- méthode : `GET`
- URL :

```text
http://localhost:3000/api/cours
```

Puis clique sur **Send**.

Si le backend est bien lancé et que la base fonctionne, tu dois recevoir :

- un statut HTTP valide, souvent `200 OK`
- une réponse JSON

Ensuite, tu peux tester d’autres routes du même module.

## Lire un cours précis

```text
GET http://localhost:3000/api/cours/1
```

## Créer un cours

```text
POST http://localhost:3000/api/cours
```

Body JSON :

```json
{
  "code": "INF101",
  "nom": "Introduction a la programmation",
  "duree": 60,
  "programme": "Informatique",
  "etape_etude": 1,
  "type_salle": "Laboratoire"
}
```

## Modifier un cours

```text
PUT http://localhost:3000/api/cours/1
```

## Supprimer un cours

```text
DELETE http://localhost:3000/api/cours/1
```

Après cela, tu peux faire le même type de tests avec les professeurs et les salles. 

---


# 18.  lancer les tests automatisés

Une fois que :

- le backend démarre
- la base est connectée
- les premières routes répondent

tu peux lancer les tests automatiques.

Dans le dossier `Backend`, exécute :

```bash
npm test
```

Tu peux aussi exécuter un test précis, par exemple :

```bash
npx jest tests/cours.test.js
```

Cette étape vient après, car les tests servent à valider le comportement du projet, pas à remplacer toutes les étapes de préparation.

---



# 22. Résumé rapide des commandes principales

## Cloner le projet

```bash
git https://github.com/bedreddinerafik-jpg/horaires-5.git
cd horaires-5
```

## Ouvrir le projet

```bash
code .
```

## Entrer dans le backend

```bash
cd Backend
```

## Installer les dépendances

```bash
npm install
```

## Tester la connexion MySQL

```bash
node test-db.js
```

## Lancer le serveur

```bash
npm start
```

ou :

```bash
npm run dev
```

## Lancer les tests

```bash
npm test
```

---

# 23. Conclusion

Si tu suis ce guide dans l’ordre, tu peux faire fonctionner le projet sans avoir besoin de deviner par où commencer.

La règle la plus importante est celle-ci :

**commence par préparer l’environnement du projet, pas par modifier le code.**

Quand le backend tourne correctement, que la base répond et que les premières routes fonctionnent, tout devient beaucoup plus simple à comprendre pour la suite.

---

Fin du guide.