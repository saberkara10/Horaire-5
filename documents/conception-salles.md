# Conception - Module Salles

## 1. Objectif

Le module Salles doit rester un referentiel simple, fiable et reutilisable par la planification.

La fonctionnalite ajoutee est un import Excel/CSV qui s'integre :

- dans la page existante `Frontend/src/pages/SallesPage.jsx` ;
- sans nouvelle page ;
- sans modification du parcours CRUD manuel.

## 2. Choix d'architecture

Le choix a ete de mutualiser la logique d'import avec les autres modules CRUD, au lieu de creer une implementation specifique aux salles.

Composants clefs :

- `import-excel.shared.js` : lecture, normalisation, resume, gestion des savepoints ;
- `import-excel.definitions.js` : contrat des colonnes ;
- `import-salles.service.js` : transformation et persistance du module ;
- `ModuleExcelImportPanel.jsx` : integration frontend reutilisable.

## 3. Flux technique

### Frontend

1. l'utilisateur reste dans `SallesPage.jsx` ;
2. il telecharge le modele ou selectionne son fichier ;
3. le composant demande une confirmation ;
4. le fichier est envoye a `POST /api/salles/import` ;
5. le resume s'affiche dans la meme page ;
6. la liste des salles est rechargee.

### Backend

1. la route valide l'upload ;
2. le service lit la feuille Excel/CSV ;
3. les entetes sont normalisees ;
4. les lignes sont validees ;
5. chaque ligne valide est traitee dans un `SAVEPOINT` ;
6. le resume final est renvoye au frontend.

## 4. Reutilisation du modele existant

L'import ne duplique pas la persistance SQL. Il reutilise :

- `getSalleByCode()`
- `addSalle()`
- `modifySalle()`

Le modele `salle.js` accepte maintenant un `executor` optionnel afin de fonctionner :

- avec le pool MySQL habituel pour le CRUD ;
- avec une connexion transactionnelle pour les imports.

## 5. Strategie de resolution

Une ligne de salle est resolue par `code`.

Cas de figure :

- code absent en base : creation ;
- code present avec differences : mise a jour ;
- code present sans difference : ignore ;
- ligne invalide : rejet detaille.

Ce choix respecte le fait que `code` est deja l'identifiant metier fort du module.

## 6. Contraintes metier retenues

- `code` obligatoire et unique dans le fichier ;
- `type` obligatoire ;
- `capacite` strictement positive ;
- pas de persistance de donnees annexes non presentes dans le modele SQL courant.

Cette decision evite d'introduire une dette technique autour de colonnes qui ne seraient ni affichees ni exploitees par la planification actuelle.

## 7. Experience utilisateur

L'import n'est pas traite comme une page separee. Il est concu comme une action contextuelle du module.

Objectifs UX :

- action claire ;
- aucun changement de navigation ;
- format attendu visible avant l'import ;
- resultat rassurant avec compteurs et erreurs explicites.

## 8. Non-regression

Risques identifies :

- casser la recherche des types de salles ;
- casser le formulaire manuel ;
- casser la lecture de l'occupation des salles ;
- diverger entre import et CRUD sur la normalisation du type.

Mesures prises :

- conservation des routes existantes ;
- reutilisation de `normaliserTypeSalle()` ;
- rechargement de la liste apres import ;
- absence de modification des contrats utilises par les autres pages.

## 9. Validation

Les tests automatisés couvrent :

- le service d'import ;
- le comportement HTTP des routes ;
- les erreurs de format ;
- les erreurs de lecture.

Fichiers :

- `Backend/tests/import-salles.service.test.js`
- `Backend/tests/salles.import.test.js`

## 10. Conclusion

La conception retenue pour Salles privilegie la simplicite :

- une integration directe dans la page existante ;
- un service d'import modulaire ;
- une persistance basee sur les primitives SQL deja en production ;
- une strategie partielle adaptee aux imports administratifs.
