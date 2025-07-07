import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import NFTMarketplace from "../models/NFTMarketplace.js";
import AekoTransaction from "../models/AekoTransaction.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { 
  mintPostAsNFT,
  transferNFT,
  purchaseNFTWithAeko,
  getAekoBalance
} from "../utils/solanaBlockchain.js";
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /api/nft/mint:
 *   post:
 *     summary: Mint a post as NFT
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - privateKey
 *               - metadataUri
 *             properties:
 *               postId:
 *                 type: string
 *                 description: Post ID to mint as NFT
 *               privateKey:
 *                 type: string
 *                 description: Creator's wallet private key
 *               metadataUri:
 *                 type: string
 *                 description: URI for NFT metadata
 *               price:
 *                 type: number
 *                 description: Optional listing price in Aeko coins
 *               listForSale:
 *                 type: boolean
 *                 description: Whether to list for sale immediately
 *     responses:
 *       200:
 *         description: NFT minted successfully
 *       400:
 *         description: Post not eligible for NFT minting
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Post not found
 */
router.post("/mint", auth, async (req, res) => {
  try {
    const { postId, privateKey, metadataUri, price = 0, listForSale = false } = req.body;
    const userId = req.user.id;

    // Validation
    if (!postId || !privateKey || !metadataUri) {
      return res.status(400).json({
        success: false,
        message: "Post ID, private key, and metadata URI are required"
      });
    }

    // Get post and user
    const post = await Post.findById(postId);
    const user = await User.findById(userId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check ownership
    if (post.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only mint your own posts as NFTs"
      });
    }

    // Check eligibility
    if (!post.isEligibleForNFT || post.views < 200000) {
      return res.status(400).json({
        success: false,
        message: "Post must have 200k+ views to be eligible for NFT minting"
      });
    }

    if (post.nftMinted) {
      return res.status(400).json({
        success: false,
        message: "Post has already been minted as NFT"
      });
    }

    // Check if user has Aeko coins
    const aekoBalance = await getAekoBalance(user.solanaWalletAddress);
    if (aekoBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: "You must hold Aeko coins to mint NFTs"
      });
    }

    // Mint NFT on blockchain
    const mintResult = await mintPostAsNFT(post, privateKey, metadataUri);

    // Create NFT marketplace entry
    const nftMarketplace = new NFTMarketplace({
      tokenId: mintResult.tokenId,
      contractAddress: process.env.SOLANA_NFT_PROGRAM_ID || 'NFT_PROGRAM',
      metadataUri,
      originalPost: postId,
      creator: userId,
      currentOwner: userId,
      isListed: listForSale,
      price: listForSale ? price : 0,
      status: 'active',
      metadata: {
        name: `Aeko Post #${postId}`,
        description: post.text || 'Viral Aeko Post NFT',
        image: post.media || 'https://aeko.io/default-nft.png',
        postStats: {
          originalViews: post.views,
          originalLikes: post.likes.length,
          originalShares: post.reposts.length,
          mintDate: new Date()
        }
      },
      mintTransactionId: mintResult.signature,
      verified: true // Auto-verify platform minted NFTs
    });

    await nftMarketplace.save();

    // Update post
    post.nftMinted = true;
    post.nftTokenId = mintResult.tokenId;
    post.nftMetadataUri = metadataUri;
    if (listForSale) {
      post.isListedForSale = true;
      post.salePrice = price;
    }

    await post.save();

    // Create transaction record
    const transaction = new AekoTransaction({
      transactionId: uuidv4(),
      solanaSignature: mintResult.signature,
      fromUser: userId,
      toUser: userId,
      fromWallet: user.solanaWalletAddress,
      toWallet: user.solanaWalletAddress,
      amount: 0,
      type: 'mint',
      status: 'confirmed',
      description: `Minted post as NFT: ${post.text.substring(0, 50)}...`,
      relatedPost: postId,
      relatedNFT: nftMarketplace._id,
      confirmedAt: new Date()
    });

    await transaction.save();

    res.json({
      success: true,
      message: "NFT minted successfully",
      data: {
        nft: nftMarketplace,
        mintResult,
        post: post
      }
    });

  } catch (error) {
    console.error("NFT mint error:", error);
    res.status(500).json({
      success: false,
      message: "Error minting NFT"
    });
  }
});

/**
 * @swagger
 * /api/nft/marketplace:
 *   get:
 *     summary: Get NFTs listed in marketplace
 *     tags: [NFT Marketplace]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by (price_asc, price_desc, newest, oldest, popular)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of NFTs to return
 *     responses:
 *       200:
 *         description: Marketplace NFTs retrieved successfully
 */
