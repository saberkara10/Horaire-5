# Documentation - Module d'authentification

## 1. Contexte et objectif

Ce document présente la conception fonctionnelle et technique du module **Authentification** du projet **gestion-des-horaires**.

Objectifs du module :

- authentifier les utilisateurs avec email et mot de passe ;
- ouvrir et maintenir une session serveur sécurisée ;
- exposer l'utilisateur connecté ;
- gérer la déconnexion ;
- contrôler l'accès aux routes selon l'authentification et les rôles.

## 2. Périmètre fonctionnel

Le module couvre les fonctionnalités suivantes :

- connexion utilisateur (`POST /auth/login`) ;
- consultation de l'utilisateur connecté (`GET /auth/me`) ;
- déconnexion utilisateur (`POST /auth/logout`) ;
- protection de routes via middleware `authRequired` ;
- autorisation par rôles via middleware `authorize([...])`.

Routes applicatives associées :

- `GET /protected`
- `GET /admin-only`
- `GET /responsable-only`

## 3. Architecture du module

Composants utilisés :

- `Backend/routes/auth.routes.js` : logique des endpoints d'authentification.
- `Backend/Middlewares/auth.middlewares.js` : vérification de session active.
- `Backend/Middlewares/authorize.js` : contrôle d'accès par rôle.
- `Backend/app.js` : configuration CORS, sessions et montage des routes auth.

Principe de fonctionnement :

1. le login vérifie les identifiants ;
2. la session Express stocke l'objet utilisateur ;
3. les middlewares lisent `req.session.user` pour autoriser/refuser l'accès.

## 4. Modèle de données attendu par le code

### 4.1 Table `utilisateurs` (attendue dans `auth.routes.js`)

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| id | INT | PRIMARY KEY | Identifiant technique utilisateur |
| email | VARCHAR | UNIQUE, NOT NULL | Identifiant de connexion |
| mot_de_passe_hash | VARCHAR | NOT NULL | Mot de passe hashé (bcrypt) |
| nom | VARCHAR | NOT NULL | Nom |
| prenom | VARCHAR | NOT NULL | Prénom |
| actif | BOOLEAN/TINYINT | NOT NULL | État actif/inactif du compte |

### 4.2 Tables de rôles attendues

#### Table `roles`

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| id | INT | PRIMARY KEY | Identifiant du rôle |
| code | VARCHAR | UNIQUE, NOT NULL | Code rôle (`ADMIN`, `RESPONSABLE`, etc.) |

#### Table `utilisateur_roles`

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| utilisateur_id | INT | FK -> utilisateurs.id | Utilisateur concerné |
| role_id | INT | FK -> roles.id | Rôle attribué |

### 4.3 État du dump SQL du projet

Le dump `Backend/Database/GDH5.sql` contient actuellement :

- une table `utilisateurs` avec colonnes `id_utilisateur`, `motdepasse`, `role` ;
- aucune table `roles` ;
- aucune table `utilisateur_roles`.

Conclusion : le schéma SQL fourni n'est pas encore aligné avec les requêtes de `auth.routes.js`.

## 5. Règles de validation et de sécurité

### 5.1 Login (`POST /auth/login`)

Règles appliquées :

- `email` et `password` obligatoires ;
- normalisation de l'email (`toLowerCase().trim()`) ;
- refus si utilisateur introuvable ;
- refus si compte inactif ;
- comparaison mot de passe via `bcrypt.compare`.

Messages/codes possibles :

- `400` : `Email et mot de passe requis`
- `401` : `Identifiants invalides`
- `401` : `Compte désactivé`
- `500` : `Erreur serveur`

### 5.2 Session utilisateur

En cas de succès, la session stocke :

- `id`
- `email`
- `nom`
- `prenom`
- `roles`

### 5.3 Authentification requise

Middleware `authRequired` :

- refuse à `401` si `req.session.user` est absent ;
- message : `Authentification requise`.

### 5.4 Autorisation par rôle

Middleware `authorize(rolesAutorise)` :

- vérifie qu'au moins un rôle utilisateur appartient à la liste autorisée ;
- refuse à `403` sinon ;
- message : `Accès interdit`.

### 5.5 Configuration session/cookie

Dans `Backend/app.js`, la session est configurée avec :

- `name: "sid"`
- `httpOnly: true`
- `sameSite: "lax"`
- `secure` activé en production
- durée : 1 heure (`maxAge`)

## 6. Contrat API

### 6.1 POST `/auth/login`

- But : authentifier et créer la session.
- Codes : `200`, `400`, `401`, `500`.

