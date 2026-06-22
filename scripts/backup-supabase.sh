#!/bin/bash

# =============================================================================
# Comprehensive Supabase Backup Script
# =============================================================================
# This script backs up:
# - Database schema and data (tables, functions, triggers, RLS policies, etc.)
# - Storage buckets and files
# - Authentication settings
# - Edge functions (if any)
# =============================================================================

set -e  # Exit on any error

# Use original PostgreSQL client (compatibility mode)
# export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# Configuration - Set these variables
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

# Backup directory with timestamp
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🚀 Starting comprehensive Supabase backup..."
echo "📁 Backup directory: $BACKUP_DIR"

# =============================================================================
# 1. COMPLETE DATABASE BACKUP
# =============================================================================
echo "📊 Backing up complete database schema and data..."

# Full database dump with all schemas, functions, triggers, RLS policies, etc.
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=custom \
  --verbose \
  --file="$BACKUP_DIR/complete_database.dump" \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --schema=realtime \
  --schema=supabase_functions \
  --schema=graphql_public \
  --schema=extensions \
  --schema=vault \
  "$DB_NAME"

# Also create a human-readable SQL dump
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=plain \
  --verbose \
  --file="$BACKUP_DIR/complete_database.sql" \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --schema=realtime \
  --schema=supabase_functions \
  --schema=graphql_public \
  --schema=extensions \
  --schema=vault \
  "$DB_NAME"

echo "✅ Database backup completed"

# =============================================================================
# 2. SCHEMA-ONLY BACKUP (for structure reference)
# =============================================================================
echo "📋 Creating schema-only backup..."

PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=plain \
  --schema-only \
  --verbose \
  --file="$BACKUP_DIR/schema_only.sql" \
  "$DB_NAME"

echo "✅ Schema-only backup completed"

# =============================================================================
# 3. STORAGE BUCKETS BACKUP
# =============================================================================
echo "🪣 Backing up storage buckets..."

# Create storage backup directory
mkdir -p "$BACKUP_DIR/storage"

# Use Node.js script to backup storage
cat > "$BACKUP_DIR/backup_storage.js" << 'EOF'
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
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function downloadFile(bucketName, fileName, savePath) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;
    const file = fs.createWriteStream(savePath);
    
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function backupStorage() {
  console.log('📦 Starting storage backup...');
  
  try {
    // Get list of buckets
    const bucketsResponse = await makeRequest(`${SUPABASE_URL}/storage/v1/bucket`);
    console.log(`Found ${bucketsResponse.length} buckets`);
    
    // Save buckets metadata
    fs.writeFileSync(
      path.join(BACKUP_DIR, 'storage', 'buckets.json'), 
      JSON.stringify(bucketsResponse, null, 2)
    );
    
    for (const bucket of bucketsResponse) {
      console.log(`📂 Backing up bucket: ${bucket.name}`);
      
      const bucketDir = path.join(BACKUP_DIR, 'storage', bucket.name);
      fs.mkdirSync(bucketDir, { recursive: true });
      
      // Get objects in bucket
      const objectsResponse = await makeRequest(`${SUPABASE_URL}/storage/v1/object/list/${bucket.name}`);
      
      // Save objects metadata
      fs.writeFileSync(
        path.join(bucketDir, 'objects_metadata.json'), 
        JSON.stringify(objectsResponse, null, 2)
      );
      
      // Download each file
      for (const obj of objectsResponse) {
        if (obj.name && !obj.name.endsWith('/')) { // Skip folders
          try {
            console.log(`  📄 Downloading: ${obj.name}`);
            const filePath = path.join(bucketDir, obj.name);
            
            // Create directory if needed
            const fileDir = path.dirname(filePath);
            fs.mkdirSync(fileDir, { recursive: true });
            
            await downloadFile(bucket.name, obj.name, filePath);
          } catch (error) {
            console.error(`  ❌ Error downloading ${obj.name}:`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Storage backup completed');
  } catch (error) {
    console.error('❌ Storage backup failed:', error);
    process.exit(1);
  }
}

backupStorage();
EOF

# Run storage backup
export SUPABASE_URL="$SUPABASE_URL"
export SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export BACKUP_DIR="$BACKUP_DIR"

node "$BACKUP_DIR/backup_storage.js"

# Clean up the temporary script
rm "$BACKUP_DIR/backup_storage.js"

# =============================================================================
# 4. AUTH CONFIGURATION BACKUP
# =============================================================================
echo "🔐 Backing up authentication configuration..."

# Create auth config backup using SQL queries
PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --command="COPY (SELECT * FROM auth.users) TO STDOUT CSV HEADER;" > "$BACKUP_DIR/auth_users.csv"

PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --command="COPY (SELECT * FROM auth.identities) TO STDOUT CSV HEADER;" > "$BACKUP_DIR/auth_identities.csv"

echo "✅ Auth configuration backup completed"

# =============================================================================
# 5. MIGRATIONS BACKUP
# =============================================================================
echo "🔄 Copying migration files..."

if [ -d "supabase/migrations" ]; then
  cp -r "supabase/migrations" "$BACKUP_DIR/"
  echo "✅ Migration files copied"
else
  echo "⚠️  No migration files found"
fi

# =============================================================================
# 6. PROJECT CONFIGURATION
# =============================================================================
echo "⚙️  Backing up project configuration..."

# Create a configuration summary
cat > "$BACKUP_DIR/backup_info.json" << EOF
{
  "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project_id": "$PROJECT_ID",
  "database_host": "$DB_HOST",
  "database_name": "$DB_NAME",
  "backup_contents": {
    "complete_database": "Full database dump with all schemas",
    "schema_only": "Database structure only",
    "storage": "All storage buckets and files",
    "auth_config": "Authentication users and identities",
    "migrations": "Database migration files"
  },
  "restore_instructions": "Use restore-supabase.sh to restore this backup"
}
EOF

# Copy relevant project files
[ -f "supabase_definitions.txt" ] && cp "supabase_definitions.txt" "$BACKUP_DIR/"
[ -f "package.json" ] && cp "package.json" "$BACKUP_DIR/"
[ -f "env.example" ] && cp "env.example" "$BACKUP_DIR/"

# =============================================================================
# 7. COMPRESSION AND CLEANUP
# =============================================================================
echo "🗜️  Compressing backup..."

# Create compressed archive
tar -czf "${BACKUP_DIR}.tar.gz" -C "backups" "$(basename "$BACKUP_DIR")"

# Calculate sizes
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
ARCHIVE_SIZE=$(du -sh "${BACKUP_DIR}.tar.gz" | cut -f1)

echo "✅ Backup completed successfully!"
echo "📊 Backup Statistics:"
echo "   📁 Directory: $BACKUP_DIR ($BACKUP_SIZE)"
echo "   📦 Archive: ${BACKUP_DIR}.tar.gz ($ARCHIVE_SIZE)"
echo "   🕒 Duration: $SECONDS seconds"

# Optional: Remove uncompressed backup to save space
# Uncomment the next line if you want to keep only the compressed version
# rm -rf "$BACKUP_DIR"

echo "🎉 Backup process completed!"