router.get("/marketplace", async (req, res) => {
  try {
    const { category, sort = 'newest', limit = 20, page = 1 } = req.query;

    // Build query
    let query = { isListed: true, status: 'active' };
    if (category && category !== 'all') {
      query.category = category;
    }

    // Build sort
    let sortOptions = {};
    switch (sort) {
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'popular':
        sortOptions = { 'analytics.totalViews': -1, 'analytics.favoriteCount': -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [nfts, totalCount] = await Promise.all([
      NFTMarketplace.find(query)
        .populate('creator', 'username profilePicture')
        .populate('currentOwner', 'username profilePicture')
        .populate('originalPost', 'text media type views likes reposts')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      NFTMarketplace.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        nfts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        filters: {
          category,
          sort
        }
      }
    });

  } catch (error) {
    console.error("Get marketplace error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting marketplace NFTs"
    });
  }
});

/**
 * @swagger
 * /api/nft/purchase:
 *   post:
 *     summary: Purchase an NFT with Aeko coins
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nftId
 *               - buyerPrivateKey
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: NFT marketplace ID
 *               buyerPrivateKey:
 *                 type: string
 *                 description: Buyer's wallet private key
 *     responses:
 *       200:
 *         description: NFT purchased successfully
 *       400:
 *         description: Invalid request or insufficient balance
 *       404:
 *         description: NFT not found
 */
