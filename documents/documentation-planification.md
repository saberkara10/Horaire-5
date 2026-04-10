# Documentation - Module Planification standard

## 1. Objet

Cette documentation couvre le module expose sous `/api/horaires`.

Il s'agit du module de planification standard :

- CRUD des affectations ;
- lecture des horaires ;
- generation automatique simple sur une fenetre courte.

Ce module est distinct du moteur intelligent expose sous `/api/scheduler`.

## 2. Fichiers de reference

- `Backend/routes/horaire.routes.js`
- `Backend/src/model/horaire.js`

## 3. Routes exposees

### `GET /api/horaires`

Retourne toutes les affectations.

Parametre supporte :

- `session_active=1`

### `GET /api/horaires/:id`

Retourne une affectation detaillee.

### `POST /api/horaires`

Cree une affectation validee.

Payload minimal :

```json
{
  "id_cours": 4,
  "id_professeur": 2,
  "id_salle": 5,
  "id_groupes_etudiants": 8,
  "date": "2026-04-14",
  "heure_debut": "08:00:00",
  "heure_fin": "10:00:00"
}
```

### `PUT /api/horaires/:id`

Met a jour une affectation existante avec le meme schema de payload.

### `DELETE /api/horaires/:id`

Supprime une affectation.

### `DELETE /api/horaires`

Reinitialise les affectations.

Parametres supportes :

- `delete_students=1`
- `session_active=1`

### `POST /api/horaires/generer`

Lance une generation automatique simple.

Payload type :

```json
{
  "programme": "Programmation informatique",
  "etape": 2,
  "session": "Hiver",
  "date_debut": "2026-04-14"
}
```

## 4. Validations metier

Les ecritures verifient notamment :

- presence de tous les identifiants ;
- validite de l'identifiant d'affectation ;
- coherence des heures ;
- existence des ressources ;
- absence de conflit de groupe ;
- absence de conflit de salle ;
- absence de conflit de professeur ;
- disponibilite du professeur.

## 5. Generation automatique simple

La generation automatique standard :

- cible un `programme`, une `etape` et une `session` ;
- cree ou reutilise des groupes compatibles ;
- travaille sur une fenetre courte de `10` jours ;
- essaye des creneaux de depart predefinis ;
- affecte les cours selon disponibilites et ressources.

Cette logique est utile pour une generation rapide mais elle reste moins riche
que le moteur intelligent.

## 6. Codes de retour utiles

- `200` lecture, mise a jour ou suppression reussie
- `201` creation ou generation reussie
- `400` validation ou donnees insuffisantes
- `404` affectation introuvable
- `500` erreur serveur
