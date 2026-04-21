# Centre documentaire Horaires-5

Ce fichier est le point d'entree unique de toute la documentation du projet **Horaires-5**.  
Chaque lien ci-dessous est cliquable et redirige directement vers le fichier cible.

## 1. Lecture prioritaire

- Pour obtenir la vision la plus complete et transversale du projet : [Documentation complete Horaires-5](Documentation-complete-horaires-5.md)
- Pour consulter le cahier des charges en version Markdown : [Cahier des charges](Cahier_de_charge_G5_VF.md)
- Pour ouvrir la version bureautique du cahier des charges : [Cahier des charges DOCX](<Cahier_de_charge_G5 VF.docx>)
- Pour consulter le referentiel des roles et responsabilites : [Gestion des roles](roles.md)
- Pour examiner le schema SQL de reference de la base de donnees : [Schema SQL gdh5](<gdh5 (2).sql>)

## 2. Conceptions fonctionnelles et techniques

### Gouvernance, acces et administration

- Pour comprendre le modele de connexion, les sessions et les controles d'acces : [Conception de l'authentification](conception-auth.md)
- Pour consulter la gouvernance des comptes administratifs et la hierarchie des acteurs : [Conception des administrateurs](conception-admins.md)

### Noyau de planification et moteur intelligent

- Pour etudier l'architecture, l'algorithme et les contraintes du moteur intelligent : [Conception du moteur intelligent](conception-moteur-intelligent.md)
- Pour consulter la logique generale de construction des horaires : [Conception de la planification](conception-planification.md)
- Pour voir la gestion des ajustements manuels et des validations immediates : [Conception de la planification manuelle](conception-planification-manuelle.md)
- Pour comprendre la relance intelligente apres conflit ou indisponibilite : [Conception de la replanification intelligente](conception-replanification-intelligente.md)
- Pour consulter le traitement administratif des permutations et remplacements de seances : [Conception des echanges de cours entre etudiants](conception-echanges-cours-etudiants.md)
- Pour voir la gestion des exceptions appliquees a des cas particuliers : [Conception des exceptions individuelles](conception-exceptions-individuelles.md)
- Pour consulter la logique de consultation et de diffusion des horaires cote apprenants : [Conception des horaires etudiants](conception-horaires-etudiants.md)

### Referentiels academiques et donnees metier

- Pour consulter la conception du module cours, affectations et metadonnees pedagogiques : [Conception des cours](conception-cours.md)
- Pour consulter la conception du module professeurs, disponibilites et capacites d'enseignement : [Conception des professeurs](conception-prof.md)
- Pour consulter la conception du module salles, capacites et types d'occupation : [Conception des salles](conception-salles.md)
- Pour consulter la conception du module etudiants, profils et rattachements : [Conception des etudiants](conception-etudiants.md)
- Pour consulter la conception du module groupes et structures pedagogiques : [Conception des groupes](conception-groupes.md)
- Pour examiner la logique d'import et de normalisation des fichiers d'etudiants : [Conception de l'import etudiants](conception-import-etudiants.md)

### Plateforme, interfaces et infrastructure de donnees

- Pour comprendre l'organisation des ecrans, composants et flux UI : [Conception du frontend](conception-frontend.md)
- Pour consulter la conception du tableau de bord et de la supervision operationnelle : [Conception du dashboard](conception-dashboard.md)
- Pour voir la logique des exports PDF et Excel : [Conception des exports](conception-export.md)
- Pour consulter l'organisation logique de la base de donnees : [Conception de la base de donnees](conception-base-de-donnees.md)

## 3. Documentation technique detaillee

### Dossier global

- Pour parcourir une documentation technique consolidee de la solution : [Documentation complete Horaires-5](Documentation-complete-horaires-5.md)

### Administration et securite

- Pour consulter les details d'authentification, de session et de securisation des acces : [Documentation de l'authentification](documentation-authentification.md)
- Pour consulter le fonctionnement administratif et la gestion des comptes de plateforme : [Documentation des administrateurs](documentation-admins.md)

### Moteur, planification et traitement des exceptions

