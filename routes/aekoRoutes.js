import express from "express";
import User from "../models/User.js";
import AekoTransaction from "../models/AekoTransaction.js";
import LiveStream from "../models/LiveStream.js";
import auth from "../middleware/auth.js";
import { 
  transferAekoTokens,
  getAekoBalance,
  airdropAekoTokens,
  donateAekoToStream,
  createWallet,
  isValidSolanaAddress,
  getSolBalance,
  getTransactionDetails
} from "../utils/solanaBlockchain.js";
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /api/aeko/balance:
 *   get:
 *     summary: Get user's Aeko coin balance
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *       404:
 *         description: User wallet not found
 */
router.get("/balance", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.solanaWalletAddress) {
      return res.status(404).json({
        success: false,
        message: "Solana wallet not connected"
      });
    }

    // Get balance from blockchain
    const blockchainBalance = await getAekoBalance(user.solanaWalletAddress);
    
    // Update user's stored balance
    user.aekoBalance = blockchainBalance;
    await user.save();

    // Get SOL balance too
    const solBalance = await getSolBalance(user.solanaWalletAddress);

    res.json({
      success: true,
      data: {
        aekoBalance: blockchainBalance,
        solBalance,
        walletAddress: user.solanaWalletAddress
      }
    });

  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting balance"
    });
  }
});

/**
 * @swagger
 * /api/aeko/connect-wallet:
 *   post:
 *     summary: Connect Solana wallet to user account
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Solana wallet public address
 *     responses:
 *       200:
 *         description: Wallet connected successfully
 *       400:
 *         description: Invalid wallet address
 */
router.post("/connect-wallet", auth, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Solana wallet address"
      });
    }

    // Check if wallet is already connected to another user
    const existingUser = await User.findOne({ 
      solanaWalletAddress: walletAddress,
      _id: { $ne: req.user.id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Wallet already connected to another account"
      });
    }

    // Update user's wallet
    const user = await User.findById(req.user.id);
    user.solanaWalletAddress = walletAddress;
    
    // Get initial balance
    const balance = await getAekoBalance(walletAddress);
    user.aekoBalance = balance;
    
    await user.save();

    res.json({
      success: true,
      message: "Wallet connected successfully",
      data: {
        walletAddress,
        aekoBalance: balance
      }
    });

  } catch (error) {
    console.error("Connect wallet error:", error);
    res.status(500).json({
      success: false,
      message: "Error connecting wallet"
    });
  }
});

/**
 * @swagger
 * /api/aeko/transfer:
 *   post:
 *     summary: Transfer Aeko coins to another user
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toUserId
 *               - amount
 *               - privateKey
 *             properties:
 *               toUserId:
 *                 type: string
 *                 description: Recipient user ID
 *               amount:
 *                 type: number
 *                 description: Amount of Aeko coins to transfer
 *               privateKey:
 *                 type: string
 *                 description: Sender's wallet private key
 *               description:
 *                 type: string
 *                 description: Optional transfer description
 *     responses:
 *       200:
 *         description: Transfer completed successfully
 *       400:
 *         description: Invalid request or insufficient balance
 *       404:
 *         description: Recipient not found
 */
router.post("/transfer", auth, async (req, res) => {
  try {
    const { toUserId, amount, privateKey, description = "" } = req.body;
    const fromUserId = req.user.id;

    // Validation
    if (!toUserId || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        message: "Recipient, amount, and private key are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    // Get sender and recipient
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!toUser) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found"
      });
    }

    if (!fromUser.solanaWalletAddress || !toUser.solanaWalletAddress) {
      return res.status(400).json({
        success: false,
        message: "Both users must have connected Solana wallets"
      });
    }

    // Check balance
    const balance = await getAekoBalance(fromUser.solanaWalletAddress);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Aeko balance"
      });
    }

    // Perform blockchain transfer
    const transferResult = await transferAekoTokens(
      privateKey,
      toUser.solanaWalletAddress,
      amount,
      'transfer'
    );

    // Create transaction record
    const transaction = new AekoTransaction({
      transactionId: uuidv4(),
      solanaSignature: transferResult.signature,
      fromUser: fromUserId,
      toUser: toUserId,
      fromWallet: fromUser.solanaWalletAddress,
      toWallet: toUser.solanaWalletAddress,
      amount,
      type: 'transfer',
      status: 'confirmed',
      description,
      confirmedAt: new Date()
    });

    await transaction.save();

    // Update user balances
    fromUser.aekoBalance = await getAekoBalance(fromUser.solanaWalletAddress);
    toUser.aekoBalance = await getAekoBalance(toUser.solanaWalletAddress);
    
    await fromUser.save();
    await toUser.save();

    res.json({
      success: true,
      message: "Transfer completed successfully",
      data: {
        transaction: {
          id: transaction.transactionId,
          signature: transferResult.signature,
          amount,
          fromUser: fromUser.username,
          toUser: toUser.username,
          timestamp: transferResult.timestamp
        },
        newBalance: fromUser.aekoBalance
      }
    });

  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing transfer"
    });
  }
});

