// Minimal test endpoint to debug Vercel deployment
export default function handler(req, res) {
  try {
    console.log('Test endpoint called');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('MongoDB URI exists:', !!process.env.MONGO_URI);
    
    res.status(200).json({
      message: 'Test endpoint working!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGO_URI
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      error: 'Test endpoint failed',
      message: error.message
    });
  }
}