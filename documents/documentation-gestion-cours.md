# Documentation - Module de gestion des cours

## 1. Contexte et objectif

Ce document présente la conception fonctionnelle et technique du module **Cours** du projet **gestion-des-horaires**.

Objectifs du module :

- gérer le cycle CRUD complet des cours ;
- garantir la validité des données avant persistance ;
- assurer l'unicité du code cours ;
- protéger l'intégrité métier lors de la suppression d'un cours affecté.

## 2. Périmètre fonctionnel

Le module couvre les opérations suivantes :

- création d'un cours ;
- consultation de tous les cours ;
- consultation d'un cours par identifiant ;
- modification d'un cours ;
- suppression d'un cours (si non affecté).

Routes exposées :

- `GET /api/cours`
- `GET /api/cours/:id`
- `POST /api/cours`
- `PUT /api/cours/:id`
- `DELETE /api/cours/:id`

## 3. Architecture du module

Le module suit une architecture en trois couches :

- **Routes** : définition des endpoints et enchaînement des middlewares.
- **Validations** : règles de validation et règles métier.
- **Model** : requêtes SQL paramétrées.

Fichiers de référence :

- `Backend/routes/cours.routes.js`
- `Backend/src/validations/cours.validations.js`
- `Backend/src/model/cours.model.js`
- `Backend/src/app.js`
- `Backend/db.js`

## 4. Modèle de données

### 4.1 Table `cours`

Source : `Backend/Database/GDH5.sql`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_cours | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Code métier du cours |
| nom | VARCHAR(150) | NOT NULL | Intitulé du cours |
| duree | INT | NOT NULL | Durée du cours |
| programme | VARCHAR(150) | NOT NULL | Programme/Filière |
| etape_etude | VARCHAR(50) | NOT NULL | Étape d'étude |
| type_salle | VARCHAR(50) | NOT NULL | Type de salle requis |
| archive | TINYINT(1) | NOT NULL, DEFAULT 0 | Indicateur d'archivage |

### 4.2 Relations métier

- `cours.id_cours` est référencé dans `affectation_cours.id_cours`.
- un cours déjà affecté ne peut pas être supprimé.

## 5. Règles de validation métier

Source : `Backend/src/validations/cours.validations.js`

### 5.1 Validation de l'identifiant

- `id` doit être un entier strictement positif.
- erreur : `Identifiant invalide.`

### 5.2 Vérification d'existence

- contrôle via `recupererCoursParId(id)`.
- si absent : `Cours introuvable.`
- si présent : objet injecté dans `request.cours`.

### 5.3 Validation CREATE

Contraintes :

- `code` obligatoire et non vide ;
- `nom` obligatoire, non vide, non numérique seul ;
- `programme` obligatoire, non vide ;
- `type_salle` obligatoire, non vide ;
- `duree` entier > 0 ;
- `etape_etude` entier entre 1 et 8 ;
- `code` unique ;
- `type_salle` doit exister dans `salles.type`.

Messages d'erreur possibles :

- `Code obligatoire.`
- `Nom invalide.`
- `Programme obligatoire.`
- `Type de salle obligatoire.`
- `Durée invalide (> 0).`
- `Étape invalide (1 à 8).`
- `Code déjà utilisé.`
- `Type de salle inexistant.`

### 5.4 Validation UPDATE

Contraintes :

- le champ `archive` est interdit ;
- au moins un champ modifiable est requis ;
- les mêmes règles CREATE sont appliquées aux champs présents ;
- unicité de `code` vérifiée hors enregistrement courant ;
- `type_salle` doit exister si fourni.

Messages d'erreur possibles :

- `Champ archive non autorisé.`
- `Aucun champ à modifier.`
- `Code invalide.`
- `Code déjà utilisé.`
- `Nom invalide.`
- `Durée invalide (> 0).`
- `Programme invalide.`
- `Étape invalide (1 à 8).`
- `Type de salle invalide.`
- `Type de salle inexistant.`

### 5.5 Validation DELETE

- suppression refusée si le cours est déjà présent dans `affectation_cours`.
- message : `Suppression impossible : cours déjà affecté.`

## 6. Contrat API

### 6.1 GET `/api/cours`

- But : récupérer la liste des cours.
- Codes : `200`, `500`.

### 6.2 GET `/api/cours/:id`

- But : récupérer un cours par identifiant.
- Codes : `200`, `400`, `404`, `500`.

### 6.3 POST `/api/cours`

- But : créer un cours.
- Codes : `201`, `400`, `409`, `500`.

### 6.4 PUT `/api/cours/:id`

- But : modifier un cours existant.
- Codes : `200`, `400`, `404`, `409`, `500`.

### 6.5 DELETE `/api/cours/:id`

- But : supprimer un cours.
- Codes : `200`, `400`, `404`, `500`.

## 7. Requêtes SQL utilisées

