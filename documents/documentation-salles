# Documentation - Module de gestion des salles

## 1. Contexte et objectif

Ce document presente la conception fonctionnelle et technique du module **Salles** du projet **gestion-des-horaires**.

Objectifs du module :

- gerer le cycle CRUD complet des salles ;
- garantir la validite des donnees avant persistance ;
- assurer l'unicite du code salle ;
- proteger l'integrite metier lors de la suppression d'une salle deja affectee ;
- preparer les affectations de cours en tenant compte du type et de la capacite.

## 2. Perimetre fonctionnel

Le module couvre les operations suivantes :

- creation d'une salle ;
- consultation de toutes les salles ;
- consultation d'une salle par identifiant ;
- modification d'une salle ;
- suppression d'une salle (si non affectee).

Routes exposees :

- `GET /api/salles`
- `GET /api/salles/:id`
- `POST /api/salles`
- `PUT /api/salles/:id`
- `DELETE /api/salles/:id`

## 3. Architecture du module

Le module suit une architecture en trois couches :

- **Routes** : definition des endpoints et enchainement des middlewares.
- **Validations** : regles de validation et regles metier.
- **Model** : requetes SQL parametrees.

Fichiers de reference attendus :

- `Backend/routes/salles.routes.js`
- `Backend/src/validations/salles.validations.js`
- `Backend/src/model/salles.model.js`
- `Backend/src/app.js`
- `Backend/db.js`

## 4. Modele de donnees

### 4.1 Table `salles`

Source : `Backend/Database/GDH5.sql`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_salle | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Code metier de la salle |
| type | VARCHAR(50) | NOT NULL | Type de salle |
| capacite | INT | NOT NULL | Capacite maximale |

### 4.2 Relations metier

- `salles.id_salle` est reference dans `affectation_cours.id_salle`.
- une salle deja affectee ne doit pas etre supprimee.
- une salle doit pouvoir etre utilisee dans la planification uniquement si elle est disponible sur la plage horaire choisie.

## 5. Regles de validation metier

### 5.1 Validation de l'identifiant

- `id` doit etre un entier strictement positif.
- erreur : `Identifiant invalide.`

### 5.2 Verification d'existence

- controle via `recupererSalleParId(id)`.
- si absente : `Salle introuvable.`
- si presente : objet injecte dans `request.salle`.

### 5.3 Validation CREATE

Contraintes :

- `code` obligatoire et non vide ;
- `type` obligatoire et non vide ;
- `capacite` obligatoire ;
- `capacite` entier > 0 ;
- `code` unique.

Messages d'erreur possibles :

- `Code obligatoire.`
- `Type obligatoire.`
- `Capacite invalide (> 0).`
- `Code deja utilise.`

### 5.4 Validation UPDATE

Contraintes :

- au moins un champ modifiable est requis ;
- les memes regles CREATE sont appliquees aux champs presents ;
- unicite de `code` verifiee hors enregistrement courant.

Messages d'erreur possibles :

- `Aucun champ a modifier.`
- `Code invalide.`
- `Code deja utilise.`
- `Type invalide.`
- `Capacite invalide (> 0).`

### 5.5 Validation DELETE

- suppression refusee si la salle est deja presente dans `affectation_cours`.
- message : `Suppression impossible : salle deja affectee.`

## 6. Contrat API

### 6.1 GET `/api/salles`

- But : recuperer la liste des salles.
- Codes : `200`, `500`.

### 6.2 GET `/api/salles/:id`

- But : recuperer une salle par identifiant.
- Codes : `200`, `400`, `404`, `500`.

### 6.3 POST `/api/salles`

- But : creer une salle.
- Codes : `201`, `400`, `409`, `500`.

### 6.4 PUT `/api/salles/:id`

- But : modifier une salle existante.
- Codes : `200`, `400`, `404`, `409`, `500`.

### 6.5 DELETE `/api/salles/:id`

- But : supprimer une salle.
- Codes : `200`, `400`, `404`, `500`.

## 7. Requetes SQL utilisees

Source attendue : `Backend/src/model/salles.model.js`

- lecture liste : `SELECT id_salle, code, type, capacite FROM salles ORDER BY code ASC`
- lecture detail : `SELECT id_salle, code, type, capacite FROM salles WHERE id_salle = ? LIMIT 1`
- recherche code : `SELECT id_salle, code, type, capacite FROM salles WHERE code = ? LIMIT 1`
- insertion : `INSERT INTO salles (code, type, capacite) VALUES (?, ?, ?)`
- mise a jour dynamique : `UPDATE salles SET ... WHERE id_salle = ? LIMIT 1`
- controle affectation : `SELECT 1 FROM affectation_cours WHERE id_salle = ? LIMIT 1`
- suppression : `DELETE FROM salles WHERE id_salle = ? LIMIT 1`

Toutes les requetes doivent etre parametrees (`?`).

## 8. Exemples d'utilisation

### 8.1 Creation d'une salle

```http
POST /api/salles
Content-Type: application/json

{
  "code": "F2340",
  "type": "Laboratoire",
  "capacite": 32
}