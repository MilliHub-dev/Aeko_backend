import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSMongoose from "@adminjs/mongoose";
import express from "express";
import mongoose from "mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import Status from "./models/Status.js";
import Debate from "./models/Debate.js";
import Ad from "./models/Ad.js";
import LiveStream from "./models/LiveStream.js";
import BotSettings from "./models/BotSettings.js";
import BotConversation from "./models/BotConversation.js";
import EnhancedMessage from "./models/EnhancedMessage.js";
import Comment from "./models/Comment.js";
import Challenge from "./models/Challenge.js";
import Space from "./models/Space.js";
import Chat from "./models/Chat.js";
import Message from "./models/Message.js";
import AekoTransaction from "./models/AekoTransaction.js";
import NFTMarketplace from "./models/NFTMarketplace.js";
import Interest from "./models/Interest.js";
import Community from "./models/Community.js";

AdminJS.registerAdapter(AdminJSMongoose);

const admin = new AdminJS({
  resources: [
    // ===== COMMUNITY MANAGEMENT =====
    {
      resource: Community,
      options: {
        parent: {
          name: 'Community Management',
          icon: 'Users'
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } }
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true }
        }
      }
    },
    // ===== INTEREST MANAGEMENT =====
    {
      resource: Interest,
      options: {
        parent: {
          name: 'Content Management',
          icon: 'Tag'
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } }
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true }
        },
        listProperties: ['name', 'displayName', 'isActive', 'createdAt'],
        showProperties: ['name', 'displayName', 'description', 'icon', 'isActive', 'createdAt', 'updatedAt'],
        editProperties: ['name', 'displayName', 'description', 'icon', 'isActive']
      }
    },
    
    // ===== USER MANAGEMENT =====
    {
      resource: User,
      options: {
        parent: {
          name: "User Management",
          icon: "Users"
        },
        properties: {
          password: { isVisible: false },
          _id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
          followers: { isVisible: { list: false, show: true, edit: false } },
          following: { isVisible: { list: false, show: true, edit: false } },
          posts: { isVisible: { list: false, show: true, edit: false } },
          botResponses: { isVisible: { list: false, show: true, edit: true } }
        },
        actions: {
          new: {
            isVisible: true,
          },
          edit: {
            isVisible: true,
          },
          delete: {
            isVisible: true,
          },
          banUser: {
            actionType: "record",
            icon: "Ban",
            label: "Ban User",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ banned: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: `User ${record.params.username} has been banned successfully!`,
                  type: 'success',
                },
              };
            },
          },
          unbanUser: {
            actionType: "record",
            icon: "Check",
            label: "Unban User",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ banned: false });
              return {
                record: record.toJSON(),
                notice: {
                  message: `User ${record.params.username} has been unbanned successfully!`,
                  type: 'success',
                },
              };
            },
          },
          grantBlueTick: {
            actionType: "record",
            icon: "Award",
            label: "Grant Blue Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ blueTick: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Blue tick granted to ${record.params.username}!`,
                  type: 'success',
                },
              };
            },
          },
          grantGoldenTick: {
            actionType: "record",
            icon: "Star",
            label: "Grant Golden Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ goldenTick: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Golden tick granted to ${record.params.username}!`,
                  type: 'success',
                },
              };
            },
          },
          activateSubscription: {
            actionType: "record",
            icon: "CreditCard",
            label: "Activate Subscription",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              const oneMonthFromNow = new Date();
              oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
              await record.update({ 
                subscriptionStatus: 'active',
                subscriptionExpiry: oneMonthFromNow
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Subscription activated for ${record.params.username}!`,
                  type: 'success',
                },
              };
            },
          },
          userStats: {
            actionType: "resource",
            icon: "Analytics",
            label: "User Statistics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await User.aggregate([
                {
                  $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    verifiedUsers: { $sum: { $cond: [{ $or: ["$blueTick", "$goldenTick"] }, 1, 0] } },
                    activeSubscriptions: { $sum: { $cond: [{ $eq: ["$subscriptionStatus", "active"] }, 1, 0] } },
                    botEnabledUsers: { $sum: { $cond: ["$botEnabled", 1, 0] } }
                  }
                }
              ]);
              return {
                notice: {
                  message: `Total Users: ${stats[0]?.totalUsers || 0}, Verified: ${stats[0]?.verifiedUsers || 0}, Active Subscriptions: ${stats[0]?.activeSubscriptions || 0}, Bot Enabled: ${stats[0]?.botEnabledUsers || 0}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['username', 'email', 'name', 'blueTick', 'goldenTick', 'subscriptionStatus', 'botEnabled', 'createdAt'],
        showProperties: ['username', 'email', 'name', 'bio', 'profilePicture', 'blueTick', 'goldenTick', 'subscriptionStatus', 'subscriptionExpiry', 'botEnabled', 'botPersonality', 'createdAt', 'updatedAt'],
        editProperties: ['name', 'username', 'email', 'bio', 'profilePicture', 'blueTick', 'goldenTick', 'subscriptionStatus', 'subscriptionExpiry', 'botEnabled', 'botPersonality'],
      },
    },
    
    // ===== CONTENT MANAGEMENT =====
    {
      resource: Post,
      options: {
        parent: {
          name: "Content Management",
          icon: "FileText"
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
          likes: { isVisible: { list: false, show: true, edit: false } },
          reposts: { isVisible: { list: false, show: true, edit: false } },
          comments: { isVisible: { list: false, show: true, edit: false } }
        },
        actions: {
          delete: { isVisible: true },
          flagContent: {
            actionType: "record",
            icon: "Flag",
            label: "Flag as Inappropriate",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              // Here you could add a flagged field to the schema
              return {
                record: record.toJSON(),
                notice: {
                  message: `Post has been flagged for review!`,
                  type: 'warning',
                },
              };
            },
          },
          contentStats: {
            actionType: "resource",
            icon: "BarChart",
            label: "Content Statistics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await Post.aggregate([
                {
                  $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    totalLikes: { $sum: { $size: "$likes" } },
                    totalReposts: { $sum: { $size: "$reposts" } }
                  }
                }
              ]);
              const message = stats.map(s => `${s._id}: ${s.count} posts (${s.totalLikes} likes, ${s.totalReposts} reposts)`).join(', ');
              return {
                notice: {
                  message: `Content Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['user', 'type', 'text', 'createdAt'],
        showProperties: ['user', 'text', 'media', 'type', 'likes', 'reposts', 'comments', 'createdAt'],
      },
    },

    {
      resource: Comment,
      options: {
        parent: {
          name: "Content Management",
          icon: "MessageCircle"
        },
        actions: {
          delete: { isVisible: true },
          moderateComment: {
            actionType: "record",
            icon: "Shield",
            label: "Moderate",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              return {
                record: record.toJSON(),
                notice: {
                  message: `Comment moderated successfully!`,
                  type: 'success',
                },
              };
            },
          }
        },
      },
    },

    // ===== LIVESTREAM MANAGEMENT =====
    {
      resource: LiveStream,
      options: {
        parent: {
          name: "LiveStream Management",
          icon: "Video"
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          streamKey: { isVisible: { list: false, show: true, edit: false } },
          rtmpUrl: { isVisible: { list: false, show: true, edit: false } },
          hlsUrl: { isVisible: { list: false, show: true, edit: false } },
          webrtcUrl: { isVisible: { list: false, show: true, edit: false } },
          roomId: { isVisible: { list: false, show: true, edit: false } },
          uniqueViewers: { isVisible: { list: false, show: true, edit: false } },
          reactions: { isVisible: { list: false, show: true, edit: false } },
          currentViewers: { isVisible: { list: true, show: true, edit: false } },
          peakViewers: { isVisible: { list: true, show: true, edit: false } },
          totalViews: { isVisible: { list: true, show: true, edit: false } }
        },
        actions: {
          delete: { isVisible: true },
          endStream: {
            actionType: "record",
            icon: "StopCircle",
            label: "End Stream",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ 
                status: 'ended',
                endedAt: new Date()
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Stream "${record.params.title}" has been ended!`,
                  type: 'success',
                },
              };
            },
          },
          banStream: {
            actionType: "record",
            icon: "Ban",
            label: "Ban Stream",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ 
                status: 'ended',
                endedAt: new Date()
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Stream "${record.params.title}" has been banned and ended!`,
                  type: 'error',
                },
              };
            },
          },
          streamStats: {
            actionType: "resource",
            icon: "TrendingUp",
            label: "Stream Analytics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await LiveStream.aggregate([
                {
                  $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalViews: { $sum: "$totalViews" },
                    totalRevenue: { $sum: "$monetization.totalEarnings" }
                  }
                }
              ]);
              const message = stats.map(s => `${s._id}: ${s.count} streams (${s.totalViews} views, $${s.totalRevenue} revenue)`).join(', ');
              return {
                notice: {
                  message: `Stream Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['title', 'host', 'status', 'category', 'currentViewers', 'totalViews', 'createdAt'],
        showProperties: ['title', 'description', 'host', 'status', 'category', 'currentViewers', 'peakViewers', 'totalViews', 'createdAt'],
        editProperties: ['title', 'description', 'status', 'category'],
      },
    },

    // ===== AI & BOT MANAGEMENT =====
    {
      resource: BotSettings,
      options: {
        parent: {
          name: "AI & Bot Management",
          icon: "Bot"
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['userId', 'botEnabled', 'botPersonality', 'aiProvider'],
        showProperties: ['userId', 'botEnabled', 'botPersonality', 'aiProvider', 'model', 'maxTokens', 'temperature', 'customInstructions'],
        editProperties: ['botEnabled', 'botPersonality', 'aiProvider', 'model', 'maxTokens', 'temperature', 'customInstructions'],
      },
    },

    {
      resource: BotConversation,
      options: {
        parent: {
          name: "AI & Bot Management",
          icon: "MessageSquare"
        },
        listProperties: ['userId', 'userMessage', 'botResponse', 'updatedAt'],
        actions: {
          delete: { isVisible: true },
          clearHistory: {
            actionType: "record",
            icon: "Trash",
            label: "Clear Chat History",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ 
                messages: [],
                totalMessages: 0
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Chat history cleared for user!`,
                  type: 'success',
                },
              };
            },
          }
        },
      },
    },

    // ===== ADVERTISING =====
    {
      resource: Ad,
      options: {
        parent: {
          name: "Advertising",
          icon: "DollarSign"
        },
        actions: {
          approveAd: {
            actionType: "record",
            icon: "Check",
            label: "Approve Ad",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ status: 'approved' });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Ad "${record.params.title}" has been approved!`,
                  type: 'success',
                },
              };
            },
          },
          rejectAd: {
            actionType: "record",
            icon: "X",
            label: "Reject Ad",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ status: 'rejected' });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Ad "${record.params.title}" has been rejected!`,
                  type: 'error',
                },
              };
            },
          },
          adStats: {
            actionType: "resource",
            icon: "BarChart3",
            label: "Ad Performance",
            component: false,
            handler: async (request, response, context) => {
              const stats = await Ad.aggregate([
                {
                  $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalBudget: { $sum: "$budget.total" }
                  }
                }
              ]);
              const message = stats.map(s => `${s._id}: ${s.count} ads ($${s.totalBudget} budget)`).join(', ');
              return {
                notice: {
                  message: `Ad Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['title', 'mediaType', 'budget.total', 'status', 'advertiserId', 'createdAt'],
      },
    },

    // ===== COMMUNITY FEATURES =====
    {
      resource: Debate,
      options: {
        parent: {
          name: "Community Features",
          icon: "Users2"
        },
      },
    },

    {
      resource: Challenge,
      options: {
        parent: {
          name: "Community Features",
          icon: "Trophy"
        },
      },
    },

    {
      resource: Space,
      options: {
        parent: {
          name: "Community Features",
          icon: "Globe"
        },
      },
    },

    // ===== MESSAGING =====
    {
      resource: EnhancedMessage,
      options: {
        parent: {
          name: "Messaging",
          icon: "Mail"
        },
        properties: {
          attachments: { isVisible: { list: false, show: true, edit: false } },
          metadata: { isVisible: { list: false, show: true, edit: false } }
        },
        listProperties: ['sender', 'receiver', 'messageType', 'createdAt'],
        actions: {
          delete: { isVisible: true },
          flagMessage: {
            actionType: "record",
            icon: "Flag",
            label: "Flag Message",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              return {
                record: record.toJSON(),
                notice: {
                  message: `Message has been flagged for review!`,
                  type: 'warning',
                },
              };
            },
          }
        },
      },
    },

    {
      resource: Chat,
      options: {
        parent: {
          name: "Messaging",
          icon: "MessageCircle"
        },
      },
    },

    {
      resource: Message,
      options: {
        parent: {
          name: "Messaging",
          icon: "Send"
        },
      },
    },

    // ===== USER ACTIVITY =====
    {
      resource: Status,
      options: {
        parent: {
          name: "User Activity",
          icon: "Activity"
        },
        listProperties: ['userId', 'content', 'createdAt'],
      },
    },

    // ===== BLOCKCHAIN & CRYPTO =====
    {
      resource: AekoTransaction,
      options: {
        parent: {
          name: "Blockchain & Crypto",
          icon: "Coins"
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          solanaSignature: { isVisible: { list: false, show: true, edit: false } },
          metadata: { isVisible: { list: false, show: true, edit: false } }
        },
        actions: {
          delete: { isVisible: true },
          verifyTransaction: {
            actionType: "record",
            icon: "Check",
            label: "Verify Transaction",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              // Here you could add blockchain verification logic
              return {
                record: record.toJSON(),
                notice: {
                  message: `Transaction ${record.params.transactionId} verified!`,
                  type: 'success',
                },
              };
            },
          },
          transactionStats: {
            actionType: "resource",
            icon: "BarChart",
            label: "Transaction Analytics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await AekoTransaction.aggregate([
                {
                  $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$amount" },
                    totalFees: { $sum: "$platformFee" }
                  }
                }
              ]);
              const message = stats.map(s => `${s._id}: ${s.count} txns (${s.totalAmount} AEKO, ${s.totalFees} fees)`).join(', ');
              return {
                notice: {
                  message: `Transaction Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['transactionId', 'type', 'amount', 'status', 'fromUser', 'toUser', 'createdAt'],
        showProperties: ['transactionId', 'solanaSignature', 'type', 'amount', 'status', 'fromUser', 'toUser', 'platformFee', 'description', 'createdAt'],
        editProperties: ['status', 'description'],
      },
    },

    {
      resource: NFTMarketplace,
      options: {
        parent: {
          name: "Blockchain & Crypto",
          icon: "Image"
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false } },
          tokenId: { isVisible: { list: true, show: true, edit: false } },
          metadataUri: { isVisible: { list: false, show: true, edit: false } },
          'analytics.totalViews': { isVisible: { list: true, show: true, edit: false } },
          'analytics.favoriteCount': { isVisible: { list: true, show: true, edit: false } },
          'auction.currentBid': { isVisible: { list: true, show: true, edit: false } }
        },
        actions: {
          delete: { isVisible: true },
          verifyNFT: {
            actionType: "record",
            icon: "Shield",
            label: "Verify NFT",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ verified: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: `NFT "${record.params.metadata.name}" verified!`,
                  type: 'success',
                },
              };
            },
          },
          featureNFT: {
            actionType: "record",
            icon: "Star",
            label: "Feature NFT",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ featured: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: `NFT "${record.params.metadata.name}" featured!`,
                  type: 'success',
                },
              };
            },
          },
          nftStats: {
            actionType: "resource",
            icon: "TrendingUp",
            label: "NFT Analytics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await NFTMarketplace.getMarketplaceStats();
              const data = stats[0] || {};
              return {
                notice: {
                  message: `NFT Stats: ${data.totalNFTs || 0} NFTs, ${data.totalVolume || 0} AEKO volume, ${data.listedNFTs || 0} listed`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['metadata.name', 'creator', 'currentOwner', 'price', 'status', 'verified', 'createdAt'],
        showProperties: ['tokenId', 'creator', 'currentOwner', 'price', 'isListed', 'verified', 'createdAt'],
        editProperties: ['price', 'isListed', 'verified', 'featured', 'category'],
      },
    },
  ],
  
  // ===== BRANDING & UI CUSTOMIZATION =====
  branding: {
    companyName: "Aeko Platform Admin",
    logo: "/uploads/admin-logo.png",
    softwareBrothers: false,
    favicon: "/uploads/favicon.ico",
    theme: {
      colors: {
        primary100: '#667eea',
        primary80: '#764ba2',
        primary60: '#f093fb',
        primary40: '#4facfe',
        primary20: '#00f2fe',
        grey100: '#151515',
        grey80: '#333333',
        grey60: '#666666',
        grey40: '#999999',
        grey20: '#cccccc',
        filterBg: '#333333',
        accent: '#ff6b6b',
        hoverBg: '#4a5568',
      },
    }
  },
  
  // ===== DASHBOARD CUSTOMIZATION =====
  dashboard: {
    component: false,
  },
  
  // ===== CUSTOM PAGES =====
  pages: {
    analytics: {
      component: false,
      icon: 'Analytics',
    },
    reports: {
      component: false,
      icon: 'FileText',
    }
  },
  
  rootPath: "/admin",
  
  // Login redirect configuration
  loginPath: '/admin/login',
  logoutPath: '/admin/logout',
  
  // ===== LOCALE SETTINGS =====
  locale: {
    language: 'en',
    availableLanguages: ['en'],
    translations: {
      en: {
        labels: {
          loginWelcome: 'Welcome to Aeko Platform Admin',
        },
        actions: {
          banUser: 'Ban User',
          unbanUser: 'Unban User',
          grantBlueTick: 'Grant Blue Tick',
          grantGoldenTick: 'Grant Golden Tick',
          activateSubscription: 'Activate Subscription',
          userStats: 'User Statistics',
          contentStats: 'Content Statistics',
          streamStats: 'Stream Analytics',
          adStats: 'Ad Performance',
          approveAd: 'Approve Ad',
          rejectAd: 'Reject Ad',
          endStream: 'End Stream',
          banStream: 'Ban Stream',
          flagContent: 'Flag as Inappropriate',
          flagMessage: 'Flag Message',
          moderateComment: 'Moderate',
          clearHistory: 'Clear Chat History'
        }
      }
    }
  }
});

// Custom authentication function with error handling
const authenticate = async (email, password) => {
  try {
    console.log('AdminJS Authentication attempt for:', email);
    
    if (!email || !password) {
      console.log('Missing email or password');
      return false;
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return false;
    }

    if (!user.isAdmin) {
      console.log('User is not admin:', email);
      return false;
    }

    const bcrypt = await import('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return false;
    }

    console.log('AdminJS Authentication successful for:', email);
    return { email: user.email, id: user._id, isAdmin: user.isAdmin };
  } catch (error) {
    console.error('AdminJS Authentication error:', error);
    return false;
  }
};

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(admin, {
  authenticate,
  cookieName: 'adminjs',
  cookiePassword: process.env.JWT_SECRET || 'some-secret-password-used-to-secure-cookie',
}, null, {
  resave: false,
  saveUninitialized: true,
  secret: process.env.JWT_SECRET || 'some-secret-password-used-to-secure-cookie',
}, {
  loginPath: '/admin/login',
  logoutPath: '/admin/logout',
  rootPath: '/admin',
});

export { admin, adminRouter };
