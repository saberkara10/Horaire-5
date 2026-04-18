# Conception - Module Professeurs

## 1. Objectif

Le module Professeurs doit permettre :

- la gestion CRUD manuelle des professeurs ;
- la gestion des cours autorises ;
- la gestion des disponibilites ;
- l'import Excel/CSV directement dans la page existante.

Le choix de conception a ete de **ne pas creer de nouvelle page** et de **ne pas dupliquer la logique metier** deja presente dans le backend.

## 2. Principe d'integration

L'import est integre dans `Frontend/src/pages/ProfesseursPage.jsx` via un composant reutilisable :

- `Frontend/src/components/imports/ModuleExcelImportPanel.jsx`

Ce composant :

- encapsule la selection du fichier ;
- telecharge le modele officiel ;
- demande la confirmation utilisateur ;
- affiche le resume de traitement ;
- ne remplace pas le formulaire manuel existant.

Le modal manuel de creation/modification reste intact.

## 3. Architecture backend

Le flux d'import repose sur quatre couches :

1. `professeurs.routes.js`
2. `import-excel.validation.js`
3. `import-professeurs.service.js`
4. `professeurs.model.js`

Responsibilities :

- la route gere les endpoints HTTP et les codes de retour ;
- le middleware upload controle la presence et l'extension du fichier ;
- le service d'import lit, valide, transforme et traite les lignes ;
- le modele conserve l'acces SQL et les regles de persistance deja utilisees par le CRUD.

## 4. Contrat de donnees

Source de verite backend :

- `Backend/src/services/import-excel.definitions.js`

Colonnes :

- `matricule` : obligatoire
- `nom` : obligatoire
- `prenom` : obligatoire
- `specialite` : optionnelle
- `cours_codes` : optionnelle

L'UI reprend ce contrat sous forme lisible dans `Frontend/src/config/importExcelModules.js`.

## 5. Strategie de persistance

Le service `import-professeurs.service.js` applique la strategie suivante :

- transaction globale pour le lot ;
- `SAVEPOINT` par ligne ;
- rollback limite a la ligne en echec ;
- commit final si le traitement complet se termine sans erreur fatale d'infrastructure.

Ce choix permet :

- de garder une trace ligne par ligne ;
- d'importer les lignes valides ;
- d'eviter une base partiellement corrompue ;
- de ne pas casser les flux CRUD existants.

## 6. Reutilisation de l'existant

Le service d'import reutilise directement :

- `ajouterProfesseur()`
- `modifierProfesseur()`
- `recupererProfesseurParMatricule()`
- `recupererProfesseurParNomPrenom()`
- `validerContrainteCoursProfesseur()`

Pour rendre cela possible sans duplication, le modele accepte maintenant un `executor` optionnel afin d'executer les memes fonctions :

- en mode standard avec le pool ;
- en mode transactionnel avec la connexion d'import.

## 7. Regles de resolution d'un professeur

Ordre de resolution :

1. recherche par `matricule` ;
2. recherche par `nom + prenom` ;
3. si les deux resolutions pointent vers deux lignes differentes, la ligne est rejetee ;
4. si aucune ligne n'existe, creation ;
5. sinon mise a jour ou ignore si aucune modification n'est necessaire.

Cette approche limite les doublons tout en respectant le modele metier existant.

## 8. Gestion des cours autorises

Si la colonne `cours_codes` est presente :

- chaque code est resolu en `id_cours` ;
- les cours archives sont refuses ;
- la contrainte metier globale sur les cours d'un professeur est validee ;
- la liste existante est remplacee par la nouvelle liste.

Si la colonne est absente :

- aucun changement n'est applique sur les cours autorises.

## 9. Experience utilisateur

L'UX retenue est volontairement simple :

- un panneau d'import dans la page Professeurs ;
- un bouton `Telecharger le modele` ;
- un bouton `Importer un fichier Excel` ;
- une confirmation explicite avant insertion ;
- un resume numerique et des details d'erreur apres traitement.

Cette conception evite de casser le parcours actuel des administrateurs.

## 10. Non-regression

Les points de non-regression identifies etaient :

- edition manuelle d'un professeur ;
- maintien de la vue liste ;
- maintien des affectations de cours ;
- maintien des disponibilites ;
- maintien des consommateurs du modele Professeurs.

La mitigation mise en place :

- aucune route existante n'a ete renommee ;
- aucune page existante n'a ete remplacee ;
- la logique d'import s'appuie sur les memes primitives SQL que le CRUD ;
- les tests couvrent le service et la route d'import.

## 11. Tests de conception valides

Les tests automatisés couvrent :

- succes d'import ;
- erreurs de format ;
- erreurs de colonnes ;
- import partiel ;
- routage HTTP et propagation des erreurs metier.

Fichiers :

- `Backend/tests/import-professeurs.service.test.js`
- `Backend/tests/professeurs.import.test.js`

## 12. Decision de conception finale

La fonctionnalite d'import Professeurs est concue comme une extension du module existant, pas comme un sous-systeme parallele.

Le resultat attendu est :

- un seul point d'entree utilisateur ;
- une logique backend factorisee ;
- une persistance robuste ;
- une maintenance simple a long terme.
