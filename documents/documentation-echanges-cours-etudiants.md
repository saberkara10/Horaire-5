# Documentation - Echanges de cours entre etudiants

## 1. Objet

Cette documentation couvre le sous-module qui permet a deux etudiants
d'echanger la section d'un cours qu'ils suivent deja tous les deux.

Le flux est intentionnellement strict :

- le cours doit etre commun aux deux etudiants ;
- les sections doivent etre differentes ;
- l'echange ne doit creer aucun conflit avec le reste de leur horaire.

## 2. Fichiers de reference

- `Backend/routes/etudiants.routes.js`
- `Backend/src/services/etudiants/student-course-exchange.service.js`
- `Frontend/src/components/etudiants/CourseExchangePanel.jsx`

## 3. Endpoints

| Methode | Route | Usage |
|---|---|---|
| `GET` | `/api/etudiants/echange-cours/options?etudiant_a=...&etudiant_b=...` | Liste les cours communs potentiellement echangeables |
| `GET` | `/api/etudiants/echange-cours/preview?etudiant_a=...&etudiant_b=...&id_cours=...` | Retourne le diagnostic de faisabilite |
| `POST` | `/api/etudiants/echange-cours` | Execute l'echange cible |

## 4. Donnees manipulees

Le sous-module s'appuie sur :

- l'horaire effectif de chaque etudiant ;
- les affectations de groupe normales ;
- les affectations individuelles deja existantes ;
- la table `echanges_cours_etudiants` qui sert de journal metier ;
- la colonne `id_echange_cours` dans `affectation_etudiants`.

## 5. Flux fonctionnel

### 5.1 Options

Le backend :

- recupere l'horaire effectif des deux etudiants ;
- calcule les cours communs ;
- marque si l'echange serait utile ou inutile selon que la section est deja la meme.

### 5.2 Previsualisation

Le backend :

- charge les deux affectations effectives sur le cours cible ;
- retire ce cours du reste de l'horaire de chaque etudiant ;
- projette la section de l'autre etudiant ;
- detecte les conflits eventuels ;
- retourne `echange_possible` et la liste detaillee des `blocages`.

### 5.3 Execution

L'echange n'est persiste que si la previsualisation reste valide au moment de
l'ecriture.

L'operation est transactionnelle et cree :

- une ligne dans `echanges_cours_etudiants` ;
- un override individuel pour chaque etudiant si sa nouvelle section differe de
  son groupe principal.

## 6. Regles metier

- les deux etudiants doivent exister ;
- ils doivent etre differents ;
- une session active doit etre resolue ;
- le cours doit etre suivi par les deux etudiants ;
- les deux sections ne doivent pas deja etre identiques ;
- aucune occurrence de la nouvelle section ne doit chevaucher le reste de
  l'horaire de l'etudiant receveur.

## 7. Structure du diagnostic

La previsualisation retourne notamment :

- `session`
- `cours`
- `etudiant_a` et `etudiant_b`
- `affectation_actuelle`
- `affectation_cible`
- `conflits`
- `echange_possible`
- `blocages`

## 8. Effets de bord attendus

Apres execution :

- l'horaire etudiant doit refleter la nouvelle section ;
- l'ancienne section du groupe principal ne doit plus etre visible pour ce cours ;
- les exports et la vue horaire doivent exposer `id_echange_cours` et
  `etudiant_echange` si disponibles.

## 9. Codes d'erreur utiles

- `COURSE_EXCHANGE_STUDENTS_REQUIRED`
- `COURSE_EXCHANGE_SAME_STUDENT`
- `COURSE_EXCHANGE_COURSE_REQUIRED`
- `COURSE_EXCHANGE_NO_ACTIVE_SESSION`
- `COURSE_EXCHANGE_STUDENT_NOT_FOUND`
- `COURSE_EXCHANGE_NOT_SHARED`
- `COURSE_EXCHANGE_NOT_ALLOWED`

## 10. Points de vigilance

- l'echange repose sur l'horaire effectif, pas uniquement sur le groupe principal ;
- une reprise ou une exception individuelle existante peut invalider un echange ;
- supprimer ou modifier `affectation_etudiants` sans tenir compte de
  `id_echange_cours` ferait perdre la tracabilite metier.
