import { Connection, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Liquidity, LiquidityPoolKeys, TOKEN_PROGRAM_ID as RAYDIUM_TOKEN_PROGRAM_ID, Percent } from '@raydium-io/raydium-sdk';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INITIAL_SOL_LIQUIDITY = parseFloat(process.env.INITIAL_SOL_LIQUIDITY || '1.0');
const INITIAL_TOKEN_LIQUIDITY = parseFloat(process.env.INITIAL_TOKEN_LIQUIDITY || '100000');

// Raydium Program IDs (devnet)
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey('27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv');
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

if (!PRIVATE_KEY) {
  console.error('❌ Please set PRIVATE_KEY in .env file');
  process.exit(1);
}

console.log('🚀 Creating Raydium Liquidity Pool for AEKO...\n');

async function createRaydiumPool() {
  try {
    // Load wallet
    const secretKey = JSON.parse(PRIVATE_KEY);
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    // Connect to Solana
    const connection = new Connection(RPC_URL);
    
    // Load token info
    if (!fs.existsSync('./token-info.json')) {
      console.error('❌ Token info not found. Deploy your token first.');
      process.exit(1);
    }
    
    const tokenInfo = JSON.parse(fs.readFileSync('./token-info.json', 'utf8'));
    const tokenMint = new PublicKey(tokenInfo.mintAddress);
    
    console.log('📍 Wallet:', wallet.publicKey.toString());
    console.log('📍 Token Mint:', tokenMint.toString());
    console.log('📍 Initial SOL Liquidity:', INITIAL_SOL_LIQUIDITY, 'SOL');
    console.log('📍 Initial Token Liquidity:', INITIAL_TOKEN_LIQUIDITY, 'AEKO');
    
    // Check balances
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log('💰 SOL Balance:', solBalance / LAMPORTS_PER_SOL);
    
    const tokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
    const tokenAccountInfo = await getAccount(connection, tokenAccount);
    console.log('💰 AEKO Balance:', Number(tokenAccountInfo.amount));
    
    // Validate sufficient balance
    if (solBalance / LAMPORTS_PER_SOL < INITIAL_SOL_LIQUIDITY + 0.1) {
      console.error('❌ Insufficient SOL balance for liquidity + fees');
      process.exit(1);
    }
    
    if (Number(tokenAccountInfo.amount) < INITIAL_TOKEN_LIQUIDITY) {
      console.error('❌ Insufficient AEKO token balance for liquidity');
      process.exit(1);
    }
    
    console.log('\n🔧 Creating pool configuration...');
    
    // SOL mint address (wrapped SOL)
    const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    
    // Calculate amounts in base units
    const solAmount = Math.floor(INITIAL_SOL_LIQUIDITY * LAMPORTS_PER_SOL);
    const tokenAmount = Math.floor(INITIAL_TOKEN_LIQUIDITY * Math.pow(10, tokenInfo.decimals));
    
    console.log('📊 Pool Parameters:');
    console.log('   - Base Token: SOL');
    console.log('   - Quote Token: AEKO');
    console.log('   - SOL Amount:', solAmount, 'lamports');
    console.log('   - AEKO Amount:', tokenAmount, 'smallest units');
    console.log('   - Initial Price: 1 AEKO =', (INITIAL_SOL_LIQUIDITY / INITIAL_TOKEN_LIQUIDITY).toFixed(8), 'SOL');
    
    // Create pool market (simplified version)
    console.log('\n💱 Setting up market and pool...');
    
    // For a full implementation, you would need to:
    // 1. Create a Serum market first (if not exists)
    // 2. Initialize the liquidity pool
    // 3. Add initial liquidity
    
    // This is a simplified example showing the structure
    const poolConfig = {
      baseMint: SOL_MINT,
      quoteMint: tokenMint,
      baseAmount: solAmount,
      quoteAmount: tokenAmount,
      marketId: null, // Would be created/found
      programId: RAYDIUM_AMM_PROGRAM_ID
    };
    
    console.log('⚠️  IMPORTANT: This is a demonstration of pool creation structure.');
    console.log('⚠️  For actual pool creation on mainnet, use the Raydium UI or full SDK.');
    console.log('⚠️  Pool creation requires significant technical setup and market creation.');
    
    // Save pool configuration for reference
    const poolInfo = {
      config: poolConfig,
      createdAt: new Date().toISOString(),
      network: RPC_URL.includes('devnet') ? 'devnet' : 'mainnet-beta',
      status: 'configuration_ready',
      instructions: [
        '1. Create a Serum market for AEKO/SOL pair',
        '2. Initialize Raydium liquidity pool with market ID',
        '3. Add initial liquidity to the pool',
        '4. Verify pool creation and get LP tokens'
      ]
    };
    
    fs.writeFileSync('./raydium-pool-config.json', JSON.stringify(poolInfo, null, 2));
    
    console.log('\n📝 Pool configuration saved to: raydium-pool-config.json');
    
    console.log('\n🔄 Alternative Approaches:');
    console.log('1. 🌐 Use Raydium UI: https://raydium.io/liquidity/create/');
    console.log('2. 🤖 Use our simplified pool creator: node simple-pool-creator.js');
    console.log('3. 🐋 Use Orca DEX: node create-orca-pool.js');
    
    console.log('\n💡 Next Steps:');
    console.log('- For testing: Create pool on devnet using Raydium SDK');
    console.log('- For production: Use the Raydium website interface');
    console.log('- Monitor pool: node monitor-pools.js');
    
    return poolInfo;

  } catch (error) {
    console.error('❌ Pool creation setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Ensure you have sufficient SOL for gas fees');
    console.log('- Verify your token balance is sufficient');
    console.log('- Try using the web interface first');
    process.exit(1);
  }
}

// Alternative simple pool creator using Jupiter
async function createSimplePool() {
  console.log('\n🌊 Creating simple liquidity pool...');
  console.log('💡 This uses a simplified approach suitable for testing');
  
  try {
    // This would integrate with Jupiter or another aggregator
    // to create a basic trading pair
    
    console.log('✅ Simple pool creation structure ready');
    console.log('📍 Use this for basic liquidity provision');
    
  } catch (error) {
    console.error('❌ Simple pool creation failed:', error.message);
  }
}

// Run the pool creation
createRaydiumPool()
  .then((result) => {
    console.log('\n🎉 Pool configuration completed!');
    if (process.argv.includes('--simple')) {
      createSimplePool();
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });