/**
 * Migration: Add privacy fields to existing posts
 * Date: 2024-11-17
 * Description: Adds privacy settings to existing Post documents and creates necessary indexes
 */

import mongoose from 'mongoose';
import Post from '../models/Post.js';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATION_NAME = '001-add-post-privacy-fields';

/**
 * Migration to add privacy fields to existing posts
 */
async function up() {
    console.log(`🚀 Starting migration: ${MIGRATION_NAME}`);
    
    try {
        // Connect to database if not already connected
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('📦 Connected to MongoDB for migration');
        }

        // Get collection reference
        const collection = mongoose.connection.db.collection('posts');
        
        // Count existing posts without privacy field
        const postsWithoutPrivacy = await collection.countDocuments({
            'privacy': { $exists: false }
        });
        
        console.log(`📊 Found ${postsWithoutPrivacy} posts without privacy settings`);
        
        if (postsWithoutPrivacy === 0) {
            console.log('✅ All posts already have privacy settings');
            return;
        }

        // Add default privacy settings to existing posts
        const updateResult = await collection.updateMany(
            { 'privacy': { $exists: false } },
            {
                $set: {
                    'privacy': {
                        level: 'public',
                        selectedUsers: [],
                        updatedAt: new Date(),
                        updateHistory: []
                    }
                }
            }
        );

        console.log(`✅ Updated ${updateResult.modifiedCount} posts with default privacy settings`);

        // Create indexes for privacy fields
        console.log('🔍 Creating indexes for privacy fields...');
        
        const indexes = [
            { 'privacy.level': 1 },
            { 'privacy.selectedUsers': 1 },
            { user: 1, 'privacy.level': 1 },
            { 'privacy.level': 1, createdAt: -1 },
            { user: 1, 'privacy.level': 1, createdAt: -1 }
        ];

        for (const index of indexes) {
            try {
                await collection.createIndex(index);
                console.log(`✅ Created index: ${JSON.stringify(index)}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`⚠️  Index already exists: ${JSON.stringify(index)}`);
                } else {
                    console.error(`❌ Error creating index ${JSON.stringify(index)}:`, error.message);
                }
            }
        }

        // Verify the migration
        const updatedPostsCount = await collection.countDocuments({
            'privacy.level': 'public'
        });
        
        console.log(`✅ Verification: ${updatedPostsCount} posts now have privacy settings`);
        
        // Record migration in database
        await recordMigration();
        
        console.log(`🎉 Migration ${MIGRATION_NAME} completed successfully!`);
        
    } catch (error) {
        console.error(`❌ Migration ${MIGRATION_NAME} failed:`, error);
        throw error;
    }
}

/**
 * Rollback migration (remove privacy fields)
 */
async function down() {
    console.log(`🔄 Rolling back migration: ${MIGRATION_NAME}`);
    
    try {
        // Connect to database if not already connected
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('📦 Connected to MongoDB for rollback');
        }

        const collection = mongoose.connection.db.collection('posts');
        
        // Remove privacy fields from all posts
        const updateResult = await collection.updateMany(
            {},
            {
                $unset: {
                    'privacy': 1
                }
            }
        );

        console.log(`✅ Removed privacy fields from ${updateResult.modifiedCount} posts`);

        // Drop privacy-related indexes
        console.log('🗑️  Dropping privacy indexes...');
        
        const indexesToDrop = [
            'privacy.level_1',
            'privacy.selectedUsers_1',
            'user_1_privacy.level_1',
            'privacy.level_1_createdAt_-1',
            'user_1_privacy.level_1_createdAt_-1'
        ];

        for (const indexName of indexesToDrop) {
            try {
                await collection.dropIndex(indexName);
                console.log(`✅ Dropped index: ${indexName}`);
            } catch (error) {
                if (error.code === 27) {
                    console.log(`⚠️  Index does not exist: ${indexName}`);
                } else {
                    console.error(`❌ Error dropping index ${indexName}:`, error.message);
                }
            }
        }

        // Remove migration record
        await removeMigrationRecord();
        
        console.log(`🎉 Rollback of ${MIGRATION_NAME} completed successfully!`);
        
    } catch (error) {
        console.error(`❌ Rollback of ${MIGRATION_NAME} failed:`, error);
        throw error;
    }
}

/**
 * Record migration in database
 */
async function recordMigration() {
    const migrationsCollection = mongoose.connection.db.collection('migrations');
    
    await migrationsCollection.insertOne({
        name: MIGRATION_NAME,
        executedAt: new Date(),
        description: 'Add privacy fields to existing posts and create indexes'
    });
    
    console.log('📝 Migration recorded in database');
}

/**
 * Remove migration record from database
 */
async function removeMigrationRecord() {
    const migrationsCollection = mongoose.connection.db.collection('migrations');
    
    await migrationsCollection.deleteOne({
        name: MIGRATION_NAME
    });
    
    console.log('📝 Migration record removed from database');
}

/**
 * Check if migration has already been run
 */
async function hasBeenRun() {
    try {
        const migrationsCollection = mongoose.connection.db.collection('migrations');
        const migration = await migrationsCollection.findOne({
            name: MIGRATION_NAME
        });
        
        return !!migration;
    } catch (error) {
        // If migrations collection doesn't exist, migration hasn't been run
        return false;
    }
}

/**
 * Run migration if not already executed
 */
async function runMigration() {
    try {
        const alreadyRun = await hasBeenRun();
        
        if (alreadyRun) {
            console.log(`⚠️  Migration ${MIGRATION_NAME} has already been executed`);
            return;
        }
        
        await up();
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('📦 Database connection closed');
        }
    }
}

// Export functions for use in migration runner
export { up, down, hasBeenRun, runMigration };

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration();
}