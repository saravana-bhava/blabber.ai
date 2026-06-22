#!/bin/bash

# =============================================================================
# Environment Template for Supabase Backups
# =============================================================================
# This script helps you quickly set up environment variables for backups
# =============================================================================

echo "🔧 Supabase Backup Environment Setup"
echo ""

# Check if .env.backup already exists
if [ -f ".env.backup" ]; then
    echo "✅ Found existing .env.backup file"
    echo "📋 Current configuration:"
    echo ""
    cat .env.backup | grep -E "^[^#]" | head -5
    echo ""
    read -r -p "Do you want to update the existing configuration? (y/n): " update_config
    
    if [[ ! "$update_config" == "y" && ! "$update_config" == "Y" ]]; then
        echo "ℹ️  Using existing configuration"
        exit 0
    fi
fi

echo ""
echo "📝 Please provide your Supabase project details:"
echo ""

# Get Project ID and check for custom domain
echo "1️⃣  Project Configuration:"
echo "   🌐 Do you use a custom domain for Supabase? (like data.blabber.ai)"
echo ""
read -r -p "Custom domain (y/n): " HAS_CUSTOM_DOMAIN

if [[ "$HAS_CUSTOM_DOMAIN" == "y" || "$HAS_CUSTOM_DOMAIN" == "Y" ]]; then
    echo ""
    echo "   📡 Custom Supabase URL (e.g., https://data.blabber.ai):"
    read -r -p "Enter your custom Supabase URL: " SUPABASE_URL
    
    echo ""
    echo "   🗄️  Database Host:"
    echo "   • Go to: https://supabase.com/dashboard → your project → Settings → Database"
    echo "   • Look for 'Connection parameters' section"
    echo "   • Copy the Host value (usually db.[project-id].supabase.co)"
    read -r -p "Enter your database host: " DB_HOST
    
    PROJECT_ID="custom-domain"
else
    echo ""
    echo "   📋 Project ID:"
    echo "   • Go to: https://supabase.com/dashboard"
    echo "   • Select your project"
    echo "   • Copy the ID from the URL: https://supabase.com/dashboard/project/{PROJECT_ID}"
    echo ""
    read -r -p "Enter your Project ID: " PROJECT_ID
    SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
    DB_HOST="db.${PROJECT_ID}.supabase.co"
fi

# Get Database Password  
echo ""
echo "2️⃣  Database Password:"
echo "   • Go to Settings → Database in your Supabase dashboard"
echo "   • Find 'Connection parameters' section"
echo "   • Use the password you set when creating the project"
echo ""
read -r -s -p "Enter your Database Password: " DB_PASSWORD
echo ""

# Get Service Role Key
echo ""
echo "3️⃣  Service Role Key:"
echo "   • Go to Settings → API in your Supabase dashboard"
echo "   • Copy the 'service_role' key (NOT the 'anon' key)"
echo "   • ⚠️  This key bypasses RLS policies - keep it secret!"
echo ""
read -r -s -p "Enter your Service Role Key: " SERVICE_KEY
echo ""

# Optional: Custom backup directory
echo ""
echo "4️⃣  Backup Directory (optional):"
echo "   • Default: ./backups"
echo "   • Press Enter to use default, or specify custom path"
echo ""
read -r -p "Enter backup directory (or press Enter for default): " BACKUP_DIR

if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="./backups"
fi

# Create .env.backup file
cat > .env.backup << EOF
# =============================================================================
# Supabase Backup Configuration
# Generated on: $(date)
# =============================================================================

# Your project ID (from the dashboard URL, or 'custom-domain' if using custom domain)
SUPABASE_PROJECT_ID="$PROJECT_ID"

# Supabase URL (custom domain or standard)
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"

# Database connection details
SUPABASE_DB_HOST="$DB_HOST"
SUPABASE_DB_PASSWORD="$DB_PASSWORD"

# Service role key (from Settings → API)
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

# Backup directory
BACKUP_ROOT_DIR="$BACKUP_DIR"

# Optional: Maximum backup files to keep (defaults to unlimited)
# MAX_BACKUP_FILES=30

# Optional: Compression level (1-9, default: 6)
# COMPRESSION_LEVEL=6
EOF

echo ""
echo "✅ Configuration saved to .env.backup"
echo ""
echo "🔒 Security Note:"
echo "   • Your .env.backup file contains sensitive credentials"
echo "   • Never commit this file to version control"
echo "   • Consider adding .env.backup to your .gitignore"
echo ""
echo "🧪 Test your configuration:"
echo "   source .env.backup && ./scripts/backup-supabase.sh"
echo ""
echo "📖 For complete instructions, see: docs/SUPABASE_BACKUP_GUIDE.md"
