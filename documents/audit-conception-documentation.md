# Audit de couverture documentaire

## 1. Objet

Ce document trace la couverture documentaire des modules exposes par
l'application a la date du depot.

La verification a ete faite a partir de :

- `Backend/src/app.js`
- `Backend/routes/*.js`
- `Backend/src/services/**/*`
- `Frontend/src/App.jsx`
- `documents/*.md`

## 2. Legende

- `Existant` : document deja present dans le depot.
- `Ajoute` : document cree dans cette livraison.
- `A revoir` : document present mais non utilise comme source principale de couverture.

## 3. Matrice de couverture

| Module | Point d'entree principal | Conception | Documentation | Statut |
|--------|--------------------------|------------|---------------|--------|
| Authentification | `Backend/routes/auth.routes.js` | `documents/conception-auth.md` | `documents/documentation-authentification.md` | Existant |
| Frontend | `Frontend/src/App.jsx` | `documents/conception-frontend.md` | `documents/documentation-frontend.md` | Existant |
| Cours | `Backend/routes/cours.routes.js` | `documents/conception-cours.md` | `documents/documentation-gestion-cours.md` | Existant |
| Professeurs | `Backend/routes/professeurs.routes.js` | `documents/conception-prof.md` | `documents/documentation-gestion-professeurs.md` | Existant |
| Salles | `Backend/routes/salles.routes.js` | `documents/conception-salles.md` | `documents/documentation-salles.md` | Existant |
| Horaires etudiants | `Backend/routes/etudiants.routes.js` | `documents/conception-horaires-etudiants.md` | `documents/documentation-horaires-etudiants.md` | Existant |
| Base de donnees | `Backend/Database/*.sql` | `documents/conception-base-de-donnees.md` | N/A | Existant |
| Planification standard | `Backend/routes/horaire.routes.js` | `documents/conception-planification.md` | `documents/documentation-planification.md` | Mise a jour + ajoute |
| Import etudiants | `Backend/src/services/import-etudiants.service.js` | `documents/conception-import-etudiants.md` | `documents/documentation-import-etudiants.md` | Ajoute + existant |
| Etudiants | `Backend/routes/etudiants.routes.js` | `documents/conception-etudiants.md` | `documents/documentation-gestion-etudiants.md` | Ajoute |
| Groupes | `Backend/routes/groupes.routes.js` | `documents/conception-groupes.md` | `documents/documentation-groupes.md` | Ajoute |
| Dashboard | `Backend/routes/dashboard.routes.js` | `documents/conception-dashboard.md` | `documents/documentation-dashboard.md` | Ajoute |
| Admins | `Backend/routes/admins.routes.js` | `documents/conception-admins.md` | `documents/documentation-admins.md` | Ajoute |
| Export | `Backend/routes/export.routes.js` | `documents/conception-export.md` | `documents/documentation-export.md` | Ajoute |
| Moteur intelligent | `Backend/routes/scheduler.routes.js` | `documents/conception-moteur-intelligent.md` | `documents/documentation-moteur-intelligent.md` | Ajoute |

## 4. Resultat

Les modules qui n'avaient pas de couverture explicite disposent
maintenant d'une conception et d'une documentation dediees.

La distinction suivante est volontaire pour eviter toute ambiguite :

- `planification standard` couvre le module `/api/horaires` ;
- `moteur intelligent` couvre le module `/api/scheduler` ;
- `horaires etudiants` couvre la lecture et l'agregation des horaires cote etudiant.

## 5. Convention retenue pour les nouveaux documents

Tous les nouveaux documents suivent la meme logique :

- objectif et perimetre du module ;
- composants et dependances principales ;
- donnees manipulees ;
- regles metier et contraintes ;
- contrats API ou flux d'execution ;
- points de vigilance operationnels.

Cette structure permet de garder des documents lisibles dans Git tout
en restant suffisamment precis pour la maintenance et la reprise du projet.
