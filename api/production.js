import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// Load environment variables
dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:9876'],
  credentials: true
}));

// Body parsing middleware
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiRateLimit);

// Swagger setup with inline specification
const setupSwagger = async () => {
  try {
    console.log('🔄 Setting up Swagger documentation...');
    const swaggerUi = await import('swagger-ui-express');
    console.log('✅ Swagger UI imported successfully');

    // Define comprehensive API specification inline
    const swaggerSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Aeko Backend API',
        version: '1.0.0',
        description: `
# Aeko Social Media Platform API

A comprehensive backend API for a modern social media platform with blockchain integration.

## Features
- 🔐 JWT Authentication with Google OAuth
- 👥 User Management & Profiles
- 📝 Posts, Comments & Social Interactions
- 💬 Real-time Chat & Messaging
- 🎥 Live Streaming Support
- 🖼️ Media Upload via Cloudinary
- 🔗 Blockchain Integration (Solana)
- 💳 Payment Processing
- 🎯 Interest-based Content Discovery
- 🛡️ Privacy Controls & Blocking
- 📊 Admin Dashboard

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`
        `,
        contact: {
          name: 'Aeko API Support',
          email: 'support@aeko.com'
        },
        license: {
          name: 'ISC',
          url: 'https://opensource.org/licenses/ISC'
        }
      },
      servers: [
        {
          url: isProduction ? 'https://aeko-backend1.vercel.app' : 'http://localhost:9876',
          description: isProduction ? 'Production Server' : 'Development Server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your JWT token'
          }
        },
        schemas: {
          User: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              username: { type: 'string', example: 'johndoe' },
              email: { type: 'string', format: 'email', example: 'john@example.com' },
              name: { type: 'string', example: 'John Doe' },
              profilePicture: { type: 'string', example: 'https://cloudinary.com/image.jpg' },
              bio: { type: 'string', example: 'Software developer and crypto enthusiast' },
              blueTick: { type: 'boolean', example: false },
              goldenTick: { type: 'boolean', example: false },
              followers: { type: 'array', items: { type: 'string' } },
              following: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Post: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              content: { type: 'string', example: 'This is my first post!' },
              media: { type: 'string', example: 'https://cloudinary.com/image.jpg' },
              user: { $ref: '#/components/schemas/User' },
              likes: { type: 'array', items: { type: 'string' } },
              comments: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string', example: 'Error message' },
              message: { type: 'string', example: 'Detailed error description' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      paths: {
        '/api/health': {
          get: {
            tags: ['System'],
            summary: 'Health check endpoint',
            description: 'Returns the current health status of the API and database connection',
            responses: {
              200: {
                description: 'API is healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'healthy' },
                        database: { type: 'boolean', example: true },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number', example: 12345.67 },
                        memory: {
                          type: 'object',
                          properties: {
                            used: { type: 'string', example: '45 MB' },
                            total: { type: 'string', example: '128 MB' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/auth/signup': {
          post: {
            tags: ['Authentication'],
            summary: 'User registration',
            description: 'Register a new user account with email verification',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['username', 'email', 'password'],
                    properties: {
                      username: { type: 'string', example: 'johndoe' },
                      email: { type: 'string', format: 'email', example: 'john@example.com' },
                      password: { type: 'string', minLength: 6, example: 'password123' },
                      name: { type: 'string', example: 'John Doe' }
                    }
                  }
                }
              }
            },
            responses: {
              201: {
                description: 'User registered successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'User registered successfully' },
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              },
              400: { description: 'Bad request - validation errors' },
              409: { description: 'User already exists' }
            }
          }
        },
        '/api/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: 'User login',
            description: 'Authenticate user and return JWT token',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                      email: { type: 'string', format: 'email', example: 'john@example.com' },
                      password: { type: 'string', example: 'password123' }
                    }
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Login successful',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              },
              401: { description: 'Invalid credentials' }
            }
          }
        },
        '/api/users': {
          get: {
            tags: ['Users'],
            summary: 'Get all users',
            description: 'Retrieve a paginated list of users',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'page',
                in: 'query',
                schema: { type: 'integer', minimum: 1, default: 1 },
                description: 'Page number'
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                description: 'Number of users per page'
              },
              {
                name: 'search',
                in: 'query',
                schema: { type: 'string' },
                description: 'Search users by name or username'
              }
            ],
            responses: {
              200: {
                description: 'Users retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        users: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/User' }
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            currentPage: { type: 'integer', example: 1 },
                            totalPages: { type: 'integer', example: 5 },
                            totalUsers: { type: 'integer', example: 100 },
                            hasNext: { type: 'boolean', example: true },
                            hasPrev: { type: 'boolean', example: false }
                          }
                        }
                      }
                    }
                  }
                }
              },
              401: { description: 'Unauthorized' }
            }
          }
        },
        '/api/users/{id}': {
          get: {
            tags: ['Users'],
            summary: 'Get user by ID',
            description: 'Retrieve a specific user by their ID',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'User ID',
                example: '507f1f77bcf86cd799439011'
              }
            ],
            responses: {
              200: {
                description: 'User retrieved successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' }
                  }
                }
              },
              404: { description: 'User not found' },
              403: { description: 'Access denied - privacy settings' }
            }
          }
        },
        '/api/posts': {
          get: {
            tags: ['Posts'],
            summary: 'Get all posts',
            description: 'Retrieve a feed of posts with pagination',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'page',
                in: 'query',
                schema: { type: 'integer', minimum: 1, default: 1 }
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
              }
            ],
            responses: {
              200: {
                description: 'Posts retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        posts: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Post' }
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            currentPage: { type: 'integer' },
                            totalPages: { type: 'integer' },
                            totalPosts: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            tags: ['Posts'],
            summary: 'Create a new post',
            description: 'Create a new post with optional media upload',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      content: { type: 'string', example: 'This is my new post!' },
                      media: { type: 'string', format: 'binary', description: 'Image or video file' },
                      privacy: {
                        type: 'string',
                        enum: ['public', 'followers', 'only_me', 'select_users'],
                        default: 'public'
                      }
                    }
                  }
                }
              }
            },
            responses: {
              201: {
                description: 'Post created successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Post' }
                  }
                }
              },
              400: { description: 'Bad request' },
              401: { description: 'Unauthorized' }
            }
          }
        }
      },
      tags: [
        { name: 'System', description: 'System health and status endpoints' },
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Users', description: 'User management and profiles' },
        { name: 'Posts', description: 'Social media posts and content' },
        { name: 'Comments', description: 'Post comments and interactions' },
        { name: 'Chat', description: 'Real-time messaging' },
        { name: 'Profile', description: 'User profile management' },
        { name: 'Explore', description: 'Content discovery' }
      ]
    };
    
    console.log('🔄 Setting up Swagger routes...');
    
    // Simple, reliable Swagger UI setup
    app.use('/api-docs', swaggerUi.default.serve);
    app.get('/api-docs', swaggerUi.default.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Aeko API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list'
      }
    }));
    
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.json(swaggerSpec);
    });

    // Add a test route to verify setup
    app.get('/api/swagger-test', (req, res) => {
      res.json({
        message: 'Swagger setup is working!',
        swaggerUI: '/api-docs',
        apiSpec: '/api-docs.json',
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ Swagger documentation setup complete');
    console.log('📚 Swagger UI available at /api-docs');
    console.log('📄 API spec available at /api-docs.json');
    return true;
  } catch (error) {
    console.error('❌ Swagger setup failed:', error);
    console.error('Error details:', error.stack);
    
    // Fallback documentation endpoint
    app.get('/api-docs', (req, res) => {
      res.send(`
        <html>
          <head><title>API Documentation</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #667eea;">🚀 Aeko API Documentation</h1>
              <p>Swagger UI is temporarily unavailable. Here are the available endpoints:</p>
              <ul style="line-height: 2;">
                <li><strong>GET /api/health</strong> - Health check</li>
                <li><strong>POST /api/auth/signup</strong> - User registration</li>
                <li><strong>POST /api/auth/login</strong> - User login</li>
                <li><strong>GET /api/users</strong> - Get all users</li>
                <li><strong>GET /api/users/{id}</strong> - Get user by ID</li>
                <li><strong>GET /api/posts</strong> - Get all posts</li>
                <li><strong>POST /api/posts</strong> - Create new post</li>
              </ul>
              <p><a href="/api-docs.json" style="color: #667eea;">View Raw API Specification (JSON)</a></p>
            </div>
          </body>
        </html>
      `);
    });
    
    return false;
  }
};

// Database connection
let dbConnected = false;
const connectToDatabase = async () => {
  if (!dbConnected && process.env.MONGO_URI) {
    try {
      const { default: connectDB } = await import("../config/db.js");
      await connectDB();
      dbConnected = true;
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }
};

// Landing page
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aeko Backend API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 3rem;
            max-width: 600px;
            width: 90%;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c);
        }
        
        .logo {
            font-size: 3rem;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 1rem;
        }
        
        .subtitle {
            color: #666;
            font-size: 1.2rem;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        
        .status {
            display: inline-flex;
            align-items: center;
            background: #e8f5e8;
            color: #2d5a2d;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-weight: 500;
            margin-bottom: 2rem;
            border: 2px solid #c3e6c3;
        }
        
        .status::before {
            content: '●';
            color: #4caf50;
            margin-right: 0.5rem;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .link-card {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 1.5rem;
            text-decoration: none;
            color: #333;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .link-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            border-color: #667eea;
        }
        
        .link-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }
        
        .link-card:hover::before {
            transform: scaleX(1);
        }
        
        .link-title {
            font-weight: 600;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
            color: #333;
        }
        
        .link-desc {
            color: #666;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #e9ecef;
        }
        
        .info-item {
            text-align: center;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
        }
        
        .info-value {
            font-weight: 600;
            color: #333;
            font-size: 1rem;
        }
        
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 2rem;
                margin: 1rem;
            }
            
            .logo {
                font-size: 2.5rem;
            }
            
            .links {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀 AEKO</div>
        <div class="subtitle">
            Social Media Platform Backend API<br>
            Powering the next generation of social interactions
        </div>
        
        <div class="status">
            API Status: Online & Ready
        </div>
        
        <div class="links">
            <a href="/api-docs" class="link-card">
                <div class="link-title">📚 API Documentation</div>
                <div class="link-desc">Interactive Swagger UI with all endpoints and examples</div>
            </a>
            
            <a href="/api/health" class="link-card">
                <div class="link-title">💚 Health Check</div>
                <div class="link-desc">Real-time API and database status monitoring</div>
            </a>
            
            <a href="/api/info" class="link-card">
                <div class="link-title">ℹ️ Project Info</div>
                <div class="link-desc">Detailed information about features and technology stack</div>
            </a>
            
            <a href="/api/routes" class="link-card">
                <div class="link-title">�️ Availa ble Routes</div>
                <div class="link-desc">List of all loaded API endpoints and services</div>
            </a>
            
            <a href="/api-docs.json" class="link-card">
                <div class="link-title">📄 OpenAPI Spec</div>
                <div class="link-desc">Raw JSON specification for API integration</div>
            </a>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Environment</div>
                <div class="info-value">${process.env.NODE_ENV || 'development'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Version</div>
                <div class="info-value">1.0.0</div>
            </div>
            <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">🟢 Online</div>
            </div>
            <div class="info-item">
                <div class="info-label">Last Updated</div>
                <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
        </div>
        
        <div class="footer">
            <strong>Aeko Backend API</strong> - Built with Express.js, MongoDB, and ❤️<br>
            <small>Deployed on Vercel • ${new Date().toISOString()}</small>
        </div>
    </div>
</body>
</html>`;
  
  res.send(html);
});

