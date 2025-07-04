import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import Message from "./models/Message.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Middleware
app.use(cors());
app.use(express.json());

/**
 * @swagger
 * /api/chat/sendMessage:
 *   post:
 *     summary: Send a message
 *     description: Sends a message from one user to another
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sender:
 *                 type: string
 *                 description: ID of the sender
 *               receiver:
 *                 type: string
 *                 description: ID of the receiver
 *               message:
 *                 type: string
 *                 description: The message content
 *             example:
 *               sender: "user123"
 *               receiver: "user456"
 *               message: "Hello!"
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       500:
 *         description: Error sending message
 * 
 * /api/chat/receiveMessage:
 *   get:
 *     summary: Receive messages for a user
 *     description: Retrieves messages for a specific user
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         description: ID of the user to retrieve messages for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       500:
 *         description: Error retrieving messages
 * 
 * /api/joinChat:
 *   post:
 *     summary: Join a chat room
 *     description: Joins a chat room for real-time messaging
 *     requestBody:
 *       required: true 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user joining the chat room
 *             example:
 *               userId: "user123"
 *     responses:
 *       200:
 *         description: Joined chat room successfully
 *       500:
 *         description: Error joining chat room
 * 
 * /api/chat/getMessages:
 *   get:
 *     summary: Get list of messages
 *     description: Retrieves messages for a specific user
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         description: ID of the user to retrieve messages for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       500:
 *         description: Error retrieving messages
 * 
 * /api/chat/getChatRooms:
 *   get:
 *     summary: Get list of chat rooms
 *     description: Retrieves chat rooms for a specific user
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         description: ID of the user to retrieve chat rooms for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat rooms retrieved successfully
 *       500:
 *         description: Error retrieving chat rooms
 */

// WebSocket for real-time messaging
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a chat room (for DMs)
  socket.on("joinChat", (userId) => {
    socket.join(userId);
  });

  // Handle sending messages
  socket.on("sendMessage", async ({ sender, receiver, message }) => {
    const newMessage = new Message({ sender, receiver, message });
    await newMessage.save();

    // Emit the message to the receiver
    io.to(receiver).emit("receiveMessage", newMessage);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
