# 📚 Aeko API Documentation Overview

## 🚀 **Enhanced Swagger Documentation**

The Aeko platform now features **comprehensive Swagger/OpenAPI documentation** that includes all blockchain features, NFT marketplace, and Web3 integration.

### **📍 Access Swagger UI**
- **Development**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Production**: [https://api.aeko.com/api-docs](https://api.aeko.com/api-docs)
- **JSON Spec**: [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)

---

## 🔗 **Blockchain API Endpoints**

### **📝 Post Transfer System**
```
POST   /api/posts/transfer              Transfer post to another user
GET    /api/posts/transfer-history/:id  Get post transfer history
GET    /api/posts/my-received-posts     Get posts received via transfer
GET    /api/posts/my-transferred-posts  Get posts transferred to others
POST   /api/posts/increment-view/:id    Increment post view count
GET    /api/posts/nft-eligible          Get NFT-eligible posts
```

### **💰 Aeko Coin Operations**
```
GET    /api/aeko/balance                Get user's Aeko balance
POST   /api/aeko/connect-wallet         Connect Solana wallet
POST   /api/aeko/transfer               Transfer Aeko coins
POST   /api/aeko/giveaway               Conduct token giveaway
POST   /api/aeko/donate-to-stream       Donate to live stream
GET    /api/aeko/transactions           Get transaction history
POST   /api/aeko/create-wallet          Generate new Solana wallet
```

### **🖼️ NFT Marketplace**
```
POST   /api/nft/mint                    Mint post as NFT
GET    /api/nft/marketplace             Browse NFT marketplace
POST   /api/nft/purchase                Purchase NFT with Aeko coins
POST   /api/nft/list                    List NFT for sale
POST   /api/nft/bid                     Place auction bid
POST   /api/nft/donate                  Donate to NFT
GET    /api/nft/my-nfts                 Get user's NFT collection
GET    /api/nft/stats                   Get marketplace statistics
```

---

## 📋 **New Swagger Features**

### **🏷️ Enhanced Tags**
- **Post Transfer** - Post ownership management
- **Aeko Coin** - Cryptocurrency operations
- **NFT Marketplace** - NFT trading and management
- **Blockchain** - Web3 integration features

### **📊 Comprehensive Schemas**
- **Post** - Enhanced with blockchain fields
- **AekoTransaction** - Complete transaction tracking
- **NFTMarketplace** - Full marketplace functionality
- **WalletInfo** - Solana wallet information
- **BlockchainResponse** - Standardized blockchain responses

### **🔐 Security Documentation**
- **Bearer Token Authentication** for all protected endpoints
- **Wallet Authentication** for blockchain operations
- **Role-based Access Control** for admin features

---

## 💡 **Usage Examples**

### **🔄 Transfer Post**
```javascript
POST /api/posts/transfer
{
  "postId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "toUserId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "reason": "Collaboration transfer"
}
```

### **💸 Transfer Aeko Coins**
```javascript
POST /api/aeko/transfer
{
  "toUserId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "amount": 100,
  "privateKey": "your_wallet_private_key",
  "description": "Payment for services"
}
```

### **🎨 Mint NFT**
```javascript
POST /api/nft/mint
{
  "postId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "privateKey": "your_wallet_private_key",
  "metadataUri": "https://ipfs.io/ipfs/QmYourMetadataHash",
  "price": 500,
  "listForSale": true
}
```

### **🛒 Purchase NFT**
```javascript
POST /api/nft/purchase
{
  "nftId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "buyerPrivateKey": "your_wallet_private_key"
}
```

### **🎁 Conduct Giveaway**
```javascript
POST /api/aeko/giveaway
{
  "recipients": [
    "64f8a1b2c3d4e5f6a7b8c9d1",
    "64f8a1b2c3d4e5f6a7b8c9d2",
    "64f8a1b2c3d4e5f6a7b8c9d3"
  ],
  "amountPerRecipient": 50,
  "privateKey": "your_wallet_private_key",
  "description": "Community giveaway event"
}
```

---

## 🌐 **API Response Formats**

### **✅ Success Response**
```javascript
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data object
  }
}
```

### **❌ Error Response**
```javascript
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### **💰 Transaction Response**
```javascript
{
  "success": true,
  "message": "Transaction completed",
  "data": {
    "transaction": {
      "id": "unique_transaction_id",
      "signature": "solana_transaction_signature",
      "amount": 100,
      "fromUser": "sender_username",
      "toUser": "recipient_username",
      "timestamp": "2024-12-10T10:30:00Z"
    },
    "newBalance": 450.75
  }
}
```

---

## 🔑 **Authentication**

### **🔒 JWT Authentication**
Include JWT token in Authorization header:
```
Authorization: Bearer your_jwt_token
```

### **🏦 Wallet Authentication**
For blockchain operations, provide private key in request body:
```javascript
{
  "privateKey": "your_solana_wallet_private_key"
}
```

> ⚠️ **Security Note**: Private keys should never be stored on the server and only transmitted over HTTPS.

---

## 📊 **Swagger UI Features**

### **🎨 Enhanced UI**
- **Custom styling** with Aeko branding
- **Organized sections** by feature category
- **Interactive testing** with built-in request forms
- **Real-time validation** of request parameters

### **📖 Interactive Documentation**
- **Try it out** functionality for all endpoints
- **Model schemas** with detailed property descriptions
- **Response examples** for success and error cases
- **Authentication testing** with JWT tokens

### **🔍 Advanced Features**
- **API filtering** by tags and categories
- **Search functionality** across all endpoints
- **Export options** for API specifications
- **Custom documentation** with platform-specific guides

---

## 🚀 **Getting Started with API**

### **1. Authentication Setup**
```javascript
// Login to get JWT token
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response includes token
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { /* user data */ }
}
```

### **2. Connect Solana Wallet**
```javascript
// Connect wallet for blockchain operations
POST /api/aeko/connect-wallet
Authorization: Bearer your_jwt_token
{
  "walletAddress": "your_solana_public_key"
}
```

### **3. Start Using Blockchain Features**
```javascript
// Check Aeko balance
GET /api/aeko/balance
Authorization: Bearer your_jwt_token

