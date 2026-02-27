# Conception du module d'authentification

## 1. Objectif du module

Le module d'authentification permet de controler l'acces a l'application via une connexion securisee par email et mot de passe.

Il gere egalement la session utilisateur, la recuperation du profil connecte et la deconnexion.

---

## 2. Role de l'authentification dans le systeme

L'authentification est un module transversal du systeme.  
Elle est utilisee pour :

- verifier l'identite d'un utilisateur,
- ouvrir une session securisee cote serveur,
- appliquer les autorisations basees sur les roles,
- proteger les routes sensibles.

---

## 3. Structure des donnees d'authentification

La conception est alignee avec les requetes utilisees dans `routes/auth.routes.js`.

### 3.1 Tables attendues par le code d'authentification

#### Table : `utilisateurs` (attendue par les routes auth)

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| id | INT | PRIMARY KEY | Identifiant technique utilisateur |
| email | VARCHAR | UNIQUE, NOT NULL | Identifiant de connexion |
| mot_de_passe_hash | VARCHAR | NOT NULL | Mot de passe hache (bcrypt) |
| nom | VARCHAR | NOT NULL | Nom utilisateur |
| prenom | VARCHAR | NOT NULL | Prenom utilisateur |
| actif | BOOLEAN/TINYINT | NOT NULL | Etat du compte (actif/inactif) |

#### Table : `roles`

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| id | INT | PRIMARY KEY | Identifiant role |
| code | VARCHAR | UNIQUE, NOT NULL | Code role (ex: ADMIN, RESPONSABLE) |

#### Table : `utilisateur_roles`

| Champ | Type logique | Contraintes | Description |
|--------|--------|------------|------------|
| utilisateur_id | INT | FK -> utilisateurs.id | Utilisateur concerne |
| role_id | INT | FK -> roles.id | Role attribue |

### 3.2 Etat du dump SQL fourni (`Backend/Database/GDH5.sql`)

Le dump actuel contient une table `utilisateurs` avec des colonnes differentes (`id_utilisateur`, `motdepasse`, `role`) et ne contient pas `roles` ni `utilisateur_roles`.

---

## 4. Contraintes d'integrite et de securite

- `email` doit rester unique.
- Le mot de passe doit etre stocke sous forme de hash (bcrypt), jamais en clair.
- Un compte inactif ne peut pas se connecter.
- Une session valide doit contenir un objet `req.session.user`.
- Le cookie de session est protege (`httpOnly`, `sameSite=lax`, `secure` en production).

---

## 5. Regles de validation (cote backend)

### 5.1 Login (`POST /auth/login`)
- `email` et `password` obligatoires
- email normalise (`lowercase`, `trim`)
- utilisateur introuvable => `401 Identifiants invalides`
- compte inactif => `401 Compte desactive`
- mot de passe invalide => `401 Identifiants invalides`

### 5.2 Session utilisateur
- en cas de succes, la session stocke : `id`, `email`, `nom`, `prenom`, `roles`
- la route `GET /auth/me` retourne l'utilisateur de session

### 5.3 Deconnexion (`POST /auth/logout`)
- destruction de la session serveur
- suppression du cookie `sid`

### 5.4 Autorisation par role
- middleware `authRequired` : bloque a `401` si non authentifie
- middleware `authorize([...])` : bloque a `403` si role non autorise

---

## 6. Fonctionnalites prevues du module

Le module doit permettre :

- **Connecter** un utilisateur
- **Recuperer** l'utilisateur connecte (`/auth/me`)
- **Deconnecter** un utilisateur
- **Proteger** des routes selon l'authentification
- **Restreindre** des routes selon les roles (ADMIN, RESPONSABLE)

---

## 7. Integration avec les autres modules et coherence technique

Le module auth est integre avec :

- `Middlewares/auth.middlewares.js` pour exiger une session active,
- `Middlewares/authorize.js` pour le controle d'acces par role,
- les routes proteges (`/protected`, `/admin-only`, `/responsable-only`).

Points de coherence a traiter pour un fonctionnement parfait :

- Aligner la base de donnees reelle avec les champs et tables attendus par `auth.routes.js`.
- Definir `SESSION_SECRET` dans `Backend/.env` (requis par `Backend/app.js`).
- Verifier que l'application utilise un point d'entree unique, car `Backend/app.js` (auth/session) et `Backend/src/app.js` (cours/professeurs) sont separes.

---

## 8. Conclusion

La conception du module d'authentification est claire et structuree autour de la session serveur et des roles.

Elle garantit :

- l'identification des utilisateurs,
- la protection des routes sensibles,
- un controle d'acces coherent avec les responsabilites metier.

Ce document constitue la base de reference pour stabiliser le module auth et l'integrer completement avec les modules metier.
