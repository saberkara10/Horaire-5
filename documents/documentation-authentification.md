# Documentation - Module d'authentification

## 1. Objectif

Le module d'authentification permet :

- la connexion avec email et mot de passe ;
- la creation d'une session serveur ;
- la lecture de l'utilisateur connecte ;
- la destruction de la session a la deconnexion.

## 2. Fichiers concernes

Le module s'appuie sur :

- `Backend/app.js`
- `Backend/routes/auth.routes.js`
- `Backend/Middlewares/auth.middlewares.js`
- `Backend/Middlewares/authorize.js`
- `Backend/db.js`

## 3. Statut actuel dans le projet

Le module auth existe bien dans le depot, mais il n'est pas branche dans le backend lance par defaut.

Concretement :

- `Backend/package.json` lance `Backend/src/server.js` ;
- `Backend/src/server.js` charge `Backend/src/app.js` ;
- le module auth, lui, est monte dans `Backend/app.js`.

La documentation ci-dessous decrit donc le module tel qu'il est implemente, sans le presenter comme deja integre au serveur principal.

## 4. Modele de donnees reel

La route de login lit la table `utilisateurs` avec les colonnes suivantes :

- `id_utilisateur`
- `email`
- `motdepasse`
- `nom`
- `prenom`
- `role`

Cette structure correspond a la requete de `Backend/routes/auth.routes.js`.

## 5. Contrat API reel

### `POST /auth/login`

But :

- verifier les identifiants ;
- creer `req.session.user` si la connexion reussit.

Champs attendus :

- `email`
- `password`

Codes observes dans le code :

- `200` : connexion reussie ;
- `400` : email ou mot de passe manquant ;
- `401` : identifiants invalides ;
- `500` : erreur interne du serveur.

### `GET /auth/me`

But :

- retourner l'utilisateur present en session.

Codes observes :

- `200` : utilisateur connecte retourne ;
- `401` : aucune session active.

### `POST /auth/logout`

But :

- detruire la session ;
- effacer le cookie `sid`.

Code observe :

- `200`.

## 6. Structure reelle de la session

En cas de succes, le login stocke :

```js
req.session.user = {
  id,
  email,
  nom,
  prenom,
  role
};
```

Le champ stocke est `role` au singulier.

## 7. Routes protegees par authentification et role

Dans `Backend/app.js`, le depot contient aussi :

- `GET /protected`
- `GET /admin-only`
- `GET /responsable-only`

Ces routes utilisent :

- `authRequired`
- `authorize([...])`

## 8. Point de vigilance important

Le middleware `authorize` lit actuellement `req.session.user.roles`, c'est-a-dire un tableau.

La route `POST /auth/login`, elle, stocke `req.session.user.role`, c'est-a-dire une seule chaine.

Consequence :

- l'authentification simple fonctionne selon son propre code ;
- la logique de role n'est pas completement coherente avec la structure de session creee au login.

## 9. Conclusion

Le module d'authentification est present et documentable, mais il faut distinguer deux niveaux :

- l'implementation auth existe bien dans le depot ;
- son integration avec le serveur principal et la logique de roles n'est pas encore unifiee.
