import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables
dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Swagger configuration
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
        url: isProduction ? 'https://your-app.vercel.app' : 'http://localhost:9876',
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
  apis: ['./routes/*.js', './api/*.js'], // paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiRateLimit);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Database connection (lazy loading)
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
      // Don't throw - continue without DB for basic functionality
    }
  }
};

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    message: 'Aeko Backend API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    docs: '/api-docs'
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Aeko Backend API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    docs: '/api-docs'
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: boolean
 */
app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbConnected,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: false,
      error: error.message
    });
  }
});

// Lazy load and setup routes
const setupRoutes = async () => {
  try {
    // Import routes dynamically to avoid startup issues
    const routes = await Promise.allSettled([
      import("../routes/auth.js"),
      import("../routes/userRoutes.js"),
      import("../routes/postRoutes.js"),
      import("../routes/profile.js"),
      import("../routes/explore.js"),
      import("../routes/commentRoutes.js"),
      import("../routes/chatRoutes.js"),
      import("../routes/interestRoutes.js"),
      import("../routes/userInterestRoutes.js")
    ]);

    // Setup routes that loaded successfully
    if (routes[0].status === 'fulfilled') {
      app.use("/api/auth", routes[0].value.default);
      console.log('✅ Auth routes loaded');
    }
    
    if (routes[1].status === 'fulfilled') {
      app.use("/api/users", routes[1].value.default);
      console.log('✅ User routes loaded');
    }
    
    if (routes[2].status === 'fulfilled') {
      app.use("/api/posts", routes[2].value.default);
      console.log('✅ Post routes loaded');
    }
    
    if (routes[3].status === 'fulfilled') {
      app.use("/api/profile", routes[3].value.default);
      console.log('✅ Profile routes loaded');
    }
    
    if (routes[4].status === 'fulfilled') {
      app.use("/api/explore", routes[4].value.default);
      console.log('✅ Explore routes loaded');
    }
    
    if (routes[5].status === 'fulfilled') {
      app.use("/api/comments", routes[5].value.default);
      console.log('✅ Comment routes loaded');
    }
    
    if (routes[6].status === 'fulfilled') {
      app.use("/api/chat", routes[6].value.default);
      console.log('✅ Chat routes loaded');
    }
    
    if (routes[7].status === 'fulfilled') {
      app.use("/api/interests", routes[7].value.default);
      console.log('✅ Interest routes loaded');
    }
    
    if (routes[8].status === 'fulfilled') {
      app.use("/api/user/interests", routes[8].value.default);
      console.log('✅ User interest routes loaded');
    }

    return true;
  } catch (error) {
    console.error('Error setting up routes:', error);
    return false;
  }
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
    availableEndpoints: [
      '/api/health',
      '/api/auth/*',
      '/api/users/*',
      '/api/posts/*',
      '/api/profile/*',
      '/api/explore/*',
      '/api-docs'
    ]
  });
});

// Initialize routes once
let routesInitialized = false;

// Vercel serverless function handler
export default async (req, res) => {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Setup routes on first request
    if (!routesInitialized) {
      await setupRoutes();
      routesInitialized = true;
    }
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ 
      error: 'Function initialization failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};