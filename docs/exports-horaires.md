# Exports d'horaires HORAIRE 5

## Portee

Les exports PDF et Excel sont centralises dans `Backend/src/services/ExportService.js`.

Les cibles prises en charge aujourd'hui sont :

- horaires groupes
- horaires professeurs
- horaires etudiants

L'architecture de routes actuelle ne prevoit pas encore d'export salle. La correction a donc ete concentree sur les trois flux effectivement exposes par `Backend/routes/export.routes.js`.

## Role du service

Le service d'export remplit quatre fonctions principales :

1. normaliser les donnees de seances pour les vues groupe, professeur et etudiant
2. construire une presentation commune des blocs horaires pour PDF et Excel
3. appliquer une identite visuelle unique aux vues hebdomadaires et detaillees
4. proteger le rendu contre les debordements, les chevauchements et les informations secondaires trop envahissantes

## Strategie de rendu

### Hierarchie d'information

L'ordre de priorite est volontairement fixe :

1. code + nom du cours
2. nature speciale de la seance
3. groupe
4. professeur
5. salle et horaire

Cette hierarchie est portee par `buildSessionPresentation(...)`, qui alimente a la fois le PDF et l'Excel.

### PDF

Le PDF repose sur :

- une grille hebdomadaire complete du lundi au dimanche
- des blocs horaires adaptes a leur hauteur reelle
- un layout de carte qui reserve explicitement une zone au badge metier sans rogner la premiere ou la derniere ligne
- un retour a la ligne controle pour le cours, le professeur, le groupe et la salle
- une reduction progressive de la densite typographique avant toute coupe de contenu utile

Les tables detaillees PDF utilisent aussi une hauteur de ligne dynamique afin d'eviter le texte coupe dans les colonnes longues.

### Excel

L'Excel est genere avec `exceljs` pour permettre :

- des couleurs et bordures reelles
- des entetes stylises
- des volets figes
- des hauteurs de ligne ajusteables
- des cellules fusionnees verticalement sur la vue hebdomadaire
- une feuille detaillee propre et exploitable

Sur la vue hebdomadaire, les cellules sont fusionnees quand une seance s'etend sur plusieurs slots et qu'il n'y a pas de conflit. En cas de conflit, le contenu reste empile proprement dans le slot concerne plutot que de produire un merge incoherent.
La hauteur totale necessaire est ensuite repartie sur la zone fusionnee pour eviter les lignes ecrasees.

## Gestion des contenus longs

Les contenus longs sont traites par plusieurs mecanismes cumules :

- semaine complete affichee sur 7 jours avec un calibrage adapte des colonnes
- retour a la ligne controle par mesure de largeur PDF
- densite typographique progressive pour garder toutes les informations metier visibles dans la carte
- augmentation de la hauteur des lignes detaillees Excel selon le volume de texte

L'objectif n'est pas d'afficher 100 % du texte dans un micro-bloc, mais de garantir en permanence une sortie lisible, stable et sans debordement.

## Regles couleur

Les couleurs suivent une regle metier stricte :

- vert / blanc / noir : identite principale du produit
- orange : reserve aux cours echoues / reprises

Concretement :

- les reprises PDF et Excel utilisent une teinte orange pale avec bordure orange
- les exceptions individuelles restent dans la palette verte
- les cours standards restent dans des nuances vertes sobres

Cette contrainte est documentee dans les constantes `COLORS` et `BLOCK_PALETTES`.

## Anti-debordement et lisibilite minimale

La lisibilite minimale est garantie par :

- le modele commun `buildSessionPresentation(...)`
- le calcul de layout `prepareBlockLayout(...)`
- le wrapping `wrapTextToLines(...)`
- les hauteurs dynamiques de lignes PDF
- l'estimation de lignes Excel pour ajuster la hauteur des cellules detaillees

## Validation

Les validations automatiques principales sont dans `Backend/tests/export.service.test.js`.

Elles couvrent :

- generation PDF groupe
- generation PDF professeur
- generation PDF etudiant
- generation Excel groupe
- generation Excel professeur
- generation Excel etudiant
- cas de libelles longs
- verification de la feuille de reprises
- verification de la couleur orange reservee aux reprises
- verification des fusions de cellules sur la vue hebdomadaire Excel
