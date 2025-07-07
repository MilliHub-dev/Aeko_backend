import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerConfig = {
    openapi: "3.0.0",
    info: {
        title: "Aeko Enhanced API",
        version: "2.0.0",
        description: `
# Aeko Backend API Documentation

Welcome to the comprehensive API documentation for Aeko, featuring an **Enhanced Real-Time Chat System** with advanced capabilities.

## 🚀 Features

### Enhanced Chat System
- **Real-time messaging** with Socket.IO
- **Voice messages** with audio recording
- **Emoji reactions** and advanced emoji support
- **AI Bot integration** with 7 personalities
- **File sharing** (images, videos, documents, audio)
- **Typing indicators** and presence management
- **Read receipts** and message status tracking
- **Message search** and conversation history
- **Group chats** and advanced chat management

### AI Bot Personalities
1. **Friendly** 😊 - Warm and approachable
2. **Professional** 💼 - Business-oriented and formal
3. **Sarcastic** 😏 - Witty with dry humor
4. **Creative** 🎨 - Imaginative and artistic
5. **Analytical** 📊 - Data-driven and logical
6. **Mentor** 🧙 - Educational and supportive
7. **Companion** 🤝 - Empathetic and understanding

### Core Features
- **User management** and authentication
- **Social media features** (posts, comments, likes)
- **Advertisement system**
- **Payment processing**
- **Subscription management**
- **Challenge and debate systems**
- **Space/community features**

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
