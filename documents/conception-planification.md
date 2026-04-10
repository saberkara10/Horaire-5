# Conception de la planification standard

## 1. Objectif

La planification standard couvre le module `/api/horaires`.

Elle permet :

- de lire les affectations existantes ;
- de creer, modifier et supprimer une affectation ;
- de lancer une generation automatique simple sur une fenetre courte.

Le document de reference est aligne sur :

- `Backend/routes/horaire.routes.js`
- `Backend/src/model/horaire.js`

## 2. Positionnement dans le systeme

Ce module ne doit pas etre confondu avec le moteur intelligent expose sous `/api/scheduler`.

La planification standard est une couche plus directe :

- basee sur des validations synchrones ;
- orientee CRUD ;
- utile pour corriger, tester ou produire un premier horaire rapidement.

Le moteur intelligent, lui, gere une orchestration academique plus large.

## 3. Ressources manipulees

Une affectation standard relie :

- un cours ;
- un professeur ;
- une salle ;
- un groupe ;
- une plage horaire.

Les tables principales sont :

- `cours`
- `professeurs`
- `salles`
- `groupes_etudiants`
- `plages_horaires`
- `affectation_cours`
- `affectation_groupes`

## 4. Composants techniques

Le module est concentre dans `Backend/src/model/horaire.js`.

Les responsabilites principales y sont regroupees :

- verifications de compatibilite professeur/cours ;
- verifications de compatibilite salle/cours ;
- verification des conflits ;
- creation et mise a jour transactionnelle ;
- generation automatique simple.

## 5. Logique de validation

Avant toute ecriture, le module verifie :

- la presence des identifiants metier ;
- l'existence des ressources ;
- la disponibilite du professeur ;
- l'absence de conflit de groupe ;
- l'absence de conflit de salle ;
- l'absence de conflit de professeur ;
- la validite de la date et de la plage horaire.

La conception impose donc que l'affectation soit validee avant persistence,
et non corrigee apres coup.

## 6. Generation automatique simple

La fonction `genererHoraireAutomatiquement` fonctionne sur un principe plus direct
que le scheduler avance.

Elle :

- cible un `programme`, une `etape` et une `session` ;
- calcule ou cree les groupes compatibles de la cohorte ;
- parcourt une fenetre courte de `10` jours ;
- teste des creneaux de depart predefinis ;
- choisit professeurs et salles compatibles ;
- persiste les affectations creees.

Cette generation reste utile pour :

- des jeux de test ;
- des corrections rapides ;
- des environnements ou le moteur intelligent n'est pas encore requis.

## 7. Regles metier structurantes

- une affectation ne peut pas superposer un groupe deja reserve ;
- un professeur ne peut pas etre double-booke ;
- une salle ne peut pas etre double-bookee ;
- les salles doivent etre compatibles avec le type de cours et la capacite cible ;
- les professeurs doivent etre compatibles avec le cours et sous le plafond de charge hebdomadaire.

## 8. Relation avec les autres modules

- `groupes` fournit la cible pedagogique ;
- `professeurs` fournit la disponibilite et la compatibilite ;
- `salles` fournit les ressources physiques ;
- `etudiants` consomme indirectement les horaires de groupe ;
- `scheduler` constitue la version avancee et plus complete de la planification.

## 9. Conclusion

La planification standard est la couche de reservation et de correction rapide des horaires.

Elle reste volontairement plus simple que le moteur intelligent, mais elle conserve
les controles de coherence indispensables a l'integrite des affectations.
