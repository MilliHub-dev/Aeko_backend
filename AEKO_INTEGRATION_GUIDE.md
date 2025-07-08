# 🚀 Aeko Blockchain & Coin Integration Guide

## 🛠️ **Issue Fixed: Import Error Resolution**

### **Problem Solved**
The initial error was caused by incompatible ES module imports from CommonJS packages:

```bash
SyntaxError: Named export 'PROGRAM_ID' not found
```

### **Solution Applied**
Updated imports in `utils/solanaBlockchain.js`:

```javascript
// ❌ Before (Broken)
import { 
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID
} from '@metaplex-foundation/mpl-token-metadata';

// ✅ After (Fixed)
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { 
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID 
} = pkg;
```

---

## 🎯 **Quick Start Guide**

### **1. Environment Setup**

Create a `.env` file with the following variables:

```env
# Required Environment Variables
NODE_ENV=development
PORT=5000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/aeko_db

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_base58_encoded_private_key

# Email Configuration (Optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Flutterwave Payment (Optional)
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
```

### **2. Install Dependencies**

```bash
# Install all required packages
npm install

# Key blockchain packages
npm install @solana/web3.js@^1.95.0
npm install @solana/spl-token@^0.4.6
npm install @metaplex-foundation/mpl-token-metadata@^3.2.1
npm install bs58
```

### **3. Start the Server**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

✅ **Server should start successfully on port 5000**

---

## 🪙 **Aeko Coin Integration**

### **Token Specifications**
- **Name**: Aeko Coin
- **Symbol**: AEKO
- **Decimals**: 9 (like SOL)
- **Initial Supply**: 1,000,000,000 AEKO
- **Network**: Solana (Devnet/Mainnet)
- **Standard**: SPL Token

### **Core Features**
✅ Wallet connection (Phantom, Solflare)
✅ Balance tracking
✅ User-to-user transfers
✅ Stream donations
✅ Giveaway system
✅ NFT marketplace transactions

### **API Endpoints**

#### **Get User Balance**
```http
GET /api/aeko/balance
Authorization: Bearer <JWT_TOKEN>
```

#### **Connect Wallet**
```http
POST /api/aeko/connect-wallet
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "walletAddress": "11111111111111111111111111111112"
}
```

#### **Transfer Aeko Coins**
```http
POST /api/aeko/transfer
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "toUserId": "user_id_here",
  "amount": 100,
  "privateKey": "base58_private_key",
  "description": "Payment for services"
}
```

#### **Conduct Giveaway**
```http
POST /api/aeko/giveaway
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "recipients": ["user1_id", "user2_id"],
  "amountPerRecipient": 50,
  "privateKey": "base58_private_key",
  "description": "Community giveaway"
}
```

---

## 🎨 **NFT Marketplace Integration**

### **NFT Requirements**
To mint a post as NFT:
- ✅ Post must have **200,000+ views**
- ✅ User must hold Aeko coins
- ✅ Post not previously minted
- ✅ User owns the post

### **Minting Process**

#### **1. Check NFT Eligibility**
```http
GET /api/posts/nft-eligible
Authorization: Bearer <JWT_TOKEN>
```

#### **2. Mint Post as NFT**
```http
POST /api/nft/mint
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "postId": "post_id_here",
  "privateKey": "base58_private_key",
  "metadataUri": "https://arweave.net/metadata_hash",
  "price": 1000,
  "listForSale": true
}
```

#### **3. Purchase NFT**
```http
POST /api/nft/purchase
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "nftId": "nft_id_here",
  "buyerPrivateKey": "base58_private_key"
}
```

---

## 📊 **Post Transfer System**

### **Transfer Posts Between Users**

```http
POST /api/posts/transfer
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "postId": "post_id_here",
  "toUserId": "target_user_id",
  "reason": "Collaboration transfer"
}
```

### **View Transfer History**

```http
GET /api/posts/transfer-history/POST_ID
```

### **Get Received Posts**

```http
GET /api/posts/my-received-posts
Authorization: Bearer <JWT_TOKEN>
```

---

## 🔧 **Frontend Integration**

### **Wallet Connection (React Example)**

```javascript
import { Connection, PublicKey } from '@solana/web3.js';

// Connect to Phantom Wallet
const connectWallet = async () => {
  if (window.solana) {
    try {
      const response = await window.solana.connect();
      const walletAddress = response.publicKey.toString();
      
      // Send to backend
      await fetch('/api/aeko/connect-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ walletAddress })
      });
      
      console.log('Wallet connected:', walletAddress);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  } else {
    alert('Please install Phantom wallet');
  }
};
```

### **Display Aeko Balance**

```javascript
const fetchAekoBalance = async () => {
  try {
    const response = await fetch('/api/aeko/balance', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const data = await response.json();
    return data.balance;
  } catch (error) {
    console.error('Error fetching balance:', error);
  }
};
```

### **Transfer Aeko Coins**

```javascript
const transferAeko = async (toUserId, amount) => {
  try {
    // Get user's private key (securely stored)
    const privateKey = await getStoredPrivateKey();
    
    const response = await fetch('/api/aeko/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        toUserId,
        amount,
        privateKey,
        description: 'User transfer'
      })
    });
    
    const result = await response.json();
    console.log('Transfer successful:', result);
  } catch (error) {
    console.error('Transfer failed:', error);
  }
};
```

