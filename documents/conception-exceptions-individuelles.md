# Conception - Exceptions individuelles

## 1. Objectif

Les exceptions individuelles permettent de modifier localement l'horaire d'un
etudiant sans casser l'horaire de son groupe principal.

## 2. Principe retenu

Le projet ne clone pas l'horaire complet de chaque etudiant.

A la place :

- le groupe principal porte l'horaire normal ;
- `affectation_etudiants` stocke uniquement les deviations necessaires ;
- la vue finale est recomposee a la lecture.

## 3. Types d'exceptions

- reprise d'un cours echoue ;
- affectation individuelle ponctuelle ;
- resultat d'un echange de cours.

## 4. Relation avec les autres modules

- la planification manuelle cree les reprises individuelles ;
- le service d'echange cree les exceptions liees aux permutations de section ;
- le module horaires etudiants fusionne ensuite ces sources.

## 5. Decision de conception

Un override individuel sur un cours remplace la lecture de groupe pour ce meme
cours. Cette priorite est la regle structurante du sous-module.

Sans cette priorite, l'etudiant verrait deux sections simultanees pour un meme
cours.

## 6. Points de vigilance

- toute evolution de `affectation_etudiants` impacte les horaires, les exports,
  les echanges de cours et les reprises ;
- les contraintes d'unicite doivent empecher les doublons sur un meme cours ;
- une exception individuelle doit toujours rester rattachee a une session.
