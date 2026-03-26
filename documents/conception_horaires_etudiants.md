# Conception — Horaire étudiant

## Présentation
Ce document présente la conception fonctionnelle du module de consultation de l’horaire étudiant.

Il regroupe les tâches suivantes :
-Comprendre l’horaire d’un étudiant
-Expliquer la consultation de l’horaire étudiant
-Préparer les informations de l’horaire d’un étudiant

## Objectif
Définir clairement comment le module doit fonctionner avant le développement.

## Idée générale
Le module doit permettre de retrouver l’horaire d’un étudiant à partir des données importées depuis un fichier Excel.

L’étudiant est identifié par ses informations personnelles, mais la liaison principale avec l’horaire se fait par le groupe.

## Source des données
Les étudiants proviennent d’un fichier Excel contenant :
- nom
- prénom
- groupe
- programme
- étape
- matricule

## Logique du groupe
Le groupe de l’étudiant est fourni dans le fichier Excel.

Ce groupe sert ensuite à faire le lien avec les groupes gérés dans le système afin de retrouver l’horaire du groupe.

La logique du module est donc :

**Fichier Excel → étudiant importé → groupe lu dans le fichier → groupe reconnu dans le système → horaire retrouvé**

## Relation principale
La relation principale du module est :

**Étudiant → Groupe → Horaire**

Cela signifie que le système ne crée pas un horaire étudiant par étudiant.

Le système récupère l’horaire associé au groupe auquel l’étudiant appartient.

## Fonctionnement du module
Le fonctionnement prévu suit les étapes suivantes :

1. importer le fichier Excel des étudiants
2. lire les données du fichier
3. enregistrer ou utiliser la liste des étudiants importés
4. permettre la recherche ou la sélection d’un étudiant
5. récupérer le groupe de l’étudiant
6. faire le lien avec le groupe correspondant dans le système
7. retrouver l’horaire lié à ce groupe
8. afficher l’horaire

## Données nécessaires
### Données étudiant
- matricule
- nom
- prénom
- groupe
- programme
- étape

### Données d’horaire
- groupe
- cours
- professeur
- salle
- date
- heure de début
- heure de fin

## Préparation des informations
Pour que la consultation fonctionne correctement, le système doit disposer des informations suivantes :

### Pour identifier l’étudiant
- matricule
- nom
- prénom

### Pour faire le lien avec l’horaire
- groupe

### Pour vérifier la cohérence
- programme
- étape

### Pour afficher l’horaire
- cours
- professeur
- salle
- date
- heure de début
- heure de fin

## Parcours utilisateur
Le parcours prévu pour la consultation est le suivant :

1. l’utilisateur ouvre la section des horaires étudiants
2. il consulte ou recherche un étudiant importé
3. il sélectionne un étudiant
4. le système récupère le groupe de cet étudiant
5. le système retrouve l’horaire associé à ce groupe
6. le système affiche l’horaire

## Vue calendrier
Le module doit permettre un affichage en vue calendrier.

Cette vue doit aider à lire rapidement :
- les dates
- les heures
- les cours
- les salles
- les professeurs

## Contraintes
Le module dépend des éléments suivants :
- le fichier Excel doit être valide
- les colonnes nécessaires doivent être présentes
- le matricule doit être utilisable
- le groupe doit être renseigné dans le fichier
- le groupe doit pouvoir être reconnu dans le système
- un horaire doit exister pour ce groupe

## Cas limites
Les cas suivants doivent être prévus :
- matricule manquant
- groupe manquant
- doublon de matricule
- groupe présent dans le fichier Excel mais absent du système
- groupe reconnu mais sans horaire
- incohérence entre groupe, programme et étape

## Résultat attendu
Le système doit permettre de consulter l’horaire d’un étudiant importé à partir d’un fichier Excel.

Le groupe est lu dans le fichier, puis utilisé comme lien principal pour retrouver l’horaire correspondant dans le système.

## Conclusion
La conception du module repose sur une logique simple :
- les étudiants viennent d’un fichier Excel
- chaque étudiant possède un matricule et un groupe
- le groupe sert de lien avec l’horaire
- le système affiche ensuite l’horaire de manière claire