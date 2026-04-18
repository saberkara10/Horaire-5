# Conception - Module Cours

## 1. Objectif

Le module Cours doit rester le referentiel principal du catalogue pedagogique, exploitable :

- par le CRUD manuel ;
- par la planification ;
- par les affectations ;
- par un import Excel/CSV integre a la page existante.

La contrainte principale etait de ne pas casser les dependances du systeme autour des cours.

## 2. Principe d'integration

L'import n'introduit pas de nouvelle page. Il est integre a `Frontend/src/pages/CoursPage.jsx` via un composant mutualise :

- `Frontend/src/components/imports/ModuleExcelImportPanel.jsx`

Ce composant est utilise tel quel pour les modules Professeurs, Salles et Cours afin de conserver une UX et une maintenance homogenes.

## 3. Architecture backend

L'architecture retenue est la suivante :

- route : `Backend/routes/cours.routes.js`
- service metier d'import : `Backend/src/services/import-cours.service.js`
- service partage : `Backend/src/services/import-excel.shared.js`
- definition de contrat : `Backend/src/services/import-excel.definitions.js`
- persistance : `Backend/src/model/cours.model.js`

Le service d'import transforme les donnees Excel vers le meme modele metier que le CRUD manuel.

## 4. Reutilisation et factorisation

Le service `import-cours.service.js` reutilise directement :

- `recupererCoursParCode()`
- `ajouterCours()`
- `modifierCours()`
- `getSalleByCode()`

Le modele `cours.model.js` accepte maintenant un `executor` optionnel afin de fonctionner dans une transaction d'import sans dupliquer les requetes SQL existantes.

## 5. Resolution d'une ligne de cours

Chaque ligne est resolue selon ce flux :

1. validation des champs locaux ;
2. recherche de la salle de reference par `salle_reference_code` ;
3. verification optionnelle de `type_salle` ;
4. recherche d'un cours existant par `code` ;
5. creation, mise a jour ou ignore selon l'etat actuel.

Le `code` reste l'identifiant metier principal de synchronisation.

## 6. Raisons du controle sur la duree

L'import limite `duree` a `1..4` heures.

Ce choix n'est pas arbitraire. Il garantit que :

- les cours importes restent coherents avec le select manuel de `CoursPage.jsx` ;
- l'utilisateur peut corriger ensuite un cours importe depuis l'interface standard ;
- aucune divergence fonctionnelle n'apparait entre saisie manuelle et import.

## 7. Gestion de la salle de reference

Le cours n'importe pas un `id_salle_reference` brut. Il importe un `salle_reference_code`.

Avantages :

- format plus naturel pour l'utilisateur ;
- independance vis-a-vis des identifiants techniques ;
- alignement avec le role metier du code salle ;
- meilleure portabilite des fichiers Excel.

Le `type_salle` importe, s'il est present, joue uniquement un role de controle de coherence.

## 8. Strategie transactionnelle

Le lot est traite dans une transaction globale avec `SAVEPOINT` par ligne.

Cette strategie permet :

- d'importer les lignes valides ;
- de rejeter les lignes invalides ;
- d'eviter l'arret complet du lot ;
- de conserver la securite transactionnelle sur chaque ligne.

## 9. Experience utilisateur

L'utilisateur final voit :

- les colonnes attendues ;
- la strategie de traitement ;
- un telechargement du modele ;
- une confirmation avant import ;
- un resume numerique ;
- les erreurs ligne par ligne.

Le modal manuel existant reste disponible en parallele.

## 10. Non-regression

Risques principaux identifies :

- casser l'affichage des salles de reference ;
- introduire des cours impossibles a re-editer ;
- diverger du modele de validation manuel ;
- casser la planification qui depend des cours.

Mesures prises :

- reutilisation du modele SQL existant ;
- limitation volontaire de la duree aux valeurs deja supportees par l'UI ;
- verification stricte de la salle de reference ;
- rechargement des cours, programmes et salles apres import.

## 11. Validation

Tests associes :

- `Backend/tests/import-cours.service.test.js`
- `Backend/tests/cours.import.test.js`

Ils verifient le contrat de route, les erreurs de lecture et le comportement general du service.

## 12. Decision finale

Le module Cours conserve une architecture simple :

- meme page pour le CRUD et l'import ;
- meme coeur de persistance pour manuel et import ;
- meme structure metier pour la planification ;
- documentation et format de fichier explicites pour l'utilisateur.
