# 🎥 Enhanced LiveStream Platform - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Features](#features) 
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [API Reference](#api-reference)
6. [Socket.IO Events](#socketio-events)
7. [WebRTC Integration](#webrtc-integration)
8. [Monetization](#monetization)
9. [Moderation](#moderation)
10. [Analytics](#analytics)
11. [Client Libraries](#client-libraries)
12. [Examples](#examples)
13. [Troubleshooting](#troubleshooting)
14. [Performance Optimization](#performance-optimization)
15. [Security](#security)

## Overview

The Enhanced LiveStream Platform is a comprehensive real-time streaming solution built on Node.js, Socket.IO, and WebRTC. It provides enterprise-grade features comparable to platforms like Twitch, YouTube Live, and Discord, while being fully integrated with the Aeko backend ecosystem.

### Key Capabilities
- **Real-time WebRTC streaming** with multiple quality options
- **Interactive stream chat** with emoji reactions and moderation
- **Monetization features** including donations, subscriptions, and paid streams
- **Advanced analytics** and viewer engagement metrics
- **Co-hosting and guest features** for collaborative streaming
- **Screen sharing** and multi-source broadcasting
- **Stream recording** and archive management
- **Discovery system** with trending and category-based browsing

## Features

### 🎬 Core Streaming Features
- **Multi-protocol support**: WebRTC, RTMP, HLS, DASH
- **Adaptive quality**: 360p to 4K resolution with automatic bitrate adjustment
- **Low latency**: Sub-second latency with WebRTC
- **Screen sharing**: Desktop and application capture
- **Audio/video controls**: Real-time mute/unmute and camera toggle
- **Stream scheduling**: Plan and promote upcoming streams

### 💬 Interactive Features
- **Real-time chat**: Integrated with enhanced chat system
- **Emoji reactions**: Live floating reactions overlay
- **Viewer engagement**: Likes, shares, and follows
- **Typing indicators**: Show when viewers are typing
- **Message reactions**: React to individual chat messages

### 🤝 Collaboration Features
- **Co-hosting**: Multiple hosts with permission management
- **Guest invites**: Bring viewers on stream temporarily
- **Permission system**: Fine-grained control over guest capabilities
- **Multi-camera support**: Switch between different video sources

### 💰 Monetization Features
- **Donations**: Real-time tip jar with custom messages
- **Subscriptions**: Monthly recurring payments for exclusive content
- **Paid streams**: Ticket-based access to premium streams
- **Currency support**: USD, EUR, GBP, JPY with payment processor integration

### 🛡️ Moderation Tools
- **User banning**: Temporary and permanent bans
- **Chat moderation**: Message deletion and user timeouts
- **Slow mode**: Rate limiting for chat messages
- **Auto-moderation**: Automated content filtering
- **Moderator hierarchy**: Multiple moderation levels

### 📊 Analytics & Insights
- **Real-time metrics**: Current viewers, peak viewers, total views
- **Engagement analytics**: Chat messages, reactions, average watch time
- **Geographic insights**: Viewer locations and device statistics
- **Revenue tracking**: Donations, subscriptions, and earnings analytics
- **Performance metrics**: Stream quality, dropped frames, network stats

## Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │◄──►│  Socket.IO Hub  │◄──►│   WebRTC MCU    │
│                 │    │                 │    │                 │
│ - Stream UI     │    │ - Event Router  │    │ - Media Relay   │
│ - Chat          │    │ - Auth Layer    │    │ - Quality Adapt │
│ - Controls      │    │ - State Mgmt    │    │ - Recording     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  RESTful API    │    │   MongoDB       │    │  File Storage   │
│                 │    │                 │    │                 │
│ - Stream CRUD   │    │ - Stream Data   │    │ - Recordings    │
│ - Analytics     │    │ - User Data     │    │ - Thumbnails    │
│ - Monetization  │    │ - Chat History  │    │ - Avatars       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Models

#### LiveStream Schema
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: Enum,
  host: ObjectId(User),
  status: Enum["scheduled", "live", "ended", "paused"],
  streamKey: String,
  roomId: String,
  quality: {
    resolution: String,
    bitrate: Number,
    fps: Number,
    codec: String
  },
  features: {
    chatEnabled: Boolean,
    reactionsEnabled: Boolean,
    donationsEnabled: Boolean,
    recordingEnabled: Boolean
  },
  analytics: {
    currentViewers: Number,
    peakViewers: Number,
    totalViews: Number,
    chatMessages: Number,
    averageWatchTime: Number
  },
  monetization: {
    donations: Array,
    totalEarnings: Number,
    subscribers: Array
  }
}
```

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install socket.io jsonwebtoken uuid multer mongoose

# Set up environment variables
echo "JWT_SECRET=your_jwt_secret_here" >> .env
echo "MONGODB_URI=mongodb://localhost:27017/aeko" >> .env
```

### 2. Basic Server Setup

```javascript
import EnhancedLiveStreamSocket from './sockets/enhancedLiveStreamSocket.js';
import enhancedLiveStreamRoutes from './routes/enhancedLiveStreamRoutes.js';

// Initialize server
const server = http.createServer(app);

// Initialize livestream system
const liveStreamSocket = new EnhancedLiveStreamSocket(server);

// Add routes
app.use('/api/livestream', enhancedLiveStreamRoutes);

server.listen(5000);
```

### 3. Client Integration

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="./enhancedLiveStreamClient.js"></script>
</head>
<body>
    <video id="localVideo" autoplay muted></video>
    <script>
        const client = new EnhancedLiveStreamClient({
            serverUrl: 'http://localhost:5000',
            token: 'your_jwt_token'
        });
        
        client.connect();
    </script>
</body>
</html>
```

## API Reference

### Stream Management

#### Create Stream
```http
POST /api/livestream/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "My Awesome Stream",
  "description": "Live coding session",
  "category": "technology",
  "streamType": "public",
  "features": {
    "chatEnabled": true,
    "reactionsEnabled": true,
    "donationsEnabled": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "streamId": "60d5f482f8d2e83a4c8b4567",
    "streamKey": "live_abc123def456",
    "roomId": "room_xyz789",
    "urls": {
      "rtmp": "rtmp://localhost:1935/live/abc123def456",
      "webrtc": "ws://localhost:5000/webrtc/room_xyz789",
      "hls": "http://localhost:8080/hls/abc123def456/index.m3u8"
    }
  }
}
```

#### Start Stream
```http
POST /api/livestream/{streamId}/start
Authorization: Bearer {token}
```

#### End Stream
```http
POST /api/livestream/{streamId}/end
Authorization: Bearer {token}
```

#### Get Stream Details
```http
GET /api/livestream/{streamId}
```

### Discovery

#### Get Trending Streams
```http
GET /api/livestream/trending?limit=10&category=gaming
```

#### Search Streams
```http
GET /api/livestream/search?q=coding&category=technology&limit=20
```

#### Get Category Streams
```http
GET /api/livestream/category/gaming?limit=20&page=1
```

### Analytics

#### Get Stream Analytics
```http
GET /api/livestream/user/analytics/{streamId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalViews": 1250,
    "uniqueViewers": 890,
    "peakViewers": 245,
    "currentViewers": 156,
    "averageWatchTime": 1840,
    "chatMessages": 3420,
    "reactions": 890,
    "likes": 167,
    "engagementRate": "12.5%",
    "totalEarnings": 145.50,
    "duration": 7200,
    "durationFormatted": "2:00:00"
  }
}
```

### Monetization

#### Process Donation
```http
POST /api/livestream/{streamId}/donate
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 5.00,
  "message": "Great stream!",
  "currency": "USD"
}
```

### Moderation

#### Add Moderator
```http
POST /api/livestream/{streamId}/moderators
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "60d5f482f8d2e83a4c8b4567"
}
```

#### Remove Moderator
```http
DELETE /api/livestream/{streamId}/moderators/{userId}
Authorization: Bearer {token}
```

## Socket.IO Events

### Connection Events

#### Client to Server

**Authentication:**
```javascript
socket.emit('authenticate', { token: 'jwt_token' });
```

**Create Stream:**
```javascript
socket.emit('create_stream', {
  title: 'My Stream',
  description: 'Description here',
  category: 'gaming',
  features: { chatEnabled: true }
});
```

**Join Stream:**
```javascript
socket.emit('join_stream', { streamId: 'stream_id_here' });
```

**Send Chat Message:**
```javascript
socket.emit('stream_chat_message', {
  streamId: 'stream_id',
  message: 'Hello everyone!'
});
```

**Send Reaction:**
```javascript
socket.emit('stream_reaction', {
  streamId: 'stream_id',
  emoji: '❤️'
});
```

#### Server to Client

**Stream Created:**
```javascript
socket.on('stream_created', (data) => {
  console.log('Stream created:', data.streamId);
});
```

**Chat Message Received:**
```javascript
socket.on('stream_chat_message', (data) => {
  displayChatMessage(data.sender.username, data.message);
});
```

**Reaction Received:**
```javascript
socket.on('stream_reaction', (data) => {
  showReactionAnimation(data.emoji, data.username);
});
```

**Viewer Count Update:**
```javascript
socket.on('viewer_count_update', (data) => {
  updateViewerCount(data.currentViewers);
});
```

### WebRTC Signaling Events

**Offer/Answer Exchange:**
```javascript
// Send offer
socket.emit('offer', {
  streamId: 'stream_id',
  offer: rtcOffer,
  targetUserId: 'user_id'
});

// Receive answer
socket.on('webrtc_answer', (data) => {
  handleAnswer(data.answer);
});
```

**ICE Candidate Exchange:**
```javascript
// Send ICE candidate
socket.emit('ice_candidate', {
  streamId: 'stream_id',
  candidate: iceCandidate,
  targetUserId: 'user_id'
});

// Receive ICE candidate
socket.on('ice_candidate', (data) => {
  addIceCandidate(data.candidate);
});
```

## WebRTC Integration

### Basic Setup

```javascript
class StreamClient {
  constructor() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    this.localStream = null;
    this.remoteStreams = new Map();
  }

  async startBroadcast() {
    // Get user media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, frameRate: 30 },
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    // Add tracks to peer connection
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    return this.localStream;
  }

  async startScreenShare() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1920, height: 1080 },
      audio: true
    });

    // Replace video track
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = this.peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    
    if (sender) {
      await sender.replaceTrack(videoTrack);
    }

    return screenStream;
  }
}
```

### Quality Adaptation

```javascript
function adaptQuality(peerConnection, targetBitrate) {
  const sender = peerConnection.getSenders().find(s => 
    s.track && s.track.kind === 'video'
  );
  
  if (sender) {
    const params = sender.getParameters();
    if (params.encodings && params.encodings.length > 0) {
      params.encodings[0].maxBitrate = targetBitrate * 1000; // Convert to bps
      sender.setParameters(params);
    }
  }
}

// Usage
adaptQuality(peerConnection, 2500); // 2.5 Mbps
```

## Monetization

### Donation System

The platform supports real-time donations with custom messages:

```javascript
// Client-side donation
async function sendDonation(streamId, amount, message) {
  const response = await fetch(`/api/livestream/${streamId}/donate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, message, currency: 'USD' })
  });
  
  if (response.ok) {
    console.log('Donation sent successfully!');
  }
}

// Real-time donation notification
socket.on('stream_donation', (data) => {
  showDonationAlert(data.donor.username, data.amount, data.message);
});
```

### Subscription System

```javascript
// Subscribe to streamer
async function subscribeToStreamer(streamerId, tier = 'basic') {
  const response = await fetch(`/api/livestream/subscribe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ streamerId, tier })
  });
  
  return response.json();
}
```

### Paid Streams

```javascript
// Create paid stream
const paidStreamOptions = {
  title: 'Exclusive Workshop',
  ticketPrice: 9.99,
  currency: 'USD',
  streamType: 'paid'
};

