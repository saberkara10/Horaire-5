# Sprint 1 — Tester le serveur : Tests Postman (Routes API)
## Objectif
Tester le serveur avec Postman afin de vérifier que les routes fonctionnent correctement et que le serveur répond sans erreur.
## Pré-requis
- Serveur démarré localement :
  - Backend : "npm run dev"
  - URL de base : "http://localhost:3000"


  # GDH5-64 — Scénarios de test des routes
## Scénario 1 — Vérification du serveur 
- Méthode : GET
- Endpoint : `/api/health`
- But : Confirmer que le serveur est actif.
- Résultat attendu :
  - Statut HTTP : 200 OK
  - Réponse : JSON
  - Champs attendus : `status`, "Le serveur fonctionne correctement"


## Scénario 2 — Route de test API
- Méthode : GET
- Endpoint : `/api/test`
- But : Vérifier qu’une route API répond correctement.
- Résultat attendu :
  - Statut HTTP : 200 OK
  - Réponse : JSON
  - Champ attendu : "La route de test fonctionne correctement"

## Scénario 3 — Route inexistante
- Méthode : GET
- Endpoint : `/api/scenario`
- But : Confirmer le comportement du serveur quand la route n’existe pas.
- Résultat attendu :
  - Statut HTTP : 404 Not Found
  - Message type : `Cannot GET ...`

## Scénario 4 — Serveur arrêté
- Méthode : GET
- Endpoint : `/api/health` (ou `/api/test`)
- But : Vérifier la réaction du client si le serveur ne répond pas.
- Résultat attendu :
  - Postman affiche une erreur du type : "Could not get any response"

   #GDH5-65 — Documentation des requêtes Postman

## Variable de collection
- **Nom** : `baseURL
- **Valeur** : `http://localhost:3000`
- **Utilisation** :
  - `{{baseURL}}/api/health`
  - `{{baseURL}}/api/test`

## Requête 1 — GET /api/health
- **URL** : `{{baseURL}}/api/health`
- **Description** : Vérifie l’état du serveur.
- **Réponse attendue** :
  - **200 OK**
  - JSON :
    - `status` : "OK"
    - `message` : texte confirmant que le serveur fonctionne

## Requête 2 — GET /api/test
- **URL** : `{{baseURL}}/api/test`
- **Description** : Route de test pour valider le bon fonctionnement de l’API.
- **Réponse attendue** :
  - **200 OK**
  - JSON :
    - `message` : texte confirmant que la route fonctionne

## Tests Postman
- Vérifier le statut 200
- Vérifier le format JSON
- Vérifier la présence du champ `message` 