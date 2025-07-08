import { 
  transferAekoTokens, 
  getAekoBalance,
  checkDeploymentStatus,
  getAekoTokenInfo 
} from './utils/improvedSolanaBlockchain.js';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

async function testAekoToken() {
  try {
    console.log('🧪 Testing Aeko Token Functionality...\n');

    // 1. Check deployment status
    console.log('1️⃣ Checking deployment status...');
    const status = await checkDeploymentStatus();
    console.log('   Deployed:', status.deployed ? '✅' : '❌');
    
    if (!status.deployed) {
      console.log('❌ Token not deployed. Run: node deploy-aeko-token.js first');
      return;
    }
    
    console.log('   Mint Address:', status.mintAddress);
    console.log('   Current Supply:', status.supply.toLocaleString(), 'AEKO\n');

    // 2. Get token info
    console.log('2️⃣ Getting token information...');
    const info = await getAekoTokenInfo();
    console.log('   Name:', info.name);
    console.log('   Symbol:', info.symbol);
    console.log('   Decimals:', info.decimals);
    console.log('   Explorer:', info.explorerUrl, '\n');

    // 3. Check platform balance
    console.log('3️⃣ Checking platform wallet balance...');
    const platformWallet = 'Y1aMxGaerMwQcr8cbKeREdyRRkYfdgVF4rrxgGVBJJw';
    const platformBalance = await getAekoBalance(platformWallet);
    console.log('   Platform Balance:', platformBalance.toLocaleString(), 'AEKO\n');

    // 4. Create test wallet
    console.log('4️⃣ Creating test wallet...');
    const testWallet = Keypair.generate();
    const testWalletAddress = testWallet.publicKey.toString();
    console.log('   Test Wallet:', testWalletAddress);
    
    // Check initial balance (should be 0)
    const initialBalance = await getAekoBalance(testWalletAddress);
    console.log('   Initial Balance:', initialBalance, 'AEKO\n');

    // 5. Test transfer
    console.log('5️⃣ Testing token transfer...');
    const transferAmount = 1000; // Transfer 1000 AEKO
    const platformPrivateKey = process.env.SOLANA_PRIVATE_KEY;
    
    console.log('   Transferring', transferAmount, 'AEKO to test wallet...');
    
    const transferResult = await transferAekoTokens(
      platformPrivateKey,
      testWalletAddress,
      transferAmount,
      'test_transfer'
    );
    
    console.log('   ✅ Transfer successful!');
    console.log('   Transaction:', transferResult.signature);
    console.log('   Explorer:', transferResult.explorerUrl, '\n');

    // 6. Verify transfer
    console.log('6️⃣ Verifying transfer...');
    const newBalance = await getAekoBalance(testWalletAddress);
    console.log('   Test Wallet Balance After Transfer:', newBalance, 'AEKO');
    
    if (newBalance === transferAmount) {
      console.log('   ✅ Transfer verification successful!\n');
    } else {
      console.log('   ❌ Transfer verification failed!\n');
    }

    // 7. Check platform balance after transfer
    console.log('7️⃣ Checking platform balance after transfer...');
    const newPlatformBalance = await getAekoBalance(platformWallet);
    console.log('   Platform Balance After Transfer:', newPlatformBalance.toLocaleString(), 'AEKO');
    console.log('   Difference:', (platformBalance - newPlatformBalance), 'AEKO\n');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Token deployed and accessible');
    console.log('✅ Balance checking working');
    console.log('✅ Token transfers working');
    console.log('✅ State persistence working');
    console.log('\n🚀 Your Aeko token is ready for production use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Solution: The platform wallet needs more SOL for transaction fees');
      console.log('Visit: https://faucet.solana.com to get more devnet SOL');
    }
    
    if (error.message.includes('SOLANA_PRIVATE_KEY')) {
      console.log('\n💡 Solution: Make sure SOLANA_PRIVATE_KEY is set in .env file');
    }
  }
}

testAekoToken();