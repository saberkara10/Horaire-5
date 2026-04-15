# Conception - Echanges de cours entre etudiants

## 1. Objectif

Le sous-module d'echange permet de modifier localement la section suivie par
deux etudiants sur un cours commun, sans regenirer tout l'horaire.

Il s'agit d'un mecanisme de correction ciblee, pas d'un flux massif.

## 2. Positionnement architectural

Le sous-module est porte par :

- l'API etudiants ;
- le service `student-course-exchange.service.js` ;
- la table `affectation_etudiants` pour les overrides ;
- la table `echanges_cours_etudiants` pour la tracabilite.

Il reutilise les memes briques que l'horaire etudiant, ce qui garantit que la
validation et la restitution reposent sur une seule interpretation des donnees.

## 3. Decision de conception

Le projet ne deplace pas physiquement les groupes ni les affectations de base.

A la place, l'echange est modele comme :

1. une trace metier "avant / apres" ;
2. deux surcharges individuelles qui remplacent, pour un cours donne,
   l'affectation de groupe visible par l'etudiant.

Ce choix preserve :

- l'integrite de l'horaire du groupe ;
- la possibilite de reconstituer l'historique de l'echange ;
- la compatibilite avec les autres exceptions individuelles.

## 4. Donnees et relations

- `echanges_cours_etudiants` contient la transaction metier ;
- `affectation_etudiants.id_echange_cours` rattache l'override a cette transaction ;
- `id_groupe_a_avant`, `id_groupe_a_apres`, `id_groupe_b_avant`,
  `id_groupe_b_apres` capturent l'etat de l'echange ;
- l'horaire effectif est relu ensuite via `affectation_etudiants`.

## 5. Pipeline de traitement

### 5.1 Preparation

- resoudre la session cible ;
- charger un resume fiable des deux etudiants ;
- retrouver leur affectation effective sur le cours cible.

### 5.2 Validation

- retirer temporairement le cours cible du reste de l'horaire ;
- projeter les occurrences de la section cible ;
- detecter les chevauchements de date et d'heure ;
- refuser l'echange si la section est identique ou si un conflit apparait.

### 5.3 Persistence

- inserer la ligne de journal dans `echanges_cours_etudiants` ;
- supprimer les overrides individuels precedents sur ce cours ;
- recreer les overrides correspondant a la nouvelle section ;
- ne rien recreer si la section cible correspond finalement au groupe principal.

## 6. Justification du double controle

Le service execute la meme logique de validation :

- une premiere fois pour la previsualisation ;
- une seconde fois dans la transaction finale.

Ce choix evite qu'un conflit apparu entre la previsualisation et la validation
definitive passe en base.

## 7. Compatibilite avec les autres modules

- `etudiants.model.js` consomme directement les overrides crees ;
- les exports et la vue horaire peuvent afficher l'etudiant d'origine de
  l'echange ;
- la planification manuelle continue a voir l'horaire effectif sans cas special
  supplementaire.

## 8. Points de vigilance

- toute modification de la priorite entre horaire de groupe et overrides doit
  etre reverifiee ici ;
- si un cours change de structure d'occurrences, la logique de conflit doit
  rester basee sur les seances effectives et non sur un simple groupe cible ;
- la suppression d'un echange doit idealement passer par une operation metier
  dediee et non par une suppression directe en base.
