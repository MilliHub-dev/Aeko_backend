import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());

// Simple health check
app.get('/', (req, res) => {
  res.json({
    message: 'Aeko Backend API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'API endpoint working!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Simple auth test endpoint
app.get('/api/auth/test', (req, res) => {
  res.json({
    message: 'Auth endpoint test successful',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

export default app;