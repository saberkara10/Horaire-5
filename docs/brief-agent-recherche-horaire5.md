# Brief Agent De Recherche — HORAIRE 5

## Mission

Tu interviens comme un chercheur-ingénieur senior de très haut niveau sur `HORAIRE 5`, un système de planification académique avancé.  
Ta mission est de produire une analyse approfondie, critique, exhaustive et innovante du projet afin de :

- détecter tous les problèmes actuels,
- anticiper les problèmes futurs,
- identifier les limites métier, techniques, UX et opérationnelles,
- proposer des solutions concrètes, robustes et professionnelles,
- élever le projet à un niveau crédible pour une présentation devant une grande entreprise type Oracle / IBM.

Tu ne dois pas te limiter aux problèmes déjà connus.  
Tu dois aussi trouver les angles morts, les faiblesses structurelles, les risques non encore traités, les cas limites, les incohérences métier potentielles et les améliorations à fort impact.

## Contexte Projet

`HORAIRE 5` est une application full stack de gestion d’horaires académiques.

Le projet gère notamment :

- les sessions académiques,
- les cours,
- les professeurs,
- les salles,
- les groupes d’étudiants,
- la génération automatique d’horaires,
- les cours échoués à reprendre,
- l’affichage des horaires par professeur, groupe et étudiant,
- l’historique et les rapports de génération.

L’objectif métier est d’obtenir des horaires académiques cohérents, stables, explicables et exploitables en contexte réel.

## Stack Et Architecture

### Backend

- Node.js
- Express
- MySQL
- Architecture orientée services

### Frontend

- React
- Vite

### Modules clés

- `Backend/src/services/scheduler/SchedulerEngine.js`
- `Backend/src/services/scheduler/GroupFormer.js`
- `Backend/src/services/scheduler/FailedCourseEngine.js`
- `Backend/src/services/scheduler/FailedCourseDebugService.js`
- `Backend/src/services/scheduler/SchedulerReportService.js`
- `Backend/src/services/scheduler/SchedulerConfig.js`
- `Backend/routes/scheduler.routes.js`
- `Backend/routes/groupes.routes.js`
- `Frontend/src/pages/SchedulerPage.jsx`
- `Frontend/src/components/etudiants/EtudiantDetails.jsx`
- `Frontend/src/components/etudiants/EtudiantScheduleBoard.jsx`

### Tables importantes

- `sessions`
- `cours`
- `professeurs`
- `salles`
- `groupes_etudiants`
- `etudiants`
- `affectation_cours`
- `affectation_groupes`
- `affectation_etudiants`
- `cours_echoues`
- `rapports_generation`

## Règles Métier Actuelles À Respecter

### Cours échoués

Un cours échoué ne doit pas devenir un nouveau groupe artificiel.

Le modèle attendu est :

- un étudiant a un groupe principal,
- un étudiant peut avoir zéro, une ou plusieurs reprises,
- chaque reprise correspond à un seul cours échoué,
- chaque reprise est rattachée à un seul groupe réel existant de la session courante,
- l’étudiant suit uniquement ce cours avec ce groupe,
- il ne devient jamais membre complet de ce groupe,
- les conflits avec l’horaire principal et les autres reprises doivent être vérifiés,
- si aucun groupe n’est compatible, la cause doit être explicitée.

### Cours en ligne

Les cours en ligne sont temporairement désactivés par configuration :

- `ENABLE_ONLINE_COURSES = false`
- aucun cours en ligne ne doit être planifié dans cette version,
- le code doit rester réactivable proprement.

### Groupes et capacité

- capacité cible par groupe : environ `24–26`
- capacité max opérationnelle : `30`
- les reprises doivent compter dans la charge réelle par cours,
- si la demande réelle dépasse la structure existante, le système doit pouvoir créer de vrais groupes supplémentaires,
- la répartition doit rester homogène.

## État Actuel Du Projet

Des améliorations importantes ont déjà été faites :

