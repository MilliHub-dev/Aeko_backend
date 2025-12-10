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

// Swagger setup with dynamic import
const setupSwagger = async () => {
  try {
    const [swaggerUi, swaggerJsdoc] = await Promise.all([
      import('swagger-ui-express'),
      import('swagger-jsdoc')
    ]);

    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Aeko Backend API',
          version: '1.0.0',
          description: 'Social media platform backend API',
        },
        servers: [
          {
            url: isProduction ? process.env.FRONTEND_URL?.replace('3000', '5000') || 'https://your-app.vercel.app' : 'http://localhost:9876',
            description: isProduction ? 'Production server' : 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      apis: ['./routes/*.js', './api/*.js'],
    };

    const swaggerSpec = swaggerJsdoc.default(swaggerOptions);
    
    app.use('/api-docs', swaggerUi.default.serve, swaggerUi.default.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Aeko API Documentation'
    }));
    
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    console.log('✅ Swagger documentation setup complete');
    return true;
  } catch (error) {
    console.error('❌ Swagger setup failed:', error);
    
    // Fallback documentation endpoint
    app.get('/api-docs', (req, res) => {
      res.json({
        message: 'API Documentation',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth/*',
          users: '/api/users/*',
          posts: '/api/posts/*',
          profile: '/api/profile/*',
          explore: '/api/explore/*'
        },
        note: 'Swagger UI temporarily unavailable'
      });
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
            
            <a href="/api/routes" class="link-card">
                <div class="link-title">🛣️ Available Routes</div>
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

app.get('/api', (req, res) => {
  res.json({ 
    name: 'Aeko Backend API',
    description: 'Social Media Platform Backend API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      documentation: '/api-docs',
      health: '/api/health',
      routes: '/api/routes',
      spec: '/api-docs.json'
    },
    features: [
      'User Authentication & Authorization',
      'Social Media Posts & Comments',
      'Real-time Chat & Messaging',
      'File Upload & Media Processing',
      'Interest-based Content Discovery',
      'Profile Management',
      'Payment Integration',
      'Admin Dashboard'
    ]
  });
});

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
      '/api - API information (JSON)',
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