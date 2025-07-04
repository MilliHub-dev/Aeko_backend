Aeko

Aeko is a next-generation social media platform designed to connect people, empower creators, and enhance digital conversations.
It combines traditional social networking with AI-driven interactions through customizable bot personalities, subscriptions, and verification systems.
Features

    🔐 Secure User Authentication (bcrypt password hashing)

    🧑‍🤝‍🧑 Follow and Connect with other users

    🖼️ Create and Share Posts

    🤖 Personal AI Bots (customizable personalities)

    📜 Subscription System (with Blue and Golden verification ticks)

    🛡️ Scalable, Secure, and Modern Backend

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

# Start the server
npm run dev

API Overview
Endpoint	Method	Description
/api/auth/register	POST	Register a new user
/api/auth/login	POST	Login and retrieve auth token
/api/users/:id	GET	Fetch a user's profile
/api/posts	POST	Create a new post
/api/bots/:id	PATCH	Update bot personality or status

(more detailed API docs coming soon)
Environment Variables
Variable	Purpose
MONGO_URI	MongoDB connection string
JWT_SECRET	Secret for JWT token signing
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

