/**
 * Migration Runner
 * Manages database migrations for the Aeko platform
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MigrationRunner {
    constructor() {
        this.migrationsDir = __dirname;
        this.migrationsCollection = null;
    }

    async connect() {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('📦 Connected to MongoDB');
        }
        this.migrationsCollection = mongoose.connection.db.collection('migrations');
    }

    async disconnect() {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('📦 Database connection closed');
        }
    }

    async getMigrationFiles() {
        const files = await fs.readdir(this.migrationsDir);
        return files
            .filter(file => file.match(/^\d{3}-.*\.js$/) && file !== 'migrate.js')
            .sort();
    }

    async getExecutedMigrations() {
        try {
            const executed = await this.migrationsCollection.find({}).toArray();
            return executed.map(m => m.name);
        } catch (error) {
            // If collection doesn't exist, no migrations have been run
            return [];
        }
    }

    async getPendingMigrations() {
        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        
        return allMigrations.filter(file => {
            const migrationName = file.replace('.js', '');
            return !executedMigrations.includes(migrationName);
        });
    }

    async runMigration(migrationFile) {
        const migrationPath = join(this.migrationsDir, migrationFile);
        const migrationName = migrationFile.replace('.js', '');
        
        console.log(`🚀 Running migration: ${migrationName}`);
        
        try {
            const migration = await import(`file://${migrationPath}`);
            
            if (typeof migration.up !== 'function') {
                throw new Error(`Migration ${migrationName} does not export an 'up' function`);
            }
            
            await migration.up();
            
            // Record successful migration
            await this.migrationsCollection.insertOne({
                name: migrationName,
                executedAt: new Date(),
                description: `Migration from file: ${migrationFile}`
            });
            
            console.log(`✅ Migration ${migrationName} completed successfully`);
            
        } catch (error) {
            console.error(`❌ Migration ${migrationName} failed:`, error);
            throw error;
        }
    }

    async rollbackMigration(migrationFile) {
        const migrationPath = join(this.migrationsDir, migrationFile);
        const migrationName = migrationFile.replace('.js', '');
        
        console.log(`🔄 Rolling back migration: ${migrationName}`);
        
        try {
            const migration = await import(`file://${migrationPath}`);
            
            if (typeof migration.down !== 'function') {
                throw new Error(`Migration ${migrationName} does not export a 'down' function`);
            }
            
            await migration.down();
            
            // Remove migration record
            await this.migrationsCollection.deleteOne({
                name: migrationName
            });
            
            console.log(`✅ Migration ${migrationName} rolled back successfully`);
            
        } catch (error) {
            console.error(`❌ Rollback of ${migrationName} failed:`, error);
            throw error;
        }
    }

    async runAllPending() {
        const pendingMigrations = await this.getPendingMigrations();
        
        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }
        
        console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
        pendingMigrations.forEach(migration => {
            console.log(`   - ${migration}`);
        });
        
        for (const migration of pendingMigrations) {
            await this.runMigration(migration);
        }
        
        console.log('🎉 All pending migrations completed!');
    }

    async showStatus() {
        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        
        console.log('\n📊 Migration Status:');
        console.log('==================');
        
        if (allMigrations.length === 0) {
            console.log('No migration files found');
            return;
        }
        
        allMigrations.forEach(file => {
            const migrationName = file.replace('.js', '');
            const isExecuted = executedMigrations.includes(migrationName);
            const status = isExecuted ? '✅ Executed' : '⏳ Pending';
            console.log(`${status} - ${migrationName}`);
        });
        
        const pendingCount = allMigrations.length - executedMigrations.length;
        console.log(`\nTotal: ${allMigrations.length} migrations, ${pendingCount} pending`);
    }
}

// CLI interface
async function main() {
    const command = process.argv[2];
    const migrationName = process.argv[3];
    
    const runner = new MigrationRunner();
    
    try {
        await runner.connect();
        
        switch (command) {
            case 'up':
                if (migrationName) {
                    await runner.runMigration(`${migrationName}.js`);
                } else {
                    await runner.runAllPending();
                }
                break;
                
            case 'down':
                if (!migrationName) {
                    console.error('❌ Migration name required for rollback');
                    process.exit(1);
                }
                await runner.rollbackMigration(`${migrationName}.js`);
                break;
                
            case 'status':
                await runner.showStatus();
                break;
                
            default:
                console.log(`
🔧 Migration Runner Usage:

  node migrate.js up [migration-name]    - Run all pending migrations or specific migration
  node migrate.js down <migration-name>  - Rollback specific migration
  node migrate.js status                 - Show migration status

Examples:
  node migrate.js up                           # Run all pending migrations
  node migrate.js up 001-add-post-privacy-fields  # Run specific migration
  node migrate.js down 001-add-post-privacy-fields # Rollback specific migration
  node migrate.js status                       # Show status
                `);
                break;
        }
        
    } catch (error) {
        console.error('Migration runner failed:', error);
        process.exit(1);
    } finally {
        await runner.disconnect();
    }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default MigrationRunner;