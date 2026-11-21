#!/usr/bin/env bash
# Backs up the Supabase database (the public and auth schemas) to a compressed file, checks the file
# can be read, and keeps the newest 8 backups. Needs pg_dump and pg_restore (PostgreSQL client tools,
# version 15 or newer) and the connection string in SUPABASE_DB_URL (the "Session pooler" string from
# Supabase > Connect: it works over IPv4). Never commit or paste that string anywhere public.
#
#   SUPABASE_DB_URL='postgresql://...' ./scripts/backup.sh [output-folder]
#
# The backup holds customers' personal data and login records: keep it on an encrypted disk and out of
# public places. Logo image files are not in it (they live in Supabase Storage and are easy to re-upload).
set -euo pipefail

OUT_DIR="${1:-./backups}"
KEEP=8

if [ -z "${SUPABASE_DB_URL:-}" ]; then echo "Set SUPABASE_DB_URL first." >&2; exit 2; fi
command -v pg_dump >/dev/null || { echo "pg_dump not found. Install the PostgreSQL client tools." >&2; exit 2; }
command -v pg_restore >/dev/null || { echo "pg_restore not found. Install the PostgreSQL client tools." >&2; exit 2; }

mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/uk-booking-$(date -u +%Y-%m-%d-%H%M).dump"
TMP="$FILE.partial"
trap 'rm -f "$TMP"' EXIT

pg_dump --dbname="$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file="$TMP"

# A real backup is not empty and can be listed.
[ -s "$TMP" ] || { echo "Backup file is empty." >&2; exit 1; }
pg_restore --list "$TMP" >/dev/null || { echo "Backup file cannot be read." >&2; exit 1; }

mv "$TMP" "$FILE"
trap - EXIT
echo "Backup written: $FILE ($(wc -c < "$FILE") bytes)"

# Keep the newest $KEEP backups.
ls -1t "$OUT_DIR"/uk-booking-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old"; echo "Removed old backup: $old"; done
