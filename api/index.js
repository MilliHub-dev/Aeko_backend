import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Load environment variables first
dotenv.config();

// Conditional imports to avoid heavy dependencies in serverless
let connectDB, authRoutes, userRoutes, postRoutes, profileRoutes, exploreRoutes;

const loadDependencies = async () => {
  try {
    const [dbModule, authModule, userModule, postModule, profileModule, exploreModule] = await Promise.all([
      import("../config/db.js"),
      import("../routes/auth.js").catch(() => null),
      import("../routes/userRoutes.js").catch(() => null),
      import("../routes/postRoutes.js").catch(() => null),
      import("../routes/profile.js").catch(() => null),
      import("../routes/explore.js").catch(() => null)
    ]);
    
    connectDB = dbModule.default;
    authRoutes = authModule?.default;
    userRoutes = userModule?.default;
    postRoutes = postModule?.default;
    profileRoutes = profileModule?.default;
    exploreRoutes = exploreModule?.default;
    
    return true;
  } catch (error) {
    console.error('Failed to load dependencies:', error);
    return false;
  }
};

const app = express();

// Configuration
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiRateLimit);

// Connect to database
let dbConnected = false;
const connectToDatabase = async () => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Aeko Backend API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Aeko Backend API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API Routes (conditionally loaded)
const setupRoutes = () => {
  if (authRoutes) app.use("/api/auth", authRoutes);
  if (userRoutes) app.use("/api/users", userRoutes);
  if (postRoutes) app.use("/api/posts", postRoutes);
  if (profileRoutes) app.use("/api/profile", profileRoutes);
  if (exploreRoutes) app.use("/api/explore", exploreRoutes);
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: isProduction ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Vercel serverless function handler
export default async (req, res) => {
  try {
    // Load dependencies
    const dependenciesLoaded = await loadDependencies();
    
    if (!dependenciesLoaded) {
      return res.status(500).json({ 
        error: 'Failed to load dependencies',
        message: 'Some modules could not be imported'
      });
    }
    
    // Connect to database on each request (serverless)
    if (connectDB) {
      await connectToDatabase();
    }
    
    // Setup routes
    setupRoutes();
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ 
      error: 'Function initialization failed',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};