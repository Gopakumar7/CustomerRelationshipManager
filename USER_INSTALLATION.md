# Personal CRM Installation Guide for Windows

This guide is for a non-developer using the CRM on a Windows 10 or Windows 11
computer. You only need:

- Windows 10 or Windows 11
- Docker Desktop
- The CRM project folder copied to your computer

You do **not** need to install Python, Node.js, npm, PostgreSQL, Django, React,
Git, VS Code, or a compiler.

## 1. System prerequisites

Confirm that:

- Windows 10/11 is up to date.
- Hardware virtualization is enabled. Docker Desktop will report if it is not.
- You have enough disk space for Docker Desktop and CRM data.
- You can install software with Windows administrator permission.

## 2. Install Docker Desktop

1. Open <https://www.docker.com/products/docker-desktop/>.
2. Download Docker Desktop for Windows.
3. Run the installer.
4. Keep the recommended WSL 2 option enabled when offered.
5. Restart Windows if the installer requests it.
6. Start Docker Desktop.
7. Wait until Docker Desktop reports that Docker is running.

Docker Desktop must be running whenever you want to use the CRM.

## 3. First-time CRM installation

1. Copy the complete CRM folder to a permanent location, for example:
   `C:\PersonalCRM`.
2. Do not rename or remove the files inside the folder.
3. Double-click `INSTALL-CRM.bat`.
4. The installer checks Docker, creates local configuration, builds the
   application containers, creates the database storage, and starts the CRM.
5. When installation succeeds, it displays the CRM address.

The first installation may take several minutes because Docker downloads the
required images and builds the application.

The installer creates `.env` from `.env.example` if it does not already exist.
This file is local configuration and should not be shared.

## 4. Starting the CRM

1. Start Docker Desktop.
2. Open the CRM folder.
3. Double-click `START-CRM.bat`.
4. Open <http://127.0.0.1:5173/> in your browser.

## 5. Stopping the CRM

Double-click `STOP-CRM.bat`.

This stops the containers but keeps your CRM data in Docker's persistent
database volume.

Do not use `docker compose down -v` unless you intentionally want to delete the
database volume and all CRM data.

## 6. Restarting the CRM

Double-click `RESTART-CRM.bat`.

Use this after a temporary Docker problem or when the application needs to be
restarted. Your data is preserved.

## 7. Opening the CRM in the browser

Open:

<http://127.0.0.1:5173/>

The CRM is intentionally available only on this computer by default.

## 8. Checking whether the CRM is running

Double-click `STATUS-CRM.bat`.

The status window shows the database, backend, and frontend containers. It also
checks whether the browser page responds.

You can also open <http://127.0.0.1:5173/> directly. If the page does not
load, run `START-CRM.bat` and check Docker Desktop.

## 9. Updating the CRM

When you receive a new CRM folder or updated files:

1. Stop the CRM with `STOP-CRM.bat`.
2. Make a backup before replacing files.
3. Replace the application files with the new version.
4. Keep your existing `.env` file.
5. Double-click `INSTALL-CRM.bat`.

The installer rebuilds the application containers and runs database migrations.
Migrations are designed to preserve existing data. Do not delete the Docker
database volume during an update.

If you update by copying over the existing folder, close any open command
windows first and do not overwrite `.env` unless you intentionally want to
reset local configuration.

## 10. Backing up CRM data

Create a backup regularly, especially before updates.

1. Open Command Prompt in the CRM folder.
2. Run:

```bat
docker compose -f docker-compose.production.yml exec -T db pg_dump -U crm -d crm > crm-backup.sql
```

Store `crm-backup.sql` somewhere separate from the computer, such as an
encrypted external drive. Do not email or publicly upload it; it contains CRM
data.

If your `.env` uses different database names or users, use those values in the
command instead of `crm`.

## 11. Restoring CRM data

Restoring replaces the current database contents. Make a backup of the current
data first.

1. Put the backup file in the CRM folder and name it `crm-backup.sql`.
2. Start the CRM with `START-CRM.bat`.
3. Open Command Prompt in the CRM folder.
4. Clear the current database and recreate it:

```bat
docker compose -f docker-compose.production.yml exec -T db psql -U crm -d postgres -c "DROP DATABASE IF EXISTS crm;"
docker compose -f docker-compose.production.yml exec -T db psql -U crm -d postgres -c "CREATE DATABASE crm;"
docker compose -f docker-compose.production.yml exec -T db psql -U crm -d crm < crm-backup.sql
```

5. Run `STATUS-CRM.bat`.
6. Refresh the CRM browser page.

If the backup was created with different database credentials, replace `crm`
with the configured database user and name.

## 12. Troubleshooting

### Docker was not found

Install Docker Desktop, restart Windows if requested, and run the installer
again.

### Docker Desktop is not running

Start Docker Desktop and wait until it reports that Docker is running. Then run
`START-CRM.bat` or `INSTALL-CRM.bat` again.

### The browser page does not open

1. Run `STATUS-CRM.bat`.
2. If services are stopped, run `START-CRM.bat`.
3. Wait 30-60 seconds during the first start.
4. Try <http://127.0.0.1:5173/>.
5. Try a private browser window or hard refresh with `Ctrl+Shift+R`.

### Another application is using port 5173

Close the other application using that port, then run `RESTART-CRM.bat`.
The CRM is configured to use port 5173 for its local browser address.

### Installation takes a long time

The first installation downloads Docker images and builds the frontend. Keep
Docker Desktop open and allow the process to finish. A later start is much
faster.

### A container is unhealthy

Run `STATUS-CRM.bat`. If the problem continues, restart Docker Desktop and run
`RESTART-CRM.bat`. Do not delete the database volume unless you have a verified
backup and intend to remove the local database.

### Data is missing

Stop and restart the CRM first. If data is still missing, stop making changes
and restore the most recent verified backup. Do not run commands that remove
Docker volumes.

### Need more help

Keep the output from `STATUS-CRM.bat`, note what you clicked, and record the
time the problem occurred. This information is useful when diagnosing the
installation without exposing passwords or the contents of the CRM database.