// Removed /api endpoint to avoid confusion - use /api-docs for documentation

app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbConnected,
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      services: {
        database: dbConnected ? '🟢 Connected' : '🔴 Disconnected',
        api: '🟢 Online',
        documentation: '🟢 Available'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: false,
      error: error.message,
      services: {
        database: '🔴 Error',
        api: '🟡 Degraded',
        documentation: '🟢 Available'
      }
    });
  }
});

// Project info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    project: {
      name: 'Aeko',
      description: 'Next-generation social media platform with blockchain integration',
      version: '1.0.0',
      author: 'Aeko Team',
      license: 'ISC'
    },
    features: {
      authentication: {
        description: 'JWT-based auth with Google OAuth integration',
        endpoints: ['/api/auth/signup', '/api/auth/login', '/api/auth/google']
      },
      social: {
        description: 'Posts, comments, likes, and social interactions',
        endpoints: ['/api/posts', '/api/comments', '/api/users']
      },
      realtime: {
        description: 'Real-time chat and live streaming',
        endpoints: ['/api/chat', '/api/livestream']
      },
      blockchain: {
        description: 'Solana integration for NFTs and tokens',
        endpoints: ['/api/nft', '/api/aeko']
      },
      payments: {
        description: 'Multiple payment gateways integration',
        endpoints: ['/api/payments', '/api/subscription']
      }
    },
    technology: {
      backend: 'Node.js + Express.js',
      database: 'MongoDB Atlas',
      authentication: 'JWT + Passport.js',
      fileStorage: 'Cloudinary',
      blockchain: 'Solana Web3.js',
      deployment: 'Vercel Serverless',
      documentation: 'Swagger/OpenAPI 3.0'
    },
    links: {
      documentation: '/api-docs',
      health: '/api/health',
      routes: '/api/routes'
    }
  });
});

