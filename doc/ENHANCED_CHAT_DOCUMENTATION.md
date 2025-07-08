# Enhanced Real-Time Chat System Documentation

## 🚀 Overview

The Enhanced Real-Time Chat System is a comprehensive, feature-rich messaging platform built with Node.js, Socket.IO, MongoDB, and advanced AI integration. It provides modern chat capabilities including voice messages, emoji reactions, AI bot assistance, real-time indicators, and much more.

## ✨ Features

### Core Features
- ✅ **Real-time messaging** - Instant message delivery using Socket.IO
- 🎵 **Voice messages** - Record and send audio messages with waveform visualization
- 😊 **Emoji reactions** - React to messages with emojis and custom skin tones
- 🤖 **AI Bot integration** - Chat with AI assistants with multiple personalities
- 👀 **Read receipts** - See when messages are delivered and read
- ⌨️ **Typing indicators** - Real-time typing status
- 📁 **File sharing** - Send images, videos, documents, and other files
- 🔍 **Message search** - Search through conversation history
- 📱 **Cross-platform** - Works on web, mobile, and desktop

### Advanced Features
- 💬 **Group chats** - Multi-user conversations
- 🔄 **Message replies** - Reply to specific messages
- ✏️ **Message editing** - Edit sent messages
- 🗑️ **Message deletion** - Soft delete messages
- 📍 **Location sharing** - Share geographical location
- 🔗 **Link previews** - Automatic link metadata extraction
- 🏷️ **Hashtags & mentions** - Tag users and create hashtags
- 📊 **Analytics** - Track usage and engagement metrics

## 🏗️ Architecture

### Backend Components

#### 1. Enhanced Message Model (`models/EnhancedMessage.js`)
```javascript
// Advanced message schema with support for:
- Multiple message types (text, voice, image, video, file, emoji, ai_response)
- Voice message metadata (duration, waveform, transcription)
- Emoji reactions and user interactions
- AI bot integration fields
- Message status tracking (sending, sent, delivered, read)
- Rich metadata (device type, location, mentions, hashtags)
```

#### 2. Enhanced Chat Socket (`sockets/enhancedChatSocket.js`)
```javascript
// Real-time communication handler with:
- JWT authentication
- File upload support (100MB limit)
- Voice recording coordination
- AI bot response triggers
- Typing and presence indicators
- Reaction management
- Connection management
```

#### 3. Chat API Routes (`routes/enhancedChatRoutes.js`)
```javascript
// RESTful API endpoints:
GET    /api/enhanced-chat/conversations     - Get user conversations
GET    /api/enhanced-chat/messages/:chatId  - Get chat messages
POST   /api/enhanced-chat/send-message      - Send text message
POST   /api/enhanced-chat/upload-voice      - Upload voice message
POST   /api/enhanced-chat/upload-file       - Upload files
POST   /api/enhanced-chat/emoji-reactions/:messageId - Add emoji reaction
DELETE /api/enhanced-chat/emoji-reactions/:messageId - Remove emoji reaction
POST   /api/enhanced-chat/bot-chat          - Chat with AI bot
POST   /api/enhanced-chat/create-chat       - Create new chat
POST   /api/enhanced-chat/mark-read/:chatId - Mark messages as read
GET    /api/enhanced-chat/search            - Search messages
GET    /api/enhanced-chat/emoji-list        - Get emoji categories
```

#### 4. AI Bot Integration
```javascript
// Enhanced bot with:
- 7 AI personalities (friendly, professional, sarcastic, creative, analytical, mentor, companion)
- Multi-provider support (OpenAI GPT-4, Anthropic Claude, Cohere)
- Context-aware responses
- Sentiment analysis
- Auto-reply capabilities
```

### Frontend Components

#### 1. Enhanced Chat Client (`client/enhancedChatClient.js`)
```javascript
// JavaScript client library with:
- Socket.IO connection management
- Voice recording utilities
- Emoji handling
- Real-time event processing
- Error handling and reconnection
```

#### 2. HTML Demo (`client/chatExample.html`)
```html
<!-- Complete chat interface with:
- Modern responsive design
- Voice recording UI
- Emoji picker
- AI bot controls
- Real-time indicators
- File upload interface
-->
```

## 🚦 Getting Started

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- Modern browser with microphone access

### Installation

1. **Clone and install dependencies:**
```bash
npm install socket.io multer jsonwebtoken
```

