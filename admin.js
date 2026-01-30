import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import express from "express";
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const dmmf = Prisma.dmmf;
const modelMap = dmmf.datamodel.models.reduce((acc, model) => {
    acc[model.name] = model;
    return acc;
}, {});

AdminJS.registerAdapter({ Database, Resource });

const admin = new AdminJS({
  resources: [
    // ===== COMMUNITY MANAGEMENT =====
    {
      resource: { model: modelMap.Community, client: prisma },
      options: {
        parent: {
          name: 'Community Management',
          icon: 'Users'
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
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
    {
      resource: { model: modelMap.Transaction, client: prisma },
      options: {
        parent: {
          name: 'Community Management',
          icon: 'CreditCard'
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } }
        }
      }
    },
    // ===== INTEREST MANAGEMENT =====
    {
      resource: { model: modelMap.Interest, client: prisma },
      options: {
        parent: {
          name: 'Content Management',
          icon: 'Tag'
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
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
      resource: { model: modelMap.User, client: prisma },
      options: {
        parent: {
          name: "User Management",
          icon: "Users"
        },
        properties: {
          password: { isVisible: false },
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
          followers: { isVisible: { list: false, show: true, edit: false } },
          following: { isVisible: { list: false, show: true, edit: false } },
          posts: { isVisible: { list: false, show: true, edit: false } },
          botResponses: { isVisible: { list: false, show: true, edit: true } }
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          banUser: {
            actionType: "record",
            icon: "Ban",
            label: "Ban User",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { banned: true }
              });
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
              await prisma.user.update({
                where: { id: record.params.id },
                data: { banned: false }
              });
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
              await prisma.user.update({
                where: { id: record.params.id },
                data: { blueTick: true }
              });
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
              await prisma.user.update({
                where: { id: record.params.id },
                data: { goldenTick: true }
              });
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
              await prisma.user.update({
                where: { id: record.params.id },
                data: { 
                  subscriptionStatus: 'active',
                  subscriptionExpiry: oneMonthFromNow
                }
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
              const totalUsers = await prisma.user.count();
              const verifiedUsers = await prisma.user.count({ where: { OR: [{ blueTick: true }, { goldenTick: true }] } });
              const activeSubscriptions = await prisma.user.count({ where: { subscriptionStatus: 'active' } });
              const botEnabledUsers = await prisma.user.count({ where: { botEnabled: true } });
              
              return {
                notice: {
                  message: `Total Users: ${totalUsers}, Verified: ${verifiedUsers}, Active Subscriptions: ${activeSubscriptions}, Bot Enabled: ${botEnabledUsers}`,
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
      resource: { model: modelMap.Post, client: prisma },
      options: {
        parent: {
          name: "Content Management",
          icon: "FileText"
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
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
              // Implementation placeholder
              return {
                record: context.record.toJSON(),
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
              const stats = await prisma.post.groupBy({
                by: ['type'],
                _count: { _all: true }
              });
              const message = stats.map(s => `${s.type}: ${s._count._all} posts`).join(', ');
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
      resource: { model: modelMap.Comment, client: prisma },
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
              return {
                record: context.record.toJSON(),
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
      resource: { model: modelMap.LiveStream, client: prisma },
      options: {
        parent: {
          name: "LiveStream Management",
          icon: "Video"
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
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
              await prisma.liveStream.update({
                where: { id: record.params.id },
                data: { 
                  status: 'ended',
                  endedAt: new Date()
                }
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
              await prisma.liveStream.update({
                where: { id: record.params.id },
                data: { 
                  status: 'ended',
                  endedAt: new Date()
                }
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
              const stats = await prisma.liveStream.groupBy({
                by: ['status'],
                _count: { _all: true },
                _sum: { totalViews: true }
              });
              const message = stats.map(s => `${s.status}: ${s._count._all} streams (${s._sum.totalViews || 0} views)`).join(', ');
              return {
                notice: {
                  message: `Stream Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['title', 'user', 'status', 'category', 'currentViewers', 'totalViews', 'createdAt'],
        showProperties: ['title', 'description', 'user', 'status', 'category', 'currentViewers', 'peakViewers', 'totalViews', 'createdAt'],
        editProperties: ['title', 'description', 'status', 'category'],
      },
    },

    // ===== AI & BOT MANAGEMENT =====
    {
      resource: { model: modelMap.BotSettings, client: prisma },
      options: {
        parent: {
          name: "AI & Bot Management",
          icon: "Bot"
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['user', 'botEnabled', 'botPersonality', 'aiProvider'],
        showProperties: ['user', 'botEnabled', 'botPersonality', 'aiProvider', 'model', 'maxTokens', 'temperature', 'customInstructions'],
        editProperties: ['botEnabled', 'botPersonality', 'aiProvider', 'model', 'maxTokens', 'temperature', 'customInstructions'],
      },
    },

    {
      resource: { model: modelMap.BotConversation, client: prisma },
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
              await prisma.botConversation.update({
                where: { id: record.params.id },
                data: { 
                  messages: [],
                  totalMessages: 0
                }
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
      resource: { model: modelMap.Ad, client: prisma },
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
              await prisma.ad.update({
                where: { id: record.params.id },
                data: { status: 'approved' }
              });
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
              await prisma.ad.update({
                where: { id: record.params.id },
                data: { status: 'rejected' }
              });
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
              const stats = await prisma.ad.groupBy({
                by: ['status'],
                _count: { _all: true }
              });
              const message = stats.map(s => `${s.status}: ${s._count._all} ads`).join(', ');
              return {
                notice: {
                  message: `Ad Stats: ${message}`,
                  type: 'info',
                },
              };
            },
          }
        },
        listProperties: ['title', 'mediaType', 'Status', 'user', 'createdAt'],
      },
    },

    // ===== COMMUNITY FEATURES =====
    {
      resource: { model: modelMap.Debate, client: prisma },
      options: {
        parent: {
          name: "Community Features",
          icon: "Users2"
        },
      },
    },

    {
      resource: { model: modelMap.Challenge, client: prisma },
      options: {
        parent: {
          name: "Community Features",
          icon: "Trophy"
        },
      },
    },

    {
      resource: { model: modelMap.Space, client: prisma },
      options: {
        parent: {
          name: "Community Features",
          icon: "Globe"
        },
      },
    },

    // ===== MESSAGING =====
    {
      resource: { model: modelMap.EnhancedMessage, client: prisma },
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
              return {
                record: context.record.toJSON(),
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
      resource: { model: modelMap.Chat, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "MessageCircle"
        },
      },
    },

    {
      resource: { model: modelMap.Message, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "Send"
        },
      },
    },

    // ===== USER ACTIVITY =====
    {
      resource: { model: modelMap.Status, client: prisma },
      options: {
        parent: {
          name: "User Activity",
          icon: "Activity"
        },
        listProperties: ['users', 'content', 'createdAt'],
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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found:', email);
      return false;
    }

    if (!user.isAdmin) {
      console.log('User is not admin:', email);
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return false;
    }

    return user;
  } catch (error) {
    console.error('AdminJS Authentication Error:', error);
    return false;
  }
};

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate,
    cookieName: 'adminjs',
    cookiePassword: 'some-secret-password-used-to-secure-cookie',
  },
  null,
  {
    resave: false,
    saveUninitialized: true,
  }
);

export { admin, adminRouter };
