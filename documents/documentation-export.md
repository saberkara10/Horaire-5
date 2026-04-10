# Documentation - Module Export

## 1. Objet

Cette documentation couvre le module expose sous `/api/export`.

## 2. Fichiers de reference

- `Backend/routes/export.routes.js`
- `Backend/src/services/ExportService.js`
- `Frontend/src/services/export.api.js`

## 3. Routes exposees

### 3.1 Exports groupe

- `GET /api/export/groupe/:id/pdf`
- `GET /api/export/groupe/:id/excel`

### 3.2 Exports professeur

- `GET /api/export/professeur/:id/pdf`
- `GET /api/export/professeur/:id/excel`

### 3.3 Exports etudiant

- `GET /api/export/etudiant/:id/pdf`
- `GET /api/export/etudiant/:id/excel`

Toutes les routes exigent `userAuth`.

## 4. Validation appliquee

Chaque route :

- convertit `:id` en entier ;
- refuse les identifiants invalides ;
- charge les donnees source ;
- retourne `404` si l'entite n'existe pas ;
- genere le binaire correspondant ;
- pousse le telechargement avec le bon `Content-Type`.

## 5. Types MIME utilises

- PDF : `application/pdf`
- Excel : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## 6. Nommage serveur

Le backend fabrique des noms de fichier du type :

- `horaire-groupe-...pdf`
- `horaire-professeur-...xlsx`
- `horaire-etudiant-...pdf`

Le frontend peut conserver ce nom ou appliquer un nom de secours.

## 7. Structure fonctionnelle des exports

### Groupe

- vue hebdomadaire ;
- seances detaillees ;
- salle, type de salle, professeur, programme, etape.

### Professeur

- vue hebdomadaire ;
- seances detaillees ;
- groupes desservis ;
- salle ;
- programme ou specialite.

### Etudiant

- vue hebdomadaire ;
- seances detaillees ;
- distinction groupe principal / reprise ;
- feuille supplementaire `Reprises` si necessaire.

## 8. Erreurs courantes

- `400` identifiant invalide ;
- `404` entite introuvable ;
- `500` erreur pendant la generation du PDF ou du classeur.

## 9. Notes frontend

`Frontend/src/services/export.api.js` :

- appelle directement les routes backend ;
- recupere le blob ;
- lit `Content-Disposition` ;
- cree un lien temporaire de telechargement.
