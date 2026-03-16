# Documentation - Module de gestion des professeurs

## 1. Contexte et objectif

Ce document présente la conception fonctionnelle et technique du module **Professeurs** du projet **gestion-des-horaires**.

Objectifs du module :

- centraliser la gestion des professeurs ;
- garantir la qualité des données (validation, unicité, intégrité) ;
- offrir des opérations CRUD robustes et cohérentes avec la base MySQL ;
- empêcher les suppressions invalides lorsqu'un professeur est déjà affecté.

## 2. Périmètre fonctionnel

Le module couvre les opérations suivantes :

- création d'un professeur ;
- consultation de tous les professeurs ;
- consultation d'un professeur par identifiant ;
- modification d'un professeur ;
- suppression d'un professeur (avec contrôle de dépendance métier).

Routes exposées :

- `GET /api/professeurs`
- `GET /api/professeurs/:id`
- `POST /api/professeurs`
- `PUT /api/professeurs/:id`
- `DELETE /api/professeurs/:id`

## 3. Architecture du module

Le module suit une séparation claire par responsabilités :

- **Routes** : orchestration des endpoints HTTP et enchaînement des middlewares.
- **Validations** : contrôle des entrées utilisateur et règles métier.
- **Model** : accès base de données via requêtes SQL paramétrées.

Fichiers de référence :

- `Backend/routes/professeurs.routes.js`
- `Backend/src/validations/professeurs.validation.js`
- `Backend/src/model/professeurs.model.js`
- `Backend/src/app.js`
- `Backend/db.js`

## 4. Modèle de données

### 4.1 Table `professeurs`

Source : `Backend/Database/GDH5.sql`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_professeur | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| matricule | VARCHAR(50) | NOT NULL, UNIQUE | Identifiant métier unique |
| nom | VARCHAR(100) | NOT NULL | Nom du professeur |
| prenom | VARCHAR(100) | NOT NULL | Prénom du professeur |
| specialite | VARCHAR(100) | NULL autorisé | Spécialité (optionnelle) |

### 4.2 Intégrité relationnelle

Le champ `id_professeur` est référencé dans `affectation_cours`.

Conséquence métier :

- un professeur déjà affecté ne peut pas être supprimé.

## 5. Règles de validation métier

Source : `Backend/src/validations/professeurs.validation.js`

### 5.1 Validation de l'identifiant

- `id` doit être un entier strictement positif.
- erreur : `Identifiant invalide.`

### 5.2 Vérification d'existence

- contrôle via `recupererProfesseurParId(id)`.
- si absent : `Professeur introuvable.`
- si présent : objet injecté dans `request.professeur`.

### 5.3 Validation CREATE

Contraintes :

- `matricule` obligatoire, non vide, max 50 ;
- `nom` obligatoire, non vide, non numérique seul, max 100 ;
- `prenom` obligatoire, non vide, non numérique seul, max 100 ;
- `specialite` optionnelle, max 100 (si fournie et non `null`) ;
- `matricule` unique.

Messages d'erreur possibles :

- `Matricule obligatoire.`
- `Nom invalide.`
- `Prenom invalide.`
- `Matricule trop long (max 50).`
- `Nom trop long (max 100).`
- `Prenom trop long (max 100).`
- `Specialite trop longue (max 100).`
- `Matricule deja utilise.`

### 5.4 Validation UPDATE

Contraintes :

- au moins un champ à modifier ;
- mêmes règles de validité que CREATE pour les champs présents ;
- contrôle d'unicité du matricule (hors enregistrement courant) ;
- `specialite` accepte `null`.

Messages d'erreur possibles :

- `Aucun champ a modifier.`
- `Matricule invalide.`
- `Matricule trop long (max 50).`
- `Matricule deja utilise.`
- `Nom invalide.`
- `Nom trop long (max 100).`
- `Prenom invalide.`
- `Prenom trop long (max 100).`
- `Specialite trop longue (max 100).`

### 5.5 Validation DELETE

- suppression refusée si le professeur existe dans `affectation_cours`.
- message : `Suppression impossible : professeur deja affecte.`

## 6. Contrat API

### 6.1 GET `/api/professeurs`

- But : récupérer la liste complète.
- Code succès : `200`.
- Code erreur : `500`.

### 6.2 GET `/api/professeurs/:id`

- But : récupérer un professeur par identifiant.
- Codes : `200`, `400`, `404`, `500`.

### 6.3 POST `/api/professeurs`

- But : créer un professeur.
- Codes : `201`, `400`, `409`, `500`.

### 6.4 PUT `/api/professeurs/:id`