const stream = await liveStreamClient.createStream(paidStreamOptions);
```

## Moderation

### Auto-Moderation

```javascript
// Configure auto-moderation
const moderationSettings = {
  autoModeration: true,
  bannedWords: ['spam', 'inappropriate'],
  slowMode: 5, // 5 seconds between messages
  followersOnly: false,
  subscribersOnly: false
};

await updateStreamSettings(streamId, { moderation: moderationSettings });
```

### Manual Moderation

```javascript
// Ban user from stream
socket.emit('ban_user', {
  streamId: 'stream_id',
  userId: 'user_to_ban',
  reason: 'Inappropriate behavior'
});

// Add moderator
socket.emit('add_moderator', {
  streamId: 'stream_id',
  userId: 'new_moderator_id'
});

// Delete chat message
socket.emit('delete_chat_message', {
  streamId: 'stream_id',
  messageId: 'message_to_delete'
});
```

## Analytics

### Real-time Metrics

```javascript
// Track viewer engagement
class StreamAnalytics {
  constructor(streamId) {
    this.streamId = streamId;
    this.metrics = {
      viewerCount: 0,
      peakViewers: 0,
      chatMessages: 0,
      reactions: 0,
      startTime: new Date()
    };
  }

  updateViewerCount(count) {
    this.metrics.viewerCount = count;
    if (count > this.metrics.peakViewers) {
      this.metrics.peakViewers = count;
    }
    this.sendMetricsUpdate();
  }

