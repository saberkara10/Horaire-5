# Conception du module Export

## 1. Objectif

Le module Export transforme les horaires applicatifs en livrables PDF et Excel.

Il couvre trois vues metier :

- groupe ;
- professeur ;
- etudiant.

Les points d'entree principaux sont :

- `Backend/routes/export.routes.js`
- `Backend/src/services/ExportService.js`

## 2. Positionnement dans l'architecture

Le module Export est une couche de presentation serveur.

Il ne calcule pas l'horaire lui-meme.

Il :

- charge les donnees issues des modules Groupes, Professeurs et Etudiants ;
- les normalise pour l'impression ou le tableur ;
- genere un binaire PDF ou XLSX ;
- renvoie le fichier en telechargement HTTP.

## 3. Sources de donnees

Selon le type d'export, le module s'appuie sur :

- `recupererPlanningCompletGroupe`
- `recupererHoraireProfesseur`
- `recupererProfesseurParId`
- `recupererHoraireCompletEtudiant`
- la session active pour completer l'etiquetage

## 4. Typologie des sorties

Chaque export contient deux niveaux de lecture.

### 4.1 Vue hebdomadaire

Une grille visuelle organisee par :

- jour ;
- heure ;
- semaine.

### 4.2 Vue detaillee

Un tableau de seances avec les colonnes metier utiles.

Pour l'etudiant, le module distingue aussi les reprises.

## 5. Generation PDF

Le service PDF repose sur `pdfkit`.

La structure generale comprend :

- un en-tete de document ;
- des pages hebdomadaires ;
- des tableaux detailes ;
- un pied de page normalise.

## 6. Generation Excel

Le service Excel repose sur `xlsx`.

Chaque fichier cree un classeur avec :

- une feuille `Vue hebdo` ;
- une ou plusieurs feuilles de detail ;
- une feuille `Reprises` pour les exports etudiants si necessaire.

## 7. Nommage et telechargement

Le module construit les noms de fichier a partir :

- du type d'entite ;
- d'un identifiant lisible ;
- de la session.

Le frontend complete ce dispositif avec `Frontend/src/services/export.api.js`,
qui declenche le telechargement et recupere au besoin le nom serveur
depuis `Content-Disposition`.

## 8. Points de vigilance

- les exports refletent les donnees lues au moment de la requete ; ils ne doivent pas etre consideres comme une archive officielle ;
- l'export etudiant fusionne l'horaire principal et les reprises ;
- l'absence de session active degrade le libelle, mais ne doit pas casser la generation si les donnees de base existent.

## 9. Conclusion

Le module Export est une couche de valorisation des horaires.

Il rend les donnees planifiees consommables par des usagers qui n'ont pas
besoin d'acceder directement a l'application.
