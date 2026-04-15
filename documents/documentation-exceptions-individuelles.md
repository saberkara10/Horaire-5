# Documentation - Exceptions individuelles

## 1. Objet

Cette documentation couvre le sous-module qui gere les affectations
individuelles d'etudiants en dehors de leur groupe principal.

Dans le projet, une exception individuelle peut representer :

- une reprise planifiee ;
- une affectation manuelle propre a un etudiant ;
- une section obtenue apres un echange de cours.

## 2. Fichiers de reference

- `Backend/src/services/etudiants/student-course-exchange.service.js`
- `Backend/src/model/etudiants.model.js`
- `Backend/src/services/planning/manual-planning.service.js`
- `Backend/src/services/academic-scheduler-schema.js`

## 3. Table centrale

Le support principal est `affectation_etudiants`.

Colonnes metier importantes :

- `id_etudiant`
- `id_groupes_etudiants`
- `id_cours`
- `id_session`
- `source_type`
- `id_cours_echoue`
- `id_echange_cours`

## 4. Sources fonctionnelles

| Source | Effet |
|---|---|
| `source_type = 'reprise'` | L'etudiant suit une reprise dans un groupe reel |
| `source_type = 'individuelle'` | L'etudiant suit une section hors de son groupe principal |

## 5. Effet sur l'horaire

Quand une exception individuelle existe pour un cours :

- l'horaire du groupe principal sur ce cours est masque ;
- la section individuelle devient la source visible dans l'horaire effectif.

## 6. Modules producteurs

- planification manuelle des reprises ;
- execution d'un echange de cours ;
- futures corrections manuelles par etudiant.

## 7. Modules consommateurs

- horaire etudiant ;
- exports etudiant ;
- verifications de conflits avant echange ;
- relecture des reprises planifiees.

## 8. Points de vigilance

- supprimer une exception individuelle peut faire reapparaitre l'horaire de groupe ;
- `source_type` doit rester fiable, car il pilote l'affichage et les filtres ;
- `id_echange_cours` et `id_cours_echoue` ne doivent pas etre perdus si
  l'on veut conserver la tracabilite du contexte metier.
