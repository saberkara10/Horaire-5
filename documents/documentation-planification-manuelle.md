# Documentation - Planification manuelle

## 1. Objet

Cette documentation couvre le sous-module qui permet de corriger et completer
les horaires sans relancer la generation complete du scheduler.

Il couvre trois usages :

- planifier manuellement un cours de groupe ;
- replanifier une occurrence ou une serie existante ;
- rattacher un cours echoue a un groupe reel compatible.

## 2. Fichiers de reference

- `Backend/routes/horaire.routes.js`
- `Backend/src/model/horaire.js`
- `Backend/src/services/planning/manual-planning.service.js`

## 3. Endpoints

| Methode | Route | Usage |
|---|---|---|
| `POST` | `/api/horaires` | Cree une affectation manuelle |
| `PUT` | `/api/horaires/:id` | Replanifie une affectation existante |
| `GET` | `/api/horaires/reprises/etudiants` | Liste les etudiants a traiter en reprise |
| `GET` | `/api/horaires/etudiants/:id/cours-echoues` | Liste les cours echoues planifiables |
| `GET` | `/api/horaires/etudiants/:id/cours-echoues/:idCoursEchoue/groupes-compatibles` | Liste les groupes compatibles pour une reprise |
| `POST` | `/api/horaires/reprises` | Planifie une reprise pour un etudiant |

## 4. Concepts metier

### 4.1 Portee d'une planification

Le payload peut cibler :

- une seule occurrence ;
- toutes les semaines a partir d'une date ;
- une plage personnalisee.

Si plusieurs dates sont retenues, le backend cree une `planification_series`.

### 4.2 Participants reels

Avant validation, le service calcule l'effectif reel de la seance :

- etudiants reguliers du groupe ;
- etudiants deja rattaches individuellement au meme cours.

Cette valeur sert a verifier :

- la capacite de salle ;
- les conflits etudiants ;
- la coherence des reprises.

### 4.3 Reprises

La planification d'un cours echoue ne cree pas une nouvelle affectation de
groupe. Elle ajoute une affectation individuelle de type `reprise` et met a
jour la ligne correspondante dans `cours_echoues`.

## 5. Validations majeures

Le service verifie notamment :

- existence du cours, du professeur, de la salle et du groupe ;
- compatibilite `programme + etape` entre groupe et cours ;
- compatibilite professeur / cours ;
- compatibilite salle / type de cours ;
- capacite suffisante selon l'effectif reel ;
- disponibilites et absences du professeur ;
- indisponibilites de salle ;
- absence de conflit de groupe, de salle, de professeur et d'etudiants ;
- appartenance des dates a la session.

## 6. Structure des reponses

Les operations de planification retournent generalement :

- un `message` ;
- les identifiants impactes ;
- les occurrences creees ou modifiees ;
- les groupes, professeurs, salles et etudiants touches ;
- l'effectif reel de la seance lorsque pertinent.

## 7. Replanification d'une occurrence

`PUT /api/horaires/:id` peut agir sur :

- une occurrence seule ;
- une serie a partir de l'occurrence courante ;
- une plage definie par dates.

Le backend :

1. retrouve l'affectation de reference ;
2. derive les occurrences concernees ;
3. revalide chacune d'elles avec les nouvelles ressources ;
4. met a jour les series si necessaire ;
5. supprime les series orphelines.

## 8. Codes d'erreur utiles

- `ACTIVE_SESSION_MISSING`
- `COURSE_NOT_FOUND`
- `PROFESSOR_NOT_FOUND`
- `ROOM_NOT_FOUND`
- `GROUP_NOT_FOUND`
- `GROUP_COURSE_MISMATCH`
- `PROFESSOR_UNAVAILABLE`
- `ROOM_TIME_CONFLICT`
- `GROUP_TIME_CONFLICT`
- `STUDENT_TIME_CONFLICT`
- `FAILED_COURSE_GROUP_INVALID`

## 9. Points de vigilance

- la validation manuelle utilise le meme schema runtime que le scheduler ;
- une recurrence manuelle cree une serie explicite a maintenir ;
- les reprises modifient l'horaire effectif etudiant sans toucher au groupe principal ;
- toute suppression d'affectation doit aussi reevaluer la serie associee.