- But : modifier un professeur existant.
- Codes : `200`, `400`, `404`, `409`, `500`.

### 6.5 DELETE `/api/professeurs/:id`

- But : supprimer un professeur.
- Codes : `200`, `400`, `404`, `500`.

## 7. Requêtes SQL utilisées

Source : `Backend/src/model/professeurs.model.js`

- lecture liste : `SELECT ... FROM professeurs ORDER BY matricule ASC`
- lecture détail : `SELECT ... WHERE id_professeur = ? LIMIT 1`
- recherche matricule : `SELECT ... WHERE matricule = ? LIMIT 1`
- insertion : `INSERT INTO professeurs (matricule, nom, prenom, specialite) VALUES (?, ?, ?, ?)`
- mise à jour dynamique : `UPDATE professeurs SET ... WHERE id_professeur = ? LIMIT 1`
- contrôle d'affectation : `SELECT 1 FROM affectation_cours WHERE id_professeur = ? LIMIT 1`
- suppression : `DELETE FROM professeurs WHERE id_professeur = ? LIMIT 1`

Toutes les requêtes sont paramétrées (`?`) pour limiter le risque d'injection SQL.

## 8. Exemples d'utilisation

### 8.1 Création d'un professeur (Jonathan Weklie)

```http
POST /api/professeurs
Content-Type: application/json

{
  "matricule": "P-2026-001",
  "nom": "Jonathan",
  "prenom": "Weklie",
  "specialite": "Informatique"
}
```

Réponse `201` (exemple) :

```json
{
  "id_professeur": 7,
  "matricule": "P-2026-001",
  "nom": "Jonathan",
  "prenom": "Weklie",
  "specialite": "Informatique"
}
```

### 8.2 Conflit d'unicité matricule

```json
{
  "message": "Matricule deja utilise."
}
```

### 8.3 Suppression impossible (professeur affecté)

```json
{
  "message": "Suppression impossible : professeur deja affecte."
}
```

## 9. Flux métier simplifié

### 9.1 Création

1. Validation des champs.
2. Vérification unicité matricule.
3. Insertion SQL.
4. Relecture de la ligne créée.

### 9.2 Mise à jour

1. Validation id.
2. Vérification d'existence.
3. Validation des champs modifiés.
4. Vérification unicité (si matricule modifié).
5. Update SQL.
6. Relecture de la ligne modifiée.

### 9.3 Suppression

1. Validation id.
2. Vérification d'existence.
3. Contrôle d'affectation.
4. Delete SQL réel.

## 10. Qualité, sécurité et recommandations

Points positifs actuels :

- structure de code propre (routes/validations/model) ;
- contrôle d'unicité métier sur le matricule ;
- requêtes SQL paramétrées ;
- prévention de suppression incohérente.

Améliorations recommandées :

- protéger les routes avec authentification/autorisation si exigé par le cahier des charges ;
- normaliser les données (`trim`) avant persistance ;
- ajouter des tests API automatisés (Jest + Supertest).

## 11. Matrice de tracabilite (Exigence -> Implementation)

| Exigence metier | Implementation technique | Preuve dans le projet |
|--------|--------|--------|
| Identifier un professeur de maniere unique | Controle d'unicite du matricule en validation + contrainte SQL UNIQUE | Backend/src/validations/professeurs.validation.js, Backend/Database/GDH5.sql |
| Empêcher l'acces a un professeur inexistant | Middleware verifierProfesseurExiste | Backend/src/validations/professeurs.validation.js |
| Interdire la suppression d'un professeur deja affecte | Verification professeurEstDejaAffecte avant DELETE | Backend/src/model/professeurs.model.js, Backend/src/validations/professeurs.validation.js |
| Exposer un CRUD stable | Routes REST structurees et reponses HTTP coherentes | Backend/routes/professeurs.routes.js |

## 12. Plan de tests d'acceptation (notation)

| ID | Scenario | Requete | Attendu |
|--------|--------|--------|--------|
| PROF-AT-01 | Creer un professeur valide | POST /api/professeurs | 201 + objet cree |
| PROF-AT-02 | Refuser matricule duplique | POST /api/professeurs (meme matricule) | 409 |
| PROF-AT-03 | Refuser id invalide | GET /api/professeurs/abc | 400 |
| PROF-AT-04 | Refuser professeur inexistant | GET /api/professeurs/999999 | 404 |
| PROF-AT-05 | Refuser suppression d'un professeur affecte | DELETE /api/professeurs/:id affecte | 400 |
| PROF-AT-06 | Supprimer un professeur non affecte | DELETE /api/professeurs/:id non affecte | 200 |


