<#
Backs up the Supabase database (the public and auth schemas) to a compressed file, checks the file can
be read, and keeps the newest 8 backups. Windows PowerShell version of backup.sh.

Needs pg_dump.exe and pg_restore.exe (PostgreSQL client tools, version 15 or newer, on PATH) and the
connection string in the SUPABASE_DB_URL environment variable (the "Session pooler" string from
Supabase > Connect: it works over IPv4). Never commit or paste that string anywhere public.

  $env:SUPABASE_DB_URL = 'postgresql://...'
  .\scripts\backup.ps1 -OutDir 'D:\backups\uk-booking'

The backup holds customers' personal data and login records: keep it on an encrypted disk (BitLocker)
and out of public places. Logo image files are not in it (they live in Supabase Storage).
#>
param([string]$OutDir = ".\backups")

$ErrorActionPreference = "Stop"
$keep = 8

if (-not $env:SUPABASE_DB_URL) { Write-Error "Set SUPABASE_DB_URL first."; exit 2 }
foreach ($tool in "pg_dump", "pg_restore") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Error "$tool not found. Install the PostgreSQL client tools."; exit 2 }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd-HHmm")
$file = Join-Path $OutDir "uk-booking-$stamp.dump"
$tmp = "$file.partial"

try {
  & pg_dump --dbname="$env:SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file="$tmp"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit code $LASTEXITCODE)." }
  if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -eq 0) { throw "Backup file is empty." }
  & pg_restore --list "$tmp" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Backup file cannot be read." }
  Move-Item -Force $tmp $file
} catch {
  if (Test-Path $tmp) { Remove-Item -Force $tmp }
  Write-Error $_
  exit 1
}

Write-Output ("Backup written: {0} ({1} bytes)" -f $file, (Get-Item $file).Length)

Get-ChildItem -Path $OutDir -Filter "uk-booking-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keep | ForEach-Object {
  Remove-Item -Force $_.FullName
  Write-Output "Removed old backup: $($_.FullName)"
}
