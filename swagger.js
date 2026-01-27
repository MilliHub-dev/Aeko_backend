import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Community documentation is included via the apis configuration below

const swaggerConfig = {
    openapi: "3.0.0",
    info: {
        title: "Aeko Enhanced API",
        version: "2.0.0",
        description: `
# Aeko Backend API Documentation

Welcome to the comprehensive API documentation for Aeko, the **Social Media Platform** featuring advanced real-time communication.

**Aeko** is a next-generation social media platform that merges the best features of short-form video sharing, microblogging, and photo-based networking, enhanced by AI capabilities. It aims to provide a decentralized, immersive, and rewarding experience for content creators and consumers alike.
Aeko combines a rich set of social features, including an enhanced chat system, AI bot personalities, and unique community tools.

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
            url: process.env.NODE_ENV === 'production' 
                ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-app.railway.app'}`
                : `http://localhost:${process.env.PORT || 9876}`,
            description: process.env.NODE_ENV === 'production' ? "Railway Production Server" : "Development Server"
        }
    ],
    tags: [
        { name: "Authentication", description: "User authentication and authorization" },
        { name: "Users", description: "User management operations" },
        { name: "Profile", description: "User profile management" },
        { name: "Posts", description: "Social posts and feeds" },
        { name: "Comments", description: "Comments on posts" },
        { name: "Status", description: "User status and presence" },
        { name: "Debates", description: "Debate and discussion system" },
        { name: "Challenges", description: "Challenge and competition system" },
        { name: "Spaces", description: "Community spaces and groups" },
        { name: "Chat", description: "Enhanced real-time chat and messaging" },
        { name: "Livestream", description: "Enhanced livestream endpoints" },
        { name: "Advertisements", description: "Advertisement management" },
        { name: "Payments", description: "Payment processing and billing" },
        { name: "Subscriptions", description: "Subscription management" },
        { name: "Admin", description: "Admin endpoints and analytics" },

    ],
    'x-tagGroups': [
        {
            name: 'Core',
            tags: ['Authentication', 'Users', 'Profile', 'Status']
        },
        {
            name: 'Social',
            tags: ['Posts', 'Comments', 'Debates', 'Challenges', 'Spaces']
        },
        {
            name: 'Media',
            tags: ['Advertisements', 'Payments', 'Subscriptions']
        },
        {
            name: 'Realtime',
            tags: ['Chat', 'Livestream']
        },

        {
            name: 'Admin & System',
            tags: ['Admin']
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
                    privacy: {
                        type: "object",
                        description: "Privacy settings for the post",
                        properties: {
                            level: {
                                type: "string",
                                enum: ["public", "followers", "select_users", "only_me"],
                                description: "Privacy level of the post",
                                default: "public"
                            },
                            selectedUsers: {
                                type: "array",
                                items: {
                                    type: "string",
                                    description: "User ID"
                                },
                                description: "Array of user IDs for 'select_users' privacy level"
                            },
                            updatedAt: {
                                type: "string",
                                format: "date-time",
                                description: "When privacy settings were last updated"
                            },
                            updateHistory: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        previousLevel: {
                                            type: "string",
                                            description: "Previous privacy level"
                                        },
                                        newLevel: {
                                            type: "string",
                                            description: "New privacy level"
                                        },
                                        updatedAt: {
                                            type: "string",
                                            format: "date-time"
                                        },
                                        updatedBy: {
                                            type: "string",
                                            description: "User ID who made the change"
                                        }
                                    }
                                },
                                description: "Audit trail of privacy changes"
                            }
                        }
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
            Status: {
                type: "object",
                properties: {
                    _id: {
                        type: "string",
                        description: "Status ID"
                    },
                    userId: {
                        $ref: "#/components/schemas/User"
                    },
                    type: {
                        type: "string",
                        enum: ["text", "image", "video", "shared_post"],
                        description: "Status type"
                    },
                    content: {
                        type: "string",
                        description: "Status content (text or media URL)"
                    },
                    reactions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: {
                                    type: "string",
                                    description: "User ID who reacted"
                                },
                                emoji: {
                                    type: "string",
                                    description: "Emoji reaction"
                                }
                            }
                        },
                        description: "User reactions to the status"
                    },
                    sharedPost: {
                        type: "string",
                        description: "ID of the original post (for shared_post type)",
                        nullable: true
                    },
                    originalContent: {
                        type: "object",
                        description: "Preserved content from the original shared post",
                        properties: {
                            text: {
                                type: "string",
                                description: "Original post text"
                            },
                            media: {
                                type: "string",
                                description: "Original post media URL"
                            },
                            type: {
                                type: "string",
                                enum: ["text", "image", "video"],
                                description: "Original post type"
                            },
                            creator: {
                                type: "string",
                                description: "Original post creator ID"
                            },
                            createdAt: {
                                type: "string",
                                format: "date-time",
                                description: "Original post creation date"
                            }
                        }
                    },
                    shareMetadata: {
                        type: "object",
                        description: "Metadata about the sharing action",
                        properties: {
                            sharedAt: {
                                type: "string",
                                format: "date-time",
                                description: "When the post was shared"
                            },
                            sharedBy: {
                                type: "string",
                                description: "User ID who shared the post"
                            }
                        }
                    },
                    expiresAt: {
                        type: "string",
                        format: "date-time",
                        description: "When the status expires (24 hours from creation)"
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
            PhotoEditRequest: {
                type: "object",
                properties: {
                    filter: {
                        type: "string",
                        enum: ["greyscale", "blur", "rotate"],
                        description: "Type of filter to apply to the photo"
                    }
                },
                required: ["filter"]
            },
            PhotoEditResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    url: { type: "string", description: "URL to the edited photo" },
                    error: { type: "string", nullable: true }
                }
            },
            VideoEditRequest: {
                type: "object",
                properties: {
                    effect: {
                        type: "string",
                        enum: ["grayscale", "negate", "blur"],
                        description: "Type of effect to apply to the video"
                    }
                },
                required: ["effect"]
            },
            VideoEditResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    url: { type: "string", description: "URL to the edited video" },
                    error: { type: "string", nullable: true }
                }
            },
            WebRTCSignal: {
                type: "object",
                properties: {
                    target: { type: "string", description: "Socket ID of the target user" },
                    offer: { type: "object", description: "WebRTC offer SDP", nullable: true },
                    answer: { type: "object", description: "WebRTC answer SDP", nullable: true },
                    candidate: { type: "object", description: "ICE candidate", nullable: true }
                }
            }
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ],
    // Community documentation is included via the apis configuration below
    
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
        },
        "/api/photo/edit": {
            post: {
                tags: ["File Upload", "Photo Effects"],
                summary: "Apply a filter to a photo",
                description: "Upload a photo and apply a filter (greyscale, blur, rotate). Returns the URL to the edited photo.",
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    photo: {
                                        type: "string",
                                        format: "binary",
                                        description: "Photo file to upload"
                                    },
                                    filter: {
                                        type: "string",
                                        enum: ["greyscale", "blur", "rotate"],
                                        description: "Type of filter to apply"
                                    }
                                },
                                required: ["photo", "filter"]
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: "Edited photo URL",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PhotoEditResponse" }
                            }
                        }
                    },
                    500: {
                        description: "Error editing photo",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PhotoEditResponse" }
                            }
                        }
                    }
                }
            }
        },
        "/api/video/edit": {
            post: {
                tags: ["File Upload", "Video Effects"],
                summary: "Apply an effect to a video",
                description: "Upload a video and apply an effect (grayscale, negate, blur). Returns the URL to the edited video.",
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    video: {
                                        type: "string",
                                        format: "binary",
                                        description: "Video file to upload"
                                    },
                                    effect: {
                                        type: "string",
                                        enum: ["grayscale", "negate", "blur"],
                                        description: "Type of effect to apply"
                                    }
                                },
                                required: ["video", "effect"]
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: "Edited video URL",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/VideoEditResponse" }
                            }
                        }
                    },
                    500: {
                        description: "Error editing video",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/VideoEditResponse" }
                            }
                        }
                    }
                }
            }
        },
        "/socket.io/webrtc-signaling": {
            post: {
                tags: ["WebRTC Calls"],
                summary: "WebRTC signaling event (socket.io)",
                description: `
                    Use socket.io to emit and listen for the following events for video/voice calls:
                    - call-offer: Send a WebRTC offer to another user
                    - call-answer: Send a WebRTC answer in response to an offer
                    - ice-candidate: Exchange ICE candidates for peer connection
                    \n\n
                    Example socket.io payloads:
                    - call-offer: { target: '<socketId>', offer: { ...SDP } }
                    - call-answer: { target: '<socketId>', answer: { ...SDP } }
                    - ice-candidate: { target: '<socketId>', candidate: { ...ICE } }
                `,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/WebRTCSignal" }
                        }
                    }
                },
                responses: {
                    200: {
                        description: "Signal relayed successfully (socket.io emits to target)",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { success: { type: "boolean" } } }
                            }
                        }
                    }
                }
            }
        },
        "/websocket": {
            get: {
                tags: ["WebRTC Calls", "Enhanced Chat", "System"],
                summary: "WebSocket (Socket.IO) API Documentation",
                description: `
Connect to the WebSocket server for real-time features (chat, video/voice calls, notifications, etc.).

**WebSocket URL:**
- ws://localhost:5000 (Socket.IO)

**Authentication:**
- Pass JWT token as a query parameter or in the connection payload:
  - Example: io('ws://localhost:5000', { query: { token: '<JWT>' } })

**Key Events:**
- **Chat:**
  - send-message: { chatId, content }
  - receive-message: { chatId, sender, content, timestamp }
- **Video/Voice Calls:**
  - call-offer: { target, offer }
  - call-answer: { target, answer }
  - ice-candidate: { target, candidate }
- **Presence:**
  - user-online: { userId }
  - user-offline: { userId }

**Example Connection (JS):**
\`\`\`js
const socket = io('ws://localhost:5000', { query: { token: '<JWT>' } });
socket.on('receive-message', (msg) => { ... });
socket.emit('send-message', { chatId, content });
\`\`\`


**See /api-docs for full event and payload details.**
                `,
                responses: {
                    200: {
                        description: "WebSocket documentation page (Markdown)",
                        content: {
                            "text/markdown": {
                                schema: { type: "string" }
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
    apis: ["./routes/*.js", "./docs/*.js"], // Include route files and documentation files
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
    
    const port = process.env.PORT || 9876;
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-app.railway.app'}` 
        : `http://localhost:${port}`;
    
    console.log(`📚 Swagger UI available at: ${baseUrl}/api-docs`);
    console.log(`📄 API Spec JSON at: ${baseUrl}/api-docs.json`);
};

export default setupSwagger;
