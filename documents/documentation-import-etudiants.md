# Documentation - Importation des etudiants

## 1. Contexte et objectif

Ce document decrit le fonctionnement attendu de l'importation des etudiants dans le projet **gestion-des-horaires**.

Objectifs de cette documentation :

- definir clairement le format du fichier a importer ;
- expliquer le fonctionnement general de l'import ;
- lister les erreurs possibles ;
- fournir un exemple simple de fichier exploitable.

Cette documentation couvre les besoins des sous-taches Jira suivantes :

- `GDH5-188` Ecrire le format attendu (colonnes + exemple) ;
- `GDH5-189` Expliquer comment l'import fonctionne ;
- `GDH5-190` Expliquer les erreurs possibles ;
- `GDH5-191` Ajouter un mini exemple de fichier.

## 2. Perimetre de l'import

L'import permet d'ajouter en base les etudiants fournis par l'administration a partir d'un fichier.

Dans la version cible du module, chaque ligne du fichier represente un etudiant.

Les donnees importees servent a :

- alimenter la liste des etudiants ;
- rattacher chaque etudiant a un groupe ;
- permettre plus tard la consultation et l'association avec l'horaire.

## 3. Formats de fichier acceptes

Les formats de fichier acceptes sont :

- `.xlsx`
- `.csv`

Recommandation de projet :

- privilegier `.xlsx` si le fichier vient directement d'Excel ;
- accepter `.csv` pour simplifier les tests et les imports rapides.

Le fichier doit contenir une premiere ligne d'en-tete avec les noms des colonnes.

## 4. Format attendu du fichier

### 4.1 Colonnes attendues

Le fichier doit contenir les colonnes suivantes :

- `matricule`
- `nom`
- `prenom`
- `groupe`
- `programme`
- `etape`

### 4.2 Signification des colonnes

| Colonne | Obligatoire | Description | Regle principale |
|--------|--------|------------|------------|
| `matricule` | Oui | Identifiant metier de l'etudiant | Doit etre unique |
| `nom` | Oui | Nom de famille de l'etudiant | Non vide |
| `prenom` | Oui | Prenom de l'etudiant | Non vide |
| `groupe` | Oui | Groupe etudiant auquel appartient l'etudiant | Non vide |
| `programme` | Oui | Programme ou filiere de l'etudiant | Non vide |
| `etape` | Oui | Etape d'etude de l'etudiant | Entier de `1` a `8` |

### 4.3 Regles de nommage des colonnes

Pour eviter toute ambiguite, les noms de colonnes attendus doivent etre exactement :

```text
matricule,nom,prenom,groupe,programme,etape
```

Recommandations :

- utiliser des noms simples en minuscules ;
- ne pas ajouter d'espaces au debut ou a la fin des en-tetes ;
- ne pas renommer `etape` en `niveau`, `session` ou `annee` ;
- ne pas remplacer `groupe` par `classe` sans adaptation du backend.

### 4.4 Ordre des colonnes

Ordre recommande :

1. `matricule`
2. `nom`
3. `prenom`
4. `groupe`
5. `programme`
6. `etape`

Le backend peut etre concu pour lire les colonnes par nom, mais pour limiter les erreurs humaines, cet ordre doit etre conserve dans la documentation utilisateur.

## 5. Exemple de fichier attendu

### 5.1 Exemple minimal en CSV

```csv
matricule,nom,prenom,groupe,programme,etape
2026001,Doe,Jane,A1,Informatique,1
2026002,Dupont,Marc,A1,Informatique,1
2026003,Ali,Sarah,B2,Reseaux,2
```

### 5.2 Representation equivalente dans Excel

| matricule | nom | prenom | groupe | programme | etape |
|--------|--------|--------|--------|--------|--------|
| 2026001 | Doe | Jane | A1 | Informatique | 1 |
| 2026002 | Dupont | Marc | A1 | Informatique | 1 |
| 2026003 | Ali | Sarah | B2 | Reseaux | 2 |

### 5.3 Exemple de fichier invalide

Exemple incorrect :

```csv
nom,prenom,groupe,programme
Doe,Jane,A1,Informatique
```

Problemes :

- colonne `matricule` absente ;
- colonne `etape` absente ;
- le format ne respecte pas le modele attendu.

## 6. Champs obligatoires et regles de validation

### 6.1 Champs obligatoires

Tous les champs ci-dessous sont obligatoires pour la V1 :

- `matricule`
- `nom`
- `prenom`
- `groupe`
- `programme`
- `etape`

### 6.2 Champ unique

Le champ unique retenu est :

- `matricule`

Raison :

- il identifie l'etudiant de maniere stable ;
- il permet d'eviter les doublons lors de plusieurs imports ;
- il est coherent avec la logique deja utilisee pour les professeurs.

### 6.3 Regles de validation recommandees

- `matricule` : obligatoire, non vide, longueur maximale `50`, unique ;
- `nom` : obligatoire, non vide, longueur maximale `100` ;
- `prenom` : obligatoire, non vide, longueur maximale `100` ;
- `groupe` : obligatoire, non vide, longueur maximale `100` ;
- `programme` : obligatoire, non vide, longueur maximale `150` ;
- `etape` : obligatoire, entier compris entre `1` et `8`.