  trackChatMessage() {
    this.metrics.chatMessages++;
    this.sendMetricsUpdate();
  }

  trackReaction() {
    this.metrics.reactions++;
    this.sendMetricsUpdate();
  }

  sendMetricsUpdate() {
    socket.emit('update_stream_metrics', {
      streamId: this.streamId,
      metrics: this.metrics
    });
  }

  getDuration() {
    return Math.floor((new Date() - this.metrics.startTime) / 1000);
  }

  getEngagementRate() {
    const totalEngagements = this.metrics.chatMessages + this.metrics.reactions;
    return (totalEngagements / this.metrics.peakViewers * 100).toFixed(2);
  }
}
```

### Analytics Dashboard

```javascript
// Fetch comprehensive analytics
async function getStreamAnalytics(streamId) {
  const response = await fetch(`/api/livestream/user/analytics/${streamId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  if (data.success) {
    updateAnalyticsDashboard(data.data);
  }
}

function updateAnalyticsDashboard(analytics) {
  document.getElementById('totalViews').textContent = analytics.totalViews;
  document.getElementById('peakViewers').textContent = analytics.peakViewers;
  document.getElementById('engagementRate').textContent = analytics.engagementRate + '%';
  document.getElementById('totalEarnings').textContent = '$' + analytics.totalEarnings;
  
  // Update charts
  updateViewerChart(analytics.viewerHistory);
  updateEngagementChart(analytics.engagementHistory);
}
```

## Client Libraries

### Enhanced LiveStream Client

The `EnhancedLiveStreamClient` provides a complete JavaScript SDK:

```javascript
// Initialize client
const client = new EnhancedLiveStreamClient({
  serverUrl: 'http://localhost:5000',
  token: 'jwt_token',
  userId: 'user_id',
  username: 'username'
});

// Connect to server
client.connect();

// Create and start stream
const streamData = await client.createStream({
  title: 'My Stream',
  category: 'gaming'
});

await client.startStream(streamData.streamId);

// Handle events
client.on('stream_chat_message', (data) => {
  console.log('New message:', data.message);
});

client.on('viewer_count_update', (data) => {
  console.log('Viewers:', data.currentViewers);
});
```

### Utility Functions

```javascript
// Check WebRTC support
const support = checkWebRTCSupport();
if (!support.isSupported) {
  console.error('WebRTC not supported');
}

// Format viewer count
const formatted = formatViewerCount(1234); // "1.2K"

// Format stream duration
const duration = formatDuration(3661); // "1:01:01"

// Create video element
const video = createVideoElement({
  className: 'stream-video',
  width: 640,
  height: 480,
  autoplay: true,
  muted: true
});
```

## Examples

### Complete Streaming Application

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Live Stream Demo</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="./enhancedLiveStreamClient.js"></script>
</head>
<body>
    <div id="app">
        <!-- Video Container -->
        <div id="video-container">
            <video id="localVideo" autoplay muted playsinline></video>
            <div id="overlay">
                <div id="viewerCount">0 viewers</div>
                <div id="streamInfo">
                    <h3 id="streamTitle">Stream Title</h3>
                    <p id="streamCategory">Category</p>
                </div>
            </div>
        </div>

        <!-- Controls -->
        <div id="controls">
            <button id="createBtn">Create Stream</button>
            <button id="startBtn" disabled>Start Stream</button>
            <button id="endBtn" disabled>End Stream</button>
            <button id="toggleVideo">📹</button>
            <button id="toggleAudio">🎤</button>
            <button id="screenShare">🖥️</button>
        </div>

        <!-- Chat -->
        <div id="chat">
            <div id="messages"></div>
            <div id="chatInput">
                <input type="text" id="messageInput" placeholder="Type a message...">
                <button id="sendBtn">Send</button>
            </div>
        </div>

        <!-- Reactions -->
        <div id="reactions">
            <button onclick="sendReaction('❤️')">❤️</button>
            <button onclick="sendReaction('👍')">👍</button>
            <button onclick="sendReaction('😂')">😂</button>
            <button onclick="sendReaction('🔥')">🔥</button>
        </div>
    </div>

    <script>
        let streamClient;
        let currentStreamId;

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            // Get JWT token (from login)
            const token = localStorage.getItem('authToken');
            
            streamClient = new EnhancedLiveStreamClient({
                serverUrl: 'http://localhost:5000',
                token: token
            });

            setupEventHandlers();
            streamClient.connect();
        });

        function setupEventHandlers() {
            // Connection events
            streamClient.on('connected', () => {
                console.log('Connected to stream server');
            });

            // Stream events
            streamClient.on('stream_created', (data) => {
                currentStreamId = data.streamId;
                document.getElementById('startBtn').disabled = false;
                console.log('Stream created:', data);
            });

            streamClient.on('stream_started', (data) => {
                document.getElementById('startBtn').disabled = true;
                document.getElementById('endBtn').disabled = false;
                console.log('Stream started');
            });

            // Chat events
            streamClient.on('stream_chat_message', (data) => {
                addChatMessage(data.sender.username, data.message);
            });

            // Viewer events
            streamClient.on('viewer_count_update', (data) => {
                document.getElementById('viewerCount').textContent = 
                    `${data.currentViewers} viewers`;
            });

            // UI event handlers
            document.getElementById('createBtn').onclick = createStream;
            document.getElementById('startBtn').onclick = startStream;
            document.getElementById('endBtn').onclick = endStream;
            document.getElementById('sendBtn').onclick = sendMessage;
            
            document.getElementById('messageInput').onkeypress = (e) => {
                if (e.key === 'Enter') sendMessage();
            };
        }

        async function createStream() {
            try {
                const streamData = await streamClient.createStream({
                    title: 'My Live Stream',
                    description: 'Welcome to my stream!',
                    category: 'entertainment'
                });
                
                document.getElementById('streamTitle').textContent = streamData.stream.title;
                document.getElementById('streamCategory').textContent = streamData.stream.category;
                
            } catch (error) {
                console.error('Error creating stream:', error);
                alert('Failed to create stream');
            }
        }

        async function startStream() {
            try {
                const videoElement = document.getElementById('localVideo');
                await streamClient.startBroadcast(videoElement);
                await streamClient.startStream(currentStreamId);
                
            } catch (error) {
                console.error('Error starting stream:', error);
                alert('Failed to start stream');
            }
        }

        async function endStream() {
            try {
                await streamClient.endStream(currentStreamId);
                document.getElementById('endBtn').disabled = true;
                document.getElementById('createBtn').disabled = false;
                
            } catch (error) {
                console.error('Error ending stream:', error);
            }
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message && currentStreamId) {
                streamClient.sendChatMessage(message);
                input.value = '';
            }
        }

        function addChatMessage(username, message) {
            const messagesDiv = document.getElementById('messages');
            const messageElement = document.createElement('div');
            messageElement.innerHTML = `<strong>${username}:</strong> ${message}`;
            messagesDiv.appendChild(messageElement);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function sendReaction(emoji) {
            if (currentStreamId) {
                streamClient.sendReaction(emoji);
            }
        }
    </script>

    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
        }

        #app {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
        }

        #video-container {
            position: relative;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
        }

        #localVideo {
            width: 100%;
            height: 400px;
            object-fit: cover;
        }

        #overlay {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            display: flex;
            justify-content: space-between;
            color: white;
        }

        #controls {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            background: #007bff;
            color: white;
            cursor: pointer;
        }

        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        #chat {
            background: white;
            border-radius: 8px;
            padding: 20px;
            height: 400px;
            display: flex;
            flex-direction: column;
        }

        #messages {
            flex: 1;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            margin-bottom: 10px;
        }

        #chatInput {
            display: flex;
            gap: 10px;
        }

        #messageInput {
            flex: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        #reactions {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }

        #reactions button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 18px;
        }
    </style>
