// JWT Secret Generator for Aeko Backend
// Run this script to generate a secure JWT secret

import crypto from 'crypto';

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('🔐 Generated JWT Secret for Aeko Backend:');
console.log('');
console.log('JWT_SECRET=' + jwtSecret);
console.log('');
console.log('Copy the line above and add it to your .env file');
console.log('');
console.log('Your .env file should contain:');
console.log('PORT=5000');
console.log('MONGO_URI=mongodb://localhost:27017/aeko_db');
console.log('JWT_SECRET=' + jwtSecret);
console.log('CONTRACT_ADDRESS=0x7216778551085922af4Ae96d5c92B2B2bc9AFf7b');
console.log('PRIVATE_KEY=39949a0707c3cb13e98156f9d1fab2758bf7c1a5672ed124791fc79b63b9e190');
console.log('POLYGON_ZKEVM_RPC=sepolia.infura.io:11155111');
console.log('PINATA_API_KEY=f5ecb8197361f204dc77');
console.log('PINATA_SECRET=855fdb1249d94075b8d8e60ca1f48cd38ffbdc396f71a60354e448e17ccacb04');
console.log('EMAIL_USER=info.millihub@gmail.com');
console.log('EMAIL_PASS=08120889843Ek');
console.log('FRONTEND_URL=http://localhost:3000');
console.log('FLW_PUBLIC_KEY=FLW_PUBLIC_KEY');
console.log('FLW_SECRET_KEY=FLW_SECRET_KEY');
console.log('OPENAI_API_KEY=your_openai_api_key');
console.log('');
console.log('After updating .env, restart your server with: npm start');
