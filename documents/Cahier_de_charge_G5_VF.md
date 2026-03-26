# Cahier des charges : Application de gestion des horaires

## Équipe de développement

- Clément Jovani
- Bedreddine Rafik
- Kara Saber

---

## 1. Présentation du projet

### 1.1. Contexte

Dans un établissement d'enseignement comme le Collège La Cité, la gestion des horaires est une tâche importante qui nécessite la coordination des cours, des professeurs, des salles et des plages horaires. Lorsqu'elle est réalisée de manière manuelle ou avec des outils limités, cette gestion peut entraîner des conflits d'horaires et des erreurs, comme l'occupation d'une même salle par plusieurs cours ou l'indisponibilité des professeurs. Afin de faciliter le travail du personnel administratif et de réduire ces problèmes, il est nécessaire de mettre en place un système informatisé simple, rapide et fiable. Cette application web intuitive et centralisée permettra aux administrateurs et responsables administratifs de gérer les emplois du temps, les affectations des salles, les professeurs et les cours et les groupes étudiants.

### 1.2. Objectifs

Le projet a pour objectifs principaux de :
- Permettre aux administrateurs de gérer les comptes utilisateurs, les droits d'accès et les différents modules de l'application (cours, salles, professeurs, groupes étudiants)
- Permettre aux responsables administratifs à gérer les informations liées aux cours, salles et professeurs et étudiants
- Affectation structurée des cours aux salles et professeurs en fonctions des disponibilités et des contraintes
- Faciliter la coordination des différents horaires
- Réduire le temps consacré par l'administration à la planification des horaires
- Centraliser les informations des horaires dans une interface unique et intuitive
- Optimiser utilisation des salles
- Assurer la confidentialité des données utilisateurs
- Centraliser les informations horaires dans une vue graphique
- Permettre une visualisation claire des disponibilités via une vue calendrier
- Aider les utilisateurs à trouver rapidement les informations souhaitées

#### Critères de performance d'évaluation du projet

- Exiger une authentification pour toute action critique
- Offrir une application fiable et réactive
- Réduire les erreurs techniques
- Assurer la synchronisation correcte des informations (Création, modification et suppression de données)
- Utiliser des protocoles sécurisés (HTTPS)
- Protéger le système contre les injections
- Assurer une bonne qualité du code (Documentation, maintenabilité)
- Garantir un affichage correct et cohérent de l'application sur les navigateurs web récents

### 1.3. Périmètre du projet

Cette partie précise les éléments inclus dans le développement de l'application web de gestion des horaires du Collège La Cité et identifie les fonctionnalités exclues du projet afin de définir clairement son périmètre.

#### Inclus dans le projet

- Développement complet d'une application web accessible via les navigateurs récents
- Mise en place de modules de gestion CRUD complets (création, modification, suppression)
- Affectation des cours avec détection automatique des conflits
- Affectation des professeurs avec détection des conflits en temps réel
- Authentification sécurisée
- Gestion des utilisateurs (Administrateur et Responsable administratif)
- Interface simple et intuitive
- Interface responsive compatible avec ordinateurs, tablettes et appareils mobiles
- Vue calendrier permettant la visualisation des emplois du temps
- Intégration des étudiants à partir d'un fichier Excel fourni par l'administration
- Gestion des listes ou groupes d'étudiants
- Association des listes d'étudiants aux cours planifiés

#### Exclus du projet

- Gestions des absences et des retards
- Gestion complète du dossier scolaire de l'étudiant
- Intégration avec des systèmes externes (ex. portail étudiant)
- La gestion administrative et financière
- Aucun document pédagogique n'est stocké ou partagé
- Gestion des examens et évaluations
- Application mobile native

---

## 2. Description fonctionnelle

### 2.1. Besoins et exigences métiers

Le Collège La Cité exige une solution informatisée permettant de gérer efficacement la planification des cours, des salles et des professeurs. Les besoins exprimés portent principalement sur la réduction des erreurs humaines ainsi que sur l'amélioration globale de la planification des affectations des horaires, des salles et des enseignants.

#### Problématique à résoudre

