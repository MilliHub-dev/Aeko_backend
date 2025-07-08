import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getAccount,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
} from '@solana/spl-token';
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { 
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID 
} = pkg;

// Fallback if PROGRAM_ID is not available
const MPL_TOKEN_METADATA_PROGRAM_ID = TOKEN_METADATA_PROGRAM_ID || new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configuration
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Aeko Token Configuration
const AEKO_TOKEN_CONFIG = {
  name: "Aeko Coin",
  symbol: "AEKO", 
  decimals: 9,
  initialSupply: 1_000_000_000, // 1 Billion
  description: "The native token of the Aeko social media platform",
  image: "https://aeko.io/token-logo.png",
  external_url: "https://aeko.io"
};

// Load or create platform wallet
let platformWallet = null;
let aekoTokenMint = null;
let tokenConfigFile = './token-config.json';

// Initialize platform wallet
function initializePlatformWallet() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
  }

  try {
    platformWallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    console.log('✅ Platform wallet loaded:', platformWallet.publicKey.toString());
    return platformWallet;
  } catch (error) {
    throw new Error('Invalid SOLANA_PRIVATE_KEY format: ' + error.message);
  }
}

// Load existing token configuration
function loadTokenConfig() {
  try {
    if (fs.existsSync(tokenConfigFile)) {
      const config = JSON.parse(fs.readFileSync(tokenConfigFile, 'utf-8'));
      if (config.mintAddress) {
        aekoTokenMint = new PublicKey(config.mintAddress);
        console.log('✅ Existing Aeko token loaded:', aekoTokenMint.toString());
        return config;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not load token config:', error.message);
  }
  return null;
}

// Save token configuration
function saveTokenConfig(config) {
  try {
    fs.writeFileSync(tokenConfigFile, JSON.stringify(config, null, 2));
    console.log('✅ Token configuration saved to', tokenConfigFile);
  } catch (error) {
    console.error('Error saving token config:', error.message);
  }
}

// Create token metadata
async function createTokenMetadata(mint, authority) {
  try {
    // Create metadata URI (you would upload this to IPFS/Arweave)
    const metadata = {
      name: AEKO_TOKEN_CONFIG.name,
      symbol: AEKO_TOKEN_CONFIG.symbol,
      description: AEKO_TOKEN_CONFIG.description,
      image: AEKO_TOKEN_CONFIG.image,
      external_url: AEKO_TOKEN_CONFIG.external_url,
      attributes: [
        {
          trait_type: "Total Supply",
          value: AEKO_TOKEN_CONFIG.initialSupply.toLocaleString()
        },
        {
          trait_type: "Decimals", 
          value: AEKO_TOKEN_CONFIG.decimals
        },
        {
          trait_type: "Network",
          value: SOLANA_NETWORK
        }
      ]
    };

    // For demo purposes, we'll use a placeholder URI
    // In production, upload metadata to IPFS/Arweave first
    const metadataUri = "https://arweave.net/aeko-token-metadata";

    // Find metadata account address
    const [metadataAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );

    // Create metadata instruction
    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAddress,
        mint: mint,
        mintAuthority: authority.publicKey,
        payer: authority.publicKey,
        updateAuthority: authority.publicKey
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: AEKO_TOKEN_CONFIG.name,
            symbol: AEKO_TOKEN_CONFIG.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: [
              {
                address: authority.publicKey,
                verified: true,
                share: 100
              }
            ],
            collection: null,
            uses: null
          },
          isMutable: true,
          collectionDetails: null
        }
      }
    );

    const transaction = new Transaction().add(metadataInstruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [authority]);

    console.log('✅ Token metadata created:', signature);
    return {
      metadataAddress: metadataAddress.toString(),
      signature,
      metadataUri
    };

  } catch (error) {
    console.error('Error creating token metadata:', error);
    throw error;
  }
}

// Deploy Aeko Token (one-time setup)
export async function deployAekoToken() {
  try {
    console.log('🚀 Deploying Aeko Token to Solana', SOLANA_NETWORK);

    // Initialize platform wallet
    if (!platformWallet) {
      initializePlatformWallet();
    }

    // Check if token already exists
    let existingConfig = loadTokenConfig();
    if (existingConfig && existingConfig.mintAddress) {
      console.log('✅ Aeko token already deployed:', existingConfig.mintAddress);
      aekoTokenMint = new PublicKey(existingConfig.mintAddress);
      return existingConfig;
    }

    // Create new token mint
    console.log('📝 Creating new Aeko token mint...');
    
    const mint = await createMint(
      connection,
      platformWallet,
      platformWallet.publicKey, // Mint authority
      platformWallet.publicKey, // Freeze authority (optional)
      AEKO_TOKEN_CONFIG.decimals
    );

    aekoTokenMint = mint;
    console.log('✅ Aeko token mint created:', mint.toString());

    // Create metadata (skip for now to avoid compatibility issues)
    console.log('📝 Skipping metadata creation for now...');
    const metadataResult = {
      metadataAddress: 'skipped',
      signature: 'skipped',
      metadataUri: 'https://aeko.io/token-metadata'
    };

    // Create platform token account
    console.log('📝 Creating platform token account...');
    const platformTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,
      mint,
      platformWallet.publicKey
    );

    // Mint initial supply
    console.log('📝 Minting initial supply...');
    const mintAmount = AEKO_TOKEN_CONFIG.initialSupply * Math.pow(10, AEKO_TOKEN_CONFIG.decimals);
    
    await mintTo(
      connection,
      platformWallet,
      mint,
      platformTokenAccount.address,
      platformWallet,
      mintAmount
    );

    console.log('✅ Initial supply minted:', AEKO_TOKEN_CONFIG.initialSupply.toLocaleString(), 'AEKO');

    // Save configuration
    const tokenConfig = {
      mintAddress: mint.toString(),
      platformWallet: platformWallet.publicKey.toString(),
      platformTokenAccount: platformTokenAccount.address.toString(),
      name: AEKO_TOKEN_CONFIG.name,
      symbol: AEKO_TOKEN_CONFIG.symbol,
      decimals: AEKO_TOKEN_CONFIG.decimals,
      initialSupply: AEKO_TOKEN_CONFIG.initialSupply,
      totalSupply: AEKO_TOKEN_CONFIG.initialSupply,
      network: SOLANA_NETWORK,
      deployedAt: new Date().toISOString(),
      metadataAddress: metadataResult.metadataAddress,
      metadataUri: metadataResult.metadataUri
    };

    saveTokenConfig(tokenConfig);

    console.log('🎉 Aeko Token deployed successfully!');
    console.log('📍 Mint Address:', mint.toString());
    console.log('🏦 Platform Account:', platformTokenAccount.address.toString());
    console.log('💰 Initial Supply:', AEKO_TOKEN_CONFIG.initialSupply.toLocaleString(), 'AEKO');

    return tokenConfig;

  } catch (error) {
    console.error('❌ Error deploying Aeko token:', error);
    throw error;
  }
}

