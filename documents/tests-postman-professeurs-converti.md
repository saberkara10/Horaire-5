# Rapport de tests Postman - Module Professeurs

Projet : Horaire-5

Module : Professeurs

Date : 27/ 02 / 2026

Testeur : saber kara (chargé de la gestion des professeurs)

## 1. Objectif

Ce document sert de rapport complet pour valider les endpoints Postman du module `professeurs`.

Tu peux uniquement ajouter tes captures d'écran dans les sections prévues.

## 2. Environnement de test

- Base URL : `http://localhost:3000`

- Prefix API : `/api/professeurs`

- Format des requetes : `application/json`

- Outil : Postman

- Base de donnees : MySQL

## 3. Resume des sous-taches couvertes

| Ticket | Sous-tache | Endpoint principal |
| --- | --- | --- |
| GDH5-174 | Tester l'ajout d'un professeur | `POST /api/professeurs` |
| GDH5-175 | Tester la modification d'un professeur | `PUT /api/professeurs/:id` |
| GDH5-176 | Tester la suppression d'un professeur | `DELETE /api/professeurs/:id` |
| GDH5-177 | Tester la consultation des professeurs | `GET /api/professeurs` et `GET /api/professeurs/:id` |

## 4. Cas de test detailles

### TEST-PROF-01 - Consultation de tous les professeurs

- Ticket : `GDH5-177`

- Methode : `GET`

- URL : `{{baseUrl}}/api/professeurs`

- Body : aucun

Attendu :

- Statut `200 OK`

- Reponse = tableau JSON (liste des professeurs)

Resultat obtenu :

- Statut recu : 200

- Verdict : PASS

Capture d'ecran :

![](./image/image-1.png)

### TEST-PROF-02 - Consultation d'un professeur par ID (valide)

- Ticket : `GDH5-177`

- Methode : `GET`

- URL : `{{baseUrl}}/api/professeurs/{{professeurId}}`

- Body : aucun

Attendu :

- Statut `200 OK`

- Reponse JSON avec : `id_professeur`, `matricule`, `nom`, `prenom`, `specialite`

Resultat obtenu :

- Statut recu : 200

- Verdict : PASS

Capture d'ecran :
![](./image/image-2.png)

### TEST-PROF-03 - Consultation par ID invalide

- Ticket : `GDH5-177`

- Methode : `GET`

- URL : `{{baseUrl}}/api/professeurs/abc`

- Body : aucun

Attendu :

- Statut `400 Bad Request`

- Message : `Identifiant invalide.`

Resultat obtenu :

- Statut recu :400

- Verdict : PAS

Capture d'ecran :
![](./image/image-3.png)

### TEST-PROF-04 - Consultation d'un professeur inexistant

- Ticket : `GDH5-177`

- Methode : `GET`

- URL : `{{baseUrl}}/api/professeurs/{{professeurIdInexistant}}`

- Body : aucun

Attendu

- Statut `404 Not Found`

- Message : `Professeur introuvable.`

Resultat obtenu :

- Statut recu : 404

- Verdict : PASS

Capture d'ecran :
![](./image/image-4.png)


### TEST-PROF-05 - Ajout d'un professeur (cas valide)

- Ticket : `GDH5-174`

- Methode : `POST`

- URL : `{{baseUrl}}/api/professeurs`

- Body :

{
  "matricule": "{{10101}}",
  "nom": "Jonathan",
  "prenom": "Weklie",
  "specialite": "Informatique"
}

Attendu :

- Statut `201 Created`

- Reponse JSON avec l'objet cree

Resultat obtenu :

- Statut recu :201

- Verdict : PASS

Capture d'ecran :
![](./image/image-5.png)

### TEST-PROF-06 - Ajout avec matricule duplique

- Ticket : `GDH5-174`

- Methode : `POST`

- URL : `{{baseUrl}}/api/professeurs`

- Body :

{
  "matricule": "10101",
  "nom": "Test",
  "prenom": "Doublon",
  "specialite": "Reseau"
}

Attendu :

- Statut `409 Conflict`

- Message : `Matricule deja utilise.`