Dans un établissement d'enseignement comme le Collège La Cité, la gestion des horaires constitue un enjeu organisationnel important. La coordination entre les cours, les salles, les professeurs et les plages horaires nécessite une attention constante afin d'éviter les conflits. Lorsque cette gestion repose sur des méthodes manuelles ou des outils non spécialisés, elle devient rapidement source d'erreurs, de pertes de temps et de confusion pour le personnel administratif.

#### Utilisateurs cibles

- Le responsable administratif, chargé de la gestion des horaires, de l'organisation des cours, des salles et des professeurs
- L'administrateur, responsable de la gestion des comptes utilisateurs, des droits d'accès et de la sécurité de la plateforme
- Les professeurs, qui consultent leurs horaires et leurs affectations de cours

#### Scénarios d'utilisation

**Cas d'utilisation 1 : Ajouter un professeur**

Le responsable administratif accède au module de gestion des professeurs et choisit d'ajouter un nouveau professeur. Il renseigne les informations personnelles et professionnelles du professeur, telles que le nom, le matricule, la spécialité ainsi que ses disponibilités. Le système valide les données saisies, vérifie l'unicité du matricule et s'assure de la cohérence des informations avant d'enregistrer le professeur. Une confirmation est ensuite affichée pour indiquer que l'ajout a été effectué avec succès.

**Cas d'utilisation 2 : Ajouter un cours**

Le responsable administratif accède au module des cours et choisit d'ajouter un nouveau cours. Il saisit les informations requises telles que le nom du cours, le code et la durée. Le système vérifie la validité des données avant d'enregistrer le cours.

**Cas d'utilisation 3 : Ajouter une salle**

Le responsable administratif accède au module de gestion des salles et sélectionne l'option permettant d'ajouter une nouvelle salle. Il saisit les informations relatives à la salle, notamment son nom ou numéro, sa capacité d'accueil ainsi que ses caractéristiques générales. Le système vérifie la validité des informations saisies et s'assure que la salle n'existe pas déjà dans la base de données. Une fois la validation effectuée, la salle est enregistrée et un message confirme la réussite de l'opération.

**Cas d'utilisation 4 : Assigner un professeur à un cours planifié**

Le responsable administratif sélectionne un cours déjà planifié et choisit un professeur parmi la liste des professeurs disponibles. Le système vérifie que le professeur est disponible durant la plage horaire du cours et qu'il n'est pas déjà affecté à un autre cours au même moment. Après validation des conditions, le professeur est assigné au cours et un message confirme la réussite de l'opération.

**Cas d'utilisation 5 : Planifier un cours dans l'horaire**

Le responsable administratif accède au module de planification et sélectionne un cours existant. Il choisit ensuite une salle disponible, une date ainsi qu'une plage horaire précise. Le système vérifie automatiquement la disponibilité de la salle et s'assure qu'aucun conflit d'horaire n'existe pour la plage sélectionnée. Si aucune incohérence n'est détectée, le cours est ajouté à l'horaire et l'opération est confirmée à l'utilisateur.

**Cas d'utilisation 6 : Créer une liste d'étudiants**

Le responsable administratif accède au module des étudiants et sélectionne l'option de création d'une liste. Il choisit les étudiants à partir de la liste disponible et attribue un nom au groupe. Le système enregistre la liste et affiche un message de confirmation.

**Cas d'utilisation 7 : Associer une liste d'étudiants à un cours planifié**

Le responsable administratif sélectionne un cours déjà planifié dans l'horaire et choisit une liste d'étudiants existante. Le système associe la liste au cours et enregistre l'opération. Une confirmation est affichée pour indiquer que l'association a été réalisée avec succès.

**Cas d'utilisation 8 : Consulter l'horaire d'un étudiant**

L'étudiant accède à la plateforme et consulte son horaire. Le système affiche les cours associés au groupe auquel l'étudiant appartient, ainsi que les informations liées aux salles et aux plages horaires. Cette consultation est disponible en lecture seule.

### 2.2. Fonctionnalités principales

