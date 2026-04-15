# Documentation - Horaires etudiants

## 1. Objet

Cette documentation decrit le module qui expose la vue complete de l'horaire
d'un etudiant.

Le point important est que l'horaire retourne n'est pas limite au groupe
principal. Il fusionne aussi :

- les reprises planifiees ;
- les exceptions individuelles ;
- les echanges de cours deja executes.

## 2. Fichiers de reference

- `Backend/routes/etudiants.routes.js`
- `Backend/src/model/etudiants.model.js`
- `Backend/src/services/etudiants/student-course-exchange.service.js`
- `Frontend/src/pages/EtudiantsPage.jsx`
- `Frontend/src/components/etudiants/EtudiantScheduleBoard.jsx`
- `Frontend/src/components/etudiants/CourseExchangePanel.jsx`

## 3. Endpoints concernes

| Methode | Route | Usage |
|---|---|---|
| `GET` | `/api/etudiants` | Liste les etudiants, avec option `session_active=1` |
| `GET` | `/api/etudiants/:id` | Retourne la fiche de base d'un etudiant |
| `GET` | `/api/etudiants/:id/horaire` | Retourne la vue complete de l'horaire effectif |
| `GET` | `/api/etudiants/echange-cours/options` | Liste les cours communs echangeables entre deux etudiants |
| `GET` | `/api/etudiants/echange-cours/preview` | Simule un echange de cours sans l'executer |
| `POST` | `/api/etudiants/echange-cours` | Execute l'echange cible de cours |

## 4. Sources de donnees

Le module compose la reponse a partir de plusieurs sources :

- `etudiants` pour l'identite, la cohorte et le groupe principal ;
- `groupes_etudiants` pour le groupe reel de la session active ;
- `affectation_groupes` + `affectation_cours` + `plages_horaires` pour l'horaire
  de groupe ;
- `affectation_etudiants` pour les surcharges individuelles ;
- `cours_echoues` pour les reprises encore a traiter ou deja planifiees ;
- `echanges_cours_etudiants` pour tracer les echanges cibles deja appliques.

## 5. Structure de la reponse horaire

`GET /api/etudiants/:id/horaire` retourne un objet qui contient :

- `etudiant` : fiche de base et metadonnees de charge ;
- `horaire` : fusion triee de toutes les seances visibles ;
- `horaire_groupe` : seances heritees du groupe principal ;
- `horaire_reprises` : seances ajoutees via `source_type = 'reprise'` ;
- `horaire_individuel` : seances ajoutees via `source_type = 'individuelle'` ;
- `reprises` : liste des cours echoues encore suivis par l'etudiant ;
- `exceptions_individuelles` : vue agregee des cours detaches du groupe principal ;
- `diagnostic_reprises` : blocages du scheduler pour les reprises non resolues ;
- `resume` : compteurs consolides pour l'ecran.

## 6. Regles metier importantes

### 6.1 Priorite des exceptions individuelles

Si un etudiant possede une affectation individuelle sur un cours, l'horaire du
groupe principal pour ce meme cours n'est plus affiche.

Cette regle evite d'exposer simultanement :

- la section d'origine ;
- la section de remplacement.

### 6.2 Distinction entre reprise et exception individuelle

Le backend distingue deux natures de surcharge :

- `reprise` : rattachement a un groupe pour refaire un cours echoue ;
- `individuelle` : exception creee pour une correction manuelle ou un echange.

### 6.3 Tri de l'horaire

Les seances sont triees selon :

1. la date ;
2. l'heure de debut ;
3. le type de seance ;
4. l'identifiant d'affectation.

L'objectif est d'obtenir un affichage stable et reproductible.

## 7. Echanges de cours

Le flux d'echange se fait en trois etapes :

1. lister les cours communs entre deux etudiants ;
2. previsualiser les conflits potentiels ;
3. executer l'echange si aucun blocage n'est detecte.

La previsualisation verifie notamment :

- que les deux etudiants partagent bien le cours cible ;
- qu'ils ne sont pas deja dans la meme section ;
- qu'aucune seance du groupe cible n'entre en conflit avec le reste de leur horaire.

## 8. Codes d'erreur utiles

Quelques codes applicatifs remontes par le backend :

- `COURSE_EXCHANGE_NO_ACTIVE_SESSION`
- `COURSE_EXCHANGE_STUDENT_NOT_FOUND`
- `COURSE_EXCHANGE_NOT_SHARED`
- `COURSE_EXCHANGE_SAME_STUDENT`
- `COURSE_EXCHANGE_NOT_ALLOWED`

## 9. Points de vigilance

- la vue horaire depend de la session active si aucun `id_session` n'est fourni ;
- les echanges de cours reposent sur `affectation_etudiants` comme source de verite ;
- une reprise peut exister dans `cours_echoues` sans encore apparaitre dans
  l'horaire effectif ;
- les exports et les ecrans frontend doivent lire `source_horaire` et non
  supposer que tout provient du groupe principal.

## 10. Conclusion

Le module horaires etudiants n'est plus une simple lecture du groupe.
Il constitue aujourd'hui une vue consolidee des affectations reelles d'un
etudiant, y compris les ajustements individuels introduits apres la generation
initiale de l'horaire.
