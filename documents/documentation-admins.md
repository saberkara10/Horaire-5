# Documentation - Module Admins

## 1. Objet

Cette documentation couvre le module expose sous `/api/admins`.

## 2. Fichiers de reference

- `Backend/routes/admins.routes.js`
- `Backend/src/model/utilisateur.js`
- `Frontend/src/pages/AdminsPage.jsx`

## 3. Regle d'acces

Toutes les routes exigent :

- authentification valide ;
- role `RESPONSABLE`.

## 4. Routes exposees

### `GET /api/admins`

Retourne la liste des comptes `ADMIN`.

### `POST /api/admins`

Payload type :

```json
{
  "nom": "Martin",
  "prenom": "Aline",
  "email": "aline.martin@example.com",
  "password": "secret123"
}
```

Regles :

- nom obligatoire ;
- prenom obligatoire ;
- email obligatoire ;
- mot de passe minimum 6 caracteres.

### `PUT /api/admins/:id`

Payload type :

```json
{
  "nom": "Martin",
  "prenom": "Aline",
  "email": "aline.martin@example.com",
  "password": "nouveau-secret"
}
```

Differences avec la creation :

- `password` devient optionnel ;
- l'identifiant doit etre un entier positif ;
- la route retourne `404` si le compte n'existe pas.

### `DELETE /api/admins/:id`

Supprime le sous-admin cible.

## 5. Codes de retour utiles

- `200` lecture, mise a jour ou suppression reussie
- `201` creation reussie
- `400` validation ou identifiant invalide
- `404` admin introuvable
- `409` email deja utilise
- `500` erreur serveur

## 6. Notes d'implementation

- le modele utilise des requetes fallback pour supporter l'ancien schema ;
- les erreurs `ER_DUP_ENTRY` sont traduites en conflit d'email ;
- le role cible du module est `ADMIN`.