</body>
</html>
```

## Troubleshooting

### Common Issues

#### 1. WebRTC Connection Failed
```javascript
// Check browser support
const support = checkWebRTCSupport();
console.log('WebRTC Support:', support);

// Check STUN/TURN servers
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

#### 2. Audio/Video Permission Denied
```javascript
async function requestPermissions() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    // Permissions granted
    stream.getTracks().forEach(track => track.stop());
    return true;
    
  } catch (error) {
    console.error('Permission denied:', error);
    alert('Please allow camera and microphone access');
    return false;
  }
}
```

#### 3. Socket Connection Issues
```javascript
// Add connection error handling
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
  
  if (error.message.includes('Authentication')) {
    // Refresh token and retry
    refreshAuthToken().then(() => {
      socket.connect();
    });
  }
});

// Add reconnection logic
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Manual reconnection required
    socket.connect();
  }
  // else automatic reconnection will be attempted
});
```

#### 4. Stream Quality Issues
```javascript
// Monitor connection quality
function monitorStreamQuality(peerConnection) {
  setInterval(async () => {
    const stats = await peerConnection.getStats();
    
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        const packetsLost = report.packetsLost || 0;
        const packetsSent = report.packetsSent || 0;
        const lossRate = packetsLost / packetsSent * 100;
        
        if (lossRate > 5) {
          console.warn('High packet loss detected:', lossRate + '%');
          // Reduce quality
          adaptQuality(peerConnection, 1500); // Lower bitrate
        }
      }
    });
  }, 5000);
}
```

