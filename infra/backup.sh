#!/bin/sh
set -e

DB="${DB_PATH:-/app/data/rsvp.db}"
DEST="${BACKUP_DIR:-/backup}"
KEEP="${BACKUP_KEEP:-14}"
INTERVAL="${BACKUP_INTERVAL:-86400}"

mkdir -p "$DEST"
echo "backup: watching $DB -> $DEST every ${INTERVAL}s, keeping $KEEP"

while true; do
  if [ -f "$DB" ]; then
    ts=$(date +%Y%m%d-%H%M%S)
    if sqlite3 "$DB" ".backup '$DEST/rsvp-$ts.db'"; then
      echo "backup: wrote $DEST/rsvp-$ts.db"
    else
      echo "backup: FAILED at $ts" >&2
    fi
    ls -1t "$DEST"/rsvp-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "backup: $DB not present yet, skipping"
  fi
  sleep "$INTERVAL"
done
