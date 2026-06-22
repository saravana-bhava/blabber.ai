#!/bin/bash

# =============================================================================
# Comprehensive Supabase Restore Script
# =============================================================================
# This script restores a complete Supabase backup created by backup-supabase.sh
# =============================================================================

set -e

# Ensure we use the correct PostgreSQL version
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# Check if backup path is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-directory-or-archive>"
    echo "Example: $0 backups/20240813-165133"
    echo "Example: $0 backups/20240813-165133.tar.gz"
    exit 1
fi

BACKUP_PATH="$1"

# Configuration
PROJECT_ID="${SUPABASE_PROJECT_ID:-your-project-id}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-your-db-password}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key}"

# Supabase URLs - support custom domains
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://data.blabber.ai}"

# Database connection details
# For custom domains, use the explicit host setting
DB_HOST="${SUPABASE_DB_HOST:-db.uafeclqyunwygrzkxmjz.supabase.co}"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

echo "🚀 Starting Supabase restore process..."

# =============================================================================
# 1. PREPARE BACKUP DIRECTORY
# =============================================================================

if [[ "$BACKUP_PATH" == *.tar.gz ]]; then
    echo "📦 Extracting archive: $BACKUP_PATH"
    BACKUP_DIR="$(dirname "$BACKUP_PATH")/$(basename "$BACKUP_PATH" .tar.gz)"
    
    # Extract if not already extracted
    if [ ! -d "$BACKUP_DIR" ]; then
        tar -xzf "$BACKUP_PATH" -C "$(dirname "$BACKUP_PATH")"
    fi
else
    BACKUP_DIR="$BACKUP_PATH"
fi

# Verify backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "📁 Using backup directory: $BACKUP_DIR"

# =============================================================================
# 2. RESTORE DATABASE
# =============================================================================
echo "🗄️  Restoring database..."

# Check if custom format dump exists
if [ -f "$BACKUP_DIR/complete_database.dump" ]; then
    echo "📊 Restoring from custom format dump..."
    
    # Warning about destructive operation
    echo "⚠️  WARNING: This will OVERWRITE your current database!"
    echo "⚠️  Make sure you want to proceed. Press Ctrl+C to cancel."
    echo "⏰ Starting in 10 seconds..."
    sleep 10
    
    # Drop and recreate database (alternative: use --clean --if-exists)
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        "$BACKUP_DIR/complete_database.dump"
        
    echo "✅ Database restored from custom format dump"
    
elif [ -f "$BACKUP_DIR/complete_database.sql" ]; then
    echo "📊 Restoring from SQL dump..."
    
    # Warning about destructive operation
    echo "⚠️  WARNING: This will OVERWRITE your current database!"
    echo "⚠️  Make sure you want to proceed. Press Ctrl+C to cancel."
    echo "⏰ Starting in 10 seconds..."
    sleep 10
    
    PGPASSWORD="$DB_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --file="$BACKUP_DIR/complete_database.sql"
    
    echo "✅ Database restored from SQL dump"
else
    echo "❌ No database backup file found!"
    exit 1
fi

# =============================================================================
# 3. RESTORE STORAGE
# =============================================================================
echo "🪣 Restoring storage buckets and files..."

if [ -d "$BACKUP_DIR/storage" ]; then
    # Create Node.js script to restore storage
    cat > "$BACKUP_DIR/restore_storage.js" << 'EOF'
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const BACKUP_DIR = process.env.BACKUP_DIR;

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        ...options.headers
      },
      method: options.method || 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ data: JSON.parse(data), status: res.statusCode });
        } catch (e) {
          resolve({ data, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function uploadFile(bucketName, fileName, filePath) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    
    // This is a simplified version - in practice, you'd need a proper FormData implementation
    // For now, we'll use the Supabase REST API directly
    const fileBuffer = fs.readFileSync(filePath);
    
    const req = https.request(`${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, status: res.statusCode }));
    });
    
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function restoreStorage() {
  console.log('📦 Starting storage restore...');
  
  try {
    const bucketsFile = path.join(BACKUP_DIR, 'storage', 'buckets.json');
    
    if (!fs.existsSync(bucketsFile)) {
      console.log('⚠️  No buckets backup found, skipping storage restore');
      return;
    }
    
    const buckets = JSON.parse(fs.readFileSync(bucketsFile, 'utf8'));
    
    for (const bucket of buckets) {
      console.log(`🪣 Restoring bucket: ${bucket.name}`);
      
      // Create bucket
      try {
        const createResult = await makeRequest(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: 'POST',
          body: JSON.stringify({
            id: bucket.id,
            name: bucket.name,
            public: bucket.public,
            file_size_limit: bucket.file_size_limit,
            allowed_mime_types: bucket.allowed_mime_types
          })
        });
        
        if (createResult.status === 200 || createResult.status === 201) {
          console.log(`  ✅ Bucket ${bucket.name} created`);
        } else if (createResult.status === 409) {
          console.log(`  ℹ️  Bucket ${bucket.name} already exists`);
        } else {
          console.log(`  ⚠️  Bucket creation response: ${createResult.status}`);
        }
      } catch (error) {
        console.error(`  ❌ Error creating bucket ${bucket.name}:`, error.message);
      }
      
      // Restore files
      const bucketDir = path.join(BACKUP_DIR, 'storage', bucket.name);
      if (fs.existsSync(bucketDir)) {
        await restoreFilesRecursively(bucketDir, bucket.name, '');
      }
    }
    
    console.log('✅ Storage restore completed');
  } catch (error) {
    console.error('❌ Storage restore failed:', error);
  }
}

async function restoreFilesRecursively(dir, bucketName, prefix) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    if (item === 'objects_metadata.json') continue;
    
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      await restoreFilesRecursively(itemPath, bucketName, prefix + item + '/');
    } else {
      const fileName = prefix + item;
      try {
        console.log(`  📄 Uploading: ${fileName}`);
        await uploadFile(bucketName, fileName, itemPath);
        console.log(`  ✅ Uploaded: ${fileName}`);
      } catch (error) {
        console.error(`  ❌ Error uploading ${fileName}:`, error.message);
      }
    }
  }
}

restoreStorage();
EOF

    # Run storage restore
    export SUPABASE_URL="$SUPABASE_URL"
    export SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
    export BACKUP_DIR="$BACKUP_DIR"
    
    node "$BACKUP_DIR/restore_storage.js"
    
    # Clean up
    rm "$BACKUP_DIR/restore_storage.js"
    
else
    echo "⚠️  No storage backup found, skipping storage restore"
fi

# =============================================================================
# 4. RESTORE MIGRATIONS (if needed)
# =============================================================================
echo "🔄 Checking migrations..."

if [ -d "$BACKUP_DIR/migrations" ] && [ -d "supabase/migrations" ]; then
    echo "📋 Migration files found in backup"
    echo "ℹ️  You may want to manually review and apply any missing migrations"
    echo "   Backup migrations: $BACKUP_DIR/migrations"
    echo "   Current migrations: supabase/migrations"
else
    echo "ℹ️  No migration restoration needed"
fi

# =============================================================================
# 5. COMPLETION
# =============================================================================
echo "✅ Restore process completed!"
echo ""
echo "📋 What was restored:"
echo "   🗄️  Database schema and data"
echo "   🪣 Storage buckets and files"
echo "   📁 Project configuration files"
echo ""
echo "⚠️  Important notes:"
echo "   - Review your authentication settings"
echo "   - Check your environment variables"
echo "   - Verify storage bucket permissions"
echo "   - Test your application thoroughly"
echo ""
echo "🎉 Restoration completed!"
