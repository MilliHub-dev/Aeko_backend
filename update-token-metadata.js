import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Metaplex, keypairIdentity, bundlrStorage } from '@metaplex-foundation/js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Load configuration
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('❌ Please set PRIVATE_KEY in .env file');
  process.exit(1);
}

console.log('🔧 Updating Aeko Token Metadata...\n');

async function updateTokenMetadata() {
  try {
    // Load wallet
    const secretKey = JSON.parse(PRIVATE_KEY);
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    // Connect to Solana
    const connection = new Connection(RPC_URL);
    
    // Setup Metaplex
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(wallet))
      .use(bundlrStorage());

    // Load token info
    const tokenInfo = JSON.parse(fs.readFileSync('./token-info.json', 'utf8'));
    const mintAddress = new PublicKey(tokenInfo.mintAddress);
    
    // Load metadata IPFS info
    if (!fs.existsSync('./token-metadata-ipfs.json')) {
      console.error('❌ Metadata not uploaded yet. Run upload-metadata.js first');
      process.exit(1);
    }
    
    const ipfsInfo = JSON.parse(fs.readFileSync('./token-metadata-ipfs.json', 'utf8'));
    
    console.log('📍 Token Mint:', mintAddress.toString());
    console.log('📍 Metadata URI:', ipfsInfo.metadataUrl);
    
    // Find token metadata account
    const tokenMetadata = await metaplex.nfts().findByMint({
      mintAddress: mintAddress,
    });

    if (tokenMetadata) {
      console.log('\n🔄 Updating existing metadata...');
      
      // Update metadata
      const { nft } = await metaplex.nfts().update({
        nftOrSft: tokenMetadata,
        name: "Aeko Coin",
        symbol: "AEKO", 
        uri: ipfsInfo.metadataUrl,
        sellerFeeBasisPoints: 0,
        creators: [
          {
            address: wallet.publicKey,
            verified: true,
            share: 100,
          }
        ]
      });
      
      console.log('✅ Metadata updated successfully!');
      console.log('📍 Updated NFT:', nft.address.toString());
      
    } else {
      console.log('\n➕ Creating new metadata...');
      
      // Create metadata
      const { nft } = await metaplex.nfts().create({
        uri: ipfsInfo.metadataUrl,
        name: "Aeko Coin",
        symbol: "AEKO",
        sellerFeeBasisPoints: 0,
        useNewMint: mintAddress,
        creators: [
          {
            address: wallet.publicKey,
            verified: true,
            share: 100,
          }
        ]
      });
      
      console.log('✅ Metadata created successfully!');
      console.log('📍 New NFT:', nft.address.toString());
    }

    // Save updated info
    const updatedInfo = {
      ...tokenInfo,
      metadata: {
        logoUrl: ipfsInfo.logoUrl,
        metadataUrl: ipfsInfo.metadataUrl,
        updatedAt: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./token-info.json', JSON.stringify(updatedInfo, null, 2));
    
    console.log('\n🎉 Token metadata update completed!');
    console.log('📝 Token info updated in: token-info.json');
    
    console.log('\n🔗 View your token on Solana Explorer:');
    const network = RPC_URL.includes('devnet') ? 'devnet' : 'mainnet-beta';
    console.log(`https://explorer.solana.com/address/${mintAddress.toString()}?cluster=${network}`);
    
    console.log('\n🚀 Next Step: Add liquidity to your token');
    console.log('Read: ADD_LIQUIDITY_GUIDE.md');

  } catch (error) {
    console.error('❌ Metadata update failed:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    process.exit(1);
  }
}

updateTokenMetadata();