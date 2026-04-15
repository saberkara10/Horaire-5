# Conception - Migrations et evolution de schema

## 1. Objectif

Le projet utilise une conception de migration pragmatique, orientee reprise de
projet et compatibilite avec plusieurs etats de base existants.

Le but n'est pas uniquement de "versionner" la base, mais de garantir qu'un
module critique puisse demarrer avec le schema minimal dont il depend.

## 2. Architecture retenue

La conception repose sur deux couches :

### 2.1 Scripts explicites

Les scripts `run_migration*.js` portent les evolutions structurantes et
documentees.

Ils sont adaptes aux operations :

- executees manuellement ;
- auditables ;
- relanceables de facon idempotente.

### 2.2 Evolution runtime

`assurerSchemaSchedulerAcademique` agit comme une couche de compatibilite.

Il sert lorsque le code avance ne peut pas se permettre d'echouer parce qu'une
colonne ou une table recente manque encore dans une base existante.

## 3. Decision de conception majeure

Le depot accepte explicitement qu'une base puisse etre :

- ancienne mais encore exploitee ;
- partiellement migree ;
- alimentee par un dump historique.

La contrepartie est l'obligation d'ecrire des migrations idempotentes et
defensives.

## 4. Module d'evolution runtime

`academic-scheduler-schema.js` suit une logique simple :

1. detecter l'existence d'une table, colonne, contrainte ou index ;
2. ne modifier le schema que si l'element manque ;
3. memoriser l'execution au niveau du pool pour eviter les controles repetes.

Cette approche limite :

- les erreurs de doublon ;
- les ralentissements sur appels repetes ;
- les divergences de schema entre environnements proches.

## 5. Perimetre du bootstrap runtime

Le bootstrap runtime ne doit pas devenir un moteur de migration generaliste.
Son perimetre actuel est volontairement limite aux besoins du scheduler
academique et de la planification manuelle :

- overrides etudiants ;
- echanges de cours ;
- reprises ;
- recurrences manuelles ;
- index de groupes par session.

## 6. Justification des index et contraintes

Plusieurs contraintes sont presentes pour proteger la coherence metier :

- unicite d'une affectation individuelle sur un meme couple
  `etudiant + groupe + cours + session + source_type` ;
- index sur `id_echange_cours` pour relire rapidement les echanges ;
- unicite `(id_session, nom_groupe)` pour eviter les collisions de groupes
  inter-sessions.

## 7. Interaction avec les tests

En environnement `test`, le bootstrap runtime est neutralise.

Raison :

- les tests doivent maitriser explicitement leur schema ;
- une migration automatique masquerait des problemes de fixture ;
- le comportement devient plus deterministe.

## 8. Risques connus

- divergence entre script manuel et bootstrap runtime ;
- dette technique si trop d'evolutions restent uniquement au runtime ;
- difficultes de support si une contrainte change de nom sans mise a jour
  coordonnee des scripts.

## 9. Orientation future

Si le projet continue d'evoluer, la cible ideale serait :

- un registre explicite de version de schema ;
- un historique complet des migrations ;
- un runtime garde uniquement pour les verifications non invasives.

En l'etat, la conception hybride reste cependant coherente avec un projet
repris et enrichi progressivement.