// Get NFT-eligible posts
GET /api/posts/nft-eligible
Authorization: Bearer your_jwt_token

// Browse NFT marketplace
GET /api/nft/marketplace?category=viral&sort=newest
```

---

## 📱 **Client SDK Examples**

### **JavaScript/TypeScript**
```javascript
// Create API client
const aekoApi = axios.create({
  baseURL: 'https://api.aeko.com',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Transfer Aeko coins
const transferResult = await aekoApi.post('/api/aeko/transfer', {
  toUserId: recipientId,
  amount: 100,
  privateKey: walletPrivateKey
});

// Mint NFT
const nftResult = await aekoApi.post('/api/nft/mint', {
  postId: postId,
  privateKey: walletPrivateKey,
  metadataUri: ipfsUri,
  listForSale: true,
  price: 500
});
```

### **Python**
```python
import requests

# API client setup
api_base = "https://api.aeko.com"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Transfer Aeko coins
transfer_data = {
    "toUserId": recipient_id,
    "amount": 100,
    "privateKey": wallet_private_key
}
response = requests.post(f"{api_base}/api/aeko/transfer", 
                        json=transfer_data, headers=headers)

# Purchase NFT
purchase_data = {
    "nftId": nft_id,
    "buyerPrivateKey": buyer_private_key
}
response = requests.post(f"{api_base}/api/nft/purchase", 
                        json=purchase_data, headers=headers)
```

---

## 🔧 **Development Tools**

### **📋 Postman Collection**
Export the Swagger specification and import into Postman:
1. Visit `/api-docs.json`
2. Copy the JSON specification
3. Import into Postman as OpenAPI 3.0

### **🛠️ Code Generation**
Generate client SDKs using swagger-codegen:
```bash
# Generate JavaScript client
swagger-codegen generate -i http://localhost:5000/api-docs.json -l javascript -o ./aeko-js-client

# Generate Python client
swagger-codegen generate -i http://localhost:5000/api-docs.json -l python -o ./aeko-python-client
```

### **🧪 Testing Framework**
Use the Swagger spec for automated testing:
```javascript
// Jest test example
const swaggerSpec = require('./api-docs.json');

test('API should match swagger specification', async () => {
  const validator = new SwaggerValidator(swaggerSpec);
  const response = await api.post('/api/aeko/transfer', validData);
  expect(validator.validate(response)).toBe(true);
});
```

---

## 📞 **Support & Resources**

### **📚 Documentation Links**
- **Swagger UI**: [/api-docs](http://localhost:5000/api-docs)
- **JSON Spec**: [/api-docs.json](http://localhost:5000/api-docs.json)
- **Implementation Guide**: [AEKO_BLOCKCHAIN_IMPLEMENTATION.md](./AEKO_BLOCKCHAIN_IMPLEMENTATION.md)
- **Admin Documentation**: [ENHANCED_ADMIN_DOCUMENTATION.md](./ENHANCED_ADMIN_DOCUMENTATION.md)

### **🔗 External Resources**
- **Solana Documentation**: [https://docs.solana.com](https://docs.solana.com)
- **Metaplex Docs**: [https://docs.metaplex.com](https://docs.metaplex.com)
- **Phantom Wallet**: [https://phantom.app/](https://phantom.app/)
- **Solflare Wallet**: [https://solflare.com/](https://solflare.com/)

---

## 🎯 **Quick Reference**

### **📊 API Statistics**
- **Total Endpoints**: 50+ (including 21 new blockchain endpoints)
- **Authentication Methods**: JWT Bearer + Wallet signatures
- **Response Formats**: JSON with standardized structure
- **Rate Limiting**: Implemented for security
- **Documentation Coverage**: 100% with examples

### **🏷️ Available Tags**
- **Authentication** - User login and auth
- **Post Transfer** - Post ownership management
- **Aeko Coin** - Cryptocurrency operations
- **NFT Marketplace** - NFT trading platform
- **Enhanced Chat** - Real-time messaging
- **AI Bot** - Chatbot integration
- **Users** - User management
- **Posts** - Social media content
- **System** - Health and monitoring

---

**🚀 The Aeko API is now fully documented with comprehensive Swagger/OpenAPI specifications covering all Web3 and blockchain features!**

**Access the interactive documentation at: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)**