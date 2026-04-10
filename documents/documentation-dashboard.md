# Documentation - Module Dashboard

## 1. Objet

Cette documentation couvre le point d'entree `/api/dashboard/overview`.

Elle documente la structure de reponse qui alimente `Frontend/src/pages/DashboardPage.jsx`.

## 2. Fichiers de reference

- `Backend/routes/dashboard.routes.js`
- `Frontend/src/services/dashboard.api.js`
- `Frontend/src/pages/DashboardPage.jsx`

## 3. Route exposee

### `GET /api/dashboard/overview`

Acces :

- `userAuth`

Role :

- retourner une vue compacte du systeme pour la page Dashboard.

## 4. Structure de reponse

La reponse contient les blocs suivants :

- `session_active`
- `compteurs_globaux`
- `resume_session_active`
- `dernier_rapport`
- `cours_recents`
- `professeurs_recents`
- `groupes_sans_horaire`
- `cas_particuliers`

Exemple de squelette :

```json
{
  "session_active": {
    "id_session": 3,
    "nom": "Hiver 2026"
  },
  "compteurs_globaux": {
    "nb_cours_actifs": 0,
    "nb_professeurs": 0,
    "nb_salles": 0,
    "capacite_totale_salles": 0,
    "nb_etudiants": 0,
    "nb_groupes": 0,
    "nb_etudiants_sans_groupe": 0,
    "nb_programmes_actifs": 0
  }
}
```

## 5. Signification des blocs

### `session_active`

Decrit la session de pilotage courante.

### `compteurs_globaux`

Compteurs generaux independants du dernier calcul.

### `resume_session_active`

Indicateurs focalises sur la session active :

- groupes actifs ;
- groupes avec horaire ;
- groupes sans horaire ;
- etudiants de la session ;
- etudiants avec ou sans horaire.

### `dernier_rapport`

Resume du dernier passage du moteur intelligent.

### `cours_recents`

Derniers cours actifs ajoutes ou visibles.

### `professeurs_recents`

Liste courte de professeurs recents avec programmes assignes.

### `groupes_sans_horaire`

Liste priorisee des groupes actifs non couverts.

### `cas_particuliers`

Signalements metier prioritaires pour l'ecran.

## 6. Cas d'usage front

Le frontend exploite cette reponse pour :

- afficher des cartes de synthese ;
- calculer des pourcentages de couverture ;
- presenter une liste d'alertes ;
- identifier rapidement les groupes a surveiller.

## 7. Cas de degradation

- si aucun rapport de generation n'existe, `dernier_rapport` vaut `null` ;
- si aucune session active n'existe, le module retourne quand meme les compteurs globaux ;
- si la lecture SQL echoue, la route renvoie `500`.
