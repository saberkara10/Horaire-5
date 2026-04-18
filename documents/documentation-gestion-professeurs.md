# Documentation - Module Professeurs

## 1. Perimetre

Le module **Professeurs** gere maintenant deux modes d'alimentation qui cohabitent :

- ajout et modification manuels dans `Frontend/src/pages/ProfesseursPage.jsx` ;
- import Excel/CSV integre directement dans la meme page, sans creation de nouvelle page.

Le comportement manuel existant reste inchange. L'import ajoute simplement une voie d'alimentation supplementaire, compatible avec la consultation, la modification et les affectations deja en place.

## 2. Composants impliques

### Backend

- `Backend/routes/professeurs.routes.js`
- `Backend/src/model/professeurs.model.js`
- `Backend/src/validations/professeurs.validation.js`
- `Backend/src/validations/import-excel.validation.js`
- `Backend/src/services/import-professeurs.service.js`
- `Backend/src/services/import-excel.shared.js`
- `Backend/src/services/import-excel.definitions.js`
- `Backend/src/services/import-excel-template.service.js`

### Frontend

- `Frontend/src/pages/ProfesseursPage.jsx`
- `Frontend/src/components/imports/ModuleExcelImportPanel.jsx`
- `Frontend/src/config/importExcelModules.js`
- `Frontend/src/services/professeurs.api.js`
- `Frontend/src/styles/CrudPages.css`

## 3. Routes exposees

### CRUD existant

- `GET /api/professeurs`
- `GET /api/professeurs/:id`
- `POST /api/professeurs`
- `PUT /api/professeurs/:id`
- `DELETE /api/professeurs/:id`
- `GET /api/professeurs/:id/cours`
- `PUT /api/professeurs/:id/cours`
- `GET /api/professeurs/:id/disponibilites`
- `PUT /api/professeurs/:id/disponibilites`
- `GET /api/professeurs/:id/disponibilites/journal`
- `GET /api/professeurs/:id/horaire`

### Import Excel

- `GET /api/professeurs/import/template`
- `POST /api/professeurs/import`

Les endpoints d'import reutilisent l'authentification et restent limites a la gestion administrative, comme les autres actions d'ecriture.

## 4. Format attendu pour l'import

Colonnes obligatoires :

- `matricule`
- `nom`
- `prenom`

Colonnes optionnelles :

- `specialite`
- `cours_codes`

Regles importantes :

- `cours_codes` accepte une liste separee par `;`, `,` ou retour ligne ;
- les codes de cours doivent deja exister dans le module **Cours** ;
- si la colonne `cours_codes` est absente du fichier, les affectations de cours existantes sont conservees ;
- si la colonne `specialite` est absente, la specialite existante est conservee ;
- si la colonne `specialite` est presente mais vide, la valeur existante est effacee.

Un modele officiel est telechargeable directement depuis la page Professeurs via le bouton `Telecharger le modele`.

## 5. Strategie d'import

Strategie choisie : **import partiel robuste**.

Fonctionnement :

1. le fichier est charge (`.xlsx`, `.xls`, `.csv`) ;
2. les entetes sont normalisees et les colonnes obligatoires sont verifiees ;
3. chaque ligne non vide est validee ;
4. les doublons internes au fichier sont rejetes ;
5. l'import ouvre une transaction globale ;
6. chaque ligne valide est traitee dans un `SAVEPOINT` dedie ;
7. une ligne en erreur est annulee seule, sans casser les lignes precedentes ;
8. le resume final retourne les creations, mises a jour, lignes ignorees et erreurs.

Cette strategie preserve la robustesse metier tout en evitant de bloquer un lot complet pour une seule ligne invalide.

## 6. Regles metier appliquees

- recherche d'un professeur existant d'abord par `matricule`, puis par `nom + prenom` ;
- detection d'un conflit si le matricule et l'identite pointent vers deux professeurs differents ;
- validation de l'unicite du matricule dans le fichier ;
- validation de la longueur et du format de `matricule`, `nom`, `prenom`, `specialite` ;
- verification que tous les `cours_codes` references existent et ne sont pas archives ;
- verification des contraintes de charge/cours via `validerContrainteCoursProfesseur()` ;
- remplacement des cours autorises uniquement si la colonne `cours_codes` est presente.

## 7. Resume retourne par l'API

Le endpoint `POST /api/professeurs/import` retourne un resume standardise :

```json
{
  "module": "professeurs",
  "strategie": "partielle",
  "statut": "partial",
  "message": "Import termine partiellement.",
  "total_lignes_lues": 12,
  "lignes_importees": 9,
  "lignes_creees": 5,
  "lignes_mises_a_jour": 4,
  "lignes_ignorees": 1,
  "lignes_en_erreur": 2,
  "erreurs": [
    "Ligne 7 : les cours INF999 sont introuvables."
  ],
  "ignores": [
    "Ligne 10 : aucune mise a jour necessaire pour le professeur P-2026-001."
  ]
}
```

Valeurs possibles pour `statut` :

- `success`
- `partial`
- `warning`

## 8. Comportement de l'interface

Dans `ProfesseursPage.jsx`, le panneau d'import :

- reste dans la page existante ;
- permet de telecharger le modele ;
- ouvre le selecteur de fichier ;
- demande une confirmation avant l'envoi ;
- affiche un resume numerique du traitement ;
- affiche les erreurs ligne par ligne ;
- recharge la liste des professeurs et des cours apres import reussi.

L'ajout manuel d'un professeur reste disponible via le bouton `+ Ajouter un professeur`.

## 9. Gestion d'erreurs

Erreurs de fichier gerees explicitement :

- aucun fichier fourni ;
- format non supporte ;
- fichier vide ;
- colonnes obligatoires manquantes ;
- fichier Excel/CSV illisible.

Erreurs ligne par ligne gerees explicitement :

- matricule, nom ou prenom invalides ;
- doublon de matricule dans le fichier ;
- cours inexistant ou archive ;
- conflit entre matricule et identite ;
- contrainte metier sur les cours autorises.

Le frontend affiche :

- une banniere de resultat ;
- un tableau de statistiques ;
- la liste des lignes en erreur ;
- la liste des lignes ignorees.

## 10. Compatibilite avec l'existant

Les points suivants ont ete preserves :

- creation manuelle d'un professeur ;
- modification manuelle depuis le modal existant ;
- consultation de la liste ;
- edition des cours autorises ;
- disponibilites et consultation horaire ;
- structure des routes CRUD existantes.

Pour eviter la duplication de logique SQL, les fonctions du modele Professeurs acceptent maintenant un executor optionnel afin de travailler aussi bien en appel direct qu'a l'interieur d'une transaction d'import.

## 11. Validation et tests

Cas verifies automatiquement :

- import reussi ;
- erreur de colonnes manquantes ;
- absence de fichier ;
- validation de service avec creations, mises a jour et erreurs ligne par ligne.

Fichiers de tests associes :

- `Backend/tests/import-professeurs.service.test.js`
- `Backend/tests/professeurs.import.test.js`

## 12. Guide utilisateur

1. Ouvrir la page **Professeurs**.
2. Cliquer sur `Telecharger le modele` si necessaire.
3. Completer le fichier avec les colonnes attendues.
4. Cliquer sur `Importer un fichier Excel`.
5. Confirmer l'import.
6. Lire le resume affiche.
7. Corriger les lignes en erreur puis relancer un import si besoin.

Les professeurs importes restent ensuite modifiables par le formulaire manuel standard.
