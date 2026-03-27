# Gestion des rôles

Ce document décrit l'implémentation de la gestion des rôles utilisateurs
réalisée lors du Sprint 1 dans le projet **Gestion des horaires**.

Les fonctionnalités mises en place correspondent aux tickets suivants :

---

## GDH5-54 – Identification des profils d'utilisation du système

Deux profils principaux ont été identifiés pour le système, conformément
aux exigences du cahier des charges :

### ADMIN
- Administrateur de la plateforme
- Accès total aux fonctionnalités
- Gestion des utilisateurs et des rôles
- Accès aux routes sensibles

### RESPONSABLE
- Responsable administratif
- Gestion des cours, salles et professeurs
- Accès aux fonctionnalités métier autorisées
- Pas d'accès aux fonctionnalités réservées à l'ADMIN

Ces profils permettent de séparer clairement les responsabilités et de
sécuriser l'accès aux fonctionnalités critiques.

### Création des utilisateurs par défaut

Deux scripts d'initialisation ont été créés pour insérer les utilisateurs
par défaut dans la base de données :

- `admin.js` – crée l'utilisateur ADMIN et lui associe le rôle ADMIN
- `responsable.js` – crée l'utilisateur RESPONSABLE et lui associe le rôle RESPONSABLE

Chaque script hache le mot de passe avec bcrypt avant l'insertion et
gère le cas où l'utilisateur existe déjà (assignation du rôle uniquement).

---

## GDH5-55 – Association de chaque profil à des actions précises

Chaque rôle est associé à des actions autorisées dans l'application.

### ADMIN
- Accès aux routes d'administration (`/admin-only`)
- Gestion des utilisateurs

### RESPONSABLE
- Accès aux routes de gestion des cours, salles, professeurs et étudiants(`/responsable-only`)
- Consultation et gestion des données selon les permissions

Cette logique est appliquée au niveau des routes backend via des
middlewares de contrôle d'accès.

---

## GDH5-56 – Ajout du profil d'utilisation à l'utilisateur

Lors de la connexion :
- les rôles de l'utilisateur sont récupérés depuis la base de données via une jointure entre les tables `utilisateur_roles` et `roles`
- ils sont stockés dans la session utilisateur

### Données stockées en session

```js
req.session.user = {
  id,
  email,
  nom,
  prenom,
  roles
};
```

Cela permet de connaître le profil de l'utilisateur à chaque requête.

---

## GDH5-57 – Adaptation du comportement du système selon le profil

Le comportement du système est adapté selon les rôles grâce à un
middleware d'autorisation.

Un middleware `authorize` a été implémenté afin de :
- vérifier que l'utilisateur est authentifié
- vérifier qu'il possède au moins un rôle autorisé parmi la liste fournie
- refuser l'accès avec une erreur `403` si le rôle est insuffisant

Le middleware accepte un tableau de rôles, ce qui permet de combiner
plusieurs rôles autorisés pour une même route :

```js
authorize(["ADMIN", "RESPONSABLE"])
```

---

## GDH5-58 – Empêcher les actions non prévues par le profil

Un utilisateur qui tente d'accéder à une route non autorisée reçoit
une réponse **HTTP 403 – Accès interdit**.

### Routes protégées par rôle

```js
// Accessible uniquement par un ADMIN
app.get("/admin-only", authRequired, authorize(["ADMIN"]), (req, res) => {
  res.json({ message: "OK ADMIN", user: req.session.user });
});

// Accessible uniquement par un RESPONSABLE
app.get("/responsable-only", authRequired, authorize(["RESPONSABLE"]), (req, res) => {
  res.json({ message: "OK RESPONSABLE", user: req.session.user });
});
```

Si l'utilisateur ne possède pas le rôle requis, l'accès est bloqué
et le message `"Accès interdit"` est retourné.

---

## GDH5-59 – Vérification des profils par des scénarios simples

La gestion des rôles a été validée par plusieurs scénarios :
- utilisateur ADMIN accédant à `/admin-only` → `200 OK`
- utilisateur RESPONSABLE accédant à `/admin-only` → `403 Accès interdit`
- utilisateur non authentifié → `401 Authentification requise`
- récupération des rôles via `/auth/me` après connexion

Les tests ont été réalisés à l'aide de Postman.

---

## Structure des tables

### Table `roles`
- id (clé primaire)
- code (ex : `ADMIN`, `RESPONSABLE`)
- label (description du rôle)

### Table `utilisateur_roles`
- utilisateur_id
- role_id

Un utilisateur peut posséder un ou plusieurs rôles.
Les rôles sont associés aux utilisateurs via cette table de jointure.

---

## Conclusion

La gestion des rôles permet :
- une séparation claire des responsabilités entre ADMIN et RESPONSABLE
- un contrôle d'accès sécurisé aux routes backend
- une extensibilité simple pour ajouter de nouveaux rôles
- une base solide pour la gestion des permissions métier

Ce système s'appuie sur :
- MySQL (tables `roles` et `utilisateur_roles`)
- Express
- express-session
- des middlewares d'authentification (`authRequired`) et d'autorisation (`authorize`)
