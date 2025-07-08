#!/usr/bin/env node

/**
 * 🚀 Aeko Blockchain Setup Script
 * 
 * This script helps you quickly set up the Aeko blockchain integration
 * by creating necessary configuration files and initializing the token.
 */

import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

console.log('🚀 Welcome to Aeko Blockchain Setup!\n');

async function setupEnvironment() {
  console.log('📝 Setting up environment configuration...\n');

  // Check if .env already exists
  if (fs.existsSync('.env')) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Skipping .env creation');
      return;
    }
  }

  // Gather configuration
  const mongoUri = await question('🗄️  MongoDB URI (press Enter for default): ') || 'mongodb://localhost:27017/aeko_db';
  const jwtSecret = await question('🔐 JWT Secret (press Enter to generate): ') || generateSecret();
  const network = await question('🌐 Solana Network (devnet/mainnet-beta) [devnet]: ') || 'devnet';
  
  // Generate or ask for Solana keypair
  const generateKeypair = await question('🔑 Generate new Solana keypair? (Y/n): ');
  let privateKey;
  
  if (generateKeypair.toLowerCase() !== 'n') {
    const keypair = Keypair.generate();
    privateKey = bs58.encode(keypair.secretKey);
    console.log(`🎉 Generated new keypair!`);
    console.log(`📍 Public Key: ${keypair.publicKey.toString()}`);
    console.log(`🔐 Private Key: ${privateKey}`);
    console.log('⚠️  IMPORTANT: Save this private key securely! It cannot be recovered.\n');
  } else {
    privateKey = await question('🔑 Enter your existing private key (base58): ');
  }

  const rpcUrl = network === 'mainnet-beta' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';

  // Create .env file
  const envContent = `# Aeko Backend Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
MONGODB_URI=${mongoUri}

# JWT Configuration
JWT_SECRET=${jwtSecret}

# Solana Configuration
SOLANA_NETWORK=${network}
SOLANA_RPC_URL=${rpcUrl}
SOLANA_PRIVATE_KEY=${privateKey}

# Optional: Email Configuration (for notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Optional: Flutterwave Payment
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key

# Optional: Additional RPC endpoints for redundancy
SOLANA_RPC_URL_BACKUP=https://solana-api.projectserum.com
`;

  fs.writeFileSync('.env', envContent);
  console.log('✅ Environment file created successfully!\n');
}

function generateSecret() {
  return require('crypto').randomBytes(64).toString('hex');
}

async function createInitScript() {
  console.log('📜 Creating initialization script...\n');

  const initScript = `import { initializeAekoToken } from './utils/solanaBlockchain.js';
import dotenv from 'dotenv';

dotenv.config();

async function initialize() {
  try {
    console.log('🪙 Initializing Aeko Token...');
    
    const result = await initializeAekoToken();
    
    console.log('✅ Aeko Token initialized successfully!');
    console.log(\`🎯 Mint Address: \${result.mintAddress}\`);
    console.log(\`💰 Initial Supply: \${result.initialSupply} AEKO\`);
    console.log(\`🏦 Platform Account: \${result.platformTokenAccount}\`);
    
    // Save mint address for future use
    const envData = \`
# Aeko Token Configuration (Auto-generated)
AEKO_TOKEN_MINT=\${result.mintAddress}
AEKO_PLATFORM_ACCOUNT=\${result.platformTokenAccount}
\`;
    
    require('fs').appendFileSync('.env', envData);
    console.log('📝 Token configuration saved to .env file');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

initialize();
`;

  fs.writeFileSync('init-aeko-token.js', initScript);
  console.log('✅ Initialization script created: init-aeko-token.js\n');
}

async function installDependencies() {
  const install = await question('📦 Install missing dependencies? (Y/n): ');
  
  if (install.toLowerCase() !== 'n') {
    console.log('📦 Installing dependencies...\n');
    
    const { spawn } = require('child_process');
    const npm = spawn('npm', ['install'], { stdio: 'inherit' });
    
    npm.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Dependencies installed successfully!\n');
      } else {
        console.log('❌ Dependency installation failed\n');
      }
    });
  }
}

async function showNextSteps() {
  console.log('🎉 Setup completed! Here are your next steps:\n');
  
  console.log('1️⃣  Fund your Solana wallet (for devnet):');
  console.log('   Visit: https://faucet.solana.com\n');
  
  console.log('2️⃣  Initialize the Aeko token:');
  console.log('   node init-aeko-token.js\n');
  
  console.log('3️⃣  Start the server:');
  console.log('   npm start\n');
  
  console.log('4️⃣  Access the API documentation:');
  console.log('   http://localhost:5000/api-docs\n');
  
  console.log('📚 For detailed integration guide, see: AEKO_INTEGRATION_GUIDE.md\n');
  
  console.log('🆘 Need help? Check the troubleshooting section in the guide.\n');
}

async function checkExistingSetup() {
  console.log('🔍 Checking existing setup...\n');
  
  const checks = [
    { file: '.env', name: 'Environment configuration' },
    { file: 'package.json', name: 'Package configuration' },
    { file: 'utils/solanaBlockchain.js', name: 'Blockchain utilities' },
    { file: 'routes/aekoRoutes.js', name: 'Aeko API routes' },
    { file: 'routes/nftRoutes.js', name: 'NFT API routes' }
  ];
  
  checks.forEach(check => {
    const exists = fs.existsSync(check.file);
    console.log(`${exists ? '✅' : '❌'} ${check.name}`);
  });
  
  console.log('\n');
}

async function main() {
  try {
    await checkExistingSetup();
    
    const proceed = await question('🚀 Continue with setup? (Y/n): ');
    if (proceed.toLowerCase() === 'n') {
      console.log('👋 Setup cancelled');
      process.exit(0);
    }
    
    await setupEnvironment();
    await createInitScript();
    await installDependencies();
    await showNextSteps();
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Run the setup
main();