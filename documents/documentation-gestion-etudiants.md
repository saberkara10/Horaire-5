# Documentation - Module Etudiants

## 1. Objet

Cette documentation couvre le module expose sous `/api/etudiants`.

Elle documente :

- les routes de lecture ;
- la route d'horaire individuel ;
- la route d'import ;
- la route de purge globale.

## 2. Fichiers de reference

- `Backend/routes/etudiants.routes.js`
- `Backend/src/model/etudiants.model.js`
- `Backend/src/services/import-etudiants.service.js`
- `Frontend/src/pages/EtudiantsPage.jsx`
- `Frontend/src/pages/EtudiantsImportPage.jsx`

## 3. Routes exposees

### 3.1 Liste des etudiants

#### `GET /api/etudiants`

Parametres supportes :

- `session_active=1`

Reponse :

- liste des etudiants ;
- groupe principal ;
- programme ;
- etape ;
- session ;
- `nb_reprises`
- `nb_cours_normaux`
- `charge_cible`

### 3.2 Detail d'un etudiant

#### `GET /api/etudiants/:id`

Retourne :

- l'identite ;
- la cohorte principale ;
- les indicateurs de charge.

### 3.3 Horaire individuel

#### `GET /api/etudiants/:id/horaire`

Retourne un objet agregeant :

- `etudiant`
- `horaire`
- `horaire_reprises`
- `reprises`
- `resume`

Le frontend peut ainsi distinguer :

- les seances de groupe ;
- les seances liees a une reprise ;
- les reprises encore non affectees.

### 3.4 Import

#### `POST /api/etudiants/import`

Transport :

- `multipart/form-data`

Champ attendu :

- `file`

Formats acceptes :

- `.xlsx`
- `.xls`
- `.csv`

Le detail fonctionnel du format est documente dans :

- `documents/documentation-import-etudiants.md`

Le moteur d'import supporte aussi un onglet optionnel de reprises.

Exemple de reponse :

```json
{
  "message": "Import des etudiants et des cours echoues termine avec succes.",
  "nombre_importes": 120,
  "nombre_mis_a_jour": 12,
  "nombre_cours_echoues_importes": 18,
  "cohorte_utilisee": {
    "session": "Hiver"
  }
}
```

### 3.5 Suppression globale

#### `DELETE /api/etudiants`

Role :

- supprimer les etudiants importes ;
- nettoyer les groupes devenus orphelins.

## 4. Regles de lecture de l'horaire

L'ordre d'affichage recommande est :

1. date ;
2. heure de debut ;
3. seance reguliere avant seance de reprise si collision de tri ;
4. identifiant technique en dernier ressort.

Cette logique est centralisee dans `comparerSeancesEtudiant`.

## 5. Erreurs frequentes

- etudiant introuvable ;
- import sans fichier ;
- fichier invalide ;
- colonnes manquantes ;
- doublons de matricules ;
- session cible de reprise introuvable ;
- session de reprise incompatible avec la session de l'etudiant.

## 6. Dependances inter-modules

- `groupes` pour la cohorte principale ;
- `import-etudiants` pour les flux d'entree ;
- `scheduler` pour les reprises individuelles ;
- `export` pour les PDF et Excel individuels.