Cette section décrit les fonctionnalités principales de l'application de gestion des horaires. Ces fonctionnalités constituent le cœur du système et permettent d'assurer une planification efficace, cohérente et sécurisée des cours, des salles et des professeurs. Chaque fonctionnalité est accessible uniquement après authentification et selon les permissions attribuées aux rôles des utilisateurs.

#### Gestion des utilisateurs

L'application doit permettre une authentification sécurisée par identifiant et mot de passe. L'administrateur peut créer, modifier et supprimer des comptes utilisateurs, ainsi qu'attribuer des rôles et des permissions. L'accès aux fonctionnalités est limité selon le rôle de l'utilisateur, et toutes les actions critiques sont protégées par un contrôle d'accès.

#### Gestion des cours

Le module des cours permet la création, la modification, la suppression et la consultation des cours. Chaque cours est défini par un code unique et des informations obligatoires. Le système offre des fonctionnalités de recherche et de filtrage afin de faciliter la gestion et la consultation des cours.

#### Gestion des salles

La gestion des salles permet d'ajouter, modifier, supprimer et consulter les salles. Chaque salle possède un code unique, un type et une capacité maximale. Le système vérifie la disponibilité et l'occupation des salles afin d'éviter les conflits lors de la planification.

#### Gestion des étudiants

La gestion des étudiants permet l'intégration des étudiants à partir d'un fichier Excel fourni par l'administration. Le système importe les données des étudiants, vérifie leur validité et évite les doublons avant l'enregistrement dans la base de données. Les étudiants sont organisés en listes ou groupes pouvant être associés aux cours planifiés. Cette fonctionnalité permet la consultation des horaires par les étudiants seule, sans inclure la gestion des notes, des présences ou des inscriptions académiques.

#### Gestion des professeurs

Le module des professeurs permet d'ajouter, modifier, supprimer et consulter les professeurs. Chaque professeur est associé à une spécialité et à des disponibilités. Les professeurs peuvent ajouter et mettre à jour leurs disponibilités, lesquelles sont prises en compte lors des affectations.

#### Gestion des emplois du temps

L'application permet de planifier les cours en les associant à une salle et à une plage horaire. Le système vérifie automatiquement la disponibilité des salles et détecte les conflits d'horaires. Les emplois du temps sont consultables à travers une vue calendrier claire et intuitive.

#### Affectation des professeurs

L'affectation des professeurs aux cours planifiés est réalisée en tenant compte de leur disponibilité et de leur spécialité. Le système empêche les doubles affectations et signale toute incohérence avant validation.

#### Gestions des étudiants dans les cours

Le système vérifie également les conflits d'horaires liés aux groupes d'étudiants afin d'éviter qu'un même groupe soit associé à deux cours sur la même plage horaire.

#### Sécurité et contrôle

La plateforme applique une authentification obligatoire et un contrôle d'accès strict. Les données sont validées et protégées contre les accès non autorisés. Les actions sensibles sont sécurisées afin de garantir l'intégrité et la confidentialité des informations.

### 2.3. Interface Utilisateur

L'interface utilisateur doit permettre une prise en main rapide et efficace de l'application. Elle doit être intuitive, ergonomique et adaptée aux besoins des utilisateurs administratifs, tout en garantissant un accès sécurisé aux différentes fonctionnalités.

#### Ergonomie et design de l'interface

- Interface simple et facile à utiliser
- Navigation claire organisée par fonctionnalités
- Design sobre et professionnel
- Temps de réponse rapide de l'interface
- Cohérence visuelle entre les écrans
- Actions principales facilement identifiables

#### Technologies recommandées

- CSS3
- HTML5
- JavaScript
- React.js
- Node.js
- Express

#### Wireframes

Les wireframes ne sont pas integres dans cette version Markdown, car les fichiers images associes ne sont pas presents dans le dossier `documents`.

La version `.docx` du cahier des charges reste la reference visuelle quand les captures doivent etre consultees.

### 2.4. Conditions d'utilisation

L'utilisation de l'application s'effectue dans un environnement professionnel lié à l'administration scolaire. Elle facilite la gestion des ressources pédagogiques dans des conditions contrôlées et définies.

#### Environnements d'utilisation

