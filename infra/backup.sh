#!/bin/sh
# Periodic online backup of the SQLite database to the backup volume.
#
# `sqlite3 .backup` takes a consistent snapshot while the app keeps running
# (safe thanks to WAL mode), so this needs no coordination with the server.
# Old snapshots beyond BACKUP_KEEP are pruned.
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
    # Prune all but the newest $KEEP snapshots.
    ls -1t "$DEST"/rsvp-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "backup: $DB not present yet, skipping"
  fi
  sleep "$INTERVAL"
done
