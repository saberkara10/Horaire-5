# Conception du module Import etudiants

## 1. Objectif

Le module d'import transforme un fichier bureautique en donnees academiques coherentes.

Il ne se limite pas a inserer des lignes :

- il valide la structure du fichier ;
- il normalise les donnees ;
- il resout la session et la cohorte cible ;
- il reequilibre les groupes ;
- il peut importer un onglet de cours echoues.

Les composants clefs sont :

- `Backend/src/services/import-etudiants.service.js`
- `Backend/src/model/import-etudiants.model.js`
- `Backend/src/validations/import-etudiants.validation.js`

## 2. Separation des responsabilites

Le module est volontairement decoupe en deux couches.

### 2.1 Service de parsing

`import-etudiants.service.js` gere :

- la lecture de fichier `xlsx`, `xls` ou `csv` ;
- la resolution des feuilles ;
- la normalisation des entetes ;
- la validation ligne par ligne ;
- la construction d'un diagnostic complet avant toute ecriture SQL.

### 2.2 Couche SQL

`import-etudiants.model.js` gere :

- les anti-doublons ;
- la resolution de session ;
- la verification des cohortes importables ;
- la creation ou la mise a jour des groupes ;
- le reequilibrage des cohortes ;
- l'insertion des cours echoues.

## 3. Structure fonctionnelle du fichier

Le module supporte deux blocs de donnees :

- une feuille principale `Etudiants` ;
- une feuille optionnelle `CoursEchoues`, `Cours Echoues` ou `Reprises`.

Cette conception permet d'importer en une seule operation :

- la cohorte principale ;
- les reprises a planifier.

## 4. Notion de cohorte

Le coeur fonctionnel de l'import est la cohorte :

- `programme`
- `etape`
- `session`

Le module regroupe les etudiants par cohorte puis reequilibre chaque cohorte
dans des groupes cibles.

Cette approche garantit qu'un import massif ne cree pas un groupe arbitraire par fichier,
mais une structure de cohortes stable dans la base.

## 5. Resolution de session

La session peut etre :

- fournie explicitement dans le fichier ;
- deduite a partir du texte ;
- derivee de la session active si le fichier ne la renseigne pas.

Le module tente aussi de retrouver l'identifiant de session reelle en base.
Si aucune session compatible n'existe, la cohorte peut etre ignoree avec un motif explicite.

## 6. Reequilibrage des groupes

L'import ne laisse pas les groupes dans un etat arbitraire.

Apres insertion ou mise a jour des etudiants, le module peut :

- retrouver les groupes existants d'une cohorte ;
- calculer le nombre cible de groupes ;
- recalculer une repartition equilibree ;
- renommer ou creer les groupes manquants ;
- rattacher chaque etudiant au bon groupe.

Cette etape est essentielle pour la planification ulterieure.

## 7. Cours echoues

L'import de reprises suit une logique stricte :

- le matricule doit exister ou etre importe dans le meme lot ;
- le code de cours doit exister dans le catalogue ;
- la session cible doit etre resolvable ;
- la session cible doit rester compatible avec l'etudiant.

Le resultat est persiste dans `cours_echoues`.

## 8. Contraintes metier

- aucune ecriture SQL definitive tant que les validations de structure echouent ;
- matricule unique ;
- etape entre `1` et `8` ;
- session academique normalisable ;
- cohorte importable seulement si la base sait la relier a une session et a un catalogue actif.

## 9. Points de vigilance

- un fichier techniquement valide peut produire des cohortes ignorees si la session n'existe pas ;
- l'import a un impact direct sur les groupes et donc sur les futures generations d'horaires ;
- la feuille des reprises est facultative mais, si elle est presente, elle doit etre aussi propre que la feuille principale.

## 10. Conclusion

Le module d'import est un pipeline de qualite de donnees.

Sa responsabilite principale est de garantir que les donnees etudiantes
entrent dans le systeme sous une forme directement exploitable par les
modules Groupes, Scheduler, Dashboard et Export.
