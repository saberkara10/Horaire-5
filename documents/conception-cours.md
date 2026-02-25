# Conception du module de gestion des cours

## 1. Objectif du module

Le module de gestion des cours permet de créer, consulter, modifier et supprimer les cours dans l’application de gestion des horaires.

Il constitue une entité centrale utilisée dans la planification académique.

---

## 2. Rôle du cours dans le système

Le cours représente une activité académique planifiée dans une salle, à une date et une plage horaire précises.

Chaque cours possède un code unique permettant de l’identifier dans le système.

Le cours est utilisé pour :

- être associé à un professeur,
- être planifié dans une salle,
- être intégré dans un horaire,
- être lié à des groupes d’étudiants.

---

## 3. Informations d’un cours

Un cours contient :

- un code unique
- un nom
- une durée en heures
- un programme
- une étape d’étude (1, 2 ou 3)
- un type de salle requis

Le code est l’identifiant métier principal.

---

## 4. Règles de validation

Lors de la création ou de la modification :

- Le code est obligatoire et doit être unique.
- Le nom est obligatoire.
- La durée doit être un nombre entier strictement supérieur à zéro.
- Le programme est obligatoire.
- L’étape d’étude doit être 1, 2 ou 3.
- Le type de salle doit correspondre à un type existant.
- Deux cours peuvent avoir le même nom, mais jamais le même code.

---

## 5. Fonctionnalités du module

Le module permet :

- La création d’un cours.
- La consultation de la liste des cours.
- La consultation d’un cours spécifique.
- La modification des informations d’un cours.
- La suppression d’un cours.

---

## 6. Règles de suppression

La suppression d’un cours est autorisée uniquement s’il n’est pas déjà utilisé dans un horaire.

Si le cours est associé à une affectation existante, le système doit refuser la suppression afin de préserver l’intégrité des données.

---

## 7. Intégration avec les autres modules

Le module Cours est lié :

- au module Professeurs,
- au module Salles,
- au module Plages horaires,
- au module Groupes étudiants.

Le cours est donc une entité centrale dans le système de planification.

---

## 8. Conclusion

Le module de gestion des cours permet d’assurer une planification académique structurée et cohérente.

Il garantit :

- l’unicité des cours,
- la validité des informations,
- la cohérence avec les autres modules,
- la prévention des conflits lors de la suppression.