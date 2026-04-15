# Conception - Replanification intelligente

## 1. Objet

Cette conception decrit la strategie retenue pour modifier une affectation
existante sans relancer la generation complete du scheduler.

Le besoin n'est pas une creation de seance. C'est un remplacement controle,
trace et valide d'une affectation deja planifiee.

## 2. Principe directeur

La replanification intelligente repose sur une separation stricte :

- `creation` : insertion d'une nouvelle seance ;
- `modification` : remplacement coherent d'une seance existante ;
- `what-if` : simulation read-only obligatoire avant toute ecriture.

Cette separation evite trois derives :

- doublonner involontairement une occurrence ;
- contourner les contraintes deja appliquees par le moteur ;
- perdre la capacite d'expliquer pourquoi une modification a ete acceptee ou rejetee.

## 3. Composants retenus

- `ScheduleModificationService` : orchestration metier, resolution de portee,
  transaction SQL, journalisation.
- `ScheduleModificationController` : exposition HTTP et propagation de
  l'utilisateur courant pour l'audit.
- `ScenarioSimulator` : simulation obligatoire avant ecriture.
- `ScheduleMutationValidator` : validation dure locale sur clone de matrice.
- `ScheduleSnapshot` : source de verite read-only partagee entre simulation et scoring.
- `ScheduleScorer` via le snapshot : comparaison avant/apres selon le mode
  `etudiant`, `professeur` ou `equilibre`.

## 4. Portees supportees

- `THIS_OCCURRENCE` : une seule occurrence.
- `THIS_AND_FOLLOWING` : occurrence cible et suivantes dans la meme serie.
- `ALL_OCCURRENCES` : toutes les occurrences de la serie.
- `DATE_RANGE` : sous-ensemble borne par dates dans une serie existante.

Quand une serie est deplacee, la nouvelle date d'ancrage conserve un pas
hebdomadaire de 7 jours. Cela maintient une recurrence explicable au lieu
d'appliquer une date fixe a toutes les occurrences.

## 5. Flux metier

### 5.1 Simulation

1. charger le snapshot officiel de la session ;
2. resoudre les occurrences ciblees selon la portee ;
3. construire les placements proposes ;
4. simuler sur copie avec `ScenarioSimulator.simulatePlacementMutations` ;
5. bloquer si la mutation est infaisable ou cree des conflits ;
6. avertir si le score se degrade fortement.

### 5.2 Application

1. verrouiller les occurrences ciblees avec `FOR UPDATE` ;
2. creer de nouvelles plages horaires dediees aux occurrences modifiees ;
3. mettre a jour les affectations ciblees dans une transaction unique ;
4. decouper la serie si la portee ne couvre qu'une partie du motif ;
5. recalculer les bornes des series restantes ;
6. nettoyer les plages et series devenues orphelines ;
7. inserer le journal metier avant commit.

## 6. Pourquoi le what-if est obligatoire

- le moteur stable existe deja et doit rester l'autorite metier ;
- la validation read-only produit une explication exploitable par l'API ;
- le score avant/apres permet de distinguer blocage dur et degradation de confort ;
- aucun ecrit partiel n'est autorise si la simulation bloque.

## 7. Gestion des reprises

Les etudiants en reprise participent a la validation de conflits comme les autres
participants reels. Un conflit horaire individuel reste bloquant.

En revanche, une degradation de confort dans leur emploi du temps ne doit pas
devenir un veto autonome si la mutation reste faisable. Cette nuance est geree
par le couple validation dure + scoring read-only.

## 8. Traçabilite

Chaque modification persistée enregistre :

- l'affectation de reference ;
- la serie de reference si elle existe ;
- la portee ;
- l'utilisateur ;
- les anciennes valeurs ;
- les nouvelles valeurs ;
- le rapport de simulation ;
- les avertissements eventuels.

La table `journal_modifications_affectations_scheduler` sert de registre
d'audit et de point d'appui pour l'analyse future des corrections.
