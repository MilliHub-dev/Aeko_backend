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
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { 
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID 
} = pkg;
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

// Solana Configuration
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 
  (SOLANA_NETWORK === 'mainnet-beta' 
    ? 'https://api.mainnet-beta.solana.com' 
    : 'https://api.devnet.solana.com');

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Platform wallet (Treasury)
const PLATFORM_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
const platformWallet = PLATFORM_PRIVATE_KEY ? 
  Keypair.fromSecretKey(bs58.decode(PLATFORM_PRIVATE_KEY)) : 
  null;

// Aeko Token Configuration
let AEKO_TOKEN_MINT = null;
const AEKO_TOKEN_DECIMALS = 9; // 9 decimals like SOL
const AEKO_INITIAL_SUPPLY = 1000000000; // 1 Billion Aeko tokens

// Initialize Aeko Token
export const initializeAekoToken = async () => {
  try {
    if (!platformWallet) {
      throw new Error('Platform wallet not configured');
    }

    console.log('Creating Aeko Token...');
    
    // Create the token mint
    const mint = await createMint(
      connection,
      platformWallet,
      platformWallet.publicKey, // Mint authority
      platformWallet.publicKey, // Freeze authority
      AEKO_TOKEN_DECIMALS
    );

    AEKO_TOKEN_MINT = mint;
    console.log('Aeko Token created:', mint.toString());

    // Create platform token account
    const platformTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,
      mint,
      platformWallet.publicKey
    );

    // Mint initial supply to platform wallet
    await mintTo(
      connection,
      platformWallet,
      mint,
      platformTokenAccount.address,
      platformWallet,
      AEKO_INITIAL_SUPPLY * Math.pow(10, AEKO_TOKEN_DECIMALS)
    );

    console.log('Initial Aeko tokens minted to platform wallet');
    return {
      mintAddress: mint.toString(),
      platformTokenAccount: platformTokenAccount.address.toString(),
      initialSupply: AEKO_INITIAL_SUPPLY
    };

  } catch (error) {
    console.error('Error initializing Aeko token:', error);
    throw error;
  }
};

// Transfer Aeko tokens
export const transferAekoTokens = async (fromWalletPrivateKey, toWalletAddress, amount, type = 'transfer') => {
  try {
    if (!AEKO_TOKEN_MINT) {
      throw new Error('Aeko token not initialized');
    }

    const fromWallet = Keypair.fromSecretKey(bs58.decode(fromWalletPrivateKey));
    const toWallet = new PublicKey(toWalletAddress);

    // Get or create token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      AEKO_TOKEN_MINT,
      fromWallet.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      AEKO_TOKEN_MINT,
      toWallet
    );

    // Transfer tokens
    const signature = await transfer(
      connection,
      fromWallet,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet,
      amount * Math.pow(10, AEKO_TOKEN_DECIMALS)
    );

    console.log('Aeko tokens transferred:', signature);
    return {
      signature,
      fromWallet: fromWallet.publicKey.toString(),
      toWallet: toWalletAddress,
      amount,
      type,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error transferring Aeko tokens:', error);
    throw error;
  }
};

// Get Aeko token balance
export const getAekoBalance = async (walletAddress) => {
  try {
    if (!AEKO_TOKEN_MINT) {
      throw new Error('Aeko token not initialized');
    }

    const wallet = new PublicKey(walletAddress);
    
    try {
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        platformWallet,
        AEKO_TOKEN_MINT,
        wallet
      );

      const balance = await getAccount(connection, tokenAccount.address);
      return Number(balance.amount) / Math.pow(10, AEKO_TOKEN_DECIMALS);
    } catch (error) {
      // Account doesn't exist, return 0
      return 0;
    }

  } catch (error) {
    console.error('Error getting Aeko balance:', error);
    return 0;
  }
};

// Airdrop Aeko tokens (for giveaways)
export const airdropAekoTokens = async (recipients, amountPerRecipient) => {
  try {
    if (!platformWallet || !AEKO_TOKEN_MINT) {
      throw new Error('Platform wallet or Aeko token not configured');
    }

    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await transferAekoTokens(
          bs58.encode(platformWallet.secretKey),
          recipient,
          amountPerRecipient,
          'giveaway'
        );
        results.push({ recipient, success: true, ...result });
      } catch (error) {
        results.push({ recipient, success: false, error: error.message });
      }
    }

    return results;

  } catch (error) {
    console.error('Error airdropping Aeko tokens:', error);
    throw error;
  }
};

// Create NFT metadata
const createNFTMetadata = (postData, creator) => {
  return {
    name: `Aeko Post #${postData._id}`,
    symbol: 'AEKO_NFT',
    description: postData.text || 'Viral Aeko Post NFT',
    image: postData.media || 'https://aeko.io/default-nft.png',
    external_url: `https://aeko.io/post/${postData._id}`,
    attributes: [
      {
        trait_type: 'Original Views',
        value: postData.views
      },
      {
        trait_type: 'Likes',
        value: postData.likes?.length || 0
      },
      {
        trait_type: 'Shares',
        value: postData.reposts?.length || 0
      },
      {
        trait_type: 'Post Type',
        value: postData.type
      },
      {
        trait_type: 'Creator',
        value: creator.username
      },
      {
        trait_type: 'Mint Date',
        value: new Date().toISOString()
      },
      {
        trait_type: 'Engagement Rate',
        value: postData.engagement?.engagementRate || 0
      }
    ],
    properties: {
      creators: [
        {
          address: creator.solanaWalletAddress,
          share: 100
        }
      ],
      files: [
        {
          uri: postData.media || 'https://aeko.io/default-nft.png',
          type: postData.type === 'image' ? 'image/png' : 
                  postData.type === 'video' ? 'video/mp4' : 'text/plain'
        }
      ],
      category: 'image'
    }
  };
};

