# Module Help - Strategie de stockage

Ce dossier regroupe tous les medias du centre d'aide.

Regles de stockage :

- Videos : `Backend/uploads/help/videos`
- Miniatures : `Backend/uploads/help/thumbnails`
- Les chemins stockes en base sont toujours relatifs a `Backend/`
- Convention de nommage recommandee : reutiliser le `slug` du guide

Exemples :

- `uploads/help/videos/connexion-prise-en-main.mp4`
- `uploads/help/thumbnails/connexion-prise-en-main.jpg`

Regles d'acces :

- aucun media n'est expose en acces statique direct ;
- les videos passent par `GET /api/help/videos/:id/stream` ;
- les miniatures passent par `GET /api/help/videos/:id/thumbnail` ;
- l'acces exige une session authentifiee ;
- le backend verifie que le chemin resolu reste dans le dossier autorise.
