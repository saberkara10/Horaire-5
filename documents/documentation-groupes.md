# Documentation - Module Groupes

## 1. Objet

Cette documentation couvre le module expose sous `/api/groupes`.

Elle documente :

- les routes de consultation ;
- les routes de gestion manuelle ;
- les routes de gestion des membres ;
- les points d'entree de generation ciblee.

## 2. Fichiers de reference

- `Backend/routes/groupes.routes.js`
- `Backend/src/model/groupes.model.js`
- `Frontend/src/pages/GestionGroupesPage.jsx`
- `Frontend/src/pages/HorairesGroupesPage.jsx`

## 3. Routes principales

### 3.1 Consultation

#### `GET /api/groupes`

Parametres supportes :

- `details=1`
- `session_active=1`
- `effectif_min=1`
- `planning_only=1`
- `special_groups=1`

#### `GET /api/groupes/:id`

Retourne :

- les metadonnees du groupe ;
- l'effectif actuel ;
- le nombre de seances planifiees ;
- les indicateurs `a_horaire`, `est_complet`.

#### `GET /api/groupes/:id/planning`

Retourne :

- `groupe`
- `horaire`

#### `GET /api/groupes/:id/etudiants`

Retourne la liste des membres du groupe avec :

- identite ;
- programme ;
- etape ;
- session ;
- compteur de cours echoues actifs.

### 3.2 Gestion manuelle

#### `POST /api/groupes/manuel`

Payload type :

```json
{
  "nom_groupe": "GINF-E2-1",
  "programme": "Programmation informatique",
  "etape": 2,
  "taille_max": 30,
  "id_session": 3,
  "est_groupe_special": false
}
```

Regles :

- `nom_groupe` obligatoire ;
- `programme` obligatoire ;
- nom unique dans la session cible ;
- `taille_max` plafonnee a `30`.

#### `POST /api/groupes/nettoyer`

Payload type :

```json
{
  "mode": "preview",
  "inclure_vides": true
}
```

Comportement :

- `preview` retourne les groupes candidats ;
- `suppression` supprime seulement les groupes sans etudiant et sans affectation.

### 3.3 Gestion des membres

#### `POST /api/groupes/:id/etudiants/creer-ajouter`

Payload type :

```json
{
  "nom": "Durand",
  "prenom": "Lea",
  "matricule": "20261234",
  "email": "lea.durand@example.com",
  "programme": "Programmation informatique",
  "etape": 2,
  "cours_echoues": [
    {
      "code": "INF205",
      "note_echec": 48
    }
  ]
}
```

Regles :

- le groupe doit exister ;
- le groupe ne doit pas etre complet ;
- le matricule doit etre unique ;
- l'email est unique s'il est fourni ;
- le programme de l'etudiant doit rester coherent avec celui du groupe.

#### `PUT /api/groupes/:id/etudiants/:idEtudiant/deplacer`

Payload type :

```json
{
  "id_groupe_cible": 18
}
```

Regles :

- groupe source et groupe cible differents ;
- meme programme ;
- meme etape ;
- groupe cible non complet.

#### `DELETE /api/groupes/:id/etudiants/:idEtudiant`

Retire l'etudiant du groupe sans le supprimer du systeme.

### 3.4 Suppression d'un groupe

#### `DELETE /api/groupes/:id`

Sequence appliquee :

1. detacher les etudiants ;
2. supprimer les liaisons `affectation_groupes` ;
3. supprimer le groupe.

### 3.5 Generation ciblee

#### `POST /api/groupes/generer-cible`

Payload type :

```json
{
  "programme": "Programmation informatique",
  "etape": 2
}
```

Le module selectionne les groupes cibles, ignore les groupes vides puis appelle
`SchedulerEngine.genererGroupe`.

#### `POST /api/groupes/:id/generer-horaire`

Lance une generation ciblee pour un groupe unique.

## 4. Codes de retour utiles

- `200` lecture ou mise a jour reussie
- `201` creation ou generation reussie
- `400` parametres invalides
- `404` groupe ou etudiant introuvable
- `409` doublon metier
- `422` regle de capacite ou de coherence refusee
- `500` erreur serveur

## 5. Risques metier a surveiller

- multiplication de groupes vides ;
- deplacements entre cohortes incompatibles ;
- ajout manuel d'etudiants sans verifier la session active ;
- generation ciblee sur un groupe mal qualifie ou incomplet.

## 6. Relation avec les autres modules

- `etudiants` : rattachement principal des membres ;
- `scheduler` : generation avancee des horaires ;
- `dashboard` : comptage des groupes avec ou sans horaire ;
- `export` : edition des horaires par groupe.