/**
 * @swagger
 * /api/aeko/giveaway:
 *   post:
 *     summary: Conduct Aeko coin giveaway to multiple users
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *               - amountPerRecipient
 *               - privateKey
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to receive giveaway
 *               amountPerRecipient:
 *                 type: number
 *                 description: Amount each recipient gets
 *               privateKey:
 *                 type: string
 *                 description: Sender's wallet private key
 *               description:
 *                 type: string
 *                 description: Giveaway description
 *     responses:
 *       200:
 *         description: Giveaway completed successfully
 *       400:
 *         description: Invalid request
 */
router.post("/giveaway", auth, async (req, res) => {
  try {
    const { recipients, amountPerRecipient, privateKey, description = "Aeko Giveaway" } = req.body;
    const fromUserId = req.user.id;

    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Recipients array is required"
      });
    }

    if (!amountPerRecipient || amountPerRecipient <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount per recipient is required"
      });
    }

    const totalAmount = recipients.length * amountPerRecipient;
    const fromUser = await User.findById(fromUserId);

    // Check balance
    const balance = await getAekoBalance(fromUser.solanaWalletAddress);
    if (balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Need ${totalAmount} Aeko, have ${balance}`
      });
    }

    // Get recipient wallet addresses
    const recipientUsers = await User.find({
      _id: { $in: recipients },
      solanaWalletAddress: { $exists: true, $ne: null }
    });

    const recipientWallets = recipientUsers.map(user => user.solanaWalletAddress);

    if (recipientWallets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients with connected wallets found"
      });
    }

    // Perform airdrop
    const airdropResults = await airdropAekoTokens(recipientWallets, amountPerRecipient);

    // Create transaction records
    const transactions = [];
    for (let i = 0; i < airdropResults.length; i++) {
      const result = airdropResults[i];
      const recipientUser = recipientUsers.find(user => 
        user.solanaWalletAddress === result.recipient
      );

      if (result.success && recipientUser) {
        const transaction = new AekoTransaction({
          transactionId: uuidv4(),
          solanaSignature: result.signature,
          fromUser: fromUserId,
          toUser: recipientUser._id,
          fromWallet: fromUser.solanaWalletAddress,
          toWallet: result.recipient,
          amount: amountPerRecipient,
          type: 'giveaway',
          status: 'confirmed',
          description,
          confirmedAt: new Date()
        });

        transactions.push(transaction);
      }
    }

    await AekoTransaction.insertMany(transactions);

    // Update balances
    fromUser.aekoBalance = await getAekoBalance(fromUser.solanaWalletAddress);
    await fromUser.save();

    for (const user of recipientUsers) {
      user.aekoBalance = await getAekoBalance(user.solanaWalletAddress);
      await user.save();
    }

    res.json({
      success: true,
      message: "Giveaway completed successfully",
      data: {
        totalRecipients: recipientWallets.length,
        successfulTransfers: airdropResults.filter(r => r.success).length,
        amountPerRecipient,
        totalDistributed: airdropResults.filter(r => r.success).length * amountPerRecipient,
        newBalance: fromUser.aekoBalance,
        results: airdropResults
      }
    });

  } catch (error) {
    console.error("Giveaway error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing giveaway"
    });
  }
});

/**
 * @swagger
 * /api/aeko/donate-to-stream:
 *   post:
 *     summary: Donate Aeko coins to a live stream
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - streamId
 *               - amount
 *               - privateKey
 *             properties:
 *               streamId:
 *                 type: string
 *                 description: Live stream ID
 *               amount:
 *                 type: number
 *                 description: Donation amount in Aeko coins
 *               privateKey:
 *                 type: string
 *                 description: Donor's wallet private key
 *               message:
 *                 type: string
 *                 description: Optional donation message
 *     responses:
 *       200:
 *         description: Donation completed successfully
 *       400:
 *         description: Invalid request or insufficient balance
 *       404:
 *         description: Stream not found
 */
router.post("/donate-to-stream", auth, async (req, res) => {
  try {
    const { streamId, amount, privateKey, message = "" } = req.body;
    const donorUserId = req.user.id;

    // Validation
    if (!streamId || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        message: "Stream ID, amount, and private key are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Donation amount must be greater than 0"
      });
    }

    // Get stream and streamer
    const stream = await LiveStream.findById(streamId).populate('host');
    if (!stream) {
      return res.status(404).json({
        success: false,
        message: "Stream not found"
      });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: "Stream is not currently live"
      });
    }

    const donor = await User.findById(donorUserId);
    const streamer = stream.host;

    if (!donor.solanaWalletAddress || !streamer.solanaWalletAddress) {
      return res.status(400).json({
        success: false,
        message: "Both donor and streamer must have connected Solana wallets"
      });
    }

    // Check balance
    const balance = await getAekoBalance(donor.solanaWalletAddress);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Aeko balance for donation"
      });
    }

    // Perform donation
    const donationResult = await donateAekoToStream(
      privateKey,
      streamer.solanaWalletAddress,
      amount,
      streamId
    );

    // Calculate platform fee (5% of donation)
    const platformFee = amount * 0.05;
    const streamerAmount = amount - platformFee;

    // Create transaction record
    const transaction = new AekoTransaction({
      transactionId: uuidv4(),
      solanaSignature: donationResult.signature,
      fromUser: donorUserId,
      toUser: streamer._id,
      fromWallet: donor.solanaWalletAddress,
      toWallet: streamer.solanaWalletAddress,
      amount: streamerAmount,
      type: 'stream_donation',
      status: 'confirmed',
      description: message || `Donation to ${streamer.username}'s stream`,
      relatedStream: streamId,
      platformFee,
      confirmedAt: new Date()
    });

    await transaction.save();

    // Update stream donation data
    stream.monetization.donations.push({
      userId: donorUserId,
      amount: streamerAmount,
      message,
      timestamp: new Date()
    });
    stream.monetization.totalEarnings += streamerAmount;

    await stream.save();

    // Update user balances
    donor.aekoBalance = await getAekoBalance(donor.solanaWalletAddress);
    streamer.aekoBalance = await getAekoBalance(streamer.solanaWalletAddress);
    
    await donor.save();
    await streamer.save();

    res.json({
      success: true,
      message: "Donation completed successfully",
      data: {
        transaction: {
          id: transaction.transactionId,
          signature: donationResult.signature,
          amount: streamerAmount,
          platformFee,
          donor: donor.username,
          streamer: streamer.username,
          stream: stream.title,
          message,
          timestamp: new Date()
        },
        newBalance: donor.aekoBalance
      }
    });

  } catch (error) {
    console.error("Stream donation error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing donation"
    });
  }
});

/**
 * @swagger
 * /api/aeko/transactions:
 *   get:
 *     summary: Get user's Aeko transaction history
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by transaction type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of transactions to return
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 */
router.get("/transactions", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, limit = 50 } = req.query;

    let query = {
      $or: [
        { fromUser: userId },
        { toUser: userId }
      ]
    };

    if (type) {
      query.type = type;
    }

    const transactions = await AekoTransaction.find(query)
      .populate('fromUser', 'username profilePicture')
      .populate('toUser', 'username profilePicture')
      .populate('relatedStream', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        transactions,
        count: transactions.length
      }
    });

  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting transaction history"
    });
  }
});

/**
 * @swagger
 * /api/aeko/create-wallet:
 *   post:
 *     summary: Create a new Solana wallet
 *     tags: [Aeko Coin]
 *     responses:
 *       200:
 *         description: Wallet created successfully
 */
router.post("/create-wallet", async (req, res) => {
  try {
    const wallet = createWallet();
    
    res.json({
      success: true,
      message: "New Solana wallet created",
      data: {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        warning: "Keep your private key safe and never share it!"
      }
    });

  } catch (error) {
    console.error("Create wallet error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating wallet"
    });
  }
});

export default router;