## 7. Fonctionnement de l'import

### 7.1 Vue d'ensemble

Le fonctionnement attendu de l'import est le suivant :

1. l'utilisateur selectionne un fichier `.xlsx` ou `.csv` dans le frontend ;
2. le frontend envoie le fichier au backend ;
3. le backend verifie le type de fichier ;
4. le backend lit la premiere ligne pour recuperer les en-tetes ;
5. le backend verifie que toutes les colonnes obligatoires sont presentes ;
6. le backend convertit chaque ligne en objet etudiant ;
7. le backend valide les donnees ligne par ligne ;
8. le backend verifie si le groupe existe deja ;
9. si le groupe n'existe pas, il est cree ;
10. le backend verifie l'unicite du matricule ;
11. les etudiants valides sont inseres dans la base ;
12. le backend retourne un resultat d'import.

### 7.2 Logique de donnees recommandee

La logique la plus propre est la suivante :

- la colonne `groupe` provient du fichier ;
- la base de donnees conserve les groupes dans la table `groupes_etudiants` ;
- la table `etudiants` stocke une cle etrangere `id_groupes_etudiants`.

Autrement dit :

- le fichier contient le nom du groupe ;
- le backend retrouve ou cree ce groupe ;
- l'etudiant est ensuite relie a ce groupe en base.

### 7.3 Comportement recommande en cas d'erreur

Pour eviter les imports partiels difficiles a corriger, le comportement recommande est :

- si une seule ligne est invalide, l'import complet est refuse ;
- aucune insertion definitive n'est conservee ;
- le backend retourne les erreurs detectees.

Implementation recommande :

- utiliser une transaction SQL.

### 7.4 Reponse attendue apres un import reussi

Exemple de retour possible :

```json
{
  "message": "Import termine avec succes.",
  "nombre_importes": 3
}
```

### 7.5 Reponse attendue en cas d'echec

Exemple de retour possible :

```json
{
  "message": "Import impossible.",
  "erreurs": [
    "Ligne 2 : matricule deja utilise.",
    "Ligne 4 : etape invalide (1 a 8)."
  ]
}
```

## 8. Erreurs possibles a documenter

### 8.1 Erreurs liees au fichier

- `Format de fichier non supporte.`
- `Fichier vide.`
- `Colonnes obligatoires manquantes.`
- `Impossible de lire le fichier.`

Exemples :

- le fichier n'est ni `.xlsx` ni `.csv` ;
- le fichier ne contient aucune ligne ;
- l'en-tete ne contient pas `matricule` ou `etape`.

### 8.2 Erreurs liees aux donnees

- `Matricule obligatoire.`
- `Matricule deja utilise.`
- `Nom invalide.`
- `Prenom invalide.`
- `Groupe obligatoire.`
- `Programme obligatoire.`
- `Etape invalide (1 a 8).`

Exemples :

- un matricule est vide ;
- un matricule existe deja dans la base ;
- une ligne ne contient pas de groupe ;
- une etape vaut `0`, `9` ou un texte non numerique.

### 8.3 Erreurs ligne par ligne

Pour rendre le retour plus utile a l'utilisateur, les erreurs devraient etre rattachees au numero de ligne.

Exemples de messages :

- `Ligne 2 : matricule obligatoire.`
- `Ligne 3 : groupe obligatoire.`
- `Ligne 5 : etape invalide (1 a 8).`

## 9. Recommandations de bonne utilisation

- verifier que le fichier contient bien les six colonnes obligatoires ;
- verifier l'orthographe exacte des en-tetes ;
- supprimer les doublons de matricules avant l'import ;
- verifier que `etape` contient un nombre compris entre `1` et `8` ;
- utiliser un mini fichier de test avant un import massif.

## 10. Resume pour Jira / Confluence

### Format attendu

Le fichier d'import des etudiants doit etre au format `.xlsx` ou `.csv` et contenir les colonnes `matricule`, `nom`, `prenom`, `groupe`, `programme`, `etape`.

### Fonctionnement

Le frontend envoie le fichier au backend. Le backend verifie le format, lit les colonnes, valide les donnees, cree le groupe si necessaire, puis enregistre les etudiants en base.

### Erreurs possibles

Les erreurs principales sont :

- format de fichier invalide ;
- fichier vide ;
- colonnes manquantes ;
- matricule vide ;
- matricule duplique ;
- groupe vide ;
- programme vide ;
- etape invalide.

### Mini exemple

```csv
matricule,nom,prenom,groupe,programme,etape
2026001,Doe,Jane,A1,Informatique,1
2026002,Dupont,Marc,A1,Informatique,1
```

## 11. Conclusion

Cette documentation fixe le contrat fonctionnel de l'importation des etudiants.

Elle servira de reference pour :

- la creation de la table `etudiants` ;
- le developpement de la route d'import ;
- l'ecriture des validations backend ;
- les tests fonctionnels et techniques ;
- l'aide utilisateur sur Confluence ou dans Jira.
