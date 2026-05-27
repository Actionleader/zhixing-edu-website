#!/bin/bash
# =============================================================================
# VPS Auto-Sync Setup Script for actionleader.com.hk
#
# Run this on the VPS (via TAT or SSH) to set up automatic GitHub sync.
# This ensures CMS-uploaded images and content appear on the live site.
#
# Usage via TAT:
#   (run the contents of this script directly via TAT RunCommand)
#
# Usage via SSH:
#   cd /var/www/actionleader.com.hk/deploy
#   sudo bash setup-vps-auto-sync.sh
# =============================================================================

set -e

SITE_DIR="/var/www/actionleader.com.hk"
CRON_SCHEDULE="*/3 * * * *"  # Every 3 minutes
LOG_FILE="/var/log/actionleader-git-pull.log"

echo "============================================"
echo "  ActionLeader VPS Auto-Sync Setup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# ---- Step 1: Verify environment ----
echo "[STEP 1] Verifying environment..."

# Check if git is available
if ! command -v git &>/dev/null; then
    echo "ERROR: git not found. Installing..."
    apt-get update -qq && apt-get install -y -qq git || yum install -y git
fi

# Check if we're in a git repo
if [ ! -d "$SITE_DIR/.git" ]; then
    echo "ERROR: $SITE_DIR is not a git repository"
    exit 1
fi

echo "  Git repo: OK"
echo "  Site dir: $SITE_DIR"

# ---- Step 2: Check git remote has credentials ----
echo ""
echo "[STEP 2] Checking git remote..."
cd "$SITE_DIR"
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
echo "  Remote: $GIT_REMOTE"

if echo "$GIT_REMOTE" | grep -q '@'; then
    echo "  Credentials: Configured (token in URL)"
else
    echo "  WARNING: No credentials in git remote URL. Pull may fail."
    echo "  Consider setting up git credential helper or using a token in the URL."
fi

# ---- Step 3: Do an initial pull to sync ----
echo ""
echo "[STEP 3] Performing initial git pull..."
BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
git fetch origin main 2>&1 || echo "  WARNING: fetch failed"
git reset --hard origin/main 2>&1 || echo "  WARNING: reset failed"
AFTER=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "  Before: $BEFORE"
echo "  After:  $AFTER"

# ---- Step 4: Fix permissions ----
echo ""
echo "[STEP 4] Fixing file permissions..."

# Find the correct web user
if id www-data &>/dev/null; then
    WEB_USER="www-data"
elif id nginx &>/dev/null; then
    WEB_USER="nginx"
elif id apache &>/dev/null; then
    WEB_USER="apache"
else
    WEB_USER=$(whoami)
    echo "  WARNING: Could not determine web user, using current user: $WEB_USER"
fi

echo "  Web user: $WEB_USER"

# Set ownership
chown -R "$WEB_USER:$WEB_USER" "$SITE_DIR" 2>/dev/null || echo "  WARNING: chown failed (may need root)"

# Set file permissions
find "$SITE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
find "$SITE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true

# Special: ensure uploads directory is world-readable
if [ -d "$SITE_DIR/assets/images/uploads" ]; then
    chmod -R 755 "$SITE_DIR/assets/images/uploads" 2>/dev/null || true
    find "$SITE_DIR/assets/images/uploads" -type f -exec chmod 644 {} \; 2>/dev/null || true
    echo "  Uploads directory: Permissions fixed"
else
    echo "  Uploads directory: Does not exist yet (will be created by CMS)"
fi

# ---- Step 5: Set up cron job for auto-pull ----
echo ""
echo "[STEP 5] Setting up auto-pull cron job..."

CRON_ENTRY="$CRON_SCHEDULE /var/www/actionleader.com.hk/deploy/git-pull.sh >> /var/log/actionleader-git-pull.log 2>&1"

# Create log file
touch "$LOG_FILE" 2>/dev/null || true
chmod 644 "$LOG_FILE" 2>/dev/null || true

# Add to crontab (avoiding duplicates)
if crontab -l 2>/dev/null | grep -Fq "git-pull.sh"; then
    echo "  Cron job already exists, skipping."
else
    (crontab -l 2>/dev/null || true; echo "$CRON_ENTRY") | crontab -
    echo "  Cron job added: $CRON_SCHEDULE git-pull.sh"
fi

# Make script executable
chmod +x "$SITE_DIR/deploy/git-pull.sh" 2>/dev/null || true

# ---- Step 6: Test the pull script ----
echo ""
echo "[STEP 6] Testing auto-pull script..."
bash "$SITE_DIR/deploy/git-pull.sh" 2>&1 || echo "  Test completed (check output above)"

# ---- Step 7: Summary ----
echo ""
echo "============================================"
echo "  SETUP COMPLETE"
echo "============================================"
echo ""
echo "  What was set up:"
echo "  1. Initial git pull completed"
echo "  2. File permissions fixed"
echo "  3. Cron job: $CRON_SCHEDULE git-pull.sh"
echo "  4. Log file: $LOG_FILE"
echo ""
echo "  Current uploads directory:"
ls -la "$SITE_DIR/assets/images/uploads/" 2>/dev/null || echo "  (empty or doesn't exist)"
echo ""
echo "  To verify sync is working:"
echo "    tail -f $LOG_FILE"
echo ""
echo "============================================"