### Debug Mode

```javascript
// Enable debug logging
const client = new EnhancedLiveStreamClient({
  serverUrl: 'http://localhost:5000',
  token: token,
  debug: true // Enable detailed logging
});

// Monitor all events
client.on('*', (eventName, data) => {
  console.log(`Event: ${eventName}`, data);
});
```

## Performance Optimization

### Server-Side Optimizations

#### 1. Connection Pooling
```javascript
// Limit concurrent connections per user
const connectionLimits = new Map();

io.use((socket, next) => {
  const userId = socket.userId;
  const userConnections = connectionLimits.get(userId) || 0;
  
  if (userConnections >= 5) {
    return next(new Error('Too many connections'));
  }
  
  connectionLimits.set(userId, userConnections + 1);
  next();
});
```

#### 2. Memory Management
```javascript
// Clean up inactive streams
setInterval(() => {
  const now = Date.now();
  
  for (const [streamId, stream] of activeStreams) {
    if (now - stream.lastActivity > 30 * 60 * 1000) { // 30 minutes
      cleanupStream(streamId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
```

#### 3. Database Optimization
```javascript
// Use indexes for common queries
db.livestreams.createIndex({ "status": 1, "category": 1 });
db.livestreams.createIndex({ "host": 1, "createdAt": -1 });
db.livestreams.createIndex({ "currentViewers": -1 });

// Aggregate viewer data efficiently
const popularStreams = await LiveStream.aggregate([
  { $match: { status: 'live' } },
  { $sort: { currentViewers: -1 } },
  { $limit: 10 },
  { $project: { title: 1, hostName: 1, currentViewers: 1, category: 1 } }
]);
```