2. **Set up environment variables:**
```env
# .env file
MONGO_URI=mongodb://localhost:27017/aeko_enhanced_chat
JWT_SECRET=your_jwt_secret_key
PORT=5000

# AI Provider API Keys (optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
COHERE_API_KEY=your_cohere_key
```

3. **Start the server:**
```bash
# Using the enhanced server
node enhancedChatServer.js

# Or using the integrated main server
node server.js
```

4. **Open the demo:**
```bash
# Serve the HTML demo
open client/chatExample.html
# Or use a local server
npx http-server client/
```

## 💻 Usage Examples

### Basic Text Messaging

```javascript
import EnhancedChatClient from './client/enhancedChatClient.js';

// Initialize client
const chat = new EnhancedChatClient('http://localhost:5000', 'your_jwt_token');

// Join a chat
chat.joinChat('chat_id_123');
chat.setCurrentReceiver('user_id_456');

// Send a message
chat.sendMessage('user_id_456', 'Hello! How are you?');

// Listen for new messages
chat.on('newMessage', (data) => {
    console.log('New message:', data.message.content);
});
```

### Voice Messages

```javascript
// Start recording
await chat.startVoiceRecording();

// Stop recording (automatically sends)
chat.stopVoiceRecording();

// Listen for voice messages
chat.on('voiceMessage', (data) => {
    console.log('Voice message received:', data.message.voiceMessage.duration);
});
```

### Emoji Reactions

```javascript
// Add reaction to message
chat.addReaction('message_id_123', '👍');

// Remove reaction
chat.removeReaction('message_id_123', '👍');

// Use emoji utilities
import { EmojiUtils } from './client/enhancedChatClient.js';

// Get emojis by category
const smileys = EmojiUtils.getByCategory('smileys');

// Search emojis
const happyEmojis = EmojiUtils.searchEmojis('happy');
```

### AI Bot Integration

```javascript
// Chat with AI bot
chat.chatWithBot('Can you help me with JavaScript?', {
    personality: 'mentor',
    instruction: 'Be helpful and educational'
});

// Listen for bot responses
chat.on('botResponse', (data) => {
    console.log('Bot says:', data.response);
    console.log('Personality:', data.botInfo.personality);
    console.log('Confidence:', data.botInfo.confidence);
});
```

### Real-time Indicators

```javascript
// Typing indicators
chat.startTyping('user_id_456');
chat.stopTyping('user_id_456');

// Listen for typing
chat.on('userTyping', (data) => {
    if (data.typing) {
        console.log(`${data.username} is typing...`);
    }
});

// Online status
chat.on('userOnline', (data) => {
    console.log(`${data.userId} is ${data.status}`);
});
```

## 🔌 API Reference

### Socket.IO Events

#### Client to Server Events
```javascript
// Connection
'join_chat'                 - Join a chat room
'send_message'             - Send text message
'send_emoji'               - Send emoji message
'send_voice_message'       - Send voice message
'chat_with_bot'            - Chat with AI bot
'add_reaction'             - Add emoji reaction
'remove_reaction'          - Remove emoji reaction
'typing_start'             - Start typing indicator
'typing_stop'              - Stop typing indicator
'mark_message_read'        - Mark message as read
'start_voice_recording'    - Start voice recording indicator
'stop_voice_recording'     - Stop voice recording indicator
```

#### Server to Client Events
```javascript
// Messages
'new_message'              - New text message received
'new_voice_message'        - New voice message received
'bot_response'             - AI bot response
'bot_auto_reply'           - Bot auto-reply
'message_sent'             - Message sent confirmation
'voice_message_sent'       - Voice message sent confirmation

// Reactions & Interactions  
'reaction_added'           - Emoji reaction added
'reaction_removed'         - Emoji reaction removed
'message_read'             - Message read receipt

// Real-time Indicators
'user_typing'              - User typing status
'user_recording_voice'     - User recording voice
'user_status_update'       - User online/offline status

// System
'joined_chat'              - Successfully joined chat
'unread_count'             - Unread message count
'connection_error'         - Connection errors
'message_error'            - Message errors
'bot_error'                - Bot errors
```

### HTTP API Endpoints

#### Conversations
```http
GET /api/enhanced-chat/conversations?page=1&limit=20
Authorization: Bearer <token>
```

#### Messages
```http
GET /api/enhanced-chat/messages/:chatId?page=1&limit=50&before=messageId
Authorization: Bearer <token>
```