### 6.2 GET `/auth/me`

- But : retourner l'utilisateur de session.
- Codes : `200`, `401`.

### 6.3 POST `/auth/logout`

- But : détruire la session et nettoyer le cookie.
- Codes : `200`.

### 6.4 GET `/protected`

- But : tester l'accès authentifié.
- Codes : `200`, `401`.

### 6.5 GET `/admin-only`

- But : accès réservé au rôle `ADMIN`.
- Codes : `200`, `401`, `403`.

### 6.6 GET `/responsable-only`

- But : accès réservé au rôle `RESPONSABLE`.
- Codes : `200`, `401`, `403`.

## 7. Requêtes SQL utilisées

Source : `Backend/routes/auth.routes.js`

- recherche utilisateur :
  `SELECT id, email, mot_de_passe_hash, nom, prenom, actif FROM utilisateurs WHERE email = ?`
- récupération rôles :
  `SELECT r.code FROM utilisateur_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.utilisateur_id = ?`

## 8. Exemples d'utilisation

### 8.1 Connexion réussie

```http
POST /auth/login
Content-Type: application/json

{
  "email": "jonathan.weklie@college.ca",
  "password": "MotDePasseSecurise"
}
```

Réponse `200` (exemple) :

```json
{
  "message": "Connexion réussie",
  "user": {
    "id": 1,
    "email": "jonathan.weklie@college.ca",
    "nom": "Jonathan",
    "prenom": "Weklie",
    "roles": ["RESPONSABLE"]
  }
}
```

### 8.2 Utilisateur non authentifié (`/auth/me`)

```json
{
  "message": "Authentification requise"
}
```

### 8.3 Accès refusé par rôle

```json
{
  "message": "Accès interdit"
}
```

## 9. Flux fonctionnel simplifié

### 9.1 Connexion

1. Validation des champs email/password.
2. Recherche utilisateur par email.
3. Vérification compte actif.
4. Vérification du hash mot de passe.
5. Chargement des rôles.
6. Initialisation de `req.session.user`.

### 9.2 Contrôle d'accès

1. `authRequired` valide la présence de session.
2. `authorize([...])` valide les rôles autorisés.
3. La route protégée est exécutée uniquement si les contrôles passent.

### 9.3 Déconnexion

1. destruction de la session ;
2. suppression du cookie `sid` ;
3. confirmation JSON de déconnexion.

## 10. Cohérence technique constatée et recommandations

Points importants observés dans le projet :

- Le backend démarré par défaut (`Backend/package.json`) lance `src/server.js`, pas `Backend/app.js`.
- Le module auth est monté dans `Backend/app.js` ; il faut donc unifier le point d'entrée pour intégrer auth + modules métier dans la même application.
- `SESSION_SECRET` est requis dans `Backend/app.js` mais absent du fichier `Backend/.env` actuel.
- `bcrypt`, `express-session` et `cors` sont utilisés dans `Backend/app.js` / `auth.routes.js` ; ils doivent être présents dans les dépendances du backend utilisé au runtime.
- Le schéma SQL doit être aligné avec les colonnes/tables attendues par `auth.routes.js`.

## 11. Matrice de tracabilite (Exigence -> Implementation)

| Exigence metier | Implementation technique | Preuve dans le projet |
|--------|--------|--------|
| Authentifier via email/mot de passe | Route POST /auth/login + verification bcrypt | Backend/routes/auth.routes.js |
| Maintenir une session securisee | Configuration express-session (cookie sid) | Backend/app.js |
| Exposer l'utilisateur connecte | Route GET /auth/me basee sur req.session.user | Backend/routes/auth.routes.js |
| Proteger les routes | Middleware authRequired | Backend/Middlewares/auth.middlewares.js |
| Restreindre par role | Middleware authorize([...]) | Backend/Middlewares/authorize.js |

## 12. Plan de tests d'acceptation (notation)

| ID | Scenario | Requete | Attendu |
|--------|--------|--------|--------|
| AUTH-AT-01 | Refuser login incomplet | POST /auth/login sans password | 400 |
| AUTH-AT-02 | Refuser identifiants invalides | POST /auth/login mauvais mdp | 401 |
| AUTH-AT-03 | Session creee apres login valide | POST /auth/login valide | 200 + user |
| AUTH-AT-04 | Refuser acces sans session | GET /auth/me sans login | 401 |
| AUTH-AT-05 | Refuser role non autorise | GET /admin-only avec role non ADMIN | 403 |
| AUTH-AT-06 | Deconnexion effective | POST /auth/logout puis GET /auth/me | 200 puis 401 |


