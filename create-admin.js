import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const createAdminUser = async () => {
  try {
    console.log('🔐 Creating Admin User...');
    
    // Admin user details
    const adminData = {
      name: 'Admin User',
      username: 'admin',
      email: 'admin@aeko.social',
      password: 'admin123', // Will be hashed
      isAdmin: true,
      goldenTick: true,
      blueTick: true,
      subscriptionStatus: 'active',
      botEnabled: true,
      bio: 'Platform Administrator'
    };
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: adminData.email },
          { username: adminData.username }
        ]
      }
    });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Username: ${existingAdmin.username}`);
      console.log(`Is Admin: ${existingAdmin.isAdmin}`);
      
      // Update existing user to be admin
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
            isAdmin: true,
            goldenTick: true,
            blueTick: true
        }
      });
      
      console.log('✅ Updated existing user to admin privileges');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    
    // Create new admin user
    const adminUser = await prisma.user.create({
        data: {
            ...adminData,
            password: hashedPassword
        }
    });
    
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
    await prisma.$disconnect();
    process.exit(0);
  }
};

// Run the script
createAdminUser();
