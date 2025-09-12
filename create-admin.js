import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔐 Creating Admin User...');
    
    // Admin user details
    const adminData = {
      name: 'Admin User',
      username: 'admin',
      email: 'admin@aeko.social',
      password: 'admin123', // Change this to a secure password
      isAdmin: true,
      goldenTick: true, // Give golden tick for super admin privileges
      blueTick: true,
      subscriptionStatus: 'active',
      botEnabled: true,
      bio: 'Platform Administrator'
    };
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { username: adminData.username }
      ]
    });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Username: ${existingAdmin.username}`);
      console.log(`Is Admin: ${existingAdmin.isAdmin}`);
      
      // Update existing user to be admin
      existingAdmin.isAdmin = true;
      existingAdmin.goldenTick = true;
      existingAdmin.blueTick = true;
      await existingAdmin.save();
      
      console.log('✅ Updated existing user to admin privileges');
      process.exit(0);
    }
    
    // Create new admin user
    const adminUser = new User(adminData);
    await adminUser.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminData.email);
    console.log('👤 Username:', adminData.username);
    console.log('🔑 Password:', adminData.password);
    console.log('');
    console.log('🚀 You can now login to:');
    console.log('   • Admin Panel: http://localhost:5000/admin');
    console.log('   • Admin API: http://localhost:5000/api/admin/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
createAdminUser();
