# Conception du module Etudiants

## 1. Objectif

Le module Etudiants fournit la vision individuelle du systeme.

Il couvre :

- la consultation des etudiants ;
- la lecture detaillee d'un etudiant ;
- la construction de l'horaire individuel ;
- l'import massif depuis fichier ;
- la suppression globale des donnees importees.

Les points d'entree principaux sont :

- `Backend/routes/etudiants.routes.js`
- `Backend/src/model/etudiants.model.js`
- `Backend/src/services/import-etudiants.service.js`

## 2. Place du module dans l'architecture

Le module Etudiants n'est pas un simple catalogue de personnes.

Il sert a assembler trois couches :

- l'identite et la cohorte principale ;
- le groupe principal rattache ;
- les reprises individuelles liees aux cours echoues.

L'horaire individuel final est donc une agregation, pas une lecture directe d'une seule table.

## 3. Sources de donnees

Le module lit principalement :

- `etudiants`
- `groupes_etudiants`
- `affectation_groupes`
- `affectation_cours`
- `plages_horaires`
- `affectation_etudiants`
- `cours_echoues`
- `cours`

## 4. Vision metier de l'etudiant

Un etudiant peut etre expose sous trois angles :

- son identite academique ;
- son appartenance a une cohorte principale ;
- sa charge totale incluant les reprises.

Le module calcule explicitement :

- `nb_cours_normaux`
- `nb_reprises`
- `charge_cible`

## 5. Construction de l'horaire individuel

Le module assemble :

- l'horaire du groupe principal ;
- l'horaire des rattachements individuels de reprise ;
- les metadonnees de statut de reprise.

Chaque seance est normalisee avec :

- `est_reprise`
- `source_horaire`
- `groupe_source`
- `statut_reprise`
- `note_echec`

## 6. Import etudiants

L'import n'est pas gere directement dans la route.

La route appelle un service specialise qui :

- lit le fichier ;
- valide la structure ;
- parse les etudiants ;
- parse optionnellement les cours echoues ;
- declenche ensuite la persistence SQL transactionnelle.

L'import est donc une extension du module Etudiants, mais sa conception detaillee
est documentee separement dans `conception-import-etudiants.md`.

## 7. Contraintes metier

- le matricule identifie l'etudiant de facon stable ;
- la session et la cohorte doivent rester coherentes ;
- une reprise ne doit pas se superposer a l'horaire principal ;
- la suppression globale doit enlever les donnees importees et les groupes orphelins.

## 8. Points de vigilance

- l'horaire individuel peut combiner plusieurs sources de planning ;
- la qualite de l'affichage depend directement de la qualite de `affectation_etudiants` ;
- la suppression globale est une operation lourde a reserver a l'administration.

## 9. Conclusion

Le module Etudiants fait le lien entre le referentiel administratif,
la planification de groupe et les exceptions individuelles.
