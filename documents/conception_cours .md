# Conception du module de gestion des cours

## 1. Objectif du module

Le module de gestion des cours permet la creation, la consultation, la modification et la suppression des cours dans le systeme de gestion des horaires.

Il constitue une entite centrale utilisee dans la planification academique et l'affectation des ressources (professeurs, salles, plages horaires).

---

## 2. Role du cours dans le systeme

Le cours est une entite principale du systeme.  
Il est utilise pour :

- etre enregistre dans la base de donnees,
- etre consulte dans les interfaces administratives,
- etre associe aux affectations de l'horaire,
- garantir une identification unique via son code.

---

## 3. Structure de la table `cours`

La conception est strictement alignee avec la structure de la base de donnees.

### Table : `cours`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_cours | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Code metier unique du cours |
| nom | VARCHAR(150) | NOT NULL | Intitule du cours |
| duree | INT | NOT NULL | Duree du cours (valeur positive) |
| programme | VARCHAR(150) | NOT NULL | Programme ou filiere cible |
| etape_etude | VARCHAR(50) | NOT NULL | Etape d'etude du cours |
| type_salle | VARCHAR(50) | NOT NULL | Type de salle requis |
| archive | TINYINT(1) | NOT NULL, DEFAULT 0 | Indicateur d'archivage (non expose par l'API actuelle) |

---

## 4. Contraintes d'integrite

- `id_cours` est la cle primaire.
- `code` est unique afin d'eviter les doublons.
- `nom`, `duree`, `programme`, `etape_etude` et `type_salle` sont obligatoires.
- `id_cours` est reference par la table `affectation_cours`.
- `archive` existe en base mais n'est pas active dans le flux API actuel.

---

## 5. Regles de validation (cote backend)

### 5.1 Code
- obligatoire
- ne peut pas etre vide
- doit etre unique

### 5.2 Nom
- obligatoire
- ne peut pas etre vide
- ne peut pas etre compose uniquement de chiffres

### 5.3 Duree
- obligatoire
- doit etre un entier strictement superieur a 0

### 5.4 Programme
- obligatoire
- ne peut pas etre vide

### 5.5 Etape d'etude
- obligatoire
- doit etre un entier entre 1 et 8

### 5.6 Type de salle
- obligatoire
- ne peut pas etre vide
- doit exister dans `salles.type`

### 5.7 Suppression
- suppression refusee si le cours est deja affecte dans `affectation_cours`

---

## 6. Fonctionnalites prevues (CRUD)

Le module doit permettre :

- **Creer** un cours
- **Lire** la liste des cours
- **Lire** un cours par identifiant
- **Modifier** les informations d'un cours
- **Supprimer** un cours (si aucune contrainte metier ne l'empeche)

---

## 7. Integration avec les autres modules et coherence technique

Le champ `id_cours` est utilise comme cle de reference dans la planification (`affectation_cours`).

Deux types d'identifiants sont utilises :

- `id_cours` -> identifiant technique interne (cle primaire)
- `code` -> identifiant metier unique utilise dans la gestion quotidienne

Points de coherence a retenir pour l'equipe :

- Le schema SQL stocke `etape_etude` en `VARCHAR(50)`, mais l'API impose actuellement une valeur entiere de 1 a 8.
- Le champ `archive` existe en base, mais il est volontairement bloque dans les validations (`archive` non autorise).

---

## 8. Conclusion

La conception du module Cours est coherente avec les routes, validations et requetes SQL du projet.

Elle garantit :

- l'integrite des donnees,
- l'unicite des cours via le code,
- une integration fluide avec les modules de planification, salles et professeurs.

Ce document constitue la base pour l'evolution des routes API, des controleurs et des tests du module.
