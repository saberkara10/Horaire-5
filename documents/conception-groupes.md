# Conception du module Groupes

## 1. Objectif

Le module Groupes structure les cohortes qui servent de support a la planification.

Il gere :

- la lecture des groupes ;
- la creation manuelle ;
- le nettoyage des groupes vides ;
- la consultation du planning de groupe ;
- l'ajout, le retrait et le deplacement d'etudiants ;
- la generation ciblee d'horaires pour un groupe ou un ensemble de groupes.

Le point d'entree principal est :

- `Backend/routes/groupes.routes.js`

## 2. Role du module dans le systeme

Le groupe est l'unite pedagogique centrale entre :

- les etudiants ;
- les cours ;
- les affectations horaires ;
- les reprises de cours echoues ;
- les exports et tableaux de bord.

Sans groupe coherent, l'etudiant ne peut pas recevoir d'horaire collectif exploitable.

## 3. Types de groupes

Le module distingue deux familles :

- les groupes reels, qui portent la cohorte principale ;
- les groupes speciaux, utilises pour certaines logiques de reprise.

Cette distinction est materialisee par `groupes_etudiants.est_groupe_special`.

## 4. Composition technique

Les composants principaux sont :

- `Backend/routes/groupes.routes.js`
- `Backend/src/model/groupes.model.js`
- `Backend/src/services/academic-scheduler-schema.js`
- `Backend/src/services/scheduler/SchedulerEngine.js`

Le routeur contient une part importante de logique applicative :

- validations de capacite ;
- verification de compatibilite programme/etape ;
- transactions lors de l'ajout complet d'un etudiant ;
- orchestration de la generation ciblee.

## 5. Regles structurantes

### 5.1 Scope de session

Un groupe doit etre rattache a la session academique cible.

Le module gere explicitement :

- l'activation de session ;
- les noms de groupes par session ;
- l'unicite `(id_session, nom_groupe)`.

### 5.2 Cohesion pedagogique

Les operations de deplacement d'etudiant ou de creation manuelle imposent une
coherence sur :

- le programme ;
- l'etape ;
- la capacite maximale du groupe.

Le deplacement entre programmes differents ou etapes differentes est refuse.

### 5.3 Capacite

La capacite par defaut est limitee par `CAPACITE_MAX_GROUPE = 30`.

Le module refuse :

- l'ajout dans un groupe complet ;
- la creation d'un groupe avec une taille au-dela de la borne autorisee ;
- certains rattachements de reprises si la charge projetee depasse la capacite.

### 5.4 Priorite des routes Express

`groupes.routes.js` depend fortement de l'ordre de declaration des routes.

Les routes statiques doivent etre definies avant les routes parametrees pour
eviter qu'une route comme `/api/groupes/nettoyer` soit interpretee comme un `:id`.

Cette contrainte fait partie de la conception du module, pas seulement de son implementation.

## 6. Flux principaux

### 6.1 Consultation

Le module peut retourner :

- une liste simple ;
- une liste detaillee enrichie ;
- un detail de groupe ;
- le planning complet d'un groupe ;
- la liste des etudiants membres.

### 6.2 Ajout d'etudiant

Le cas `POST /api/groupes/:id/etudiants/creer-ajouter` est un flux riche :

- chargement du groupe cible ;
- verification de la capacite ;
- controle du matricule et de l'email ;
- insertion de l'etudiant ;
- enregistrement optionnel de cours echoues ;
- commit transactionnel.

### 6.3 Generation ciblee

Le module sert aussi de facade metier vers le scheduler avance :

- `POST /api/groupes/generer-cible`
- `POST /api/groupes/:id/generer-horaire`

Il peut donc declencher une generation du moteur intelligent sans passer par
le point d'entree global du scheduler.

## 7. Donnees manipulees

Tables principales :

- `groupes_etudiants`
- `etudiants`
- `affectation_groupes`
- `affectation_cours`
- `affectation_etudiants`
- `cours_echoues`
- `sessions`

## 8. Points de vigilance

- Le module combine lecture, ecriture et orchestration scheduler ; il ne faut pas le considerer comme un simple CRUD.
- La suppression d'un groupe detache d'abord les etudiants et nettoie les affectations liees.
- Les groupes sans etudiant peuvent etre nettoyes, mais uniquement s'ils ne portent plus d'affectation horaire.
- Les operations de deplacement et d'ajout ont un impact direct sur la qualite des generations futures.

## 9. Conclusion

Le module Groupes est la couche de cohesion academique du projet.

Il relie la structure des cohortes aux contraintes du moteur intelligent
et aux besoins de consultation terrain.
