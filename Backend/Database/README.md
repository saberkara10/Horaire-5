# Installation de la base

Pour une premiere installation, executez uniquement :

`Backend/Database/GDH5.sql`

Ce script :


## Dans MySQL Workbench

1. Ouvrir `Backend/Database/GDH5.sql`
2. Executer tout le script
3. Verifier que le backend pointe vers `gdh5` dans `.env`
4. Demarrer le projet

## Compte par defaut

- Email : `responsable@ecole.ca`
- Mot de passe : a definir localement dans `.env` via `INITIAL_RESPONSABLE_PASSWORD`
- Role : `ADMIN_RESPONSABLE`

## Session par defaut

- Nom : `Session initiale`
- Date debut : `2026-08-25`
- Date fin : `2026-12-20`
- Active : `oui`

## Exemple en ligne de commande

```bash
mysql -u root -p < Backend/Database/GDH5.sql
```
