# Conception frontend

## Objectif

Le frontend fournit l'interface web du projet. Il est developpe en React avec Vite et organise l'acces aux modules metier disponibles dans le depot.

## Structure generale

Le frontend repose sur trois blocs principaux :

- `Frontend/src/App.jsx` : routage, verification de session et redirections ;
- `Frontend/src/pages` : pages fonctionnelles ;
- `Frontend/src/services` : appels HTTP vers le backend.

## Flux principal

1. `Frontend/src/main.jsx` initialise l'application React ;
2. `Frontend/src/App.jsx` tente de recuperer l'utilisateur connecte ;
3. si aucun utilisateur n'est disponible, la navigation renvoie vers `/login` ;
4. si un utilisateur est present, les routes protegees deviennent accessibles dans l'interface.

## Routes du frontend

Les routes definies dans l'interface sont :

- `/login`
- `/dashboard`
- `/cours`
- `/professeurs`
- `/salles`
- `/import-etudiants`
- `/affectations`
- `/planning-etudiant/:id`

## Etat reel de l'integration

La presence d'une route dans le frontend ne signifie pas que l'integration complete est active dans le backend demarre par defaut.

Etat constate dans le depot :

- le backend lance via `Backend/src/server.js` expose `cours` et `professeurs` ;
- le module auth existe dans `Backend/app.js`, mais n'est pas branche dans cette entree ;
- les ecrans `Salles`, `Import etudiants`, `Planning etudiant` et `Affectations` existent dans le frontend, mais ils dependent de routes backend non montees dans `Backend/src/app.js`.

## Composant de layout

Le composant `Frontend/src/components/layout/AppShell.jsx` fournit :

- la barre laterale de navigation ;
- l'entete de page ;
- l'affichage de l'utilisateur connecte ;
- le bouton de deconnexion.

## Communication HTTP

Le frontend utilise des URL relatives telles que :

- `/auth/...`
- `/api/...`

Le proxy de `Frontend/vite.config.js` redirige ensuite ces appels vers `http://localhost:3000` en developpement.

## Conclusion

La conception frontend est alignee avec le contenu du depot. Elle distingue clairement :

- les ecrans presents dans l'interface ;
- les modules actuellement relies au backend par defaut ;
- les ecrans deja prepares mais pas encore relies de bout en bout.