- Pour consulter l'implementation detaillee du moteur de generation : [Documentation du moteur intelligent](documentation-moteur-intelligent.md)
- Pour consulter le comportement de la planification standard : [Documentation de la planification](documentation-planification.md)
- Pour consulter les operations de modification manuelle et leurs controles : [Documentation de la planification manuelle](documentation-planification-manuelle.md)
- Pour consulter le mecanisme de recalcul apres modification ou incident : [Documentation de la replanification intelligente](documentation-replanification-intelligente.md)
- Pour consulter les regles d'echange et de remplacement de cours : [Documentation des echanges de cours entre etudiants](documentation-echanges-cours-etudiants.md)
- Pour consulter la gestion des cas hors norme au niveau individuel : [Documentation des exceptions individuelles](documentation-exceptions-individuelles.md)
- Pour consulter la diffusion et la consultation des horaires cote etudiants : [Documentation des horaires etudiants](documentation-horaires-etudiants.md)

### Modules metier

- Pour consulter la documentation du module de gestion des cours : [Documentation de gestion des cours](documentation-gestion-cours.md)
- Pour consulter la documentation du module de gestion des professeurs : [Documentation de gestion des professeurs](documentation-gestion-professeurs.md)
- Pour consulter la documentation du module salles et occupation des locaux : [Documentation des salles](documentation-salles.md)
- Pour consulter la documentation du module de gestion des etudiants : [Documentation de gestion des etudiants](documentation-gestion-etudiants.md)
- Pour consulter la documentation du module groupes : [Documentation des groupes](documentation-groupes.md)
- Pour consulter la documentation du processus d'import des etudiants : [Documentation de l'import etudiants](documentation-import-etudiants.md)

Note : les documentations `Cours`, `Professeurs` et `Salles` incluent maintenant le contrat d'import Excel/CSV integre directement dans leurs pages existantes, ainsi que les formats attendus et la strategie de traitement des erreurs.

### Interface, supervision et sorties

- Pour consulter la documentation de l'interface React et de ses flux : [Documentation du frontend](documentation-frontend.md)
- Pour consulter la documentation du tableau de bord : [Documentation du dashboard](documentation-dashboard.md)
- Pour consulter la documentation des exports PDF et Excel : [Documentation des exports](documentation-export.md)

## 4. Diagrammes UML et modeles

### Index visuel des diagrammes

- Pour ouvrir un point d'entree graphique qui affiche directement les principaux diagrammes : [README des diagrammes](diagrammes/README-diagrammes.md)

### Diagrammes de synthese de la conception finale

- Pour voir le diagramme de cas d'utilisation global du projet : [Vue SVG](diagrammes/conception-complete-use-case.svg) | [Source Mermaid](diagrammes/conception-complete-use-case.mmd)
- Pour voir le diagramme de classes global du projet : [Vue SVG](diagrammes/conception-complete-class.svg) | [Source Mermaid](diagrammes/conception-complete-class.mmd)
- Pour voir le diagramme de sequence de generation complete d'un horaire : [Vue SVG](diagrammes/conception-complete-generation-sequence.svg) | [Source Mermaid](diagrammes/conception-complete-generation-sequence.mmd)
- Pour voir le diagramme de sequence de planification manuelle : [Vue SVG](diagrammes/conception-complete-manual-planning-sequence.svg) | [Source Mermaid](diagrammes/conception-complete-manual-planning-sequence.mmd)
- Pour voir le diagramme de sequence de traitement d'un echange de cours entre etudiants : [Vue SVG](diagrammes/conception-complete-student-exchange-sequence.svg) | [Source Mermaid](diagrammes/conception-complete-student-exchange-sequence.mmd)
- Pour voir le diagramme d'activite complet du moteur intelligent : [Vue SVG](diagrammes/conception-complete-activity.svg) | [Source Mermaid](diagrammes/conception-complete-activity.mmd)

### Diagrammes du scheduler et de l'architecture de planification

- Pour voir le diagramme de cas d'utilisation du scheduler : [Vue SVG](diagrammes/scheduler-use-case.svg) | [Source Mermaid](diagrammes/scheduler-use-case.mmd)
- Pour voir l'architecture en composants du scheduler : [Vue SVG](diagrammes/scheduler-components.svg) | [Source Mermaid](diagrammes/scheduler-components.mmd)
- Pour voir le diagramme d'activite de generation du scheduler : [Vue SVG](diagrammes/scheduler-activity.svg) | [Source Mermaid](diagrammes/scheduler-activity.mmd)
- Pour voir le diagramme de sequence principal du scheduler : [Vue SVG](diagrammes/scheduler-sequence.svg) | [Source Mermaid](diagrammes/scheduler-sequence.mmd)
- Pour voir le diagramme de sequence de replanification : [Vue SVG](diagrammes/scheduler-replanification-sequence.svg) | [Source Mermaid](diagrammes/scheduler-replanification-sequence.mmd)
- Pour voir le diagramme de classes du scheduler : [Vue SVG](diagrammes/scheduler-class.svg) | [Source Mermaid](diagrammes/scheduler-class.mmd)
- Pour voir le diagramme entite-relation global du scheduler : [Vue SVG](diagrammes/scheduler-er.svg) | [Source Mermaid](diagrammes/scheduler-er.mmd)
- Pour voir le diagramme de deploiement logique : [Vue SVG](diagrammes/scheduler-deployment.svg) | [Source Mermaid](diagrammes/scheduler-deployment.mmd)