- Accès à l'application sans installation locale
- Accès depuis un poste informatique (PC ou Mac)
- Consultation et gestion des horaires à distance
- Utilisation dans un contexte administratif académique
- Accès sécurisé depuis des appareils autorisés

#### Contraintes d'utilisation

- Déconnexion automatique après une période d'inactivité
- Respect des permissions définies pour chaque utilisateur
- Connexion Internet nécessaire pour accéder à la plateforme
- Accès réservé aux utilisateurs autorisés
- Interdiction de modification non autorisée
- Accès bloqué sans identification

#### Limites d'utilisation

- Utilisation réservée aux utilisateurs authentifiés
- Aucune utilisation publique sans authentification
- Les performances peuvent dépendre de la qualité de la connexion Internet
- Les fonctionnalités sont limitées au périmètre défini dans le cahier des charges

---

## 3. Description technique

### 3.1. Technologies à utiliser

Les technologies choisies sont adaptées à la création d'applications web dynamiques et faciles à maintenir dans un cadre académique.

#### Langages de programmation

- **HTML** : permet de structurer les pages web et d'organiser les différents éléments de l'interface utilisateur
- **CSS** : utilisé pour la mise en forme et le design de l'interface afin d'améliorer la lisibilité et l'ergonomie
- **JavaScript** : assure la logique applicative et permet la gestion des interactions côté client et côté serveur

#### Environnement et Framework

- **Node.js** : environnement d'exécution JavaScript côté serveur
- **Express.js** : Framework web pour la création de l'API et la gestion des routes
- **Visual Studio Code** : environnement de développement

#### Base de données

- **MySQL** : utilisée pour stocker les données de l'application, telles que les utilisateurs, les cours, les salles et les professeurs. Elle offre une solution simple et adaptée au projet

### 3.2. Architecture du système

L'application de gestion des horaires repose sur une architecture web de type client–serveur. Cette architecture permet de séparer clairement l'interface utilisateur de la logique métier, facilitant ainsi la maintenance et l'évolution du système.

#### Type d'architecture

- Architecture client–serveur
- Échange de données structuré
- Application web accessible via un navigateur
- Communication entre le client et le serveur via des requêtes HTTP

#### Composants du système

**Client (Frontend) :**
- Interface graphique permettant l'affichage des données
- Saisie des informations par l'utilisateur via des formulaires
- Gestion de l'affichage dynamique (listes, tableaux, calendrier)

**Serveur (Backend) :**
- Traitement des requêtes envoyées par le client
- Gestion des opérations de création, modification et suppression
- Coordination entre le client et la base de données

**Base de données :**
- Base de données MySQL
- Stockage des informations liées au système
- Mise à jour des données selon les actions effectuées
- Conservation des relations entre cours, salles et professeurs et étudiants

#### Tests serveurs

Les tests serveurs permettent de s'assurer du bon fonctionnement de l'application côté serveur, de la fiabilité des routes API et de la sécurité des données échangées entre le client et le serveur.

**Tests manuels :**
- **Postman** : Outil de tests manuels permettant de vérifier le fonctionnement des routes API et les réponses du serveur

**Tests automatisés :**
- **Jest + Supertest** : Outil de tests automatisés côté serveur permettant de tester les routes API, de vérifier les réponses HTTP du serveur et de valider les cas de succès et d'erreur

#### Flux de fonctionnement

Le fonctionnement de l'application repose sur un échange continu entre le client et le serveur. Lorsqu'un utilisateur effectue une action depuis l'interface, les données sont transmises au serveur pour traitement. Le serveur applique les règles métier, effectue les vérifications nécessaires et interagit avec la base de données pour récupérer ou enregistrer les informations. Une fois le traitement terminé, le serveur renvoie une réponse au client, qui affiche le résultat à l'utilisateur.

#### Intégration avec d'autres systèmes

- Pas d'échange de données avec d'autres plateformes
- Projet limité à son propre système
- Fonctionnement indépendant

### 3.3. Sécurité

La sécurité constitue un élément central de l'application de gestion des horaires afin de garantir la confidentialité, l'intégrité et la protection des données sensibles.

