# Dossier de stockage — Vidéos du Centre d'Aide

Ce dossier contient les fichiers vidéo MP4 des guides d'utilisation.

## Convention de nommage

Les fichiers doivent être nommés selon le `slug` du guide en base de données :

```
{slug-du-guide}.mp4
```

Exemples :
- `connexion-prise-en-main.mp4`
- `consulter-horaires-groupe.mp4`
- `exporter-horaire-pdf.mp4`

## Procédure d'ajout d'une vidéo

1. Déposer le fichier `.mp4` dans ce dossier
2. Mettre à jour le champ `video_path` dans la table `help_videos` :
   ```sql
   UPDATE help_videos
   SET video_path = 'uploads/help/videos/{slug}.mp4',
       duration_seconds = {durée_en_secondes}
   WHERE slug = '{slug-du-guide}';
   ```
3. Redémarrer le backend n'est pas nécessaire (lecture à la volée)

## Sécurité

- Ce dossier n'est PAS exposé directement par Express (pas de `express.static`)
- Les vidéos sont servies UNIQUEMENT via l'endpoint `/api/help/videos/:id/stream`
- L'endpoint vérifie que le chemin résolu reste dans ce dossier (path traversal protection)
- L'accès requiert une session utilisateur authentifiée
