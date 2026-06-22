#!/bin/bash

# =============================================================================
# Backup Verification Script
# =============================================================================
# This script verifies that a backup is complete and valid
# =============================================================================

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-directory>"
    echo "Example: $0 backups/20240813-165133"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "🔍 Verifying backup: $BACKUP_DIR"

# Check database backup files
echo "📊 Checking database backups..."
if [ -f "$BACKUP_DIR/complete_database.dump" ]; then
    echo "   ✅ Custom format dump found"
    # Verify dump is valid
    if pg_restore --list "$BACKUP_DIR/complete_database.dump" > /dev/null 2>&1; then
        echo "   ✅ Custom dump is valid"
    else
        echo "   ❌ Custom dump appears corrupted"
    fi
elif [ -f "$BACKUP_DIR/complete_database.sql" ]; then
    echo "   ✅ SQL dump found"
else
    echo "   ❌ No database backup found"
fi

# Check storage backup
echo "🪣 Checking storage backup..."
if [ -d "$BACKUP_DIR/storage" ]; then
    BUCKET_COUNT=$(find "$BACKUP_DIR/storage" -maxdepth 1 -type d | wc -l)
    echo "   ✅ Storage backup found ($BUCKET_COUNT buckets)"
else
    echo "   ⚠️  No storage backup found"
fi

# Check auth backup
echo "🔐 Checking auth backup..."
if [ -f "$BACKUP_DIR/auth_users.csv" ]; then
    USER_COUNT=$(tail -n +2 "$BACKUP_DIR/auth_users.csv" | wc -l)
    echo "   ✅ Auth backup found ($USER_COUNT users)"
else
    echo "   ⚠️  No auth backup found"
fi

# Check backup info
echo "ℹ️  Checking backup metadata..."
if [ -f "$BACKUP_DIR/backup_info.json" ]; then
    echo "   ✅ Backup info found"
    echo "   📅 Backup date: $(grep -o '"backup_date":"[^"]*' "$BACKUP_DIR/backup_info.json" | cut -d'"' -f4)"
else
    echo "   ⚠️  No backup info found"
fi

# Calculate total size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "💾 Total backup size: $BACKUP_SIZE"

echo "✅ Verification completed"
