#!/usr/bin/env node

/**
 * Railway Debug Server
 * Minimal server to test Railway deployment and identify issues
 */

import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9876;

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    mongoUri: process.env.MONGO_URI ? 'Set' : 'Not Set',
    jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not Set'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Aeko Backend - Railway Debug Mode',
    status: 'Running',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  });
});

// Database connection test
app.get('/db-test', async (req, res) => {
  try {
    if (!process.env.MONGO_URI) {
      return res.status(500).json({
        error: 'MONGO_URI not set',
        mongoUri: 'undefined'
      });
    }

    // Test database connection
    const connection = await mongoose.connect(process.env.MONGO_URI);
    
    res.json({
      status: 'Database connected successfully',
      database: connection.connection.name,
      host: connection.connection.host,
      port: connection.connection.port,
      readyState: connection.connection.readyState
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database connection failed',
      message: error.message,
      mongoUri: process.env.MONGO_URI ? 'Set but invalid' : 'Not set'
    });
  }
});

// Environment variables check
app.get('/env-check', (req, res) => {
  const requiredVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'NODE_ENV',
    'PORT'
  ];

  const envStatus = {};
  requiredVars.forEach(varName => {
    envStatus[varName] = process.env[varName] ? 'Set' : 'Missing';
  });

  res.json({
    status: 'Environment Variables Check',
    variables: envStatus,
    allSet: requiredVars.every(varName => process.env[varName])
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server with error handling
const startServer = () => {
  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Railway Debug Server Started');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔗 DB Test: http://localhost:${PORT}/db-test`);
      console.log(`🔗 Env Check: http://localhost:${PORT}/env-check`);
      console.log('✅ Server ready for Railway deployment testing');
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server Error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();