---

## 🔐 **Security Best Practices**

### **Private Key Management**

1. **Never store private keys in plain text**
2. **Use encryption for local storage**
3. **Implement secure key derivation**
4. **Consider hardware wallets for production**

```javascript
// Example: Secure private key handling
const encryptPrivateKey = (privateKey, password) => {
  // Use crypto-js or similar library
  return CryptoJS.AES.encrypt(privateKey, password).toString();
};

const decryptPrivateKey = (encryptedKey, password) => {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, password);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

### **Transaction Validation**

```javascript
// Always validate transactions before signing
const validateTransaction = (transaction) => {
  // Check amount limits
  if (transaction.amount > MAX_TRANSFER_AMOUNT) {
    throw new Error('Amount exceeds limit');
  }
  
  // Verify recipient
  if (!isValidSolanaAddress(transaction.recipient)) {
    throw new Error('Invalid recipient address');
  }
  
  // Check balance
  if (transaction.amount > userBalance) {
    throw new Error('Insufficient balance');
  }
};
```

---

## 📱 **Mobile Integration (React Native)**

### **Install Dependencies**

```bash
npm install @solana/web3.js
npm install @solana/spl-token
npm install react-native-crypto
npm install buffer
```

### **Setup Polyfills**

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  
  config.resolver.alias = {
    crypto: 'react-native-crypto',
    stream: 'readable-stream',
    buffer: '@craftzdog/react-native-buffer',
  };
  
  return config;
})();
```

---

## 🚀 **Production Deployment**

### **Environment Configuration**

```env
# Production Environment
NODE_ENV=production
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Security
JWT_SECRET=super_secure_secret_key
SOLANA_PRIVATE_KEY=production_private_key

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_prod
```

### **Deployment Checklist**

- [ ] Update environment variables
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Test all blockchain functions
- [ ] Verify wallet connections
- [ ] Test transaction flows

---

## 🧪 **Testing**

### **Unit Tests**

```javascript
// Test Aeko balance retrieval
describe('Aeko Balance', () => {
  it('should return user balance', async () => {
    const response = await request(app)
      .get('/api/aeko/balance')
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.balance).toBeGreaterThanOrEqual(0);
  });
});
```

### **Integration Tests**

```javascript
// Test Aeko transfer
describe('Aeko Transfer', () => {
  it('should transfer coins between users', async () => {
    const transferData = {
      toUserId: 'test_user_id',
      amount: 100,
      privateKey: 'test_private_key'
    };
    
    const response = await request(app)
      .post('/api/aeko/transfer')
      .set('Authorization', `Bearer ${testToken}`)
      .send(transferData);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

## 📊 **Monitoring & Analytics**

### **Key Metrics to Track**

1. **Wallet Connections**: User adoption rate
2. **Transaction Volume**: Daily/monthly volume
3. **NFT Activity**: Minting and trading stats
4. **Error Rates**: Failed transactions
5. **Response Times**: API performance

### **Logging Example**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log blockchain transactions
logger.info('Aeko transfer completed', {
  fromUser: fromUserId,
  toUser: toUserId,
  amount: amount,
  signature: transactionSignature
});
```

---

## 🆘 **Troubleshooting**

### **Common Issues & Solutions**

#### **1. Import Errors**
```bash
# Error: Named export not found
# Solution: Use default imports for CommonJS modules
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { PROGRAM_ID } = pkg;
```

#### **2. Wallet Connection Fails**
```javascript
// Check if Phantom is installed
if (!window.solana) {
  console.error('Phantom wallet not found');
  // Show install prompt
}
```

#### **3. Transaction Fails**
```javascript
// Check network status
const connection = new Connection(RPC_URL);
const health = await connection.getHealth();
console.log('Network health:', health);
```

#### **4. Balance Not Updating**
```javascript
// Force refresh balance
const latestBalance = await getAekoBalance(walletAddress);
// Update UI state
```

---

## 🔄 **Updates & Maintenance**

### **Regular Tasks**

1. **Update Dependencies**: Keep blockchain packages current
2. **Monitor Network**: Check Solana network status
3. **Backup Keys**: Secure private key storage
4. **Performance Review**: Analyze transaction times
5. **Security Audit**: Regular security checks

### **Version Compatibility**

```json
{
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.6",
    "@metaplex-foundation/mpl-token-metadata": "^3.2.1"
  }
}
```

---

## 📞 **Support & Resources**

### **Documentation Links**
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [SPL Token Guide](https://spl.solana.com/token)
- [Metaplex Docs](https://docs.metaplex.com/)

### **Community Resources**
- [Solana Discord](https://discord.gg/solana)
- [Metaplex Discord](https://discord.gg/metaplex)
- [Solana Stack Overflow](https://stackoverflow.com/questions/tagged/solana)

---

**🎉 Congratulations! Your Aeko blockchain integration is now complete and fully functional!**

For additional support or questions, refer to the comprehensive documentation files in the project directory.