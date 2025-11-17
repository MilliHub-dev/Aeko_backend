/**
 * Verification script for member data synchronization
 * This script demonstrates that member data is properly synchronized
 * between Community.members and User.communities arrays
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Community from './models/Community.js';
import User from './models/User.js';

dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Verify member synchronization
const verifyMemberSync = async () => {
  try {
    console.log('\n=== Member Data Synchronization Verification ===\n');

    // Find a community with members
    const community = await Community.findOne({ 
      'members.0': { $exists: true } 
    }).populate('members.user', 'name username');

    if (!community) {
      console.log('⚠ No communities with members found. Skipping verification.');
      return;
    }

    console.log(`Testing community: ${community.name} (${community._id})`);
    console.log(`Total members: ${community.members.length}\n`);

    let syncedCount = 0;
    let unsyncedCount = 0;
    const issues = [];

    // Check each member
    for (const member of community.members) {
      const userId = member.user._id || member.user;
      const user = await User.findById(userId);

      if (!user) {
        issues.push(`✗ User ${userId} not found in database`);
        unsyncedCount++;
        continue;
      }

      // Check if user has this community in their communities array
      const userCommunity = user.communities.find(
        c => c.community.toString() === community._id.toString()
      );

      if (!userCommunity) {
        issues.push(
          `✗ User ${user.username} (${userId}) is in Community.members but NOT in User.communities`
        );
        unsyncedCount++;
        continue;
      }

      // Check if roles match
      if (member.role !== userCommunity.role) {
        issues.push(
          `✗ Role mismatch for ${user.username}: ` +
          `Community.members.role="${member.role}" vs User.communities.role="${userCommunity.role}"`
        );
        unsyncedCount++;
        continue;
      }

      // Check subscription data if present
      if (member.subscription && member.subscription.isActive) {
        if (!userCommunity.subscription) {
          issues.push(
            `✗ Subscription mismatch for ${user.username}: ` +
            `Community has subscription but User does not`
          );
          unsyncedCount++;
          continue;
        }

        // Check subscription fields
        const subFields = ['type', 'isActive', 'paymentMethod'];
        let subMismatch = false;
        for (const field of subFields) {
          if (member.subscription[field] !== userCommunity.subscription[field]) {
            issues.push(
              `✗ Subscription.${field} mismatch for ${user.username}: ` +
              `Community="${member.subscription[field]}" vs User="${userCommunity.subscription[field]}"`
            );
            subMismatch = true;
          }
        }

        if (subMismatch) {
          unsyncedCount++;
          continue;
        }
      }

      // All checks passed
      console.log(
        `✓ ${user.username} - Role: ${member.role}, ` +
        `Status: ${member.status}` +
        (member.subscription?.isActive ? `, Subscription: ${member.subscription.type}` : '')
      );
      syncedCount++;
    }

    // Print summary
    console.log('\n=== Verification Summary ===');
    console.log(`✓ Synchronized members: ${syncedCount}`);
    console.log(`✗ Unsynchronized members: ${unsyncedCount}`);

    if (issues.length > 0) {
      console.log('\n=== Issues Found ===');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('\n✓ All member data is properly synchronized!');
    }

    // Check for orphaned User.communities entries
    console.log('\n=== Checking for Orphaned Entries ===');
    const users = await User.find({ 
      'communities.0': { $exists: true } 
    });

    let orphanedCount = 0;
    for (const user of users) {
      for (const userCommunity of user.communities) {
        const comm = await Community.findById(userCommunity.community);
        
        if (!comm) {
          console.log(
            `✗ User ${user.username} has reference to non-existent community ${userCommunity.community}`
          );
          orphanedCount++;
          continue;
        }

        const isMember = comm.members.some(
          m => (m.user._id || m.user).toString() === user._id.toString()
        );

        if (!isMember) {
          console.log(
            `✗ User ${user.username} has community ${comm.name} in User.communities ` +
            `but is NOT in Community.members`
          );
          orphanedCount++;
        }
      }
    }

    if (orphanedCount === 0) {
      console.log('✓ No orphaned entries found');
    } else {
      console.log(`✗ Found ${orphanedCount} orphaned entries`);
    }

  } catch (error) {
    console.error('Verification error:', error);
  }
};

// Test member operations
const testMemberOperations = async () => {
  try {
    console.log('\n=== Testing Member Operations ===\n');

    // Find a test community and user
    const community = await Community.findOne({ isActive: true });
    const user = await User.findOne({ 
      _id: { $nin: community.members.map(m => m.user) }
    });

    if (!community || !user) {
      console.log('⚠ Could not find suitable test data. Skipping operation tests.');
      return;
    }

    console.log(`Test community: ${community.name}`);
    console.log(`Test user: ${user.username}\n`);

    // Test 1: Add member
    console.log('Test 1: Adding member...');
    await community.addMember(user._id, 'member');
    
    // Verify in both models
    const updatedCommunity = await Community.findById(community._id);
    const updatedUser = await User.findById(user._id);
    
    const inCommunity = updatedCommunity.members.some(
      m => m.user.toString() === user._id.toString()
    );
    const inUser = updatedUser.communities.some(
      c => c.community.toString() === community._id.toString()
    );

    if (inCommunity && inUser) {
      console.log('✓ Member added to both models successfully\n');
    } else {
      console.log('✗ Member addition failed');
      console.log(`  In Community.members: ${inCommunity}`);
      console.log(`  In User.communities: ${inUser}\n`);
    }

    // Test 2: Update role
    console.log('Test 2: Updating member role to moderator...');
    await updatedCommunity.updateMemberRole(user._id, 'moderator');
    
    const communityAfterRole = await Community.findById(community._id);
    const userAfterRole = await User.findById(user._id);
    
    const communityRole = communityAfterRole.members.find(
      m => m.user.toString() === user._id.toString()
    )?.role;
    const userRole = userAfterRole.communities.find(
      c => c.community.toString() === community._id.toString()
    )?.role;

    if (communityRole === 'moderator' && userRole === 'moderator') {
      console.log('✓ Role updated in both models successfully\n');
    } else {
      console.log('✗ Role update failed');
      console.log(`  Community role: ${communityRole}`);
      console.log(`  User role: ${userRole}\n`);
    }

    // Test 3: Remove member
    console.log('Test 3: Removing member...');
    await communityAfterRole.removeMember(user._id);
    
    const communityAfterRemove = await Community.findById(community._id);
    const userAfterRemove = await User.findById(user._id);
    
    const stillInCommunity = communityAfterRemove.members.some(
      m => m.user.toString() === user._id.toString()
    );
    const stillInUser = userAfterRemove.communities.some(
      c => c.community.toString() === community._id.toString()
    );

    if (!stillInCommunity && !stillInUser) {
      console.log('✓ Member removed from both models successfully\n');
    } else {
      console.log('✗ Member removal failed');
      console.log(`  Still in Community.members: ${stillInCommunity}`);
      console.log(`  Still in User.communities: ${stillInUser}\n`);
    }

  } catch (error) {
    console.error('Test error:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  
  // Run verification
  await verifyMemberSync();
  
  // Run operation tests (commented out by default to avoid modifying data)
  // Uncomment the line below to test member operations
  // await testMemberOperations();
  
  await mongoose.connection.close();
  console.log('\n✓ Database connection closed');
};

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
