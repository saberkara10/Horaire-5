# horaires-5 - Guide d'instalation du projet

Projet: `horaires-5`
Nom fonctionnel: `gestion-des-horaires`

readme complet et pratique pour lancer `gestion-des-horaires` sous Windows PowerShell.

## 1) Prerequis

- Node.js 18+ (ideal: 20 LTS)
- npm 9+
- MySQL 8+
- VS Code

Verifier:

```powershell
node -v
npm -v
mysql --version
```

## 2) Extraire le ZIP

Si ton ZIP est `horaires-5-main.zip`:

```powershell
Expand-Archive -Path "D:\Telechargements\horaires-5-main.zip" -DestinationPath "D:\Projets" -Force
Rename-Item -Path "D:\Projets\horaires-5-main" -NewName "horaires-5"
Set-Location "D:\Projets\horaires-5"
```

## 3) Importer la base MySQL

Creer la base, puis importer le SQL:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS gestion_horaires;"
mysql -u root -p gestion_horaires < .\Backend\Database\GDH5.sql
```

## 4) Configurer `.env`

Fichier: `Backend/.env`

Contenu minimal:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_horaires
```

Si tu utilises le module auth (`Backend/app.js`), ajoute aussi:

```env
SESSION_SECRET=cle-secrete-longue
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## 5) Installer les dependances backend

```powershell
Set-Location .\Backend
npm install
```

Pour auth (si besoin):

```powershell
npm install bcrypt express-session cors
```

## 6) Tester la connexion DB

```powershell
node .\test-db.js
```

Attendu:

```text
Connexion MySQL OK
```

## 7) Demarrer le serveur

Mode dev:

```powershell
npm run dev
```

Mode normal:

```powershell
npm start
```

URL:

- `http://localhost:3000`

Verification rapide:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
Invoke-RestMethod -Uri "http://localhost:3000/api/test" -Method GET
```

## 8) Routes principales dispo (etat actuel)

- `GET /api/health`
- `GET /api/test`
- CRUD `/api/cours`
- CRUD `/api/professeurs`

Note: le code auth existe (`Backend/app.js`), mais le demarrage principal actuel passe par `Backend/src/server.js`.

## 9) Tests Jest + Supertest (rapide)

## 9.1 Installer

```powershell
npm install -D jest supertest
```

## 9.2 Ajouter scripts de test

```powershell
npm pkg set scripts.test="node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand"
npm pkg set scripts.test:watch="node --experimental-vm-modules ./node_modules/jest/bin/jest.js --watch"
```

## 9.3 Creer un test minimum

```powershell
New-Item -ItemType Directory -Force .\tests | Out-Null
@'
import request from "supertest";
import app from "../src/app.js";

describe("API Health", () => {
  it("GET /api/health -> 200", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "OK");
  });
});
'@ | Set-Content -Path .\tests\health.test.js -Encoding UTF8
```

## 9.4 Lancer les tests

```powershell
npm test
```

## 10) Erreurs frequentes (fix rapide)

- `SESSION_SECRET manquant`:
  ajouter `SESSION_SECRET` dans `Backend/.env`.
- `Cannot find package 'bcrypt'` (ou `express-session`, `cors`):

```powershell
npm install bcrypt express-session cors
```

- Erreurs auth SQL (`mot_de_passe_hash`, `roles`, etc.):
  le schema `GDH5.sql` doit etre aligne avec `Backend/routes/auth.routes.js`.
- Erreur connexion MySQL:
  verifier `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` + service MySQL actif.

---
