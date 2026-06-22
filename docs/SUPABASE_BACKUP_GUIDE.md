# 🚀 Comprehensive Supabase Backup Guide

This guide provides the **complete solution** for backing up all components of your Supabase project locally, including tables, functions, triggers, RLS policies, storage buckets, and more.

## 📋 What Gets Backed Up

Our backup solution captures **everything**:

- ✅ **Database Schema & Data**: All tables, views, indexes, sequences
- ✅ **Functions & Triggers**: Custom PostgreSQL functions and triggers  
- ✅ **RLS Policies**: Row Level Security policies and permissions
- ✅ **Storage Buckets**: Bucket configurations and all stored files
- ✅ **Authentication**: User data and authentication settings
- ✅ **Extensions**: PostgreSQL extensions and configurations
- ✅ **Migrations**: Database migration history
- ✅ **Custom Types**: Enums and custom data types

## 🛠️ Setup Instructions

### 1. Prerequisites

Make sure you have these tools installed:
```bash
# PostgreSQL client tools
brew install postgresql  # macOS
sudo apt-get install postgresql-client  # Linux

# Node.js (for storage backup/restore)
# Already have this in your project
```

### 2. Set Environment Variables

Create a `.env.backup` file or add these to your existing environment:

```bash
# Your Supabase project configuration
SUPABASE_PROJECT_ID="your-project-id-here"
SUPABASE_DB_PASSWORD="your-database-password"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional: Custom backup location
BACKUP_ROOT_DIR="./backups"
```

### 3. Get Your Supabase Credentials

#### Project ID:
- Go to your [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Copy the Project ID from the URL: `https://supabase.com/dashboard/project/{PROJECT_ID}`

#### Database Password:
- Go to Settings → Database
- Find the "Connection parameters" section
- Use the password you set when creating the project

#### Service Role Key:
- Go to Settings → API
- Copy the `service_role` key (not the `anon` key!)
- ⚠️ **Keep this secret - it bypasses RLS policies**

### 4. Make Scripts Executable

```bash
chmod +x scripts/backup-supabase.sh
chmod +x scripts/restore-supabase.sh
```

## 🎯 Usage

### Creating a Backup

#### Basic Backup:
```bash
# Set environment variables first
export SUPABASE_PROJECT_ID="your-project-id"
export SUPABASE_DB_PASSWORD="your-password"  
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Run backup
./scripts/backup-supabase.sh
```

#### Advanced Backup with Custom Location:
```bash
# Backup to custom directory
BACKUP_ROOT_DIR="/path/to/your/backups" ./scripts/backup-supabase.sh
```

### Restoring a Backup

⚠️ **WARNING**: Restoration will **OVERWRITE** your current database!

```bash
# Restore from directory
./scripts/restore-supabase.sh backups/20240813-165133

# Restore from compressed archive
./scripts/restore-supabase.sh backups/20240813-165133.tar.gz
```

## 📁 Backup Structure

Each backup creates a timestamped directory with this structure:

```
backups/20240813-165133/
├── complete_database.dump     # Binary PostgreSQL dump (recommended)
├── complete_database.sql      # Human-readable SQL dump  
├── schema_only.sql           # Database structure only
├── auth_users.csv            # Authentication users export
├── auth_identities.csv       # User identities export
├── storage/                  # Storage buckets and files
│   ├── buckets.json         # Bucket configurations
│   ├── bucket-name/         # Individual bucket contents
│   │   ├── objects_metadata.json
│   │   └── [actual files]
├── migrations/              # Database migrations (if available)
├── backup_info.json        # Backup metadata and info
├── supabase_definitions.txt # Project definitions
├── package.json            # Project dependencies
└── env.example            # Environment template
```

## ⏰ Automated Backups

### Using Cron (Linux/macOS)

Add to your crontab to run backups automatically:

```bash
# Edit crontab
crontab -e

# Add entries (example schedules):

# Daily backup at 2 AM
0 2 * * * cd /path/to/your/project && ./scripts/backup-supabase.sh

# Weekly backup on Sundays at 1 AM  
0 1 * * 0 cd /path/to/your/project && ./scripts/backup-supabase.sh

# Monthly backup on 1st day at midnight
0 0 1 * * cd /path/to/your/project && ./scripts/backup-supabase.sh
```

### Using GitHub Actions

Create `.github/workflows/backup.yml`:

```yaml
name: Supabase Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:     # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install PostgreSQL client
        run: sudo apt-get update && sudo apt-get install -y postgresql-client
        
      - name: Run backup
        env:
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: ./scripts/backup-supabase.sh
        
      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: supabase-backup-${{ github.run_id }}
          path: backups/
          retention-days: 30
```

## 🔧 Advanced Configuration

### Custom Backup Script

You can modify the backup scripts for your specific needs:

#### Include/Exclude Specific Schemas:
Edit the `--schema` parameters in `backup-supabase.sh`:

```bash
# Include only public and auth schemas
pg_dump \
  --schema=public \
  --schema=auth \
  # ... other parameters
```

#### Custom Storage Handling:
Modify the Node.js storage backup section to filter specific buckets or file types.

#### Database-Only Backup:
Comment out the storage backup sections if you only need database backups.

## 🚨 Security Best Practices

1. **Environment Variables**: Never commit credentials to version control
2. **Service Role Key**: Treat this like a root password - it bypasses all RLS policies
3. **Backup Storage**: Store backups in secure, encrypted locations
4. **Access Control**: Limit who can access backup files
5. **Regular Testing**: Regularly test your restore process

## 🔍 Troubleshooting

### Common Issues:

#### Connection Issues:
```bash
# Test connection
psql -h db.YOUR_PROJECT_ID.supabase.co -p 5432 -U postgres -d postgres
```

#### Storage Backup Fails:
- Verify your Service Role Key has storage permissions
- Check bucket names and file permissions
- Ensure sufficient disk space

#### Large Database Backups:
- Use custom format dumps (`.dump`) instead of SQL
- Consider excluding large tables if not needed
- Use compression for storage

#### Permission Errors:
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Check file permissions
ls -la scripts/
```

## 📊 Backup Verification

Always verify your backups:

### 1. Check Backup Contents:
```bash
# View backup info
cat backups/20240813-165133/backup_info.json

# Check database dump
pg_restore --list backups/20240813-165133/complete_database.dump | head -20
```

### 2. Test Restore Process:
Use a separate test project to verify restore functionality.

### 3. Monitor Backup Sizes:
```bash
# Check backup sizes over time
du -sh backups/*
```

## 🎯 Best Practices

1. **Regular Schedule**: Set up automated daily/weekly backups
2. **Multiple Locations**: Store backups in different locations (local + cloud)
3. **Retention Policy**: Keep multiple backup versions but clean up old ones
4. **Test Restores**: Regularly test the restore process
5. **Monitor Failures**: Set up alerts for backup failures
6. **Documentation**: Keep this guide updated with your customizations

## 📞 Support

If you encounter issues:

1. Check the backup logs for error messages
2. Verify your Supabase credentials and permissions
3. Ensure PostgreSQL client tools are properly installed
4. Test database connectivity manually

---

## ✨ Quick Start Summary

1. **Install**: `brew install postgresql` (or equivalent)
2. **Configure**: Set environment variables with your Supabase credentials  
3. **Backup**: `./scripts/backup-supabase.sh`
4. **Restore**: `./scripts/restore-supabase.sh backups/[folder-name]`
5. **Automate**: Add to cron or GitHub Actions

That's it! You now have a complete, professional-grade backup solution for your Supabase project. 🎉