### Client-Side Optimizations

#### 1. Lazy Loading
```javascript
// Load stream data on demand
async function loadStreamData(streamId) {
  if (streamCache.has(streamId)) {
    return streamCache.get(streamId);
  }
  
  const streamData = await fetchStreamData(streamId);
  streamCache.set(streamId, streamData);
  return streamData;
}
```

#### 2. Video Quality Adaptation
```javascript
// Auto-adjust quality based on connection
function autoAdjustQuality(peerConnection) {
  navigator.connection?.addEventListener('change', () => {
    const connection = navigator.connection;
    let targetBitrate;
    
    switch (connection.effectiveType) {
      case 'slow-2g':
      case '2g':
        targetBitrate = 500; // 500 kbps
        break;
      case '3g':
        targetBitrate = 1000; // 1 Mbps
        break;
      case '4g':
      default:
        targetBitrate = 2500; // 2.5 Mbps
        break;
    }
    
    adaptQuality(peerConnection, targetBitrate);
  });
}
```

#### 3. Efficient Event Handling
```javascript
// Debounce chat typing indicators
const sendTypingIndicator = debounce(() => {
  socket.emit('stream_chat_typing', { streamId });
}, 1000);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

## Security

### Authentication & Authorization

#### JWT Token Validation
```javascript
// Server-side token validation
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = user._id.toString();
    socket.user = user;
    next();
    
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};
```

#### Stream Access Control
```javascript
// Verify stream access permissions
async function verifyStreamAccess(userId, stream) {
  // Check if stream is public
  if (stream.streamType === 'public') {
    return true;
  }
  
  // Check if user is the host
  if (stream.host.toString() === userId) {
    return true;
  }
  
  // Check if stream is for followers only
  if (stream.streamType === 'followers_only') {
    return await checkIfFollowing(userId, stream.host);
  }
  
  // Check if stream requires payment
  if (stream.streamType === 'paid') {
    return await checkIfPaid(userId, stream._id);
  }
  
  return false;
}
```

### Input Validation

#### Message Sanitization
```javascript
import DOMPurify from 'dompurify';

