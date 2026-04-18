# Dossier de stockage — Miniatures du Centre d'Aide

Ce dossier contient les miniatures (thumbnails) des guides vidéo.

## Convention de nommage

```
{slug-du-guide}.jpg   ou   {slug-du-guide}.png
```

Exemples :
- `connexion-prise-en-main.jpg`
- `exporter-horaire-pdf.png`

## Dimensions recommandées

- **Format** : 16:9 (ex: 640×360 px)
- **Taille max** : 200 Ko
- **Format fichier** : JPG (photos/captures d'écran) ou PNG (illustrations)

## Procédure d'ajout

1. Déposer le fichier image dans ce dossier
2. Mettre à jour `thumbnail_path` dans `help_videos` :
   ```sql
   UPDATE help_videos
   SET thumbnail_path = 'uploads/help/thumbnails/{slug}.jpg'
   WHERE slug = '{slug-du-guide}';
   ```

## Sécurité

- Servies via `/api/help/videos/:id/thumbnail` (authentification requise)
- Protection contre le path traversal appliquée côté backend
