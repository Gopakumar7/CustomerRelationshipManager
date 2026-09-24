# Personal CRM

Local-first personal CRM based on [ARCHITECTURE.md](./ARCHITECTURE.md), with
company, contact, opportunity, interaction, assessment, follow-up, dashboard,
search, filtering, and detail workflows implemented.

## Windows user installation

For a non-developer Windows installation, install Docker Desktop, copy this
folder to the computer, and double-click `INSTALL-CRM.bat`. The complete
procedure, daily start/stop instructions, backups, restores, and
troubleshooting are documented in [USER_INSTALLATION.md](./USER_INSTALLATION.md).

The installer runs the packaged production Compose stack and exposes the CRM at
<http://127.0.0.1:5173/>.

The production installer downloads public pre-built images from GitHub Container
Registry. Developers publish updated images through the
`.github/workflows/publish-images.yml` workflow; end users do not need access
to the source code or a GitHub account.

## Prerequisites

- Python 3.12+
- Node.js 20+
- Docker Desktop (recommended for PostgreSQL)

## Native development

Copy `.env.example` to `.env` and adjust values if needed. Docker Compose loads
this file automatically. For native PowerShell development, set the variables
in the current shell before starting Django, for example:

```powershell
$env:DJANGO_SECRET_KEY = "local-development-secret"
$env:POSTGRES_HOST = "127.0.0.1"
$env:POSTGRES_PORT = "5432"
$env:POSTGRES_DB = "crm"
$env:POSTGRES_USER = "crm"
$env:POSTGRES_PASSWORD = "crm-local-password"
```

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend health endpoint is available at
`http://127.0.0.1:8000/api/v1/health/`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend is available at `http://127.0.0.1:5173/` and proxies `/api` to
Django.

### Tests

```powershell
docker compose exec backend pytest

cd ..\frontend
npm test -- --run

cd ..
npx playwright install chromium
npm run test:e2e
```

## Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

This starts PostgreSQL, Django on port 8000, and the Vite development server
on port 5173. The database data is stored in the `postgres_data` volume.

## Backup

Create a logical PostgreSQL backup from the Compose database:

```powershell
docker compose exec db pg_dump -U crm -d crm > crm-backup.sql
```

Do not commit `.env` or database backups.
