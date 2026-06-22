#!/bin/bash

# =============================================================================
# Backup Cleanup Script
# =============================================================================
# This script removes old backup files to save disk space
# =============================================================================

set -e

# Default: keep last 30 backups
MAX_BACKUPS=${MAX_BACKUP_FILES:-30}
BACKUP_DIR=${BACKUP_ROOT_DIR:-"./backups"}

echo "🧹 Cleaning up old backups..."
echo "📁 Backup directory: $BACKUP_DIR"
echo "📊 Keeping last $MAX_BACKUPS backups"

# Count current backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" | wc -l)
echo "📈 Current backups: $BACKUP_COUNT"

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
    echo "🗑️  Removing $EXCESS old backup(s)..."
    
    # Remove oldest directories and archives
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -printf '%T+ %p\n' | sort | head -n "$EXCESS" | cut -d' ' -f2- | while read -r dir; do
        echo "   Removing: $(basename "$dir")"
        rm -rf "$dir"
        rm -f "${dir}.tar.gz"
    done
    
    echo "✅ Cleanup completed"
else
    echo "✅ No cleanup needed"
fi

# Show current disk usage
echo "💾 Current backup disk usage:"
du -sh "$BACKUP_DIR"
