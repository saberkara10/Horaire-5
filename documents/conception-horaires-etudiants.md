# Conception - Horaires etudiants

## 1. Objectif

Le module horaires etudiants fournit une vue metier consolidee de ce qu'un
etudiant doit reellement suivre dans la session active.

La conception actuelle repose sur une idee simple :

- le groupe principal reste la base de l'horaire ;
- les exceptions individuelles peuvent remplacer ce socle pour un cours cible ;
- les reprises et les echanges de cours reutilisent la meme mecanique de
  surcharge individuelle.

## 2. Positionnement dans l'architecture

Le module se situe a l'intersection de trois sous-systemes :

- la gestion des etudiants ;
- la planification standard / manuelle ;
- le scheduler academique et ses reprises.

Le point d'entree HTTP est `Backend/routes/etudiants.routes.js`.
La composition de la vue est principalement portee par :

- `Backend/src/model/etudiants.model.js`
- `Backend/src/services/etudiants/student-course-exchange.service.js`

## 3. Vue structurelle

La chaine de responsabilite est la suivante :

1. retrouver la fiche etudiante et son groupe principal ;
2. reconstruire l'horaire de groupe ;
3. retrouver les affectations individuelles actives ;
4. neutraliser l'horaire de groupe pour les cours surchargés individuellement ;
5. fusionner, trier et enrichir la reponse.

## 4. Donnees et relations

Les relations cle sont :

- `etudiants -> groupes_etudiants`
- `groupes_etudiants -> affectation_groupes -> affectation_cours -> plages_horaires`
- `etudiants -> affectation_etudiants`
- `affectation_etudiants -> cours_echoues` pour les reprises
- `affectation_etudiants -> echanges_cours_etudiants` pour les echanges cibles

En pratique, `affectation_etudiants` joue le role de couche d'override.
Elle permet de dire :

- "cet etudiant suit ce cours ailleurs que dans son groupe" ;
- "cet etudiant suit une reprise" ;
- "cet etudiant a change de section via un echange".

## 5. Decision de conception majeure

Le projet ne cree pas un horaire complet physiquement dedie a chaque etudiant.

Le choix retenu est plus economique et plus maintenable :

- l'horaire normal reste porte par les groupes ;
- seules les deviations necessaires sont stockees individuellement ;
- la vue finale est reconstruite a la lecture.

Avantages :

- moins de duplication de donnees ;
- corrections locales plus simples ;
- echanges et reprises geres avec le meme mecanisme.

Contrainte :

- la lecture doit fusionner plusieurs sources et appliquer des regles de priorite.

## 6. Gestion des reprises

Une reprise suit deux etats principaux :

- presence declarative dans `cours_echoues` ;
- rattachement effectif a un groupe via `affectation_etudiants`.

La conception distingue volontairement :

- la dette academique de l'etudiant ;
- sa planification concrete dans l'horaire.

## 7. Gestion des exceptions individuelles

Les exceptions individuelles couvrent :

- les corrections manuelles d'affectation ;
- les echanges cibles de cours entre etudiants.

Quand une exception existe pour un cours donne, le module cache la section du
groupe principal sur ce cours afin que l'horaire rendu reste coherent.

## 8. Flux d'echange de cours

La conception du flux d'echange suit deux phases :

### 8.1 Phase de previsualisation

- charger les deux etudiants ;
- identifier leur affectation effective sur le cours commun ;
- retirer temporairement ce cours de leur horaire ;
- verifier si la section de l'autre etudiant cree un conflit ;
- retourner un diagnostic sans ecriture.

### 8.2 Phase d'execution

- rejouer la validation dans une transaction ;
- creer une trace metier dans `echanges_cours_etudiants` ;
- mettre a jour les deux overrides individuels dans `affectation_etudiants`.

## 9. Diagrammes existants

Les diagrammes suivants restent pertinents comme vue de base :

- [Horaire etudiants - classes](diagrammes/horaires-etudiants-class.svg)
- [Horaire etudiants - sequence](diagrammes/horaires-etudiants-sequence.svg)

Ils doivent toutefois etre lus avec la realite suivante :

- la vue etudiant integre maintenant aussi les exceptions individuelles ;
- l'echange de cours introduit un second niveau de variation par rapport au
  diagramme d'origine.

## 10. Points de vigilance

- la session active influence directement la composition de l'horaire ;
- les echanges de cours et les reprises partagent la meme table d'override ;
- toute evolution sur `affectation_etudiants` doit etre reverifiee cote
  horaires etudiants, exports et planification manuelle.

## 11. Conclusion

La conception actuelle des horaires etudiants est celle d'une vue composite.
Le groupe principal fournit le socle, puis les surcharges individuelles
redefinissent localement ce socle pour garder une representation fidele de
l'horaire reel de chaque etudiant.
