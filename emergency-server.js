const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting emergency server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Emergency Aeko Server - Working!',
    status: 'OK',
    port: PORT,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    port: PORT
  });
});

app.get('/env-check', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV || 'not set',
    PORT: PORT,
    MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Not set',
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Emergency server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Env check: http://localhost:${PORT}/env-check`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});