// Route setup with error handling
const setupRoutes = async () => {
  const routeConfigs = [
    { path: "/api/auth", file: "../routes/auth.js", name: "Auth" },
    { path: "/api/users", file: "../routes/userRoutes.js", name: "Users" },
    { path: "/api/posts", file: "../routes/postRoutes.js", name: "Posts" },
    { path: "/api/profile", file: "../routes/profile.js", name: "Profile" },
    { path: "/api/explore", file: "../routes/explore.js", name: "Explore" },
    { path: "/api/comments", file: "../routes/commentRoutes.js", name: "Comments" },
    { path: "/api/interests", file: "../routes/interestRoutes.js", name: "Interests" },
    { path: "/api/user/interests", file: "../routes/userInterestRoutes.js", name: "User Interests" }
  ];

  const loadedRoutes = [];
  
  for (const config of routeConfigs) {
    try {
      const routeModule = await import(config.file);
      if (routeModule.default) {
        app.use(config.path, routeModule.default);
        loadedRoutes.push(config.name);
        console.log(`✅ ${config.name} routes loaded`);
      }
    } catch (error) {
      console.error(`❌ Failed to load ${config.name} routes:`, error.message);
    }
  }

  // Add a route to show loaded routes
  app.get('/api/routes', (req, res) => {
    res.json({
      message: 'Available routes',
      loaded: loadedRoutes,
      timestamp: new Date().toISOString()
    });
  });

  return loadedRoutes.length > 0;
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: isProduction ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    message: 'The requested endpoint does not exist',
    suggestion: 'Visit the root URL (/) for the API landing page with all available links',
    availableEndpoints: [
      '/ - Beautiful API landing page',
      '/api/info - Project details and features',
      '/api/health - Health check with system status',
      '/api/routes - Available routes',
      '/api-docs - Interactive API documentation',
      '/api-docs.json - OpenAPI specification',
      '/api/auth/* - Authentication endpoints',
      '/api/users/* - User management',
      '/api/posts/* - Post management',
      '/api/profile/* - Profile management',
      '/api/explore/* - Explore content'
    ],
    timestamp: new Date().toISOString()
  });
});

// Initialize everything
let initialized = false;

// Vercel serverless function handler
export default async (req, res) => {
  try {
    if (!initialized) {
      console.log('🚀 Initializing Aeko Backend API...');
      
      // Setup in parallel
      const [dbResult, swaggerResult, routesResult] = await Promise.allSettled([
        connectToDatabase(),
        setupSwagger(),
        setupRoutes()
      ]);

      console.log('📊 Initialization Results:');
      console.log(`   Database: ${dbResult.status === 'fulfilled' ? '✅' : '❌'}`);
      console.log(`   Swagger: ${swaggerResult.status === 'fulfilled' && swaggerResult.value ? '✅' : '❌'}`);
      console.log(`   Routes: ${routesResult.status === 'fulfilled' && routesResult.value ? '✅' : '❌'}`);
      
      initialized = true;
      console.log('✨ Initialization complete!');
    }
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('💥 Function initialization failed:', error);
    return res.status(500).json({ 
      error: 'Function initialization failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};