Source : `Backend/src/model/cours.model.js`

- lecture liste : `SELECT id_cours, code, nom, duree, programme, etape_etude, type_salle FROM cours ORDER BY code ASC`
- lecture détail : `SELECT ... WHERE id_cours = ? LIMIT 1`
- recherche code : `SELECT ... WHERE code = ? LIMIT 1`
- insertion : `INSERT INTO cours (code, nom, duree, programme, etape_etude, type_salle) VALUES (?, ?, ?, ?, ?, ?)`
- mise à jour dynamique : `UPDATE cours SET ... WHERE id_cours = ? LIMIT 1`
- contrôle affectation : `SELECT 1 FROM affectation_cours WHERE id_cours = ? LIMIT 1`
- suppression : `DELETE FROM cours WHERE id_cours = ? LIMIT 1`
- contrôle type de salle : `SELECT 1 FROM salles WHERE type = ? LIMIT 1`

Toutes les requêtes sont paramétrées (`?`).

## 8. Exemples d'utilisation

### 8.1 Création d'un cours

```http
POST /api/cours
Content-Type: application/json

{
  "code": "INF-101",
  "nom": "Programmation 1",
  "duree": 45,
  "programme": "Techniques de l'informatique",
  "etape_etude": 1,
  "type_salle": "Laboratoire"
}
```

Réponse `201` (exemple) :

```json
{
  "id_cours": 12,
  "code": "INF-101",
  "nom": "Programmation 1",
  "duree": 45,
  "programme": "Techniques de l'informatique",
  "etape_etude": "1",
  "type_salle": "Laboratoire"
}
```

### 8.2 Conflit d'unicité code

```json
{
  "message": "Code déjà utilisé."
}
```

### 8.3 Suppression refusée (cours affecté)

```json
{
  "message": "Suppression impossible : cours déjà affecté."
}
```

## 9. Flux métier simplifié

### 9.1 Création

1. Validation complète des champs.
2. Vérification unicité du code.
3. Vérification existence du type de salle.
4. Insertion SQL.
5. Relecture de la ligne créée.

### 9.2 Mise à jour

1. Validation id.
2. Vérification d'existence.
3. Validation des champs modifiés.
4. Contrôles métier (`code`, `type_salle`, `archive`).
5. Update SQL dynamique.
6. Relecture de la ligne modifiée.

### 9.3 Suppression

1. Validation id.
2. Vérification d'existence.
3. Contrôle d'affectation.
4. Delete SQL réel.

## 10. Cohérence technique constatée et recommandations

Points importants observés :

- Le champ `archive` existe en base, mais son utilisation est volontairement bloquée au niveau validation (`Champ archive non autorisé.`).
- En SQL, `etape_etude` est de type `VARCHAR(50)`, alors que l'API impose actuellement une valeur entière entre 1 et 8.
- Les routes cours sont montées dans `Backend/src/app.js` (serveur lancé par `Backend/src/server.js`).

Recommandations :

- décider si `archive` doit rester bloqué ou être intégré au cycle métier ;
- harmoniser le type de `etape_etude` entre base et validations ;
- ajouter des tests API automatisés pour couvrir les validations critiques.


## 11. Matrice de tracabilite (Exigence -> Implementation)

| Exigence metier | Implementation technique | Preuve dans le projet |
|--------|--------|--------|
| Garantir un code cours unique | Verification unicite code + contrainte SQL UNIQUE | Backend/src/validations/cours.validations.js, Backend/Database/GDH5.sql |
| Autoriser uniquement des durees valides | Controle duree entier > 0 | Backend/src/validations/cours.validations.js |
| Valider l'etape d'etude | Controle etape_etude entre 1 et 8 | Backend/src/validations/cours.validations.js |
| Valider le type de salle | Verification type_salle dans table salles | Backend/src/model/cours.model.js, Backend/src/validations/cours.validations.js |
| Interdire suppression d'un cours affecte | Verification coursEstDejaAffecte avant DELETE | Backend/src/model/cours.model.js, Backend/src/validations/cours.validations.js |

## 12. Plan de tests d'acceptation (notation)

| ID | Scenario | Requete | Attendu |
|--------|--------|--------|--------|
| COURS-AT-01 | Creer un cours valide | POST /api/cours | 201 + objet cree |
| COURS-AT-02 | Refuser code duplique | POST /api/cours (meme code) | 409 |
| COURS-AT-03 | Refuser type de salle inexistant | POST /api/cours (type invalide) | 400 |
| COURS-AT-04 | Refuser etape hors plage | POST /api/cours (etape_etude=9) | 400 |
| COURS-AT-05 | Refuser update avec archive | PUT /api/cours/:id avec archive | 400 |
| COURS-AT-06 | Refuser suppression d'un cours affecte | DELETE /api/cours/:id affecte | 400 |