// Mint NFT from post
export const mintPostAsNFT = async (postData, creatorWallet, metadataUri) => {
  try {
    if (!platformWallet) {
      throw new Error('Platform wallet not configured');
    }

    const creator = Keypair.fromSecretKey(bs58.decode(creatorWallet));
    
    // Create NFT mint
    const nftMint = await createMint(
      connection,
      creator,
      creator.publicKey,
      creator.publicKey,
      0 // NFTs have 0 decimals
    );

    // Create token account for creator
    const creatorTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      creator,
      nftMint,
      creator.publicKey
    );

    // Mint 1 NFT to creator
    await mintTo(
      connection,
      creator,
      nftMint,
      creatorTokenAccount.address,
      creator,
      1
    );

    // Create metadata account
    const metadataAddress = await getMetadataAddress(nftMint);
    
    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAddress,
        mint: nftMint,
        mintAuthority: creator.publicKey,
        payer: creator.publicKey,
        updateAuthority: creator.publicKey
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: `Aeko Post #${postData._id}`,
            symbol: 'AEKO_NFT',
            uri: metadataUri,
            sellerFeeBasisPoints: 1000, // 10% royalty
            creators: [
              {
                address: creator.publicKey,
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
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [creator]
    );

    console.log('NFT minted successfully:', signature);
    
    return {
      tokenId: nftMint.toString(),
      signature,
      metadataAddress: metadataAddress.toString(),
      creatorTokenAccount: creatorTokenAccount.address.toString()
    };

  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
};

// Get metadata address for NFT
const getMetadataAddress = async (mint) => {
  const [metadataAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer()
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadataAddress;
};

// Transfer NFT
export const transferNFT = async (nftMint, fromWallet, toWalletAddress) => {
  try {
    const from = Keypair.fromSecretKey(bs58.decode(fromWallet));
    const to = new PublicKey(toWalletAddress);
    const mint = new PublicKey(nftMint);

    // Get token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      from,
      mint,
      from.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      from,
      mint,
      to
    );

    // Transfer NFT
    const signature = await transfer(
      connection,
      from,
      fromTokenAccount.address,
      toTokenAccount.address,
      from,
      1 // NFTs are transferred as 1 unit
    );

    return {
      signature,
      fromWallet: from.publicKey.toString(),
      toWallet: toWalletAddress,
      nftMint
    };

  } catch (error) {
    console.error('Error transferring NFT:', error);
    throw error;
  }
};

// Purchase NFT with Aeko tokens
export const purchaseNFTWithAeko = async (nftMint, buyerWallet, sellerWallet, priceInAeko) => {
  try {
    // Transfer Aeko tokens for payment
    const paymentResult = await transferAekoTokens(
      buyerWallet,
      sellerWallet,
      priceInAeko,
      'nft_purchase'
    );

    // Transfer NFT from seller to buyer
    const nftTransferResult = await transferNFT(
      nftMint,
      sellerWallet,
      new PublicKey(bs58.decode(buyerWallet)).toString()
    );

    return {
      paymentSignature: paymentResult.signature,
      nftTransferSignature: nftTransferResult.signature,
      price: priceInAeko,
      nftMint
    };

  } catch (error) {
    console.error('Error purchasing NFT:', error);
    throw error;
  }
};

// Get SOL balance
export const getSolBalance = async (walletAddress) => {
  try {
    const wallet = new PublicKey(walletAddress);
    const balance = await connection.getBalance(wallet);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    return 0;
  }
};

// Stream donation with Aeko tokens
export const donateAekoToStream = async (donorWallet, streamerWallet, amount, streamId) => {
  try {
    const result = await transferAekoTokens(
      donorWallet,
      streamerWallet,
      amount,
      'stream_donation'
    );

    return {
      ...result,
      streamId,
      donationType: 'aeko_tokens'
    };

  } catch (error) {
    console.error('Error donating Aeko to stream:', error);
    throw error;
  }
};

// Utility function to create new wallet
export const createWallet = () => {
  const wallet = Keypair.generate();
  return {
    publicKey: wallet.publicKey.toString(),
    privateKey: bs58.encode(wallet.secretKey)
  };
};

// Validate Solana wallet address
export const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Get transaction details
export const getTransactionDetails = async (signature) => {
  try {
    const transaction = await connection.getTransaction(signature);
    return transaction;
  } catch (error) {
    console.error('Error getting transaction details:', error);
    return null;
  }
};

export default {
  initializeAekoToken,
  transferAekoTokens,
  getAekoBalance,
  airdropAekoTokens,
  mintPostAsNFT,
  transferNFT,
  purchaseNFTWithAeko,
  getSolBalance,
  donateAekoToStream,
  createWallet,
  isValidSolanaAddress,
  getTransactionDetails,
  AEKO_TOKEN_MINT,
  connection
};