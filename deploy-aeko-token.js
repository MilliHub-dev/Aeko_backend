#!/usr/bin/env node

import { deployAekoToken, checkDeploymentStatus, getAekoTokenInfo } from './utils/improvedSolanaBlockchain.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Aeko Token Deployment Script\n');

async function main() {
  try {
    // Check current status
    console.log('🔍 Checking deployment status...');
    const status = await checkDeploymentStatus();
    
    if (status.deployed) {
      console.log('✅ Aeko token already deployed!');
      console.log('📍 Mint Address:', status.mintAddress);
      console.log('💰 Supply:', status.supply.toLocaleString(), 'AEKO');
      console.log('🌐 Explorer:', status.explorerUrl);
      
      // Get detailed info
      const info = await getAekoTokenInfo();
      console.log('\n📊 Token Details:');
      console.log('Name:', info.name);
      console.log('Symbol:', info.symbol);
      console.log('Decimals:', info.decimals);
      console.log('Deployed:', info.deployedAt);
      
    } else {
      console.log('❌ Token not deployed. Starting deployment...\n');
      
      // Deploy new token
      const result = await deployAekoToken();
      
      console.log('\n🎉 Deployment completed successfully!');
      console.log('📍 Mint Address:', result.mintAddress);
      console.log('🏦 Platform Account:', result.platformTokenAccount);
      console.log('💰 Initial Supply:', result.initialSupply.toLocaleString(), 'AEKO');
      console.log('🌐 Explorer:', `https://explorer.solana.com/address/${result.mintAddress}?cluster=${result.network}`);
      
      console.log('\n📝 Configuration saved to token-config.json');
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    if (error.message.includes('SOLANA_PRIVATE_KEY')) {
      console.log('\n💡 Solution: Make sure your .env file has a valid SOLANA_PRIVATE_KEY');
      console.log('Run: node generate-keypair.js to generate a new keypair');
    }
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Solution: Fund your wallet with devnet SOL');
      console.log('Visit: https://faucet.solana.com');
    }
    
    process.exit(1);
  }
}

main();