#### Sécurité des communications

La communication entre l'utilisateur et l'application est protégée. Les informations échangées ne sont pas visibles par des personnes non autorisées. Cette sécurité permet d'éviter la perte ou la modification des données lors de leur transmission. Elle assure un échange fiable entre le client et le serveur.

#### Accès et identification des utilisateurs

- Identification des utilisateurs avant l'accès à l'application
- Stockage sécurisé des mots de passe
- Limitation des actions possibles selon le profil utilisateur
- Accès accordé uniquement après validation des informations
- Blocage des accès non autorisés

#### Sécurité des données et stabilité du système

La base de données est protégée contre les accès non autorisés et les manipulations incorrectes. Les données saisies par les utilisateurs sont contrôlées avant d'être enregistrées afin d'éviter les erreurs et les utilisations abusives. L'utilisation de requêtes sécurisées permet de limiter les risques liés aux attaques courantes et de préserver l'intégrité des informations stockées.

#### Sécurité des mots de passe

- **Bcrypt** : Outil de sécurité utilisé pour le hashage des mots de passe avant leur stockage en base de données, garantissant qu'aucun mot de passe n'est enregistré en clair et renforçant la protection des données utilisateurs

### 3.4. Performance et scalabilité

- Support de plusieurs utilisateurs en même temps
- Stockage efficace des informations
- Traitement efficace des requêtes utilisateur
- Fonctionnement sans blocage de l'interface
- Réduction des temps d'attente pour l'utilisateur
- Chargement fluide des pages principales

---

## 4. Planification et livrables

### 4.1. Phases du projet

Le projet sera réalisé en une phase de préparation suivie de trois sprints de développement afin d'assurer une progression itérative et structurée.

#### Phase de préparation
**Durée estimée : 1 à 2 semaines**
- Analyse du cahier des charges
- Compréhension des besoins du client
- Réalisation des diagrammes et wireframes
- Définition des fonctionnalités principales
- Estimation du temps pour chaque fonctionnalité

#### Sprint 1 (Fonctionnalités de base)
**Durée : 4 semaines**
- Initialisation du projet Node.js et Express
- Création de la base de données MySQL
- Implémentation de l'authentification
- Connexion entre interface et serveur
- Gestion des utilisateurs et des rôles

#### Sprint 2 (Gestion métier et planification)
**Durée : 4 semaines**
- Gestion complète des cours, salles, professeurs
- Affectation des cours aux salles & cours aux horaires
- Tests des scénarios principaux
- Consultation des emplois du temps

#### Sprint 3 (Sécurité, qualité et finalisation)
**Durée estimée : 4 semaines**
- Sécurisation des accès et des routes
- Amélioration de l'interface
- Validation du projet
- Protection des données
- Tests fonctionnels globaux

### 4.2. Livrables attendus

- Application fonctionnelle prête à être utilisée
- Fonctionnalités principales disponibles
- Base de données prête à l'utilisation
- Dossier projet prêt pour une présentation académique
- État final du projet par rapport aux objectifs initiaux
- Dossier projet prêt pour une présentation académique

---

## 5. Modalités de validation

- **Tests d'acceptation utilisateur** : Réalisés avec un responsable administratif du collège
- **Tests serveur (API)** : réalisés avec Postman pour vérifier les routes (GET/POST/PUT/DELETE) et la communication avec MySQL
- **Vérification des fonctionnalités** : Toutes les exigences listées dans la section 2 doivent être couvertes
- **Tests de performance** : Mesure des temps de réponse sous charge simulée
- **Audit de sécurité** : Vérification des vulnérabilités courantes
- **Validation finale** : Signée par le superviseur du Collège La Cité

---

## 6. Conclusion

Ce cahier des charges précise les attentes, les contraintes et les livrables du projet de gestion des horaires. Il a pour objectif de proposer au Collège La Cité une solution numérique fiable, sécurisée et conviviale, destinée à remplacer les processus actuels. Les fonctionnalités non incluses dans le périmètre pourront faire l'objet d'évolutions ou d'extensions après la livraison du projet.

---


