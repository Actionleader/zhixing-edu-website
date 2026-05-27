#!/bin/bash
# =============================================================================
# Auto-pull script for actionleader.com.hk
# Pulls latest changes from GitHub to keep CMS-uploaded content in sync.
#
# Usage: /var/www/actionleader.com.hk/deploy/git-pull.sh
# Cron:  */2 * * * * /var/www/actionleader.com.hk/deploy/git-pull.sh >> /var/log/actionleader-git-pull.log 2>&1
# =============================================================================

set -e

SITE_DIR="/var/www/actionleader.com.hk"
LOCK_FILE="/tmp/actionleader-git-pull.lock"
LOG_FILE="/var/log/actionleader-git-pull.log"

# Prevent concurrent pulls
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another git-pull is already running, skipping."
    exit 0
fi

cd "$SITE_DIR"

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Not a git repository at $SITE_DIR"
    exit 1
fi

# Stash any local changes (shouldn't happen on a read-only VPS copy, but just in case)
HAS_CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
if [ "$HAS_CHANGES" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $HAS_CHANGES local change(s) detected, stashing before pull"
    git stash --include-untracked 2>/dev/null || true
fi

# Fetch and pull
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling from origin/main..."
BEFORE=$(git rev-parse HEAD 2>/dev/null)
git fetch origin main 2>&1
git reset --hard origin/main 2>&1
AFTER=$(git rev-parse HEAD 2>/dev/null)

if [ "$BEFORE" != "$AFTER" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: Updated from $BEFORE to $AFTER"

    # Fix permissions on newly pulled files (ensure nginx can read them)
    chown -R www-data:www-data "$SITE_DIR" 2>/dev/null || chown -R nginx:nginx "$SITE_DIR" 2>/dev/null || true
    find "$SITE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$SITE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true

    # Specifically ensure uploads directory is world-readable
    if [ -d "$SITE_DIR/assets/images/uploads" ]; then
        chmod -R 755 "$SITE_DIR/assets/images/uploads"
        find "$SITE_DIR/assets/images/uploads" -type f -exec chmod 644 {} \;
    fi

    # Reload nginx to clear any cache (optional, but safe)
    nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes (HEAD: $AFTER)"
fi
