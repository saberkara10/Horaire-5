# Guide d'utilisation

## 1. Ordre logique d'utilisation

1. Ajouter les salles.
2. Ajouter les cours.
3. Ajouter les professeurs.
4. Associer chaque professeur a ses cours et definir ses disponibilites.
5. Importer les etudiants.
6. Aller dans la page `Generer` pour planifier l'horaire.

## 2. Ce que fait l'import etudiants

- Colonnes attendues: `matricule`, `nom`, `prenom`, `programme`, `etape`.
- Colonne optionnelle: `session`.
- Le fichier peut etre melange: plusieurs programmes, plusieurs etapes et plusieurs sessions.
- Les programmes manquants sont crees automatiquement si necessaire.
- Les doublons d'etudiants sont bloques par `matricule`.
- Les groupes sont crees automatiquement par cohorte logique: `programme + etape + session`.

## 3. Comment generer un horaire automatiquement

Dans la page `Generer`:

1. Choisir `programme`, `etape` et `session`.
2. Choisir la `date de debut`.
3. Cliquer sur `Generer`.

Le systeme:

- prend les groupes de la cohorte;
- cherche les cours de ce programme et de cette etape;
- verifie les professeurs compatibles;
- respecte les disponibilites professeurs;
- respecte le type et la capacite des salles;
- evite les conflits de groupe, de salle et de professeur.

## 4. Comment planifier un cours manuellement

Dans la meme page `Generer`, section `Planifier un cours manuellement`:

1. Choisir le groupe.
2. Choisir le cours.
3. Choisir le professeur.
4. Choisir la salle.
5. Choisir la date, l'heure de debut et l'heure de fin.
6. Cliquer sur `Planifier le cours`.

Pour modifier une affectation existante:

1. Cliquer sur `Modifier` dans le tableau des affectations.
2. Changer les valeurs du formulaire.
3. Cliquer sur `Mettre a jour`.

Pour supprimer une affectation:

1. Cliquer sur `Supprimer` dans le tableau.

## 5. Ou verifier le resultat

- `Horaires groupes`: voir l'horaire par groupe.
- `Horaires professeurs`: voir l'horaire par professeur.
- `Generer`: voir les affectations et les elements non planifies.

## 6. Causes classiques si un cours ne se planifie pas

- aucun professeur n'est assigne a ce cours;
- le professeur est indisponible;
- aucune salle du bon type n'est assez grande;
- le groupe est deja occupe sur le creneau;
- le professeur ou la salle est deja occupe(e);
- le cours n'appartient pas au meme programme ou a la meme etape que le groupe.