- rattachement des reprises à des groupes réels,
- suppression de la logique `REC-*`,
- debug détaillé des reprises,
- rapport persistant après génération,
- affichage historique enrichi dans `Pilotage session`,
- distinction entre conflit horaire, absence de groupe réel et capacité,
- intégration de la charge des reprises dans la formation des groupes,
- augmentation de la capacité opérationnelle à `30`,
- désactivation configurable des cours en ligne,
- meilleure répartition de la charge enseignant.

## Problèmes Déjà Observés

Tu dois partir de ces problèmes connus, mais aller bien au-delà.

### Reprises non attribuées

Des cours échoués restent parfois sans groupe attribué.

Causes déjà constatées :

- aucun groupe réel n’offre le cours dans la session active,
- tous les groupes candidats sont pleins,
- tous les groupes candidats entrent en conflit avec l’horaire principal,
- combinaison de conflit horaire et de capacité.

### Cours non planifiés

Un volume important de cours peut rester non planifié après génération.

Exemple déjà observé :

- un rapport réel a montré `306` cours non planifiés sur la session active.

### Charge enseignant

La couverture enseignant reste un point critique :

- risque de plafonds trop stricts,
- risque de mauvaise distribution des professeurs,
- risque d’insuffisance de polyvalence par cours,
- risque de blocage si les disponibilités ne permettent pas assez de variantes.

### Données et cohérence

Le système peut être fragilisé par :

- données incomplètes,
- cohortes non utilisables,
- groupes historiques incohérents,
- relations incomplètes entre cours, groupes, professeurs et salles,
- règles implicites non modélisées explicitement.

## Ce Que Tu Dois Analyser En Profondeur

### 1. Solidité métier

Analyse si le modèle métier est vraiment cohérent, durable et extensible :

- groupes réguliers,
- reprises,
- affectations individuelles,
- sessions,
- variantes de génération,
- stabilité inter-générations,
- impact d’une régénération partielle,
- propagation des changements.

### 2. Qualité algorithmique

Analyse la qualité du moteur :

- formation des groupes,
- répartition des étudiants,
- équilibrage,
- sélection des professeurs,
- sélection des salles,
- gestion des conflits,
- stratégie de fallback,
- garanties de stabilité,
- performance sur de gros volumes.

### 3. Points de blocage actuels

Identifie exactement ce qui peut encore empêcher une génération de haute qualité :

- contraintes trop strictes,
- contraintes mal ordonnées,
- heuristiques sous-optimales,
- manque de variantes,
- mauvaise priorisation des cours difficiles,
- effet domino entre ressources rares,
- problème de qualité de données.

### 4. Risques futurs

Tu dois identifier les problèmes qui ne sont pas encore visibles mais qui apparaîtront probablement plus tard :

- montée en charge,
- explosion combinatoire,
- conflits de régénération ciblée,
- dérive de la qualité entre sessions,
- dette technique,
- manque d’auditabilité,
- difficultés de support métier,
- besoin de simulation avant validation,
- besoin de versionnement des horaires,
- besoin de rollback,
- besoin d’explicabilité avancée.

### 5. Données et base de données

Évalue :

- la qualité du modèle relationnel,
- les champs manquants,
- les contraintes d’intégrité manquantes,
- les index à ajouter,
- les risques d’incohérence,
- les tables qui devraient être historisées,
- les logs et traces qui devraient être persistés.

### 6. UX et exploitation

Analyse si l’interface permet réellement à un responsable académique de travailler efficacement :

- lisibilité des rapports,
- traçabilité des échecs,
- actionnabilité des diagnostics,
- compréhension des conflits,
- visibilité sur les causes racines,
- capacité à corriger manuellement,
- compréhension de l’impact d’une régénération.

### 7. Observabilité et pilotage

Propose une vraie vision d’exploitation :

- indicateurs de qualité,
- métriques de couverture,
- alertes,
- journalisation métier,
- dashboard de santé de génération,
- score de risque par session,
- score de tension sur les ressources rares,
- détection automatique des goulets d’étranglement.

### 8. Sécurité, robustesse, gouvernance

Analyse aussi :

- sécurité fonctionnelle,
- protection contre les actions destructrices,
- audit des actions admin,
- validation des entrées,
- contrôles d’accès,
- résilience en cas d’échec partiel,
- cohérence transactionnelle,
- stratégie de reprise après incident.

