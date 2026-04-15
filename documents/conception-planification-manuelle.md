# Conception - Planification manuelle

## 1. Objectif

La planification manuelle sert de couche de correction locale par-dessus
l'horaire existant.

Elle repond a un besoin different du scheduler complet :

- agir vite sur une seance cible ;
- garantir les contraintes metier avant ecriture ;
- conserver une tracabilite des recurrences manuelles.

## 2. Positionnement

Le sous-module est branche sur `/api/horaires` mais il n'est pas limite au CRUD
classique. Il introduit une logique de domaine supplementaire :

- calcul de portee ;
- validation sur participants reels ;
- maintenance de `planification_series` ;
- rattachement individuel des reprises.

## 3. Briques principales

- `recupererContextePlanification` charge les ressources metier ;
- `recupererParticipantsSeance` calcule l'effectif reel ;
- `validerOccurrenceGroupe` centralise les controles ;
- `creerSeriePlanification` et `mettreAJourSeriePlanification` maintiennent les
  recurrences ;
- `listerGroupesCompatiblesPourCoursEchoue` prepare la planification des reprises.

## 4. Decision de conception : valider avant persister

Le service ne cree jamais une affectation "a corriger plus tard".

Le principe retenu est :

1. charger tout le contexte utile ;
2. valider l'occurrence avec les contraintes de salle, professeur, groupe et
   etudiants ;
3. seulement ensuite ecrire l'affectation.

Cette approche limite fortement la creation d'horaires incoherents.

## 5. Recurrence manuelle

La recurrence n'est pas derivee implicitement des dates.
Elle est modelisee explicitement par `planification_series`.

Avantages :

- une occurrence peut etre reliee a une serie ;
- la replanification peut viser une occurrence, la suite de la serie ou une
  plage personnalisee ;
- les metadonnees de debut et fin peuvent etre recalculees apres suppression.

## 6. Gestion des reprises

La reprise suit un modele hybride :

- le besoin pedagogique reste dans `cours_echoues` ;
- le rattachement concret passe par `affectation_etudiants`.

Cette separation permet :

- de suivre les reprises non planifiees ;
- de rattacher l'etudiant a un groupe reel existant ;
- de ne pas dupliquer l'infrastructure de groupe pour chaque reprise.

## 7. Conflits et priorites

La validation applique les priorites suivantes :

- integrite de la session ;
- compatibilite pedagogique ;
- disponibilite des ressources ;
- non-chevauchement des groupes ;
- non-chevauchement des etudiants reels.

La contrainte "etudiants reels" est decisive : elle protege aussi les etudiants
de reprise deja rattaches a la seance.

## 8. Relations avec les autres modules

- `horaire.js` appelle ce sous-module comme facade de domaine ;
- `availability-rescheduler.js` traite une autre forme de correction locale,
  provoquee cette fois par les disponibilites professeur ;
- `etudiants.model.js` consomme ensuite les reprises et exceptions creees ici
  pour reconstruire l'horaire effectif.

## 9. Points de vigilance

- toute evolution de `planification_series` doit rester compatible avec les
  migrations v10+ et le bootstrap runtime ;
- les reprises planifiees manuellement impactent directement la vue horaire
  etudiant ;
- les suppressions doivent nettoyer les series orphelines pour garder un
  historique coherent.
