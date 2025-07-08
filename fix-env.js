import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

console.log('🔧 Fixing .env configuration for Aeko backend...\n');

// Your private key in array format
const privateKeyArray = [28,21,110,233,141,199,1,20,157,44,62,133,98,96,175,212,249,177,8,96,22,15,32,159,132,58,178,14,25,214,246,194,7,241,167,203,236,10,229,250,179,64,148,145,152,245,248,96,210,62,131,30,95,50,255,249,17,209,130,226,113,159,151,100];

try {
  // Convert array to Uint8Array and then to base58
  const secretKey = new Uint8Array(privateKeyArray);
  const privateKeyBase58 = bs58.encode(secretKey);
  
  // Create keypair to get public key
  const keypair = Keypair.fromSecretKey(secretKey);
  const publicKey = keypair.publicKey.toString();
  
  console.log('✅ Successfully converted private key!');
  console.log('📍 Public Key:', publicKey);
  console.log('🔐 Private Key (Base58):', privateKeyBase58);
  
  // Read existing .env and update it
  const envContent = `# Aeko Backend Configuration
# Updated on ${new Date().toISOString()}

# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://localhost:27017/aeko_db

# JWT Configuration
JWT_SECRET=1f23f990dcb92b6c8de091fbdd5e2600c49983744482f441267f629fd3328e3cb5cea7dabca05d77a6247b7bebfabb0e4e5d0c7da127d107df45b147cefaae28

# Solana Configuration (MAIN BLOCKCHAIN)
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=${privateKeyBase58}

# Your wallet info (for reference)
# Public Key: ${publicKey}
# Network: Devnet

# Email Configuration
EMAIL_USER=info.millihub@gmail.com
EMAIL_PASS=08120889843Ek

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Flutterwave Payment
FLW_PUBLIC_KEY=FLW_PUBLIC_KEY
FLW_SECRET_KEY=FLW_SECRET_KEY

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Legacy Ethereum/Polygon Configuration (kept for reference)
# CONTRACT_ADDRESS=0x7216778551085922af4Ae96d5c92B2B2bc9AFf7b
# PRIVATE_KEY=39949a0707c3cb13e98156f9d1fab2758bf7c1a5672ed124791fc79b63b9e190
# POLYGON_ZKEVM_RPC=sepolia.infura.io:11155111

# IPFS/Pinata Configuration  
PINATA_API_KEY=f5ecb8197361f204dc77
PINATA_SECRET=855fdb1249d94075b8d8e60ca1f48cd38ffbdc396f71a60354e448e17ccacb04
`;

  fs.writeFileSync('.env', envContent);
  console.log('\n📝 Updated .env file successfully!');
  console.log('🎯 Removed conflicting blockchain configurations');
  console.log('✅ Set Solana as primary blockchain');
  console.log('🔧 Fixed private key format');
  
} catch (error) {
  console.error('❌ Error converting private key:', error.message);
}