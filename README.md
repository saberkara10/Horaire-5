<div align="center">

# HORAIRES-5
### pour le readme principale se trouve sous le dossier document "README.md" ou vous pouvez tout trouvez sur le projet

### Plateforme intelligente de planification academique
## Gestion Des Horaires

**Generer -- Corriger -- Simuler -- Piloter**

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

---

**Projet de fin d'etudes -- La Cite collegiale**

Developpe par **Saber Kara** | **Rafik Bedreddin** | **Jovani Clement**

</div>

---

## Presentation du projet

**Horaires-5** est une application web d'entreprise concue pour automatiser la generation
et la gestion des horaires academiques. Developpe dans le cadre d'un projet de fin d'etudes,
ce systeme repond a un defi operationnel concret auquel font face les etablissements
d'enseignement : organiser de maniere optimale les cours, les professeurs, les salles,
les groupes et les etudiants tout en respectant un ensemble complexe de contraintes
pedagogiques, logistiques et reglementaires.

> Ce projet depasse largement le cadre d'un simple CRUD. Il integre un **moteur intelligent
> de planification par contraintes**, une logique de **correction locale sans regeneration**,
> un module de **simulation predictive (what-if)** et une gestion explicite des **cas
> exceptionnels du terrain** (absences, indisponibilites, reprises, echanges).

---


## Aperçu de l'application

<div align="center">
  <img src="https://github.com/user-attachments/assets/15160532-a910-4aee-b5bc-ce3b063a0c66" alt="Tableau de bord Horaires-5" width="800"/>
  <br/><br/>
  <em>Tableau de bord de pilotage : vue synthétique de la session active avec indicateurs clés, couverture étudiante et suivi en temps réel.</em>
</div>




</div>

---

## Valeur ajoutee et differenciation

Horaires-5 se distingue des solutions existantes par une approche hybride qui combine
automatisation intelligente et controle humain granulaire.

| Caracteristique | Description |
|---|---|
| **Moteur de planification intelligent** | Generation automatique par contraintes avec scoring de qualite et motif hebdomadaire stable et reproductible |
| **Approche hybride unique** | Automatisation complete combinee a des ajustements manuels sans necessite de regeneration globale |
| **Gestion des exceptions reelles** | Prise en charge des absences, indisponibilites temporaires, reprises de cours, echanges et cas individuels |
| **Simulation predictive (what-if)** | Evaluation de l'impact d'un changement avant son application definitive en base de donnees |
| **Rapports et diagnostics complets** | Tracabilite integrale, identification des cours non planifies, alertes et rapports de generation detailles |
| **Exports professionnels** | Generation d'horaires directement exploitables aux formats PDF et Excel |

---

## Fonctionnalites principales

### Securite et controle d'acces

- Authentification securisee avec gestion des roles (`Responsable` / `Administrateur`)
- Controle d'acces base sur les privileges avec sessions protegees

### Pilotage et supervision

- Tableau de bord de pilotage avec indicateurs cles, session active, alertes et derniers rapports
- Vue synthetique de la couverture etudiante et de l'avancement de la planification

### Gestion des donnees academiques

- Administration des cours, professeurs, salles et groupes etudiants
- Gestion des disponibilites des professeurs et des indisponibilites des salles
- Import massif des etudiants depuis des fichiers structures (Excel / CSV)

### Planification et optimisation

- Generation automatique d'un horaire complet par session via le moteur intelligent
- Correction locale et replanification intelligente d'une affectation individuelle
- Echange cible de cours entre etudiants avec validation automatique des contraintes

### Consultation et diffusion

- Consultation des horaires par groupe, professeur, salle et etudiant
- Export des horaires en **PDF** et **Excel** pour diffusion immediate
- Centre d'aide integre avec documentation et tutoriels video

---

## Architecture du moteur de planification

Le coeur technique du projet repose sur un **moteur de planification academique avance**.
Il ne se contente pas de placer des cours dans des creneaux horaires : il construit un
horaire *faisable, stable, coherent et explicable* a l'echelle d'une session complete.

### Contraintes prises en compte

Le moteur integre simultanement les contraintes suivantes :

- **Catalogue et cohortes** -- Cours actifs du catalogue et groupes formes depuis les cohortes etudiantes
- **Compatibilite professeurs** -- Affectation des professeurs qualifies pour chaque cours
- **Compatibilite salles** -- Selection des salles selon le type requis et la capacite disponible
- **Disponibilites et absences** -- Respect des disponibilites, absences et indisponibilites temporaires
- **Prerequis academiques** -- Prise en compte des prerequis et replanification des cours echoues
- **Equilibre et charge** -- Contraintes de conflits horaires, de charge enseignante et d'equilibre global

## Le point fort majeur : le moteur intelligent

Le cœur du projet est son moteur de planification académique.

Ce moteur ne cherche pas seulement à attribuer des cours à des créneaux. Il cherche à produire un horaire :

- **faisable** ;
- **stable** ;
- **cohérent** ;
- **explicable** ;
- **corrigeable sans régénération complète**.

Il prend en compte :

- les cours actifs du catalogue ;
- les groupes formés à partir des étudiants ;
- les professeurs compatibles avec chaque cours ;
- les salles compatibles selon le type et la capacité ;
- les disponibilités et absences des professeurs ;
- les indisponibilités des salles ;
- les prérequis ;
- les cours échoués à replacer ;
- les contraintes de conflit, de charge et d'équilibre.

