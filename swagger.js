import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerConfig = {
    openapi: "3.0.0",
    info: {
        title: "Aeko Enhanced API",
        version: "2.0.0",
        description: `
# Aeko Backend API Documentation

Welcome to the comprehensive API documentation for Aeko, the **Web3 Social Media Platform** featuring blockchain integration, NFT marketplace, and advanced real-time communication.

**Aeko** is a next-generation blockchain-based social media platform that merges the best features of short-form video sharing, microblogging, and photo-based networking, enhanced by AI capabilities and powered by Web3. It aims to provide a decentralized, immersive, and rewarding experience for content creators and consumers alike.
Aeko combines the power of Solana blockchain for fast, secure transactions with a rich set of social features, including an enhanced chat system, AI bot personalities, and a unique NFT marketplace.

## 🚀 Core Features

### 🌐 Social Features
- **User management** and authentication
- **Social media features** (posts, comments, likes, shares)
- **Post ownership** and transfer system
- **Engagement tracking** with view counting
- **Advertisement system** with crypto payments
- **Challenge and debate systems**
- **Space/community features** with token gating
- **Subscription-based content** and monetization
- **Profile management** with status updates

### 🔗 Blockchain Integration
- **Aeko Coin (AEKO)** - Native Solana SPL token
- **Post Transfer System** - Transfer post ownership between users
- **NFT Marketplace** - Mint viral posts as NFTs (200k+ views required)
- **Stream Donations** - Crypto donations for live streams
- **Wallet Integration** - Phantom, Solflare, and other Solana wallets
- **Transaction Tracking** - Complete on-chain transaction history

### 🖼️ NFT Marketplace
- **Three Listing Types**: Fixed price, Auction, Donation
- **Creator Royalties**: 10% automatic royalty distribution
- **Platform Fees**: 2.5% marketplace fee
- **Auction System**: Time-based bidding with automatic settlement
- **Donation NFTs**: Accept donations for your viral content
- **Verification System**: Admin-verified NFTs for authenticity

### � Aeko Coin Features
- **Native Currency**: Primary platform token on Solana
- **Transfers**: P2P token transfers between users
- **Giveaways**: Bulk token distribution for community events
- **Stream Tips**: Real-time donations during live streams
- **NFT Purchases**: Primary currency for marketplace transactions
- **Rewards**: Platform rewards and incentives

### 📱 Enhanced Chat System
- **Real-time messaging** with Socket.IO
- **Voice messages** with audio recording
- **Emoji reactions** and advanced emoji support
- **AI Bot integration** with 7 personalities
- **File sharing** (images, videos, documents, audio)
- **Typing indicators** and presence management
- **Read receipts** and message status tracking
- **Message search** and conversation history
- **Group chats** and advanced chat management

### 🤖 AI Bot Personalities
1. **Friendly** 😊 - Warm and approachable
2. **Professional** 💼 - Business-oriented and formal
3. **Sarcastic** 😏 - Witty with dry humor
4. **Creative** 🎨 - Imaginative and artistic
5. **Analytical** 📊 - Data-driven and logical
6. **Mentor** 🧙 - Educational and supportive
7. **Companion** 🤝 - Empathetic and understanding


## 🔐 Authentication

Most endpoints require JWT authentication. Include your token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

## 🌐 Base URL
- **Development**: \`http://localhost:5000\`
- **Production**: \`https://api.aeko.com\`

## 🔗 Blockchain Integration

The platform uses **Solana blockchain** for all crypto operations:
- **Network**: Solana (Devnet/Mainnet)
- **Token Standard**: SPL Token for Aeko Coin
- **NFT Standard**: Metaplex for NFT minting
- **Wallet Support**: Phantom, Solflare, and other Solana wallets
- **Transaction Fees**: Paid in SOL (Solana's native token)

## 💰 Aeko Coin Economics

- **Token Name**: Aeko Coin (AEKO)
- **Decimals**: 9 (like SOL)
- **Total Supply**: 1,000,000,000 AEKO
- **Use Cases**: NFT purchases, stream donations, giveaways, transfers
- **Platform Fees**: 2.5% on NFT sales, 5% on stream donations

## 🖼️ NFT Requirements

To mint a post as NFT:
- **Minimum Views**: 200,000 unique views
- **Aeko Holdings**: Must hold any amount of Aeko coins
- **Ownership**: Must own the post
- **Status**: Post not previously minted

## 📡 Real-Time Communication

The enhanced chat system uses **Socket.IO** for real-time features:
- **Endpoint**: \`ws://localhost:5000\`
- **Authentication**: JWT token required
- **Features**: Instant messaging, voice recording, emoji reactions, AI bot responses

## 📁 File Upload Support

- **Maximum file size**: 100MB
- **Supported formats**: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, AVI), Audio (MP3, WAV, OGG), Documents (PDF, DOC, TXT)
- **Voice messages**: WebM audio with waveform data
        `,
        contact: {
            name: "Aeko Development Team",
            email: "dev@aeko.com"
        },
        license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT"
        }
    },
    servers: [
        {
            url: "http://localhost:5000",
            description: "Development server"
        },
        {
            url: "https://api.aeko.com",
            description: "Production server"
        }
    ],
    tags: [
        {
            name: "Authentication",
            description: "User authentication and authorization"
        },
        {
            name: "Users",
            description: "User management operations"
        },
        {
            name: "Posts",
            description: "Social media posts and content"
        },
        {
            name: "Comments",
            description: "Comment system for posts"
        },
        {
            name: "Enhanced Chat",
            description: "Advanced real-time messaging system with voice, emojis, and AI bot",
            externalDocs: {
                description: "Enhanced Chat Documentation",
                url: "https://docs.aeko.com/enhanced-chat"
            }
        },
        {
            name: "AI Bot",
            description: "AI-powered chatbot with multiple personalities"
        },
        {
            name: "Voice Messages",
            description: "Audio message recording and sharing"
        },
        {
            name: "Emoji System",
            description: "Emoji reactions and advanced emoji support"
        },
        {
            name: "File Upload",
            description: "File sharing and media upload system"
        },
        {
            name: "Bot System",
            description: "Legacy bot system (use Enhanced Chat for new implementations)"
        },
        {
            name: "Challenges",
            description: "Challenge and competition system"
        },
        {
            name: "Debates",
            description: "Debate and discussion system"
        },
        {
            name: "Spaces",
            description: "Community spaces and groups"
        },
        {
            name: "Ads",
            description: "Advertisement management"
        },
        {
            name: "Payments",
            description: "Payment processing and billing"
        },
        {
            name: "Subscriptions",
            description: "Subscription management"
        },
        {
            name: "Profile",
            description: "User profile management"
        },
        {
            name: "Status",
            description: "User status and presence"
        },
        {
            name: "System",
            description: "System health and monitoring"
        },
        {
            name: "Post Transfer",
            description: "Transfer post ownership between users",
            externalDocs: {
                description: "Post Transfer Documentation",
                url: "https://docs.aeko.com/post-transfer"
            }
        },
        {
            name: "Aeko Coin",
            description: "Native Solana SPL token operations",
            externalDocs: {
                description: "Aeko Coin Documentation",
                url: "https://docs.aeko.com/aeko-coin"
            }
        },
        {
            name: "NFT Marketplace",
            description: "NFT minting, trading, and marketplace operations",
            externalDocs: {
                description: "NFT Marketplace Documentation",
                url: "https://docs.aeko.com/nft-marketplace"
            }
        },
        {
            name: "Blockchain",
            description: "Blockchain integration and Web3 features"
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT Authorization header using the Bearer scheme. Example: 'Authorization: Bearer {token}'"
            }
        },
        schemas: {
            Error: {
                type: "object",
                properties: {
                    error: {
                        type: "string",
                        description: "Error message"
                    },
                    message: {
                        type: "string",
                        description: "Detailed error description"
                    },
                    code: {
                        type: "integer",
                        description: "Error code"
                    }
                }
            },
            Success: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        description: "Operation success status"
                    },
                    message: {
                        type: "string",
                        description: "Success message"
                    },
                    data: {
                        type: "object",
                        description: "Response data"
                    }
                }
            },
            User: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "User ID"
                    },
                    username: {
                        type: "string",
                        description: "Username"
                    },
                    email: {
                        type: "string",
                        format: "email",
                        description: "User email"
                    },
                    profilePicture: {
                        type: "string",
                        description: "Profile picture URL"
                    },
                    status: {
                        type: "string",
                        enum: ["online", "offline", "away", "busy"],
                        description: "User status"
                    },
                    botEnabled: {
                        type: "boolean",
                        description: "Whether AI bot auto-reply is enabled"
                    },
                    botPersonality: {
                        type: "string",
                        enum: ["friendly", "professional", "sarcastic", "creative", "analytical", "mentor", "companion"],
                        description: "Preferred AI bot personality"
                    },
                    solanaWalletAddress: {
                        type: "string",
                        description: "Connected Solana wallet address"
                    },
                    aekoBalance: {
                        type: "number",
                        description: "Current Aeko coin balance"
                    },
                    isAdmin: {
                        type: "boolean",
                        description: "Whether user has admin privileges"
                    }
                }
            },
            EnhancedMessage: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "Message ID"
                    },
                    sender: {
                        $ref: "#/components/schemas/User"
                    },
                    receiver: {
                        $ref: "#/components/schemas/User"
                    },
                    chatId: {
                        type: "string",
                        description: "Chat room ID"
                    },
                    messageType: {
                        type: "string",
                        enum: ["text", "voice", "image", "video", "file", "emoji", "sticker", "ai_response"],
                        description: "Type of message"
                    },
                    content: {
                        type: "string",
                        description: "Message content (for text, emoji, and AI responses)"
                    },
                    voiceMessage: {
                        type: "object",
                        properties: {
                            url: {
                                type: "string",
                                description: "Voice file URL"
                            },
                            duration: {
                                type: "number",
                                description: "Duration in seconds"
                            },
                            waveform: {
                                type: "array",
                                items: {
                                    type: "number"
                                },
                                description: "Audio waveform data for visualization"
                            },
                            transcription: {
                                type: "string",
                                description: "AI transcription of voice message"
                            }
                        }
                    },
                    attachments: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: {
                                    type: "string",
                                    enum: ["image", "video", "file", "audio"]
                                },
                                url: {
                                    type: "string"
                                },
                                filename: {
                                    type: "string"
                                },
                                size: {
                                    type: "integer"
                                },
                                mimeType: {
                                    type: "string"
                                }
                            }
                        }
                    },
                    reactions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: {
                                    type: "string"
                                },
                                emoji: {
                                    type: "string"
                                },
                                timestamp: {
                                    type: "string",
                                    format: "date-time"
                                }
                            }
                        }
                    },
                    isBot: {
                        type: "boolean",
                        description: "Whether this is an AI bot message"
                    },
                    botPersonality: {
                        type: "string",
                        enum: ["friendly", "professional", "sarcastic", "creative", "analytical", "mentor", "companion"],
                        description: "AI bot personality used"
                    },
                    aiProvider: {
                        type: "string",
                        enum: ["openai", "claude", "cohere", "local"],
                        description: "AI provider used for response"
                    },
                    confidence: {
                        type: "number",
                        minimum: 0,
                        maximum: 1,
                        description: "AI response confidence score"
                    },
                    status: {
                        type: "string",
                        enum: ["sending", "sent", "delivered", "read", "failed"],
                        description: "Message delivery status"
                    },
                    replyTo: {
                        type: "string",
                        description: "ID of message being replied to"
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time"
                    },
                    updatedAt: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            Chat: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "Chat ID"
                    },
                    members: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/User"
                        },
                        description: "Chat participants"
                    },
                    isGroup: {
                        type: "boolean",
                        description: "Whether this is a group chat"
                    },
                    groupName: {
                        type: "string",
                        description: "Group chat name (if applicable)"
                    },
                    lastMessage: {
                        $ref: "#/components/schemas/EnhancedMessage"
                    },
                    unreadCount: {
                        type: "integer",
                        description: "Number of unread messages for current user"
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time"
                    },
                    updatedAt: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            EmojiCategory: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Category name"
                    },
                    emojis: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of emoji unicode characters"
                    }
                }
            },
            BotPersonality: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Personality name"
                    },
                    description: {
                        type: "string",
                        description: "Personality description"
                    },
                    traits: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Personality traits"
                    },
                    emoji: {
                        type: "string",
                        description: "Representative emoji"
                    }
                }
            },
            ChatSystemInfo: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        example: "Enhanced Real-time Chat System"
                    },
                    version: {
                        type: "string",
                        example: "2.0.0"
                    },
                    features: {
                        type: "object",
                        properties: {
                            realTimeMessaging: { type: "boolean" },
                            voiceMessages: { type: "boolean" },
                            emojiReactions: { type: "boolean" },
                            fileSharing: { type: "boolean" },
                            aiBotIntegration: { type: "boolean" },
                            typingIndicators: { type: "boolean" },
                            readReceipts: { type: "boolean" },
                            messageSearch: { type: "boolean" },
                            groupChats: { type: "boolean" },
                            messageHistory: { type: "boolean" },
                            onlineStatus: { type: "boolean" }
                        }
                    },
                    statistics: {
                        type: "object",
                        properties: {
                            connectedUsers: { type: "integer" },
                            totalActiveConnections: { type: "integer" },
                            supportedFileTypes: {
                                type: "array",
                                items: { type: "string" }
                            },
                            maxFileSize: { type: "string" },
                            supportedEmojis: { type: "string" },
                            aiPersonalities: {
                                type: "array",
                                items: { type: "string" }
                            }
                        }
                    }
                }
            },
            Post: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "Post ID"
                    },
                    user: {
                        $ref: "#/components/schemas/User"
                    },
                    originalOwner: {
                        $ref: "#/components/schemas/User"
                    },
                    text: {
                        type: "string",
                        description: "Post text content"
                    },
                    media: {
                        type: "string",
                        description: "Media URL (image or video)"
                    },
                    type: {
                        type: "string",
                        enum: ["text", "image", "video"],
                        description: "Post type"
                    },
                    views: {
                        type: "integer",
                        description: "Total post views"
                    },
                    uniqueViewers: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of unique viewer IDs"
                    },
                    transferHistory: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                fromUser: { type: "string" },
                                toUser: { type: "string" },
                                transferDate: { type: "string", format: "date-time" },
                                reason: { type: "string" }
                            }
                        }
                    },
                    isEligibleForNFT: {
                        type: "boolean",
                        description: "Whether post is eligible for NFT minting"
                    },
                    nftMinted: {
                        type: "boolean",
                        description: "Whether post has been minted as NFT"
                    },
                    nftTokenId: {
                        type: "string",
                        description: "Solana token ID if minted as NFT"
                    },
                    isListedForSale: {
                        type: "boolean",
                        description: "Whether NFT is listed for sale"
                    },
                    salePrice: {
                        type: "number",
                        description: "Sale price in Aeko coins"
                    },
                    engagement: {
                        type: "object",
                        properties: {
                            totalShares: { type: "integer" },
                            totalComments: { type: "integer" },
                            totalLikes: { type: "integer" },
                            engagementRate: { type: "number" }
                        }
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time"
                    },
                    updatedAt: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            AekoTransaction: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "Transaction ID"
                    },
                    transactionId: {
                        type: "string",
                        description: "Unique transaction identifier"
                    },
                    solanaSignature: {
                        type: "string",
                        description: "Solana blockchain transaction signature"
                    },
                    fromUser: {
                        $ref: "#/components/schemas/User"
                    },
                    toUser: {
                        $ref: "#/components/schemas/User"
                    },
                    fromWallet: {
                        type: "string",
                        description: "Sender wallet address"
                    },
                    toWallet: {
                        type: "string",
                        description: "Recipient wallet address"
                    },
                    amount: {
                        type: "number",
                        description: "Transaction amount in Aeko coins"
                    },
                    type: {
                        type: "string",
                        enum: ["transfer", "donation", "giveaway", "nft_purchase", "nft_sale", "stream_donation", "reward", "mint", "burn"],
                        description: "Transaction type"
                    },
                    status: {
                        type: "string",
                        enum: ["pending", "confirmed", "failed", "cancelled"],
                        description: "Transaction status"
                    },
                    confirmations: {
                        type: "integer",
                        description: "Number of blockchain confirmations"
                    },
                    blockNumber: {
                        type: "integer",
                        description: "Block number on Solana"
                    },
                    description: {
                        type: "string",
                        description: "Transaction description"
                    },
                    gasFee: {
                        type: "number",
                        description: "Solana network fee"
                    },
                    platformFee: {
                        type: "number",
                        description: "Platform fee collected"
                    },
                    relatedPost: {
                        type: "string",
                        description: "Related post ID (if applicable)"
                    },
                    relatedStream: {
                        type: "string",
                        description: "Related livestream ID (if applicable)"
                    },
                    relatedNFT: {
                        type: "string",
                        description: "Related NFT ID (if applicable)"
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time"
                    },
                    confirmedAt: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            NFTMarketplace: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "NFT marketplace ID"
                    },
                    tokenId: {
                        type: "string",
                        description: "Solana token ID"
                    },
                    contractAddress: {
                        type: "string",
                        description: "Solana program address"
                    },
                    metadataUri: {
                        type: "string",
                        description: "IPFS metadata URI"
                    },
                    originalPost: {
                        $ref: "#/components/schemas/Post"
                    },
                    creator: {
                        $ref: "#/components/schemas/User"
                    },
                    currentOwner: {
                        $ref: "#/components/schemas/User"
                    },
                    creatorRoyalty: {
                        type: "number",
                        description: "Creator royalty percentage (default 10%)"
                    },
                    isListed: {
                        type: "boolean",
                        description: "Whether NFT is listed for sale"
                    },
                    listingType: {
                        type: "string",
                        enum: ["fixed_price", "auction", "donation"],
                        description: "Type of listing"
                    },
                    price: {
                        type: "number",
                        description: "Listing price in Aeko coins"
                    },
                    auction: {
                        type: "object",
                        properties: {
                            startingBid: { type: "number" },
                            currentBid: { type: "number" },
                            highestBidder: { type: "string" },
                            auctionEndTime: { type: "string", format: "date-time" },
                            reservePrice: { type: "number" },
                            bidHistory: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        bidder: { type: "string" },
                                        amount: { type: "number" },
                                        timestamp: { type: "string", format: "date-time" }
                                    }
                                }
                            }
                        }
                    },
                    donations: {
                        type: "object",
                        properties: {
                            enabled: { type: "boolean" },
                            totalDonations: { type: "number" },
                            donationHistory: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        donor: { type: "string" },
                                        amount: { type: "number" },
                                        message: { type: "string" },
                                        timestamp: { type: "string", format: "date-time" }
                                    }
                                }
                            }
                        }
                    },
                    saleHistory: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                seller: { type: "string" },
                                buyer: { type: "string" },
                                price: { type: "number" },
                                transactionId: { type: "string" },
                                saleDate: { type: "string", format: "date-time" },
                                saleType: { type: "string", enum: ["direct_sale", "auction_win", "transfer"] }
                            }
                        }
                    },
                    metadata: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            image: { type: "string" },
                            attributes: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        trait_type: { type: "string" },
                                        value: { type: "string" }
                                    }
                                }
                            },
                            postStats: {
                                type: "object",
                                properties: {
                                    originalViews: { type: "integer" },
                                    originalLikes: { type: "integer" },
                                    originalShares: { type: "integer" },
                                    mintDate: { type: "string", format: "date-time" }
                                }
                            }
                        }
                    },
                    analytics: {
                        type: "object",
                        properties: {
                            totalViews: { type: "integer" },
                            totalLikes: { type: "integer" },
                            listingViews: { type: "integer" },
                            favoriteCount: { type: "integer" }
                        }
                    },
                    status: {
                        type: "string",
                        enum: ["minting", "active", "sold", "transferred", "burned"],
                        description: "NFT status"
                    },
                    verified: {
                        type: "boolean",
                        description: "Whether NFT is platform verified"
                    },
                    featured: {
                        type: "boolean",
                        description: "Whether NFT is featured on marketplace"
                    },
                    category: {
                        type: "string",
                        enum: ["art", "photography", "video", "meme", "viral", "trending", "other"],
                        description: "NFT category"
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "NFT tags"
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time"
                    },
                    updatedAt: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            WalletInfo: {
                type: "object",
                properties: {
                    publicKey: {
                        type: "string",
                        description: "Solana wallet public key"
                    },
                    privateKey: {
                        type: "string",
                        description: "Solana wallet private key (keep secure!)"
                    },
                    aekoBalance: {
                        type: "number",
                        description: "Aeko coin balance"
                    },
                    solBalance: {
                        type: "number",
                        description: "SOL balance"
                    }
                }
            },
            BlockchainResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        description: "Operation success"
                    },
                    message: {
                        type: "string",
                        description: "Response message"
                    },
                    data: {
                        type: "object",
                        description: "Response data"
                    },
                    transaction: {
                        type: "object",
                        properties: {
                            signature: { type: "string" },
                            amount: { type: "number" },
                            fromWallet: { type: "string" },
                            toWallet: { type: "string" },
                            timestamp: { type: "string", format: "date-time" }
                        }
                    }
                }
            }
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ],
    paths: {
        "/health": {
            get: {
                tags: ["System"],
                summary: "System health check",
                description: "Get system health status and feature availability",
                responses: {
                    200: {
                        description: "System health information",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "OK" },
                                        timestamp: { type: "string", format: "date-time" },
                                        services: {
                                            type: "object",
                                            properties: {
                                                mongodb: { type: "string", example: "Connected" },
                                                socket: { type: "string", example: "Active" },
                                                chat: { type: "string", example: "Enhanced Chat System Ready" },
                                                ai: { type: "string", example: "AI Bot Integrated" }
                                            }
                                        },
                                        features: {
                                            type: "array",
                                            items: { type: "string" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/chat-info": {
            get: {
                tags: ["Enhanced Chat", "System"],
                summary: "Get enhanced chat system information",
                description: "Retrieve detailed information about the enhanced chat system capabilities and statistics",
                responses: {
                    200: {
                        description: "Chat system information",
                        content: {
                            "application/json": {
                                schema: {
                                    allOf: [
                                        { $ref: "#/components/schemas/Success" },
                                        {
                                            type: "object",
                                            properties: {
                                                chatSystem: {
                                                    $ref: "#/components/schemas/ChatSystemInfo"
                                                },
                                                connectedUsers: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            userId: { type: "string" },
                                                            username: { type: "string" },
                                                            status: { type: "string" },
                                                            lastSeen: { type: "string", format: "date-time" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Define Swagger options
const options = {
    definition: swaggerConfig,
    apis: ["./routes/*.js"], // This will include all route files including enhancedChatRoutes.js
};

// Generate Swagger specification
const swaggerSpec = swaggerJSDoc(options);

// Export a function that sets up Swagger with enhanced UI options
const setupSwagger = (app) => {
    const swaggerUiOptions = {
        explorer: true,
        swaggerOptions: {
            docExpansion: 'none',
            filter: true,
            showRequestHeaders: true,
            showCommonExtensions: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha'
        },
        customCss: `
            .swagger-ui .topbar { 
                background-color: #667eea; 
                background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .swagger-ui .topbar .download-url-wrapper .select-label { 
                color: white; 
            }
            .swagger-ui .info .title { 
                color: #667eea; 
            }
            .swagger-ui .info .description { 
                margin: 20px 0; 
                color: #444;
            }
            .swagger-ui .info .description h1,
            .swagger-ui .info .description h2,
            .swagger-ui .info .description h3 {
                color: #667eea;
                margin-top: 20px;
            }
            .swagger-ui .scheme-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
        `,
        customSiteTitle: "Aeko Enhanced API Documentation",
        customfavIcon: "/favicon.ico"
    };

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    
    // Add JSON endpoint for the spec
    app.get("/api-docs.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });
    
    console.log(`📚 Swagger UI available at: http://localhost:${process.env.PORT || 5000}/api-docs`);
    console.log(`📄 API Spec JSON at: http://localhost:${process.env.PORT || 5000}/api-docs.json`);
};

export default setupSwagger;
