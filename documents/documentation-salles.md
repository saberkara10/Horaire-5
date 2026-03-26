# Documentation - Module de gestion des salles

## 1. Objectif

Le module Salles vise a gerer les salles utilisees dans la planification :

- creation ;
- consultation ;
- modification ;
- suppression sous contrainte metier.

## 2. Etat reel dans le depot

Le projet contient aujourd'hui :

- une table `salles` dans `Backend/Database/GDH5.sql` ;
- une page frontend `Frontend/src/pages/SallesPage.jsx` ;
- des diagrammes et documents de conception associes.

En revanche, le depot ne contient pas de route backend `salles` branchee dans l'entree lancee par defaut (`Backend/src/server.js` -> `Backend/src/app.js`).

Cette documentation decrit donc :

- la structure de donnees reelle ;
- le role metier du module ;
- le contrat cible attendu si le module backend est branche.

## 3. Structure de donnees reelle

Source : `Backend/Database/GDH5.sql`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| `id_salle` | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique |
| `code` | VARCHAR(50) | NOT NULL, UNIQUE | Code metier de la salle |
| `type` | VARCHAR(50) | NOT NULL | Type de salle |
| `capacite` | INT | NOT NULL | Capacite maximale |

## 4. Role metier

La salle intervient dans la planification avec les autres ressources :

- un cours ;
- un professeur ;
- une plage horaire ;
- un ou plusieurs groupes.

La table `affectation_cours` reference deja `id_salle` dans le schema SQL.

## 5. Contrat cible attendu

Si le module backend `salles` est branche, le contrat attendu est le suivant :

- `GET /api/salles`
- `GET /api/salles/:id`
- `POST /api/salles`
- `PUT /api/salles/:id`
- `DELETE /api/salles/:id`

Ce contrat correspond a la logique du frontend et aux schemas de conception, mais il n'est pas active dans l'entree backend par defaut.

## 6. Regles metier attendues

- le code de salle doit etre unique ;
- le type et la capacite sont obligatoires ;
- une salle deja referencee dans une affectation ne doit pas etre supprimee sans controle.

## 7. Conclusion

Le module Salles est bien present au niveau conception, SQL et interface, mais il n'est pas encore integre au backend demarre par defaut. Cette documentation l'indique explicitement pour eviter toute contradiction avec le projet reel.
