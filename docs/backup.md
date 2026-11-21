# Backup and keep-alive

Supabase Free has no automatic backups and pauses a project after about a week with no activity.
This is how we cover both. (Decision of 21 Nov 2026: stay on Free for now; see `docs/todo.md`.)

## 1. Keep-alive: `/api/health`

- `GET /api/health` runs one trivial query and returns `{"ok":true}`, or 503 `{"ok":false}`. It creates no data and reveals nothing.
- `.github/workflows/keepalive.yml` calls it every 3 days using the `APP_URL` secret (already set for the reminders workflow). If the site or database is down the run fails and GitHub emails the repo owner.
- GitHub's schedule is not exact (runs can be hours late), which is fine for a 3-day interval.
- The reminders cron also reads the database often, so there are two independent reasons the project stays active.
- Optional second caller: when cron-job.org is set up, add a job for `APP_URL/api/health` every 3 days.
- Check once a week that the "keepalive" runs on the repo's Actions tab are green.

## 2. Weekly backup to your own computer

The repository is **public**, so backups must **not** be stored in GitHub (not as artifacts, not in a commit). They hold customers' personal data and login records. The scripts run on your computer and write the file there.

### One-time setup
1. Install the PostgreSQL client tools, version 15 or newer (on Windows: the PostgreSQL installer, choose "Command Line Tools" only; add its `bin` folder to PATH). Check with `pg_dump --version`.
2. In Supabase: **Connect** > **Session pooler** > copy the connection string (it works over IPv4) and put your database password in it. Keep this string private. Never paste it into a chat, a commit or a public place.
3. Pick a folder on an encrypted disk (BitLocker on Windows), for example `D:\backups\uk-booking`. Do not use a folder that syncs to a public or shared cloud.

### Run it by hand (Windows PowerShell)
```powershell
$env:SUPABASE_DB_URL = 'postgresql://postgres.xxxx:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'
.\scripts\backup.ps1 -OutDir 'D:\backups\uk-booking'
```
macOS or Linux: `SUPABASE_DB_URL='...' ./scripts/backup.sh ./backups`

It writes `uk-booking-YYYY-MM-DD-HHmm.dump`, checks the file can be read, and keeps the newest 8 (about two months).

### Run it every 7 days (Windows Task Scheduler)
Store the connection string as a **user environment variable** (Settings > System > About > Advanced system settings > Environment Variables > New, name `SUPABASE_DB_URL`). Then create the task (adjust the paths):
```powershell
schtasks /Create /SC WEEKLY /D SUN /ST 20:00 /TN "uk-booking backup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\uk-booking-app\scripts\backup.ps1 -OutDir D:\backups\uk-booking"
```
The computer must be on at that time (tick "Run task as soon as possible after a scheduled start is missed" in the task's Settings tab). Look at the backup folder once a week: a new file should appear.

## 3. Test a restore once (do this before relying on the backups)

A backup nobody has restored is not proven. Use a throwaway Supabase project (never the live one):
```
pg_restore --no-owner --clean --if-exists --dbname="<throwaway project connection string>" uk-booking-YYYY-MM-DD-HHmm.dump
```
Then check in that project that the `businesses` and `bookings` tables hold the rows you expect. Expect some harmless errors about Supabase-owned objects in the `auth` schema; what matters is that your tables and their data are there. Delete the throwaway project afterwards.

## What a backup does not include
- Logo image files (Supabase Storage). Owners can re-upload them.
- Anything in Stripe. Stripe keeps its own records.

## If something goes wrong
- Up to 7 days of bookings can be missing after a restore (the time since the last backup). Contact the shops with bookings in that window.
- A paused Supabase project is restored from the Supabase dashboard (the "Restore" button), not from these backups.
