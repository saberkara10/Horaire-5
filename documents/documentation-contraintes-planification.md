# Documentation - Contraintes de planification

## Regles appliquees

- Les groupes ne sont plus importes depuis Excel. Ils sont formes automatiquement pendant la generation a partir de `programme`, `etape`, `session` et `annee`.
- Les groupes sont repartis de maniere equilibree avec un objectif de `8` a `25` etudiants par groupe lorsque l'effectif de la cohorte le permet.
- La generation active de la page `Generer` est maintenant equilibree par cohorte: chaque groupe doit recevoir le meme ensemble de cours pour la session selectionnee.
- Une session academique peut maintenant etre definie avec une `date_debut` et une `date_fin`.
- Le planning genere devient un modele hebdomadaire repete sur toute la periode de session.
- Des `dates bloquees` peuvent etre ajoutees apres generation pour retirer les cours d'une date precise.
- Un professeur ne peut pas depasser `3` groupes sur une meme session generee.
- Un professeur ne peut pas enseigner plus de `2` cours differents sur une meme session generee.
- Un professeur ne peut pas etre affecte sur deux creneaux qui se chevauchent.
- Les disponibilites et absences professeur sont respectees, weekend inclus.
- Un professeur doit etre compatible avec le cours via ses cours assignes.
- Une salle ne peut pas etre affectee sur deux creneaux qui se chevauchent.
- Une salle doit etre disponible a la date demandee.
- Le type de salle doit correspondre au type du cours.
- La capacite de la salle doit etre suffisante pour l'effectif du groupe.
- Un groupe ne peut pas avoir deux cours au meme moment.
- Les cours en ligne sont planifies sans salle.

## Limites connues

- Le moteur actuel gere les conflits de groupe. Les cas de `cours echoues` et d'affectation individuelle etudiant par etudiant demandent un modele dedie supplementaire, car l'horaire existant est groupe-centrique.
- La duree d'un cours reste fixe a `3 heures`.
- La regle historique `max 3 groupes par cours` n'est plus appliquee dans la generation equilibree de cohorte, car elle est incompatible avec l'objectif "chaque groupe suit tous les cours de la session".
- La suppression d'une date bloquee ne replanifie pas automatiquement les cours supprimes: elle retire seulement l'exception.
- La modification manuelle d'une affectation revalide les conflits, mais ne reconstruit pas automatiquement toutes les autres occurrences de la session.

## Fichiers relies

- Backend : [horaire.js](/c:/GDH/horaires-5/Backend/src/model/horaire.js)
- Frontend : [AffectationsPage.jsx](/c:/GDH/horaires-5/Frontend/src/pages/AffectationsPage.jsx)
- Import etudiants : [documentation-import-etudiants.md](/c:/GDH/horaires-5/documents/documentation-import-etudiants.md)