#### Send Message
```http
POST /api/enhanced-chat/send-message
Authorization: Bearer <token>
Content-Type: application/json

{
    "receiverId": "user_id",
    "chatId": "chat_id", 
    "content": "Hello!",
    "messageType": "text",
    "replyToId": "message_id" // optional
}
```

#### Voice Upload
```http
POST /api/enhanced-chat/upload-voice
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- voice: <audio_file>
- receiverId: <user_id>
- chatId: <chat_id>
- duration: <number>
- waveform: <json_array> // optional
```

#### AI Bot Chat
```http
POST /api/enhanced-chat/bot-chat
Authorization: Bearer <token>
Content-Type: application/json

{
    "message": "Hello bot!",
    "chatId": "chat_id", // optional
    "personality": "friendly", // optional
    "instruction": "Be helpful" // optional
}
```

#### Emoji Reactions
```http
POST /api/enhanced-chat/emoji-reactions/:messageId
Authorization: Bearer <token>
Content-Type: application/json

{
    "emoji": "👍"
}

DELETE /api/enhanced-chat/emoji-reactions/:messageId?emoji=👍
Authorization: Bearer <token>
```

## 🤖 AI Bot Personalities

### Available Personalities

1. **Friendly** 😊
   - Warm, approachable, uses casual language
   - Great for general conversation and support

2. **Professional** 💼
   - Formal, business-oriented, precise
   - Perfect for work-related discussions

3. **Sarcastic** 😏
   - Witty, playful, uses humor and sarcasm
   - Fun for casual, entertaining conversations

4. **Creative** 🎨
   - Imaginative, artistic, thinks outside the box
   - Excellent for brainstorming and creative projects

5. **Analytical** 📊
   - Data-driven, logical, methodical
   - Best for problem-solving and analysis

6. **Mentor** 👨‍🏫
   - Educational, supportive, guides learning
   - Ideal for teaching and skill development

7. **Companion** 🤝
   - Empathetic, understanding, emotionally supportive
   - Perfect for personal conversations and emotional support

### Bot Configuration

```javascript
// Enable bot auto-reply for a user
await User.findByIdAndUpdate(userId, { 
    botEnabled: true,
    botPersonality: 'friendly'
});

// Customize bot settings
const botSettings = {
    personality: 'mentor',
    maxTokens: 150,
    temperature: 0.7,
    features: {
        autoReply: true,
        contextAware: true,
        sentimentAnalysis: true
    }
};
```

## 📱 File Upload Support

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, MOV, AVI, WebM  
- **Audio**: MP3, WAV, OGG, M4A, AAC
- **Documents**: PDF, DOC, DOCX, TXT
- **Archives**: ZIP, RAR

### Upload Limits
- Maximum file size: **100MB**
- Simultaneous uploads: **10 files**
- Storage location: `/uploads/` directory

### File Upload Example
```javascript
// Using API
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('receiverId', 'user_id');
formData.append('chatId', 'chat_id');
formData.append('caption', 'Check this out!');

fetch('/api/enhanced-chat/upload-file', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`
    },
    body: formData
});
```

## 🔍 Message Search

### Search Options
```javascript
// Search messages
GET /api/enhanced-chat/search?q=hello&chatId=chat_123&messageType=text&limit=20

// Search parameters:
- q: Search query (required)
- chatId: Specific chat (optional)
- messageType: Filter by type (optional)
- limit: Max results (default: 20)
```

### Search Features
- Full-text search in message content
- Filter by message type
- Filter by specific chat
- Case-insensitive matching
- Results include message context

## 📊 Analytics & Monitoring

### Available Metrics
```javascript
GET /api/chat-info
GET /api/socket-stats

// Returns:
{
    "connectedUsers": 15,
    "totalActiveConnections": 23,
    "supportedFileTypes": ["image", "video", "audio", "document"],
    "maxFileSize": "100MB",
    "aiPersonalities": ["friendly", "professional", ...]
}
```

### Performance Monitoring
- Real-time connection count
- Message delivery statistics  
- File upload metrics
- AI bot response times
- Error tracking and logging

## 🛠️ Configuration

### Environment Variables
```env
# Server Configuration
PORT=5000
ENHANCED_CHAT_PORT=5001
NODE_ENV=production

# Database
MONGO_URI=mongodb://localhost:27017/aeko_enhanced_chat

# Authentication  
JWT_SECRET=your_super_secure_secret_key

# AI Providers (Optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
COHERE_API_KEY=...

