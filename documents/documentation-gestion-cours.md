# Documentation - Module Cours

## 1. Perimetre

Le module **Cours** gere :

- la creation manuelle de cours ;
- la consultation du catalogue ;
- la modification et la suppression ;
- l'import Excel/CSV integre directement dans `Frontend/src/pages/CoursPage.jsx`.

L'import a ete ajoute sans nouvelle page et sans casser le formulaire manuel deja utilise par l'application.

## 2. Composants impliques

### Backend

- `Backend/routes/cours.routes.js`
- `Backend/src/model/cours.model.js`
- `Backend/src/validations/cours.validations.js`
- `Backend/src/validations/import-excel.validation.js`
- `Backend/src/services/import-cours.service.js`
- `Backend/src/services/import-excel.shared.js`
- `Backend/src/services/import-excel.definitions.js`
- `Backend/src/services/import-excel-template.service.js`

### Frontend

- `Frontend/src/pages/CoursPage.jsx`
- `Frontend/src/components/imports/ModuleExcelImportPanel.jsx`
- `Frontend/src/config/importExcelModules.js`
- `Frontend/src/services/cours.api.js`
- `Frontend/src/styles/CrudPages.css`

## 3. Routes exposees

### CRUD existant

- `GET /api/cours`
- `GET /api/cours/options`
- `GET /api/cours/:id`
- `POST /api/cours`
- `PUT /api/cours/:id`
- `DELETE /api/cours/:id`

### Import Excel

- `GET /api/cours/import/template`
- `POST /api/cours/import`

## 4. Modele de donnees

Le module cours continue d'utiliser les champs metier deja exploites par la plateforme :

- `code`
- `nom`
- `duree`
- `programme`
- `etape_etude`
- `id_salle_reference`
- `type_salle` derive de la salle de reference
- `archive`

L'import alimente ces memes donnees afin de rester compatible avec la generation et les affichages existants.

## 5. Format attendu pour l'import

Colonnes obligatoires :

- `code`
- `nom`
- `duree`
- `programme`
- `etape_etude`
- `salle_reference_code`

Colonne optionnelle :

- `type_salle`

Regles :

- `duree` doit etre une valeur entiere comprise entre 1 et 4 ;
- `etape_etude` doit etre comprise entre 1 et 8 ;
- `salle_reference_code` doit pointer vers une salle existante ;
- si `type_salle` est fourni, il doit correspondre au type reel de la salle de reference.

Le modele officiel est telechargeable directement depuis la page **Cours**.

## 6. Strategie d'import

Strategie retenue : **import partiel transactionnel**.

Fonctionnement :

1. le fichier est verifie puis lu ;
2. les colonnes sont normalisees ;
3. les lignes sont validees ;
4. les doublons internes au fichier sont rejetes ;
5. chaque ligne valide est traitee dans un `SAVEPOINT` ;
6. les lignes valides sont creees ou mises a jour ;
7. les lignes invalides sont listees dans le resume final.

Cette approche est coherente avec la realite metier : un lot de cours peut contenir quelques erreurs sans devoir bloquer tout le catalogue.

## 7. Regles metier appliquees

- recherche d'un cours existant par `code` ;
- creation si le code n'existe pas ;
- mise a jour si le code existe deja ;
- ligne ignoree si les donnees sont deja identiques ;
- verification de l'existence de la salle de reference ;
- controle optionnel de coherence entre `type_salle` importe et type reel de la salle ;
- refus des durees hors plage pour rester compatibles avec l'UI manuelle actuelle.

## 8. Resume retourne par l'API

```json
{
  "module": "cours",
  "strategie": "partielle",
  "statut": "success",
  "message": "Import termine avec succes.",
  "total_lignes_lues": 4,
  "lignes_importees": 4,
  "lignes_creees": 2,
  "lignes_mises_a_jour": 2,
  "lignes_ignorees": 0,
  "lignes_en_erreur": 0,
  "erreurs": [],
  "ignores": []
}
```

## 9. Comportement de l'interface

Le panneau d'import de `CoursPage.jsx` :

- presente le format attendu ;
- permet le telechargement du modele ;
- confirme l'action avant envoi ;
- affiche le resume numerique du traitement ;
- liste les erreurs et lignes ignorees ;
- recharge les cours, programmes et salles apres import.

Le modal manuel `+ Ajouter un cours` reste disponible en permanence.

## 10. Compatibilite avec l'existant

Les points de compatibilite preserves sont :

- formulaire manuel de creation/modification ;
- affichage des salles de reference ;
- listes de programmes existantes ;
- affichage du catalogue ;
- dependances vers les modules de planification.

Pour eviter de diverger entre import et CRUD, `cours.model.js` expose les memes primitives SQL aux deux usages et accepte maintenant un executor optionnel pour les traitements transactionnels.

## 11. Gestion d'erreurs

Erreurs globales :

- fichier absent ;
- format de fichier non supporte ;
- fichier vide ;
- colonnes obligatoires manquantes ;
- fichier illisible.

Erreurs ligne par ligne :

- code duplique dans le fichier ;
- salle de reference introuvable ;
- `type_salle` incoherent avec la salle ;
- duree invalide ;
- etape invalide ;
- nom ou programme invalides.

## 12. Validation et tests

Tests automatises associes :

- `Backend/tests/import-cours.service.test.js`
- `Backend/tests/cours.import.test.js`

Ils couvrent notamment :

- import nominal ;
- erreur sur fichier vide ;
- absence de fichier ;
- remontée correcte des erreurs metier du service au niveau route.

## 13. Guide utilisateur

1. Ouvrir la page **Cours**.
2. Telecharger le modele si besoin.
3. Remplir les colonnes attendues.
4. Verifier que les salles de reference existent deja.
5. Importer le fichier.
6. Corriger les lignes en erreur si necessaire puis relancer l'import.

Tous les cours importes restent ensuite modifiables depuis le modal manuel existant.
