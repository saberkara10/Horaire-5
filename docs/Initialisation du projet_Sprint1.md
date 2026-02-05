## projet intégrateur 
## sprint 1- initialisation du projet 

# Backend – Gestion des Horaires
  Ce projet correspond à la phase d’initialisation du backend du projet intégrateur Gestion des horaires.
L’objectif principal de cette première étape est de mettre en place une base solide et organisée pour le serveur backend, afin de pouvoir développer des fonctionnalités plus avancées dans les prochains sprints.
le backend est développé avec Node.js et Express. Il met en place une API qui sera utilisée plus tard par la partie frontend pour gérer les horaires.

# objectif de cette etape  
Durant ce sprint, le travail a consisté à :

- Initialiser le projet backend
- Créer une structure claire et organisée
- Configurer Express
- Vérifier que le serveur démarre correctement
- Créer des routes API de test

Cette étape permet de s’assurer que le serveur fonctionne correctement avant d’ajouter la base de données et les fonctionnalités métier.

# fonctionnment du serveur 
Le serveur démarre sur le port 3000.
Une fois lancé, il est possible d’accéder aux routes de test à partir du navigateur ou d’un outil comme Postman.
Le message “Cannot GET /” est normal, car la route principale / n’est pas définie encore.

# Routes de test disponibles 
  1) Route de vérification du serveur
Une route de vérification a été créée pour confirmer que le serveur fonctionne correctement.
URL : /api/health
But : vérifier l’état du serveur
Résultat : retourne un JSON avec un statut et un message confirmant que le serveur est opérationnel.

   2) Route de test API
Une deuxième route de test est disponible pour valider le fonctionnement de l’API.
URL : /api/test
But : confirmer que les routes Express répondent correctement
Résultat : retourne un JSON confirmant que la route de test fonctionne.

Ces routes servent uniquement à des fins de validation pour cette première étape du projet.


# technologies utilisées 
Le projet utilise :
Node.js : environnement d’exécution du backend
Express : framework serveur pour construire l’API
dotenv : gestion des variables d’environnement
nodemon : redémarrage automatique du serveur pendant le développement
Git & GitHub : gestion et versionnage du code source
Jira : suivi des tâches et des sprints

## Structure du projet
Le projet est organisé de manière simple et logique afin de faciliter la compréhension et l’évolution du code.
À la racine du projet, on retrouve une séparation entre backend et frontend (le frontend sera développé plus tard).
Le dossier backend contient tout ce qui concerne le serveur et l’API.
Dans le backend, le dossier src regroupe le cœur de l’application.
src/app.js : configure Express, ajoute les middlewares et définit les routes (/api/health, /api/test).
src/server.js : démarre le serveur avec app.listen() et écoute sur le port défini (PORT ou 3000).
Cette séparation permet de garder un projet plus propre et facile à maintenir, surtout quand le projet va grandir.
Le fichier .env sert à configurer les variables d’environnement (ex : le port), ce qui rend le projet plus flexible et sécurisé.
Le fichier package.json contient les informations du projet ainsi que les dépendances nécessaires au fonctionnement du backend.


