import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9876;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Aeko Backend - Minimal Test',
    status: 'OK',
    port: PORT,
    env: process.env.NODE_ENV
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    mongoUri: process.env.MONGO_URI ? 'Set' : 'Not Set'
  });
});

app.get('/db-test', async (req, res) => {
  try {
    if (!process.env.MONGO_URI) {
      return res.status(400).json({ error: 'MONGO_URI not set' });
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    res.json({ status: 'Database connected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/health`);
});