function sanitizeChatMessage(message) {
  // Remove HTML tags and malicious content
  const cleaned = DOMPurify.sanitize(message, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
  
  // Limit message length
  return cleaned.substring(0, 500);
}
```

#### Rate Limiting
```javascript
// Implement rate limiting for chat messages
const messageRateLimiter = new Map();

function checkMessageRateLimit(userId) {
  const now = Date.now();
  const userLimits = messageRateLimiter.get(userId) || { count: 0, resetTime: now + 60000 };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + 60000; // 1 minute window
  }
  
  if (userLimits.count >= 30) { // Max 30 messages per minute
    return false;
  }
  
  userLimits.count++;
  messageRateLimiter.set(userId, userLimits);
  return true;
}
```

### Content Protection

#### Stream Key Security
```javascript
// Generate secure stream keys
function generateStreamKey() {
  const prefix = 'live_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return prefix + randomBytes;
}

// Rotate stream keys periodically
async function rotateStreamKey(streamId) {
  const newKey = generateStreamKey();
  
  await LiveStream.findByIdAndUpdate(streamId, {
    streamKey: newKey,
    keyRotatedAt: new Date()
  });
  
  return newKey;
}
```

#### HTTPS/WSS Enforcement
```javascript
// Enforce secure connections in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## Conclusion

The Enhanced LiveStream Platform provides a comprehensive, production-ready solution for live streaming with enterprise-grade features. With its modular architecture, extensive API, and robust client libraries, it can be easily integrated into any application requiring real-time streaming capabilities.

For additional support, examples, or feature requests, please refer to the project repository or contact the development team.

**Happy Streaming! 🎥✨**