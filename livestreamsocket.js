import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import { v4 as uuidV4 } from "uuid";

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; // Store active live streams
/**
 * @swagger
 * /api/livestream/create:
 *   post:
 *     summary: Create a new live stream room
 *     description: Creates a new live stream room and returns the room ID
 *     responses:
 *       200:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                   description: The ID of the created room
 *       500:
 *         description: Error creating room
 *
 * /api/livestream/join:
 *   post:
 *     summary: Join a live stream room
 *     description: Joins an existing live stream room
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: The ID of the room to join
 *               userId:
 *                 type: string
 *                 description: The ID of the user joining the room
 *     responses:
 *       200:
 *         description: Joined room successfully
 *       400:
 *         description: Room not found
 *       500:
 *         description: Error joining room
 *
 * /api/livestream/leave:
 *   post:
 *     summary: Leave a live stream room
 *     description: Leaves the live stream room
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: The ID of the room to leave
 *     responses:
 *       200:
 *         description: Left room successfully
 *       400:
 *         description: Room not found
 *       500:
 *         description: Error leaving room
 *
 * /api/livestream/join-room:
 *   get:
 *     summary: List of active rooms
 *     description: Returns a list of active live stream rooms
 *     responses:
 *       200:
 *         description: List of active rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roomId:
 *                         type: string
 *                         description: The ID of the room
 *                       host:
 *                         type: string
 *                         description: The ID of the host
 *                       participants:
 *                         type: array
 *                         items:
 *                           type: string
 *                           description: The IDs of the participants
 *       404:
 *         description: No rooms found
 *       500:
 *         description: Error retrieving rooms
 */



io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

// list of rooms
    app.get("/api/livestream/join-room", (req, res) => {
        const activeRooms = Object.entries(rooms).map(([roomId, room]) => ({
            roomId,
            host: room.host,
            participants: room.participants,
        }));
        res.status(200).json({ rooms: activeRooms });
    });

    // Create a live stream room
    socket.on("create-room", () => {
        const roomId = uuidV4();
        rooms[roomId] = { host: socket.id, participants: [] };
        socket.join(roomId);
        socket.emit("room-created", roomId);
        console.log(`Room ${roomId} created`);
    });

    // Join a live stream room
    socket.on("join-room", ({ roomId, userId }) => {
        if (!rooms[roomId]) {
            return socket.emit("error", "Room not found");
        }
        rooms[roomId].participants.push(userId);
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", userId);
        console.log(`User ${userId} joined Room ${roomId}`);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        for (const [roomId, room] of Object.entries(rooms)) {
            room.participants = room.participants.filter((id) => id !== socket.id);
            if (room.host === socket.id || room.participants.length === 0) {
                delete rooms[roomId];
                io.to(roomId).emit("room-ended");
                console.log(`Room ${roomId} closed`);
            }
        }
        console.log("User disconnected:", socket.id);
    });
});

server.listen(5000, () => console.log("Server running on port 5000"));
