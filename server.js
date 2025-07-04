//require("dotenv").config();
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js"; // ✅ Correct import
import postRoutes from "./routes/postRoutes.js"; // ✅ Correct import
import commentRoutes from "./routes/commentRoutes.js"; // ✅ Correct import
import swaggerDocs from "./swagger.js";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from "@adminjs/mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import adRoutes from './routes/adRoutes.js';
import profileRoutes from './routes/profile.js';
import paymentRoutes from './routes/paymentRoutes.js';
import statusRoutes from './routes/status.js';
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import auth from "./routes/auth.js";
//import chatsocket from "./chatsocket.js";
//import livestreamsocket from "./livestreamsocket.js";
import bot from "./routes/bot.js";
import challenges from "./routes/challenges.js";
import chat from "./routes/chat.js";
import debates from "./routes/debates.js";
import space from "./routes/space.js";
import { admin, adminRouter } from "./admin.js";



dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use("/api/auth", auth);
app.use("/api/bot", bot);
app.use("/api/challenges", challenges);
app.use("/api/chat", chat);
app.use("/api/debates", debates);
app.use("/api/space", space);
swaggerDocs(app);


// Register AdminJS with Mongoose
AdminJS.registerAdapter({ Database, Resource });


// Configure AdminJS
/* const adminOptions = {
  resources: [
    {
      resource: User,
      options: {
        properties: {
          password: { isVisible: false }, // Hide password
        },
        actions: {
          banUser: {
            actionType: "record",
            icon: "Ban",
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ banned: true });
              return { record: record.toJSON() };
            },
          },
        },
      },
    },
    {
      resource: Post,
      options: {
        actions: {
          delete: { isVisible: true }, // Allow post deletion
        },
      },
    },
    
  ],
  branding: {
    companyName: "Aeko Admin",
    logo: "https://your-logo-url.com/logo.png",
  },
}; */

// Setup AdminJS with Express

app.use(admin.options.rootPath, adminRouter);
//app.use(admin.options.rootPath, adminRouter);

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to Aeko Backend 🚀");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