### Diagrammes par domaine fonctionnel

- Pour voir les diagrammes du module authentification : [Sequence d'authentification SVG](diagrammes/auth-sequence.svg) | [Source Mermaid](diagrammes/auth-sequence.mmd)
- Pour voir la sequence de gestion de session : [Session SVG](diagrammes/auth-session-sequence.svg) | [Source Mermaid](diagrammes/auth-session-sequence.mmd)
- Pour voir le diagramme de classes du module cours : [Classes cours SVG](diagrammes/cours-class.svg) | [Source Mermaid](diagrammes/cours-class.mmd)
- Pour voir le diagramme de sequence du module cours : [Sequence cours SVG](diagrammes/cours-sequence.svg) | [Source Mermaid](diagrammes/cours-sequence.mmd)
- Pour voir le diagramme de classes du module professeurs : [Classes professeurs SVG](diagrammes/professeurs-class.svg) | [Source Mermaid](diagrammes/professeurs-class.mmd)
- Pour voir le diagramme de sequence du module professeurs : [Sequence professeurs SVG](diagrammes/professeurs-sequence.svg) | [Source Mermaid](diagrammes/professeurs-sequence.mmd)
- Pour voir le diagramme de classes du module salles : [Classes salles SVG](diagrammes/salles-class.svg) | [Source Mermaid](diagrammes/salles-class.mmd)
- Pour voir le diagramme de sequence du module salles : [Sequence salles SVG](diagrammes/salles-sequence.svg) | [Source Mermaid](diagrammes/salles-sequence.mmd)
- Pour voir le diagramme de classes du module planification : [Classes planification SVG](diagrammes/planification-class.svg) | [Source Mermaid](diagrammes/planification-class.mmd)
- Pour voir le diagramme de sequence du module planification : [Sequence planification SVG](diagrammes/planification-sequence.svg) | [Source Mermaid](diagrammes/planification-sequence.mmd)
- Pour voir le diagramme de classes des horaires etudiants : [Classes horaires etudiants SVG](diagrammes/horaires-etudiants-class.svg) | [Source Mermaid](diagrammes/horaires-etudiants-class.mmd)
- Pour voir le diagramme de sequence des horaires etudiants : [Sequence horaires etudiants SVG](diagrammes/horaires-etudiants-sequence.svg) | [Source Mermaid](diagrammes/horaires-etudiants-sequence.mmd)

### Diagrammes de donnees

- Pour voir les relations de base de donnees sous forme de schema lisible : [Relations BD SVG](diagrammes/database-relations.svg) | [Source Mermaid](diagrammes/database-relations.mmd)

## 5. Guides operatoires et support projet

- Pour installer l'environnement de travail et lancer le projet : [Guide d'installation](guide-d'installation.md)
- Pour comprendre les pratiques de collaboration, Git et codebase : [Guide collaborateur Git et code](guide-collaborateur-git-code.md)
- Pour consulter la procedure minimale de verification : [Guide des tests](guide-tests.md)
- Pour relire le cadrage initial du projet : [Initialisation du projet - Sprint 1](<Initialisation du projet_Sprint1.md>)
- Pour consulter le scenario de test serveur du premier sprint : [Tester le serveur - Sprint 1](Sprint1_Tester_le_serveur.md)

## 6. Annexes et ressources de travail

- Pour consulter les specifications des sorties documentaires d'horaires : [Exports horaires](exports-horaires.md)
- Pour ouvrir un exemple de fichier d'import etudiants utilise dans le projet : [Fichier Excel d'import](import-etudiants-reprises-compatible-hiver-20260408-222942.xlsx)

## 7. Versions alternatives et traces documentaires

- Pour consulter une variante historique de la conception des horaires etudiants : [Conception horaires etudiants - variante](conception_horaires_etudiants.md)
- Pour consulter une variante historique de la documentation des horaires etudiants : [Documentation horaires etudiants - variante](documentation_horaires_etudiants.md)