router.post("/purchase", auth, async (req, res) => {
  try {
    const { nftId, buyerPrivateKey } = req.body;
    const buyerId = req.user.id;

    // Validation
    if (!nftId || !buyerPrivateKey) {
      return res.status(400).json({
        success: false,
        message: "NFT ID and buyer private key are required"
      });
    }

    // Get NFT
    const nft = await NFTMarketplace.findById(nftId)
      .populate('creator', 'username solanaWalletAddress')
      .populate('currentOwner', 'username solanaWalletAddress');

    if (!nft) {
      return res.status(404).json({
        success: false,
        message: "NFT not found"
      });
    }

    if (!nft.isListed || nft.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: "NFT is not available for purchase"
      });
    }

    // Get buyer
    const buyer = await User.findById(buyerId);
    if (!buyer.solanaWalletAddress) {
      return res.status(400).json({
        success: false,
        message: "Buyer must have connected Solana wallet"
      });
    }

    // Check if buyer is not the current owner
    if (nft.currentOwner._id.toString() === buyerId) {
      return res.status(400).json({
        success: false,
        message: "You cannot buy your own NFT"
      });
    }

    // Check buyer's balance
    const buyerBalance = await getAekoBalance(buyer.solanaWalletAddress);
    if (buyerBalance < nft.price) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Aeko balance. Need ${nft.price}, have ${buyerBalance}`
      });
    }

    // Calculate fees
    const creatorRoyalty = (nft.price * nft.creatorRoyalty) / 100;
    const platformFee = nft.price * 0.025; // 2.5% platform fee
    const sellerAmount = nft.price - creatorRoyalty - platformFee;

    // Perform the purchase
    const seller = nft.currentOwner;

    // Transfer Aeko coins to seller
    const paymentResult = await purchaseNFTWithAeko(
      nft.tokenId,
      buyerPrivateKey,
      seller.solanaWalletAddress,
      sellerAmount
    );

    // Pay royalty to creator if different from seller
    if (nft.creator._id.toString() !== seller._id.toString() && creatorRoyalty > 0) {
      await transferAekoTokens(
        buyerPrivateKey,
        nft.creator.solanaWalletAddress,
        creatorRoyalty,
        'royalty'
      );
    }

    // Complete the sale
    await nft.completeSale(buyerId, nft.price, 'direct_sale', paymentResult.paymentSignature);

    // Create transaction records
    const saleTransaction = new AekoTransaction({
      transactionId: uuidv4(),
      solanaSignature: paymentResult.paymentSignature,
      fromUser: buyerId,
      toUser: seller._id,
      fromWallet: buyer.solanaWalletAddress,
      toWallet: seller.solanaWalletAddress,
      amount: sellerAmount,
      type: 'nft_purchase',
      status: 'confirmed',
      description: `Purchased NFT: ${nft.metadata.name}`,
      relatedNFT: nftId,
      platformFee,
      confirmedAt: new Date()
    });

    await saleTransaction.save();

    // Update balances
    await User.findByIdAndUpdate(buyerId, {
      aekoBalance: await getAekoBalance(buyer.solanaWalletAddress)
    });

    await User.findByIdAndUpdate(seller._id, {
      aekoBalance: await getAekoBalance(seller.solanaWalletAddress)
    });

    if (creatorRoyalty > 0 && nft.creator._id.toString() !== seller._id.toString()) {
      await User.findByIdAndUpdate(nft.creator._id, {
        aekoBalance: await getAekoBalance(nft.creator.solanaWalletAddress)
      });
    }

    res.json({
      success: true,
      message: "NFT purchased successfully",
      data: {
        nft,
        transaction: {
          id: saleTransaction.transactionId,
          signature: paymentResult.paymentSignature,
          price: nft.price,
          sellerAmount,
          creatorRoyalty,
          platformFee,
          buyer: buyer.username,
          seller: seller.username
        }
      }
    });

  } catch (error) {
    console.error("NFT purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Error purchasing NFT"
    });
  }
});

/**
 * @swagger
 * /api/nft/list:
 *   post:
 *     summary: List NFT for sale
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nftId
 *               - price
 *               - listingType
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: NFT marketplace ID
 *               price:
 *                 type: number
 *                 description: Listing price in Aeko coins
 *               listingType:
 *                 type: string
 *                 enum: [fixed_price, auction, donation]
 *                 description: Type of listing
 *               auctionEndTime:
 *                 type: string
 *                 format: date-time
 *                 description: End time for auction (required if auction)
 *     responses:
 *       200:
 *         description: NFT listed successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Not authorized
 *       404:
 *         description: NFT not found
 */
router.post("/list", auth, async (req, res) => {
  try {
    const { nftId, price, listingType, auctionEndTime } = req.body;
    const userId = req.user.id;

    // Validation
    if (!nftId || !price || !listingType) {
      return res.status(400).json({
        success: false,
        message: "NFT ID, price, and listing type are required"
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0"
      });
    }

    // Get NFT
    const nft = await NFTMarketplace.findById(nftId);
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: "NFT not found"
      });
    }

    // Check ownership
    if (nft.currentOwner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only list your own NFTs"
      });
    }

    // Update NFT listing
    nft.isListed = true;
    nft.listingType = listingType;
    nft.price = price;

    if (listingType === 'auction') {
      if (!auctionEndTime) {
        return res.status(400).json({
          success: false,
          message: "Auction end time is required for auction listings"
        });
      }
      nft.auction.startingBid = price;
      nft.auction.auctionEndTime = new Date(auctionEndTime);
      nft.auction.currentBid = 0;
      nft.auction.bidHistory = [];
    } else if (listingType === 'donation') {
      nft.donations.enabled = true;
      nft.donations.totalDonations = 0;
      nft.donations.donationHistory = [];
    }

    await nft.save();

    // Update related post
    await Post.findByIdAndUpdate(nft.originalPost, {
      isListedForSale: true,
      salePrice: price
    });

    res.json({
      success: true,
      message: "NFT listed successfully",
      data: {
        nft,
        listingDetails: {
          type: listingType,
          price,
          listedAt: new Date(),
          auctionEndTime: listingType === 'auction' ? auctionEndTime : null
        }
      }
    });

  } catch (error) {
    console.error("NFT list error:", error);
    res.status(500).json({
      success: false,
      message: "Error listing NFT"
    });
  }
});

/**
 * @swagger
 * /api/nft/bid:
 *   post:
 *     summary: Place bid on auction NFT
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nftId
 *               - bidAmount
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: NFT marketplace ID
 *               bidAmount:
 *                 type: number
 *                 description: Bid amount in Aeko coins
 *     responses:
 *       200:
 *         description: Bid placed successfully
 *       400:
 *         description: Invalid bid or auction ended
 *       404:
 *         description: NFT not found
 */
router.post("/bid", auth, async (req, res) => {
  try {
    const { nftId, bidAmount } = req.body;
    const bidderId = req.user.id;

    // Validation
    if (!nftId || !bidAmount) {
      return res.status(400).json({
        success: false,
        message: "NFT ID and bid amount are required"
      });
    }

    // Get NFT
    const nft = await NFTMarketplace.findById(nftId)
      .populate('currentOwner', 'username')
      .populate('auction.highestBidder', 'username');

    if (!nft) {
      return res.status(404).json({
        success: false,
        message: "NFT not found"
      });
    }

    // Check if it's an auction
    if (nft.listingType !== 'auction') {
      return res.status(400).json({
        success: false,
        message: "NFT is not listed as auction"
      });
    }

    // Check bidder balance
    const bidder = await User.findById(bidderId);
    const bidderBalance = await getAekoBalance(bidder.solanaWalletAddress);
    
    if (bidderBalance < bidAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Aeko balance for bid"
      });
    }

    // Place bid
    await nft.placeBid(bidderId, bidAmount);

    res.json({
      success: true,
      message: "Bid placed successfully",
      data: {
        nft: {
          id: nft._id,
          currentBid: nft.auction.currentBid,
          highestBidder: nft.auction.highestBidder,
          timeRemaining: nft.timeRemaining,
          auctionStatus: nft.auctionStatus
        },
        bid: {
          bidder: bidder.username,
          amount: bidAmount,
          timestamp: new Date()
        }
      }
    });

  } catch (error) {
    console.error("NFT bid error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error placing bid"
    });
  }
});

/**
 * @swagger
 * /api/nft/donate:
 *   post:
 *     summary: Donate to an NFT
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nftId
 *               - amount
 *               - privateKey
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: NFT marketplace ID
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
 *         description: Invalid request
 *       404:
 *         description: NFT not found
 */
router.post("/donate", auth, async (req, res) => {
  try {
    const { nftId, amount, privateKey, message = "" } = req.body;
    const donorId = req.user.id;

    // Validation
    if (!nftId || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        message: "NFT ID, amount, and private key are required"
      });
    }

    // Get NFT
    const nft = await NFTMarketplace.findById(nftId)
      .populate('currentOwner', 'username solanaWalletAddress');

    if (!nft) {
      return res.status(404).json({
        success: false,
        message: "NFT not found"
      });
    }

    // Check if donations are enabled
    if (nft.listingType !== 'donation' || !nft.donations.enabled) {
      return res.status(400).json({
        success: false,
        message: "Donations are not enabled for this NFT"
      });
    }

    // Get donor
    const donor = await User.findById(donorId);
    const owner = nft.currentOwner;

    // Check balance
    const donorBalance = await getAekoBalance(donor.solanaWalletAddress);
    if (donorBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Aeko balance for donation"
      });
    }

    // Transfer Aeko coins
    const transferResult = await transferAekoTokens(
      privateKey,
      owner.solanaWalletAddress,
      amount,
      'donation'
    );

    // Add donation to NFT
    await nft.addDonation(donorId, amount, message);

    // Create transaction record
    const transaction = new AekoTransaction({
      transactionId: uuidv4(),
      solanaSignature: transferResult.signature,
      fromUser: donorId,
      toUser: owner._id,
      fromWallet: donor.solanaWalletAddress,
      toWallet: owner.solanaWalletAddress,
      amount,
      type: 'donation',
      status: 'confirmed',
      description: `Donation to NFT: ${nft.metadata.name}`,
      relatedNFT: nftId,
      confirmedAt: new Date()
    });

    await transaction.save();

    // Update balances
    donor.aekoBalance = await getAekoBalance(donor.solanaWalletAddress);
    owner.aekoBalance = await getAekoBalance(owner.solanaWalletAddress);
    
    await donor.save();
    await owner.save();

    res.json({
      success: true,
      message: "Donation completed successfully",
      data: {
        donation: {
          donor: donor.username,
          recipient: owner.username,
          amount,
          message,
          timestamp: new Date()
        },
        nft: {
          totalDonations: nft.donations.totalDonations,
          donationCount: nft.donations.donationHistory.length
        },
        transaction: {
          id: transaction.transactionId,
          signature: transferResult.signature
        }
      }
    });

  } catch (error) {
    console.error("NFT donation error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing donation"
    });
  }
});

/**
 * @swagger
 * /api/nft/my-nfts:
 *   get:
 *     summary: Get user's owned NFTs
 *     tags: [NFT Marketplace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User NFTs retrieved successfully
 */
router.get("/my-nfts", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const nfts = await NFTMarketplace.find({
      currentOwner: userId
    })
    .populate('creator', 'username profilePicture')
    .populate('originalPost', 'text media type views likes')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        nfts,
        count: nfts.length,
        totalValue: nfts.reduce((sum, nft) => sum + (nft.isListed ? nft.price : 0), 0)
      }
    });

  } catch (error) {
    console.error("Get my NFTs error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting user NFTs"
    });
  }
});

/**
 * @swagger
 * /api/nft/stats:
 *   get:
 *     summary: Get NFT marketplace statistics
 *     tags: [NFT Marketplace]
 *     responses:
 *       200:
 *         description: Marketplace stats retrieved successfully
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await NFTMarketplace.getMarketplaceStats();
    const trending = await NFTMarketplace.getTrending(5);

    res.json({
      success: true,
      data: {
        marketplace: stats[0] || {
          totalNFTs: 0,
          totalVolume: 0,
          listedNFTs: 0,
          averagePrice: 0
        },
        trending
      }
    });

  } catch (error) {
    console.error("Get NFT stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting marketplace stats"
    });
  }
});

export default router;