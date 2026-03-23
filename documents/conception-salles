# Conception du module de gestion des salles

## 1. Objectif du module

Le module de gestion des salles permet la creation, la consultation, la modification et la suppression des salles dans le systeme de gestion des horaires.

Il constitue une entite essentielle utilisee dans la planification academique et l'affectation des ressources.

---

## 2. Role de la salle dans le systeme

La salle est une entite principale du systeme.  
Elle est utilisee pour :

- etre enregistree dans la base de donnees,
- etre consultee dans les interfaces administratives,
- etre associee aux affectations de l'horaire,
- garantir une identification unique via son code,
- verifier la compatibilite entre le type de salle et les besoins du cours,
- eviter les conflits d'occupation lors de la planification.

---

## 3. Structure de la table `salles`

La conception est strictement alignee avec la structure de la base de donnees.

### Table : `salles`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_salle | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Code metier unique de la salle |
| type | VARCHAR(50) | NOT NULL | Type de salle |
| capacite | INT | NOT NULL | Capacite maximale de la salle |

---

## 4. Contraintes d'integrite

- `id_salle` est la cle primaire.
- `code` est unique afin d'eviter les doublons.
- `type` et `capacite` sont obligatoires.
- `id_salle` est reference par la table `affectation_cours`.
- une salle deja utilisee dans une affectation horaire doit etre protegee contre une suppression non controlee.

---

## 5. Regles de validation (cote backend)

### 5.1 Code
- obligatoire
- ne peut pas etre vide
- doit etre unique
- longueur maximale coherente avec la base : 50 caracteres

### 5.2 Type
- obligatoire
- ne peut pas etre vide
- doit representer un type de salle valide

### 5.3 Capacite
- obligatoire
- doit etre un entier strictement superieur a 0

### 5.4 Suppression
- suppression refusee si la salle est deja affectee dans `affectation_cours`

---

## 6. Fonctionnalites prevues (CRUD)

Le module doit permettre :

- **Creer** une salle
- **Lire** la liste des salles
- **Lire** une salle par identifiant
- **Modifier** les informations d'une salle
- **Supprimer** une salle (si aucune contrainte metier ne l'empeche)

---

## 7. Integration avec les autres modules et coherence technique

Le champ `id_salle` est utilise comme cle de reference dans la planification (`affectation_cours`).

Deux types d'identifiants sont utilises :

- `id_salle` -> identifiant technique interne (cle primaire)
- `code` -> identifiant metier unique utilise dans la gestion quotidienne

Points de coherence a retenir pour l'equipe :

- le module salles doit rester coherent avec le module cours, car chaque cours demande un `type_salle`,
- la salle doit pouvoir etre selectionnee uniquement si elle correspond au type requis et si elle n'est pas deja occupee sur la plage horaire choisie,
- la capacite doit rester une valeur positive afin d'assurer la coherence des affectations futures.

---

## 8. Conclusion

La conception du module Salles est coherente avec le cahier des charges et la structure de la base de donnees.

Elle garantit :

- l'integrite des donnees,
- l'unicite des salles via le code,
- une integration fluide avec les modules de planification et de gestion des cours.

Ce document constitue la base pour l'evolution des routes API, des validations et des tests du module.