// Get Aeko token mint (initialize if needed)
export async function getAekoTokenMint() {
  if (!aekoTokenMint) {
    const config = loadTokenConfig();
    if (config && config.mintAddress) {
      aekoTokenMint = new PublicKey(config.mintAddress);
    } else {
      throw new Error('Aeko token not deployed. Run deployAekoToken() first.');
    }
  }
  return aekoTokenMint;
}

// Transfer Aeko tokens (improved)
export async function transferAekoTokens(fromPrivateKey, toWalletAddress, amount, type = 'transfer') {
  try {
    if (!aekoTokenMint) {
      await getAekoTokenMint();
    }

    const fromWallet = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
    const toWallet = new PublicKey(toWalletAddress);

    // Get token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      aekoTokenMint,
      fromWallet.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet, // Payer
      aekoTokenMint,
      toWallet
    );

    // Transfer tokens
    const transferAmount = amount * Math.pow(10, AEKO_TOKEN_CONFIG.decimals);
    
    const signature = await transfer(
      connection,
      fromWallet,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet,
      transferAmount
    );

    console.log('✅ Aeko tokens transferred:', signature);

    return {
      signature,
      fromWallet: fromWallet.publicKey.toString(),
      toWallet: toWalletAddress,
      amount,
      type,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_NETWORK}`
    };

  } catch (error) {
    console.error('Error transferring Aeko tokens:', error);
    throw error;
  }
}

// Get Aeko balance (improved)
export async function getAekoBalance(walletAddress) {
  try {
    if (!aekoTokenMint) {
      await getAekoTokenMint();
    }

    const wallet = new PublicKey(walletAddress);
    
    try {
      const tokenAccountAddress = await getAssociatedTokenAddress(
        aekoTokenMint,
        wallet
      );

      const tokenAccount = await getAccount(connection, tokenAccountAddress);
      return Number(tokenAccount.amount) / Math.pow(10, AEKO_TOKEN_CONFIG.decimals);
    } catch (error) {
      // Account doesn't exist, return 0
      return 0;
    }

  } catch (error) {
    console.error('Error getting Aeko balance:', error);
    return 0;
  }
}

// Get token info
export async function getAekoTokenInfo() {
  try {
    const config = loadTokenConfig();
    if (!config) {
      throw new Error('Aeko token not deployed');
    }

    // Get current supply from on-chain data
    const mintInfo = await connection.getTokenSupply(new PublicKey(config.mintAddress));
    const currentSupply = Number(mintInfo.value.amount) / Math.pow(10, AEKO_TOKEN_CONFIG.decimals);

    return {
      ...config,
      currentSupply,
      formattedSupply: currentSupply.toLocaleString(),
      explorerUrl: `https://explorer.solana.com/address/${config.mintAddress}?cluster=${SOLANA_NETWORK}`
    };

  } catch (error) {
    console.error('Error getting token info:', error);
    throw error;
  }
}

// Check deployment status
export async function checkDeploymentStatus() {
  try {
    const config = loadTokenConfig();
    
    if (!config || !config.mintAddress) {
      return {
        deployed: false,
        message: 'Aeko token not deployed. Run deployAekoToken() to deploy.'
      };
    }

    // Verify mint exists on-chain
    try {
      const mintInfo = await connection.getTokenSupply(new PublicKey(config.mintAddress));
      return {
        deployed: true,
        mintAddress: config.mintAddress,
        supply: Number(mintInfo.value.amount) / Math.pow(10, config.decimals),
        decimals: config.decimals,
        network: SOLANA_NETWORK,
        explorerUrl: `https://explorer.solana.com/address/${config.mintAddress}?cluster=${SOLANA_NETWORK}`
      };
    } catch (error) {
      return {
        deployed: false,
        message: 'Token configuration found but mint not accessible on-chain',
        error: error.message
      };
    }

  } catch (error) {
    console.error('Error checking deployment status:', error);
    return {
      deployed: false, 
      message: 'Error checking deployment status',
      error: error.message
    };
  }
}

// Initialize on import
try {
  if (process.env.SOLANA_PRIVATE_KEY) {
    initializePlatformWallet();
    loadTokenConfig();
  }
} catch (error) {
  console.warn('Warning: Could not initialize blockchain utils:', error.message);
}

export default {
  deployAekoToken,
  getAekoTokenMint,
  transferAekoTokens,
  getAekoBalance,
  getAekoTokenInfo,
  checkDeploymentStatus,
  connection,
  platformWallet
};