# Conception du module Dashboard

## 1. Objectif

Le dashboard est une couche de lecture agregee.

Il ne produit pas de donnees metier nouvelles, mais consolide l'etat du systeme
pour l'administration et le pilotage academique.

Le point d'entree principal est :

- `Backend/routes/dashboard.routes.js`

## 2. Role dans l'architecture

Le dashboard se situe entre :

- les modules de production de donnees ;
- les responsables qui doivent prendre une decision rapide.

Il synthese :

- les volumes globaux ;
- l'etat de la session active ;
- l'effet du dernier calcul de generation ;
- les groupes encore non couverts ;
- les cas particuliers qui bloquent la planification.

## 3. Nature du module

Le module est volontairement :

- en lecture seule ;
- derive ;
- centree sur des indicateurs metier.

Il ne doit pas contenir de logique transactionnelle lourde.

## 4. Agregats calcules

Le module calcule quatre familles d'indicateurs :

- compteurs globaux de reference ;
- statistiques de la session active ;
- dernier rapport de generation ;
- listes courtes de surveillance.

Exemples :

- nombre de cours actifs ;
- nombre de professeurs ;
- nombre de groupes actifs ;
- etudiants sans groupe ;
- groupes sans horaire ;
- score du dernier rapport.

## 5. Construction des alertes

Le dashboard transforme ensuite ces chiffres en `cas_particuliers`.

La logique actuelle signale notamment :

- les etudiants sans groupe ;
- les groupes actifs sans horaire ;
- les cours non planifies au dernier calcul ;
- l'absence de blocage majeur si tous les indicateurs sont au vert.

Le dashboard ne se contente donc pas d'exposer des comptes ; il propose une lecture priorisee.

## 6. Dependances principales

Le module lit :

- `sessions`
- `cours`
- `professeurs`
- `salles`
- `etudiants`
- `groupes_etudiants`
- `affectation_groupes`
- `affectation_cours`
- `plages_horaires`
- `rapports_generation`

## 7. Points de vigilance

- le dashboard depend fortement de la qualite de la session active ;
- l'absence de table `rapports_generation` est geree comme un cas sans historique ;
- les listes recents et alertes doivent rester courtes pour garder une lecture rapide.

## 8. Conclusion

Le module Dashboard est la facade analytique du projet.

Il traduit l'etat brut de la base en signaux de pilotage exploitables
par l'equipe de gestion.