Resultat obtenu :

- Statut recu : 409

- Verdict : PASS

Capture d'ecran :
![](./image/image-6.png)

### TEST-PROF-07 - Ajout avec donnees invalides

- Ticket : `GDH5-174`

- Methode : `POST`

- URL : `{{baseUrl}}/api/professeurs`

- Body (exemple invalide) :

{
  "matricule": "",
  "nom": "12345",
  "prenom": "",

 "specialite": ""
}

Attendu :

- Statut `400 Bad Request`

- Un message de validation (ex: `Matricule obligatoire.)

Resultat obtenu :

- Statut recu :400

- Message recu : MATRUCULE OBLIGATOIRE

- Verdict : PASS

Capture d'ecran :
![](./image/image-7.png)

### TEST-PROF-08 - Modification d'un professeur (cas valide)

- Ticket : `GDH5-175`

- Methode : `PUT`

- URL : `{{baseUrl}}/api/professeurs/{{professeurId}}`

- Body :

{

  "matricule": "10101",

  "nom": "jooooooooonathan",

  "prenom": "Weklie",

  "specialite": "genie logiciel"

}

Attendu :

- Statut `200 OK`

- Reponse JSON avec les champs modifies

Resultat obtenu :

- Statut recu : 200

- Verdict : PASS

Capture d'ecran :
![](./image/image-8.png)

### TEST-PROF-09 - Modification sans champs

- Ticket : `GDH5-175`

- Methode : `PUT`

- URL : `{{baseUrl}}/api/professeurs/{{professeurId}}`

- Body :

{}

Attendu :

- Statut `400 Bad Request`

- Message : `Aucun champ a modifier.`

Resultat obtenu :

- Statut recu :400

- Verdict : PASS

Capture d'ecran :
![](./image/image-9.png)

### TEST-PROF-10 - Modification avec matricule duplique

- Ticket : `GDH5-175`

- Methode : `PUT`

- URL : `{{baseUrl}}/api/professeurs/{{professeurId}}`

- Body :

{

    "id_professeur": 3,

    "matricule": "{{2742379}}",

    "nom": "jooooooooonathan",

    "prenom": "Weklie",

    "specialite": "genie logiciel"

}

Attendu :

- Statut `409 Conflict`

- Message : `Matricule deja utilise.`

Resultat obtenu :

- Statut recu : 409

- Verdict : PASS

Capture d'ecran :
![](./image/image-10.png)

### TEST-PROF-11 - Suppression d'un professeur non affecte

- Ticket : `GDH5-176`

- Methode : `DELETE`

- URL : `{{baseUrl}}/api/professeurs/{{professeurId}}`

Attendu :

- Statut `200 OK`

- Message : `Professeur supprime.`

Resultat obtenu :

- Statut recu : 200 OK

- Verdict : PASS

Capture d'ecran :
![](./image/image-11.png)

## 5. Grille finale de validation

| ID Test | Ticket | Statut attendu | Statut obtenu | Verdict |
| --- | --- | --- | --- | --- |
| TEST-PROF-01 | GDH5-177 | 200 | 200 | PASS |
| TEST-PROF-02 | GDH5-177 | 200 | 200 | PASS |
| TEST-PROF-03 | GDH5-177 | 400 | 400 | PASS |
| TEST-PROF-04 | GDH5-177 | 404 | 404 | PASS |
| TEST-PROF-05 | GDH5-174 | 201 | 201 | PASS |
| TEST-PROF-06 | GDH5-174 | 409 | 409 | PASS |
| TEST-PROF-07 | GDH5-174 | 400 | 400 | PASS |
| TEST-PROF-08 | GDH5-175 | 200 | 200 | PASS |
| TEST-PROF-09 | GDH5-175 | 400 | 400 | PASS |
| TEST-PROF-10 | GDH5-175 | 409 | 409 | PASS |
| TEST-PROF-11 | GDH5-176 | 200 | 200 | PASS |

## 6. Conclusion

- Nombre de tests executes : 11

- Nombre de PASS : 11

- Nombre de FAIL : 0

- Decision finale : VALIDE


