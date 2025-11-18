#!/usr/bin/env node

/**
 * Script to run the post privacy migration
 * This script adds privacy fields to existing posts and creates necessary indexes
 */

import { runMigration } from './migrations/001-add-post-privacy-fields.js';

console.log('🚀 Starting Post Privacy Migration...');
console.log('This will add privacy fields to existing posts and create indexes');
console.log('');

runMigration()
  .then(() => {
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 What was done:');
    console.log('  • Added privacy fields to existing posts');
    console.log('  • Set default privacy level to "public" for all existing posts');
    console.log('  • Created database indexes for privacy fields');
    console.log('  • Recorded migration in database');
    console.log('');
    console.log('🎉 Your posts now support privacy controls!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Please check your database connection and try again.');
    process.exit(1);
  });