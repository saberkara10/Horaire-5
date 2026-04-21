# Documentation - Module Salles

## 1. Perimetre

Le module **Salles** est actif dans le backend et le frontend existants. Il couvre :

- la creation manuelle ;
- la consultation ;
- la modification ;
- la suppression sous contrainte ;
- l'import Excel/CSV integre directement dans `SallesPage.jsx`.

La documentation precedente mentionnait un branchement incomplet du backend. Ce n'est plus le cas : les routes Salles sont bien disponibles dans l'application principale.

## 2. Composants impliques

### Backend

- `Backend/routes/salles.routes.js`
- `Backend/src/model/salle.js`
- `Backend/src/validations/salles.validation.js`
- `Backend/src/validations/import-excel.validation.js`
- `Backend/src/services/import-salles.service.js`
- `Backend/src/services/import-excel.shared.js`
- `Backend/src/services/import-excel.definitions.js`
- `Backend/src/services/import-excel-template.service.js`

### Frontend

- `Frontend/src/pages/SallesPage.jsx`
- `Frontend/src/components/imports/ModuleExcelImportPanel.jsx`
- `Frontend/src/config/importExcelModules.js`
- `Frontend/src/services/salles.api.js`
- `Frontend/src/styles/CrudPages.css`

## 3. Routes exposees

### CRUD et occupation

- `GET /api/salles`
- `GET /api/salles/types`
- `GET /api/salles/:id`
- `GET /api/salles/:id/occupation`
- `POST /api/salles`
- `PUT /api/salles/:id`
- `DELETE /api/salles/:id`

### Import Excel

- `GET /api/salles/import/template`
- `POST /api/salles/import`

## 4. Modele de donnees

Table `salles` :

- `id_salle`
- `code`
- `type`
- `capacite`

Dans la version actuelle du produit, l'import ne persiste pas de colonnes `campus`, `bloc`, `batiment` ou equivalentes car elles ne font pas partie du modele SQL courant.

## 5. Format attendu pour l'import

Colonnes obligatoires :

- `code`
- `type`
- `capacite`

Regles :

- `code` doit etre unique dans le fichier ;
- `capacite` doit etre un entier strictement positif ;
- `type` est normalise via la meme logique que le formulaire manuel.

Le modele officiel est telechargeable depuis la page **Salles**.

## 6. Strategie d'import

Strategie retenue : **import partiel**.

Fonctionnement :

1. verification du fichier ;
2. lecture Excel/CSV ;
3. validation des colonnes ;
4. validation ligne par ligne ;
5. transaction globale ;
6. `SAVEPOINT` par ligne ;
7. creation, mise a jour, ignore ou rejet detaille par ligne.

Cette strategie est adaptee au module Salles car une erreur sur une salle ne doit pas empecher l'integration de toutes les autres salles valides.

## 7. Regles metier appliquees

- si le `code` n'existe pas : creation ;
- si le `code` existe deja : mise a jour du `type` et de la `capacite` ;
- si les donnees importees sont identiques a la base : ligne ignoree ;
- si `capacite` est invalide : ligne rejetee ;
- si `code` ou `type` depassent les limites metier : ligne rejetee.

## 8. Resume retourne par l'API

```json
{
  "module": "salles",
  "strategie": "partielle",
  "statut": "partial",
  "message": "Import termine partiellement.",
  "total_lignes_lues": 6,
  "lignes_importees": 4,
  "lignes_creees": 2,
  "lignes_mises_a_jour": 2,
  "lignes_ignorees": 0,
  "lignes_en_erreur": 2,
  "erreurs": [
    "Ligne 5 : capacite invalide (0)."
  ],
  "ignores": []
}
```

Le frontend affiche ce resume dans la page Salles sans navigation supplementaire.

## 9. Comportement de l'interface

L'import est integre dans `Frontend/src/pages/SallesPage.jsx` :

- le bouton manuel `+ Ajouter une salle` reste disponible ;
- le panneau d'import presente les colonnes attendues ;
- le telechargement du modele est disponible ;
- un retour utilisateur detaille est affiche apres traitement ;
- la liste des salles est rechargee automatiquement apres import.

## 10. Compatibilite avec l'existant

Les garanties de non-regression sont les suivantes :

- le formulaire manuel n'a pas ete remplace ;
- la route `GET /api/salles/types` continue d'alimenter les selecteurs existants ;
- les affichages et recherches actuels restent bases sur la meme structure de donnees ;
- les fonctions du modele `salle.js` ont simplement ete rendues compatibles avec un executor transactionnel optionnel pour reutiliser le meme coeur SQL.

## 11. Gestion d'erreurs

Erreurs globales :

- aucun fichier fourni ;
- format de fichier non supporte ;
- fichier vide ;
- fichier illisible ;
- colonnes obligatoires manquantes.

Erreurs de ligne :

- code vide ;
- type vide ;
- capacite non numerique ou <= 0 ;
- doublon de code dans le fichier.

## 12. Validation et tests

Tests automatises associes :

- `Backend/tests/import-salles.service.test.js`
- `Backend/tests/salles.import.test.js`

Les cas verifies incluent :

- import nominal ;
- format invalide ;
- erreurs de lecture ;
- erreurs de capacite ;
- remontée des erreurs de service au niveau route.

## 13. Guide utilisateur

1. Ouvrir la page **Salles**.
2. Telecharger le modele si necessaire.
3. Completer les colonnes `code`, `type`, `capacite`.
4. Importer le fichier.
5. Lire le resume.
6. Corriger les lignes en erreur puis reimporter.

Toutes les salles importees restent modifiables via le modal manuel existant.
