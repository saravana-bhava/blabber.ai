#!/bin/bash

# =============================================================================
# Automated Backup Setup Script
# =============================================================================
# This script helps you set up automated backups for your Supabase project
# =============================================================================

set -e

echo "🚀 Setting up automated Supabase backups..."

# =============================================================================
# 1. VERIFY PREREQUISITES
# =============================================================================
echo "🔍 Checking prerequisites..."

# Check if PostgreSQL tools are installed
if ! command -v pg_dump &> /dev/null; then
    echo "❌ PostgreSQL client tools not found!"
    echo "📥 Installing PostgreSQL client tools..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install postgresql
        else
            echo "❌ Homebrew not found. Please install PostgreSQL client tools manually:"
            echo "   Visit: https://www.postgresql.org/download/macosx/"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y postgresql-client
        elif command -v yum &> /dev/null; then
            sudo yum install -y postgresql
        else
            echo "❌ Package manager not recognized. Please install PostgreSQL client tools manually."
        fi
    else
        echo "❌ OS not recognized. Please install PostgreSQL client tools manually."
    fi
else
    echo "✅ PostgreSQL client tools found"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install Node.js first."
    exit 1
else
    echo "✅ Node.js found: $(node --version)"
fi

# =============================================================================
# 2. CREATE ENVIRONMENT CONFIGURATION
# =============================================================================
echo "⚙️  Setting up environment configuration..."

if [ ! -f ".env.backup" ]; then
    cat > .env.backup << 'EOF'
# =============================================================================
# Supabase Backup Configuration
# =============================================================================
# Get these values from your Supabase Dashboard

# Your project ID (from the dashboard URL)
SUPABASE_PROJECT_ID="your-project-id-here"

# Database password (set when you created the project)
SUPABASE_DB_PASSWORD="your-database-password-here"

# Service role key (from Settings → API)
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Optional: Custom backup directory (defaults to ./backups)
# BACKUP_ROOT_DIR="/path/to/your/backups"

# Optional: Maximum backup files to keep (defaults to unlimited)
# MAX_BACKUP_FILES=30
EOF

    echo "📝 Created .env.backup file"
    echo "⚠️  Please edit .env.backup with your Supabase credentials"
else
    echo "✅ .env.backup file already exists"
fi

# =============================================================================
# 3. MAKE SCRIPTS EXECUTABLE
# =============================================================================
echo "🔧 Making backup scripts executable..."

chmod +x scripts/backup-supabase.sh
chmod +x scripts/restore-supabase.sh
chmod +x scripts/setup-automated-backups.sh

echo "✅ Scripts are now executable"

# =============================================================================
# 4. CREATE BACKUP DIRECTORY
# =============================================================================
echo "📁 Creating backup directory..."

mkdir -p backups
echo "✅ Backup directory created"

# =============================================================================
# 5. SET UP CRON JOB (OPTIONAL)
# =============================================================================
echo ""
echo "⏰ Would you like to set up automated backups with cron? (y/n)"
read -r setup_cron

if [[ "$setup_cron" == "y" || "$setup_cron" == "Y" ]]; then
    echo ""
    echo "🕒 Choose backup frequency:"
    echo "1) Daily at 2 AM"
    echo "2) Weekly on Sunday at 1 AM"  
    echo "3) Monthly on 1st day at midnight"
    echo "4) Custom (you'll enter the cron expression)"
    echo ""
    read -r -p "Enter choice (1-4): " freq_choice
    
    PROJECT_DIR=$(pwd)
    CRON_COMMAND="cd $PROJECT_DIR && ./scripts/backup-supabase.sh >> $PROJECT_DIR/backups/backup.log 2>&1"
    
    case $freq_choice in
        1)
            CRON_SCHEDULE="0 2 * * *"
            CRON_DESC="Daily at 2 AM"
            ;;
        2)
            CRON_SCHEDULE="0 1 * * 0"
            CRON_DESC="Weekly on Sunday at 1 AM"
            ;;
        3)
            CRON_SCHEDULE="0 0 1 * *"
            CRON_DESC="Monthly on 1st day at midnight"
            ;;
        4)
            echo "Enter cron expression (e.g., '0 2 * * *' for daily at 2 AM):"
            read -r CRON_SCHEDULE
            CRON_DESC="Custom schedule: $CRON_SCHEDULE"
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
    
    # Add to crontab
    (crontab -l 2>/dev/null || echo "") | grep -v "$PROJECT_DIR/scripts/backup-supabase.sh" > /tmp/crontab_temp
    echo "$CRON_SCHEDULE $CRON_COMMAND" >> /tmp/crontab_temp
    crontab /tmp/crontab_temp
    rm /tmp/crontab_temp
    
    echo "✅ Cron job added: $CRON_DESC"
    echo "📋 View your cron jobs: crontab -l"
    echo "📝 Backup logs will be saved to: $PROJECT_DIR/backups/backup.log"
else
    echo "ℹ️  Skipped cron setup"
fi

# =============================================================================
# 6. CREATE CLEANUP SCRIPT
# =============================================================================
echo "🧹 Creating backup cleanup script..."

cat > scripts/cleanup-old-backups.sh << 'EOF'
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
EOF

chmod +x scripts/cleanup-old-backups.sh
echo "✅ Cleanup script created"

# =============================================================================
# 7. CREATE VERIFICATION SCRIPT  
# =============================================================================
echo "🔍 Creating backup verification script..."

cat > scripts/verify-backup.sh << 'EOF'
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
EOF

chmod +x scripts/verify-backup.sh
echo "✅ Verification script created"

# =============================================================================
# 8. FINAL INSTRUCTIONS
# =============================================================================
echo ""
echo "🎉 Automated backup setup completed!"
echo ""
echo "📋 What was created:"
echo "   📄 .env.backup - Configuration file (EDIT THIS!)"
echo "   📁 backups/ - Backup directory"  
echo "   🔧 scripts/backup-supabase.sh - Main backup script"
echo "   🔄 scripts/restore-supabase.sh - Restore script"
echo "   🧹 scripts/cleanup-old-backups.sh - Cleanup old backups"
echo "   🔍 scripts/verify-backup.sh - Verify backup integrity"

if [[ "$setup_cron" == "y" || "$setup_cron" == "Y" ]]; then
    echo "   ⏰ Cron job - Automated backup schedule"
fi

echo ""
echo "🚨 IMPORTANT NEXT STEPS:"
echo "   1. Edit .env.backup with your Supabase credentials"
echo "   2. Test the backup: source .env.backup && ./scripts/backup-supabase.sh"
echo "   3. Test the restore on a test project"
echo ""
echo "📖 For detailed instructions, see: docs/SUPABASE_BACKUP_GUIDE.md"
echo ""
echo "✨ Quick test command:"
echo "   source .env.backup && ./scripts/backup-supabase.sh"

