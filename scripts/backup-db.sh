#!/usr/bin/env bash
#
# Backup Supabase (Postgres) to Cloudflare R2.
# Dumps roles, schema, and data separately (Supabase CLI recommendation:
# db dump --data-only needs the schema already applied to restore correctly),
# bundles them into one timestamped archive, uploads to R2, verifies the
# upload, and prunes old backups (R2: keep 30, local: keep 3).
#
# Usage: scripts/backup-db.sh

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ENV_FILE=".env.local"
BACKUP_DIR="backups"
RETENTION_LOCAL=3
RETENTION_REMOTE=30
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="careerasana-${TIMESTAMP}.tar.gz"
R2_PREFIX="backups"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$1"; }
fail() { printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Load env + verify required vars
# ---------------------------------------------------------------------------
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

REQUIRED_VARS=(SUPABASE_DB_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_ENDPOINT)
for var in "${REQUIRED_VARS[@]}"; do
  [[ -n "${!var:-}" ]] || fail "missing $var in $ENV_FILE"
done

command -v supabase >/dev/null 2>&1 || fail "supabase CLI not found on PATH"
command -v rclone >/dev/null 2>&1 || fail "rclone not found on PATH"

# rclone reads Cloudflare R2 credentials from env, no rclone.conf needed —
# .env.local stays the single source of truth for these secrets.
export RCLONE_CONFIG_R2_TYPE="s3"
export RCLONE_CONFIG_R2_PROVIDER="Cloudflare"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION="auto"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET="true"

# ---------------------------------------------------------------------------
# Dump roles, schema, data to a temp dir
# ---------------------------------------------------------------------------
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log "Dumping roles..."
supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$TMP_DIR/roles.sql"

log "Dumping schema..."
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP_DIR/schema.sql"

log "Dumping data..."
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$TMP_DIR/data.sql"

# ---------------------------------------------------------------------------
# Sanity-check dumps before archiving — never ship a silent-empty backup
# ---------------------------------------------------------------------------
MIN_DATA_BYTES=1024

for f in roles.sql schema.sql data.sql; do
  path="$TMP_DIR/$f"
  [[ -s "$path" ]] || fail "$f is empty — aborting, refusing to archive a broken dump"
done

data_size=$(wc -c < "$TMP_DIR/data.sql" | tr -d ' ')
if (( data_size < MIN_DATA_BYTES )); then
  log "WARNING: data.sql is only ${data_size} bytes — this looks suspiciously small for a real backup"
fi

# ---------------------------------------------------------------------------
# Bundle
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"

log "Creating archive $ARCHIVE_PATH..."
tar czf "$ARCHIVE_PATH" -C "$TMP_DIR" roles.sql schema.sql data.sql

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

# ---------------------------------------------------------------------------
# Upload to R2
# ---------------------------------------------------------------------------
log "Uploading to r2:${R2_BUCKET_NAME}/${R2_PREFIX}/${ARCHIVE_NAME}..."
rclone copyto "$ARCHIVE_PATH" "r2:${R2_BUCKET_NAME}/${R2_PREFIX}/${ARCHIVE_NAME}"

# ---------------------------------------------------------------------------
# Verify upload — don't trust a silent rclone success
# ---------------------------------------------------------------------------
REMOTE_LISTING=$(rclone lsf --format "ps" "r2:${R2_BUCKET_NAME}/${R2_PREFIX}/" | grep "^${ARCHIVE_NAME};" || true)
[[ -n "$REMOTE_LISTING" ]] || fail "upload verification failed — $ARCHIVE_NAME not found in R2 listing"

REMOTE_SIZE=$(echo "$REMOTE_LISTING" | cut -d';' -f2)
[[ "$REMOTE_SIZE" -gt 0 ]] || fail "upload verification failed — $ARCHIVE_NAME is 0 bytes in R2"

# ---------------------------------------------------------------------------
# Retention: R2 keep last N, local keep last M
# ---------------------------------------------------------------------------
log "Pruning R2 backups beyond last ${RETENTION_REMOTE}..."
rclone lsf "r2:${R2_BUCKET_NAME}/${R2_PREFIX}/" \
  | sort -r \
  | tail -n +$((RETENTION_REMOTE + 1)) \
  | while read -r old_file; do
      [[ -n "$old_file" ]] || continue
      log "  removing old remote backup: $old_file"
      rclone deletefile "r2:${R2_BUCKET_NAME}/${R2_PREFIX}/${old_file}"
    done

log "Pruning local backups beyond last ${RETENTION_LOCAL}..."
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/careerasana-*.tar.gz 2>/dev/null \
  | tail -n +$((RETENTION_LOCAL + 1)) \
  | while read -r old_file; do
      log "  removing old local backup: $old_file"
      rm -f "$old_file"
    done

log "SUCCESS: ${ARCHIVE_NAME} (${ARCHIVE_SIZE}) uploaded to R2 + verified"
