Aeko

Aeko is a next-generation social media platform designed to connect people, empower creators, and enhance digital conversations.
It combines traditional social networking with AI-driven interactions through customizable bot personalities, subscriptions, and verification systems.
Features

    🔐 Secure User Authentication (bcrypt password hashing)

    🧑‍🤝‍🧑 Follow and Connect with other users

    🖼️ Create and Share Posts with Privacy Controls

    🔒 Post Privacy Settings (public, followers, select users, only me)

    📤 Share Posts to Status (24-hour temporary sharing)

    🤖 Personal AI Bots (customizable personalities)

    📜 Subscription System (with Blue and Golden verification ticks)

    🛡️ Scalable, Secure, and Modern Backend

    📊 Database Migrations for Schema Updates

Tech Stack

    Backend: Node.js, Express.js

    Database: MongoDB (Mongoose ODM)

    Authentication: Bcrypt

    Frontend: (To be added — React, Next.js or other)

    Hosting: (To be added — AWS, Vercel, Render, etc.)

Getting Started
Prerequisites

    Node.js (v18 or higher)

    MongoDB database

Installation

# Clone the repository
git clone https://github.com/your-username/aeko.git

# Navigate into the project folder
cd aeko

# Install dependencies
npm install

# Set up environment variables
# Create a .env file and add:
# MONGO_URI=your_mongodb_connection_string
# JWT_SECRET=your_jwt_secret

# Run database migrations (for existing installations)
npm run migrate:post-privacy

# Start the server
npm run dev

API Overview
Endpoint	Method	Description
/api/auth/register	POST	Register a new user
/api/auth/login	POST	Login and retrieve auth token
/api/users/:id	GET	Fetch a user's profile
/api/posts/create	POST	Create a new post with privacy controls
/api/posts/:postId/privacy	PUT	Update privacy settings for a post
/api/posts/:postId/share-to-status	POST	Share a post to status (24h expiry)
/api/posts/feed	GET	Get privacy-filtered post feed
/api/bots/:id	PATCH	Update bot personality or status

📚 **Full API Documentation**: Available at `/api-docs` when server is running
🔧 **Interactive API Testing**: Swagger UI with all endpoints and schemas
Environment Variables
Variable	Purpose
MONGO_URI	MongoDB connection string
JWT_SECRET	Secret for JWT token signing

## Database Migrations

This project uses database migrations to safely update the schema as features are added.

### Running Migrations

```bash
# Check migration status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Run specific post privacy migration
npm run migrate:post-privacy
```

### Available Migrations

- **001-add-post-privacy-fields**: Adds privacy controls to existing posts

## Privacy Features

### Post Privacy Levels

- **Public**: Visible to all users (default)
- **Followers**: Visible only to users who follow the post creator
- **Select Users**: Visible only to specifically chosen users
- **Only Me**: Visible only to the post creator

### Post Sharing to Status

- Share any accessible post to your 24-hour status
- Original post content and creator information preserved
- Respects original post privacy settings
Contribution

Contributions are welcome! 🚀
Please fork the repository and submit a pull request.
License

This project is licensed under the MIT License.
Contact

    Project Lead: Dr Milli

    Email: ekeminieffiong22@gmail.com

    GitHub: @dr_milli

    website: www.millihub.com.ng

