# Documentation — Horaire étudiant

## Présentation
Cette partie du projet permet de consulter l’horaire d’un étudiant.

Elle aide le professeur et toute personne qui utilise le projet pour la première fois à comprendre rapidement comment fonctionne cette fonctionnalité.

## Tâches couvertes
Ce document regroupe les tâches suivantes :
- Comprendre l’horaire d’un étudiant
- Expliquer la consultation de l’horaire étudiant
- Préparer les informations de l’horaire d’un étudiant

## But du module
Le but du module est de permettre la consultation simple et claire de l’horaire d’un étudiant.

Cette consultation se fait en lecture seule.

## Source des étudiants
Les étudiants sont importés à partir d’un fichier Excel fourni par l’administration.

Le fichier Excel contient les informations suivantes :
- nom
- prénom
- groupe
- programme
- étape
- matricule

## Point important sur le groupe
Le groupe est d’abord lu dans le fichier Excel lors de l’importation.

Ensuite, ce groupe doit correspondre à un groupe reconnu dans le système afin de retrouver l’horaire associé.

Cela veut dire que :
- le fichier Excel fournit le groupe de l’étudiant
- le système utilise ce groupe pour retrouver l’horaire correspondant

## Comprendre l’horaire d’un étudiant
L’horaire d’un étudiant dépend principalement de son groupe.

Le système suit cette logique :

**Étudiant importé depuis Excel → groupe de l’étudiant → horaire du groupe**

Cela signifie que l’horaire n’est pas créé séparément pour chaque étudiant.
Le système récupère l’horaire déjà lié au groupe de l’étudiant.

## Expliquer la consultation de l’horaire étudiant
Pour consulter l’horaire d’un étudiant, le fonctionnement attendu est le suivant :

1. les étudiants sont importés depuis le fichier Excel
2. le système dispose de la liste des étudiants importés
3. l’utilisateur recherche ou sélectionne un étudiant
4. le système lit les informations de cet étudiant
5. le système récupère son groupe
6. le système retrouve l’horaire associé à ce groupe
7. le système affiche l’horaire de l’étudiant

## Informations nécessaires
### Informations de l’étudiant
- matricule
- nom
- prénom
- groupe
- programme
- étape

### Informations de l’horaire
- cours
- professeur
- salle
- date
- heure de début
- heure de fin

## Rôle des informations
### Matricule
Permet d’identifier l’étudiant.

### Nom et prénom
Permettent l’affichage et la recherche.

### Groupe
Permet de faire le lien avec l’horaire.

### Programme et étape
Permettent de vérifier la cohérence des données et peuvent aider dans les filtres.

## Affichage attendu
Le système doit afficher un horaire simple à lire.

L’affichage peut contenir :
- le nom du cours
- le professeur
- la salle
- la date
- l’heure de début
- l’heure de fin

L’horaire peut aussi être présenté en vue calendrier pour faciliter la lecture.

## Vérifications importantes
Avant d’afficher l’horaire d’un étudiant, il faut vérifier que :
- le fichier Excel a bien été importé
- les colonnes nécessaires sont présentes
- l’étudiant possède un matricule
- l’étudiant possède un groupe
- le groupe peut être reconnu dans le système
- un horaire existe pour ce groupe

## Cas particuliers
Les cas suivants doivent être pris en compte :
- étudiant sans matricule
- étudiant sans groupe
- doublon de matricule
- groupe présent dans le fichier Excel mais non reconnu dans le système
- groupe reconnu mais sans horaire associé
- incohérence entre groupe, programme et étape

## Résumé
Le module de consultation de l’horaire étudiant permet d’afficher l’horaire d’un étudiant importé depuis un fichier Excel.

Le groupe est lu dans le fichier Excel, puis utilisé par le système pour retrouver l’horaire correspondant.