L'une de ses forces les plus intéressantes est la recherche d'un **motif hebdomadaire stable**, ce qui améliore fortement la lisibilité et la cohérence des horaires à l'échelle d'une session.

## Gestion des cas réels et des exceptions

Un projet d'horaires devient réellement utile lorsqu'il sait gérer les situations difficiles. Horaires-5 prend explicitement en charge plusieurs cas que beaucoup de solutions plus simples ignorent :

- professeur absent ou devenu indisponible ;
- salle temporairement indisponible ;
- groupe sans horaire ou partiellement planifié ;
- étudiant avec exception individuelle ;
- cours échoué à replacer dans une section compatible ;
- échange de cours entre étudiants ;
- simulation préalable avant certaines modifications sensibles ;
- rapport détaillé des cours non planifiés.

Cette capacité à traiter les exceptions donne au projet une dimension nettement plus professionnelle et crédible.


### Principe fondamental : motif hebdomadaire stable

> Le moteur construit une combinaison optimale `jour + heure + professeur + salle`
> reproductible sur l'ensemble de la session. Cette approche garantit un horaire
> plus lisible, plus previsible et plus fiable pour l'ensemble des parties prenantes.

---

## Architecture technique

Le projet suit une architecture en couches avec une separation stricte des responsabilites :

```
Horaires-5/
|-- Frontend/          React 19 + Vite -- Interface, pages, composants, services API
|-- Backend/           Node.js + Express 5 -- API REST, logique metier, moteur intelligent
|   |-- Database/      MySQL -- Migrations SQL versionnees, schema evolutif
|   |-- routes/        Points d'entree API organises par domaine
|   |-- services/      Logique metier et orchestration
|   |-- repositories/  Acces aux donnees et requetes SQL
|-- documents/         Documentation fonctionnelle, technique, UML, guides
```

### Principes architecturaux

- **Separation nette** entre interface utilisateur (React/Vite), logique metier (Express/Node.js) et acces aux donnees (MySQL + mysql2)
- **Architecture en couches** : Controller → Service → Repository pour une maintenabilite optimale
- **Migrations versionnees** : Evolution du schema de base de donnees via des fichiers SQL numerotes
- **Documentation exhaustive** : Chaque module dispose de sa documentation de conception et d'utilisation

---

## Pile technologique

| Couche | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router, Framer Motion, Lucide React |
| **Backend** | Node.js, Express 5, Passport.js, express-session, Helmet, CORS |
| **Base de donnees** | MySQL 8+, mysql2 |
| **Import / Export** | ExcelJS, XLSX, PDFKit, Multer |
| **Tests** | Jest, Supertest |
| **Securite** | Helmet, CORS, bcrypt, sessions securisees |
| **Outillage** | npm scripts, migrations SQL versionnees, ESLint |

---

## Parcours d'utilisation type

Le flux operationnel complet suit huit etapes structurees :

| Etape | Action | Description |
|:---:|---|---|
| **1** | Configurer | Definir les cours, professeurs, salles et sessions academiques |
| **2** | Importer | Charger les donnees etudiantes depuis un fichier structure (Excel/CSV) |
| **3** | Grouper | Former les cohortes etudiantes et verifier leur composition |
| **4** | Generer | Lancer le moteur de planification automatique |
| **5** | Analyser | Consulter le rapport de generation et les indicateurs de qualite |
| **6** | Corriger | Resoudre les conflits identifies de maniere locale et ciblee |
| **7** | Consulter | Visualiser les horaires par groupe, professeur, salle ou etudiant |
| **8** | Exporter | Produire les horaires finaux en PDF ou Excel pour diffusion |

---

## Roles et permissions

| Role | Perimetre d'action |
|---|---|
| **Responsable** | Gouvernance globale, supervision strategique, administration avancee de la plateforme |
| **Administrateur** | Gestion operationnelle des donnees academiques et des modules fonctionnels |

> Les professeurs et les etudiants sont des **entites metier** gerees au sein de la
> plateforme. Ils ne disposent pas d'acces direct au systeme.

---

## Installation et demarrage

```bash
# Cloner le depot
git clone https://github.com/votre-utilisateur/horaires-5.git
cd horaires-5

# Installer toutes les dependances
npm install
cd Backend && npm install
cd ../Frontend && npm install
cd ..

# Initialiser la base de donnees
npm run migrate

# Lancer l'application en mode developpement
npm run dev
```

> **Prerequis** : Node.js >= 18 | MySQL >= 8

---

## Documentation du projet

Le repertoire `documents/` contient une documentation complete structuree en plusieurs volets :

- **Specifications fonctionnelles** -- Description detaillee des besoins et des regles metier
- **Conception technique** -- Architecture logicielle, diagrammes UML et choix de conception
- **Guides d'utilisation** -- Procedures pas-a-pas pour chaque module de l'application
- **Modele de base de donnees** -- Schema relationnel complet avec historique des migrations

---

<div align="center">

**HORAIRES-5**

*Projet de fin d'etudes -- La Cite collegiale*

*Construire des horaires fiables, coherents et exploitables*

---

Developpe avec rigueur par

**RAFIK BEDREDDIN** -- **SABER KARA** -- **JOVANI CLEMENT**

</div>
