# Database Migrations

This directory contains database migration scripts for the Aeko platform.

## Overview

Migrations are used to safely update the database schema and data as the application evolves. Each migration is a numbered script that can be run forward (up) or backward (down).

## Migration Files

- `001-add-post-privacy-fields.js` - Adds privacy settings to existing Post documents
- `migrate.js` - Migration runner utility

## Running Migrations

### Quick Start

To run the post privacy migration specifically:

```bash
node run-post-privacy-migration.js
```

### Using the Migration Runner

```bash
# Run all pending migrations
node migrations/migrate.js up

# Run a specific migration
node migrations/migrate.js up 001-add-post-privacy-fields

# Check migration status
node migrations/migrate.js status

# Rollback a specific migration
node migrations/migrate.js down 001-add-post-privacy-fields
```

## Migration: 001-add-post-privacy-fields

### What it does

1. **Adds privacy fields** to existing Post documents:
   - `privacy.level` - Privacy level (public, followers, select_users, only_me)
   - `privacy.selectedUsers` - Array of user IDs for select_users privacy
   - `privacy.updatedAt` - When privacy was last updated
   - `privacy.updateHistory` - Audit trail of privacy changes

2. **Sets default values**:
   - All existing posts get `privacy.level = "public"`
   - Empty `selectedUsers` array
   - Initial update history entry

3. **Creates database indexes**:
   - `privacy.level` - For filtering posts by privacy level
   - `privacy.selectedUsers` - For finding posts shared with specific users
   - `user + privacy.level` - For user-specific privacy queries
   - `privacy.level + createdAt` - For chronological privacy-filtered feeds

### Before running

- Ensure your `.env` file has the correct `MONGO_URI`
- Backup your database (recommended for production)
- Test on a staging environment first

### After running

- All existing posts will have privacy settings
- New posts can use privacy controls
- API endpoints will respect privacy settings
- Database queries will be optimized with new indexes

## Safety Features

- **Idempotent**: Safe to run multiple times
- **Validation**: Checks if migration already ran
- **Rollback**: Can be reversed if needed
- **Audit trail**: Records when migration was executed
- **Error handling**: Graceful failure with detailed error messages

## Troubleshooting

### Migration already executed
```
⚠️  Migration 001-add-post-privacy-fields has already been executed
```
This is normal - the migration has already been run and won't run again.

### Database connection issues
```
❌ Migration failed: Database connection failed
```
Check your `MONGO_URI` in the `.env` file and ensure MongoDB is running.

### Permission errors
```
❌ Error creating index: not authorized
```
Ensure your database user has the necessary permissions to create indexes.

## Creating New Migrations

1. Create a new file: `002-your-migration-name.js`
2. Follow the pattern from existing migrations
3. Export `up`, `down`, and `hasBeenRun` functions
4. Test thoroughly before deploying

## Best Practices

- Always backup production data before running migrations
- Test migrations on staging environments first
- Keep migrations small and focused
- Include rollback functionality
- Document what each migration does
- Use descriptive migration names with numbers