# File Upload
MAX_FILE_SIZE=104857600  # 100MB in bytes
UPLOAD_PATH=./uploads

# Features
ENABLE_AI_BOT=true
ENABLE_VOICE_MESSAGES=true
ENABLE_FILE_UPLOADS=true
ENABLE_ANALYTICS=true
```

### Server Configuration
```javascript
// Enhanced chat socket options
const enhancedChatSocket = new EnhancedChatSocket(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8, // 100MB
    pingTimeout: 60000,
    pingInterval: 25000
});
```

## 🔒 Security

### Authentication
- JWT token-based authentication
- User verification on Socket.IO connection
- API endpoint protection

### File Upload Security
- File type validation
- Size limit enforcement  
- Virus scanning (recommended for production)
- Secure file storage paths

### Data Protection
- Message encryption in transit (HTTPS/WSS)
- Input sanitization
- XSS protection
- Rate limiting (recommended)

## 🚀 Deployment

### Production Checklist
- [ ] Set up MongoDB cluster
- [ ] Configure environment variables
- [ ] Set up file storage (AWS S3, CloudFlare R2)
- [ ] Enable SSL/TLS certificates
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up monitoring and logging
- [ ] Configure auto-scaling
- [ ] Set up CDN for file delivery

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

### Environment Setup
```bash
# Production environment
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chat
JWT_SECRET=production_secret_key
REDIS_URL=redis://redis-cluster:6379
UPLOAD_STORAGE=s3
AWS_BUCKET=chat-files-bucket
```

## 🐛 Troubleshooting

### Common Issues

#### Socket.IO Connection Problems
```javascript
// Check connection status
const status = chat.getConnectionStatus();
console.log('Connected:', status.connected);
console.log('Socket ID:', status.socketId);

// Handle reconnection
chat.on('error', (error) => {
    if (error.type === 'connection') {
        setTimeout(() => chat.reconnect(), 5000);
    }
});
```

#### Voice Recording Issues
```javascript
// Check browser support
import { VoiceUtils } from './enhancedChatClient.js';

if (!VoiceUtils.isSupported()) {
    console.error('Voice recording not supported');
    // Show fallback UI
}

// Handle permission errors
try {
    await chat.startVoiceRecording();
} catch (error) {
    if (error.name === 'NotAllowedError') {
        console.error('Microphone permission denied');
    }
}
```

#### File Upload Errors
```javascript
// Handle file size errors
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            message: 'Maximum file size is 100MB'
        });
    }
    next(err);
});
```

### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('debug', 'socket.io-client:*');

// Server-side logging
DEBUG=socket.io:* node server.js
```

## 📈 Performance Optimization

### Client-Side
- Message pagination and virtual scrolling
- Image lazy loading and compression
- Voice message caching
- Connection pooling and reconnection strategies

### Server-Side
- Database indexing for message queries
- File upload streaming
- Redis for session management
- Message queue for heavy operations

### Database Optimization
```javascript
// Recommended indexes
db.enhancedmessages.createIndex({ "chatId": 1, "createdAt": -1 });
db.enhancedmessages.createIndex({ "sender": 1, "receiver": 1, "createdAt": -1 });
db.enhancedmessages.createIndex({ "messageType": 1 });
db.enhancedmessages.createIndex({ "isBot": 1 });
db.enhancedmessages.createIndex({ "content": "text" }); // For search
```

## 🆕 Future Enhancements

### Planned Features
- 🔐 End-to-end encryption
- 📞 Voice and video calls
- 📱 Mobile app (React Native)
- 🌐 Multi-language support
- 🎭 Custom emoji and stickers
- 🤝 Advanced group management
- 📋 Message templates
- 🔔 Smart notifications
- 📱 Push notifications
- 🎨 Themes and customization

### Integration Possibilities
- Slack/Discord integration
- Calendar integration
- Third-party file storage
- Payment processing
- Social media sharing
- CRM integration

## 📞 Support

### Documentation
- [API Reference](./API_REFERENCE.md)
- [Client Library Docs](./CLIENT_DOCS.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Community
- GitHub Issues for bug reports
- Discord server for discussions
- Stack Overflow for questions

### Professional Support
- Enterprise support available
- Custom development services
- Training and consultation

---

## 📄 License

This enhanced chat system is part of the Aeko backend project. Please refer to the main project license for usage terms.

---

**Built with ❤️ using Node.js, Socket.IO, MongoDB, and AI technology**