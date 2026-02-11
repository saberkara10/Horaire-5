# Conception du module de gestion des professeurs

## 1. Objectif du module

Le module de gestion des professeurs permet la création, la consultation, la modification et la suppression des professeurs dans le système de gestion des horaires.

Il constitue une entité centrale utilisée dans la planification académique et l’affectation des cours.

---

## 2. Rôle du professeur dans le système

Le professeur est une entité principale du système.  
Il est utilisé pour :

- être enregistré dans la base de données,
- être consulté dans les interfaces administratives,
- être associé aux horaires et aux cours,
- garantir une identification unique via son matricule.

---

## 3. Structure de la table `professeurs`

La conception est strictement alignée avec la structure de la base de données.

### Table : `professeurs`

| Champ | Type | Contraintes | Description |
|--------|--------|------------|------------|
| id_professeur | INT | PRIMARY KEY, AUTO_INCREMENT | Identifiant technique unique |
| matricule | VARCHAR(50) | NOT NULL, UNIQUE | Identifiant métier unique du professeur |
| nom | VARCHAR(100) | NOT NULL | Nom de famille |
| prenom | VARCHAR(100) | NOT NULL | Prénom |
| specialite | VARCHAR(100) | NULL autorisé | Matière ou domaine enseigné |

---

## 4. Contraintes d’intégrité

- `id_professeur` est la clé primaire.
- `matricule` est unique afin d’éviter les doublons.
- `nom` et `prenom` sont obligatoires.
- `specialite` est optionnelle.

---

## 5. Règles de validation (côté backend)

### 5.1 Matricule
- obligatoire
- maximum 50 caractères
- doit être unique

### 5.2 Nom et prénom
- obligatoires
- ne peuvent pas être vides
- maximum 100 caractères

### 5.3 Spécialité
- optionnelle
- maximum 100 caractères

---

## 6. Fonctionnalités prévues (CRUD)

Le module doit permettre :

- **Créer** un professeur
- **Lire** la liste des professeurs
- **Lire** un professeur par identifiant
- **Modifier** les informations d’un professeur
- **Supprimer** un professeur (si aucune contrainte métier ne l’empêche)

---

## 7. Intégration avec les autres modules

Le champ `id_professeur` sera utilisé comme clé de référence dans les tables liées aux horaires et aux cours.

Deux types d’identifiants sont utilisés :

- `id_professeur` → identifiant technique interne (clé primaire)
- `matricule` → identifiant métier unique utilisé pour distinguer les professeurs

Cette séparation garantit une meilleure organisation des données et facilite les relations entre les tables.

---

## 8. Conclusion

La conception du module Professeurs est cohérente avec la structure réelle de la base de données.

Elle garantit :

- l’intégrité des données,
- l’unicité des professeurs via le matricule,
- une intégration fluide avec les modules horaires et cours.

Ce document constitue la base pour le développement des routes API, des contrôleurs et des tests du module.
