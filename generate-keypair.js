import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

console.log('🔑 Generating Solana Keypair for Aeko Backend...\n');

// Generate a new keypair
const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toString();
const privateKey = bs58.encode(keypair.secretKey);

console.log('✅ Keypair Generated Successfully!');
console.log('📍 Public Key:', publicKey);
console.log('🔐 Private Key:', privateKey);
console.log('\n⚠️  IMPORTANT: Save this private key securely! It cannot be recovered.\n');

// Update .env file with the generated keypair
let envContent = '';
if (fs.existsSync('.env')) {
  envContent = fs.readFileSync('.env', 'utf-8');
  // Replace the private key line
  envContent = envContent.replace(
    /SOLANA_PRIVATE_KEY=.*/,
    `SOLANA_PRIVATE_KEY=${privateKey}`
  );
} else {
  // Create new .env content
  envContent = `# Aeko Backend Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/aeko_db

# JWT Configuration
JWT_SECRET=aeko_super_secure_jwt_secret_key_2024_blockchain_integration

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=${privateKey}

# Generated Keypair Info (for reference)
# Public Key: ${publicKey}
# Network: Devnet

# Optional: Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Optional: Flutterwave Payment
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
`;
}

fs.writeFileSync('.env', envContent);
console.log('📝 Updated .env file with new keypair');
console.log('💰 You can get devnet SOL at: https://faucet.solana.com');
console.log('🚀 Now run: npm start');