### 9. Innovation utile

Tu dois proposer des améliorations innovantes, réalistes et différenciantes, par exemple :

- moteur de simulation "et si",
- recommandations automatiques avant génération,
- détection prédictive des cours à risque,
- assistant de correction manuelle guidée,
- score d’explicabilité par décision,
- cartes de chaleur de conflits,
- moteur de variantes comparées,
- optimisation multi-objectifs,
- suggestions d’ouverture de groupes,
- suggestions de charge professeur,
- suggestions de reconfiguration de disponibilités,
- rapport exécutif premium pour direction.

## Attentes Très Concrètes

Je veux que tu me dises :

- ce qui ne va pas aujourd’hui,
- ce qui va casser demain si on ne le traite pas,
- ce qui est acceptable,
- ce qui est dangereux,
- ce qui est sous-modélisé,
- ce qui est techniquement fragile,
- ce qui est métierement ambigu,
- ce qui peut être professionnalisé fortement,
- ce qui peut rendre le projet réellement remarquable.

Je veux aussi que tu proposes :

- des solutions immédiates,
- des solutions moyen terme,
- des solutions structurantes long terme,
- des arbitrages réalistes entre complexité, coût et impact.

## Niveau D’Exigence

Je ne veux pas :

- un résumé vague,
- des idées génériques,
- des conseils théoriques déconnectés,
- des réponses superficielles.

Je veux :

- un raisonnement profond,
- un regard critique,
- des justifications solides,
- des propositions concrètes,
- des recommandations priorisées,
- un niveau crédible d’architecture logicielle professionnelle.

## Format De Réponse Exigé

Structure ta réponse exactement ainsi :

### 1. Diagnostic exécutif

- synthèse des points forts
- synthèse des faiblesses majeures
- niveau de maturité actuel du projet
- verdict professionnel global

### 2. Cartographie complète des problèmes

Pour chaque problème :

- identifiant
- catégorie
- description
- gravité
- impact métier
- impact technique
- cause racine probable
- preuve ou symptôme observable

### 3. Risques latents et futurs

Pour chaque risque :

- scénario
- probabilité
- impact
- déclencheur
- signal faible précurseur
- mesure préventive recommandée

### 4. Recommandations priorisées

Classe les recommandations en :

- `P0` critique immédiat
- `P1` très important
- `P2` structurant
- `P3` innovation / optimisation

Pour chaque recommandation :

- objectif
- bénéfice attendu
- effort estimé
- risque de mise en oeuvre
- ordre recommandé

### 5. Solutions innovantes

Propose au moins `10` améliorations innovantes et utiles, avec :

- idée
- valeur métier
- faisabilité
- complexité
- priorité

### 6. Feuille de route

Construis une roadmap :

- court terme `1–2 semaines`
- moyen terme `1–2 mois`
- long terme `3–6 mois`

### 7. Architecture cible

Décris l’architecture cible recommandée :

- modèle de données
- services
- moteur de génération
- moteur d’explication
- observabilité
- UX de pilotage

### 8. Tests et validation

Définis ce qu’il faut tester :

- métier
- algorithmique
- base de données
- API
- frontend
- performance
- robustesse

### 9. Points non demandés mais indispensables

Tu dois explicitement ajouter une section avec tout ce que nous aurions dû demander mais n’avons pas encore anticipé.

## Consignes De Travail

- Sois plus exigeant que nous.
- Remets en cause les hypothèses implicites.
- Cherche les failles cachées.
- Sois concret, défendable et rigoureux.
- N’hésite pas à proposer une évolution du modèle si elle est justifiée.
- Si une règle métier actuelle est insuffisante, dis-le clairement.
- Si un choix technique actuel est un compromis fragile, signale-le clairement.
- Si une opportunité forte d’innovation existe, développe-la.

## Bonus Attendu

À la fin, ajoute :

- les `10` questions stratégiques les plus importantes que l’équipe doit encore se poser,
- les `10` métriques de pilotage les plus utiles pour un responsable académique,
- les `5` plus gros risques de réputation projet si le système est déployé trop tôt,
- les `5` décisions d’architecture qui auraient le plus d’effet de levier.

