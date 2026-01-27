import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import privacyFilterMiddleware from "../middleware/privacyMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
// Register
router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { username: username }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                name: username // Default name to username
            }
        });

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login with email and password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: User retrieved
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// Get User Profile - Updated with privacy controls
router.get("/:id", authMiddleware, BlockingMiddleware.checkProfileAccess(), privacyFilterMiddleware.checkProfileAccess, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                posts: { take: 5, orderBy: { createdAt: 'desc' } }, // Limit posts for efficiency
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Filter sensitive information based on privacy settings
        const viewerId = req.userId || req.user?.id || req.user?._id;
        const profileId = req.params.id;
        
        // Exclude sensitive fields manually since we can't use .select() like Mongoose
        const { password, twoFactorAuth, ...safeUser } = user;

        // If viewing own profile, return full information (except password/secrets)
        if (viewerId === profileId) {
            return res.json(safeUser);
        }

        // For other users, filter based on privacy settings
        const filteredUser = {
            id: user.id,
            username: user.username,
            name: user.name,
            profilePicture: user.profilePicture,
            bio: user.bio,
            blueTick: user.blueTick,
            goldenTick: user.goldenTick,
            createdAt: user.createdAt
        };

        const privacy = user.privacy || {};
        const isPrivate = privacy.isPrivate || false;

        // Get actual followers/following from Json fields
        const followers = Array.isArray(user.followers) ? user.followers : []; 
        const following = Array.isArray(user.following) ? user.following : [];

        // Show follower counts and following status based on privacy
        if (!isPrivate) {
            filteredUser.followers = followers;
            filteredUser.following = following;
            filteredUser.followersCount = followers.length;
            filteredUser.followingCount = following.length;
            filteredUser.posts = user.posts;
        } else {
            // For private accounts, only show if viewer is a follower
            const isFollower = followers.includes(viewerId);
            if (isFollower) {
                filteredUser.followers = followers;
                filteredUser.following = following;
                filteredUser.followersCount = followers.length;
                filteredUser.followingCount = following.length;
                filteredUser.posts = user.posts;
            } else {
                filteredUser.isPrivate = true;
                filteredUser.followersCount = followers.length; // Usually visible even if private? Or 0? 
                // Instagram shows counts for private profiles. Let's show counts.
                filteredUser.followingCount = following.length;
                filteredUser.postsCount = user.posts?.length || 0;
            }
        }

        res.json(filteredUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

import upload from "../middleware/upload.js";

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by name or username
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalUsers:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const search = req.query.search;
        const skip = (page - 1) * limit;

        // Build search query
        let where = {};
        if (search) {
            where = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        // Get total count for pagination
        const totalUsers = await prisma.user.count({ where });
        const totalPages = Math.ceil(totalUsers / limit);

        // Get users with pagination
        const users = await prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        // Filter users based on privacy settings
        const filteredUsers = users.map(user => {
            // Remove sensitive fields and apply privacy filters
            const publicUser = {
                id: user.id,
                name: user.name,
                username: user.username,
                profilePicture: user.profilePicture,
                avatar: user.avatar,
                bio: user.bio,
                blueTick: user.blueTick,
                goldenTick: user.goldenTick,
                createdAt: user.createdAt,
                emailVerification: { isVerified: user.emailVerification?.isVerified || false }
            };

            const privacy = user.privacy || {};
            const isPrivate = privacy.isPrivate || false;

            // Add follower counts if profile is not private
            if (!isPrivate) {
                const followerIds = Array.isArray(user.followers) ? user.followers : [];
                const followingIds = Array.isArray(user.following) ? user.following : [];
                
                publicUser.followersCount = followerIds.length;
                publicUser.followingCount = followingIds.length;
                publicUser.postsCount = 0; // Placeholder, would need to fetch or store count
            } else {
                publicUser.isPrivate = true;
            }

            return publicUser;
        });

        res.json({
            success: true,
            users: filteredUsers,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                limit
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ 
            success: false,
            message: "Failed to retrieve users", 
            error: error.message 
        });
    }
});

/**
 * @swagger
 * /api/users/profile-picture:
 *   put:
 *     summary: Upload or update profile picture
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/profile-picture", authMiddleware, twoFactorMiddleware.requireTwoFactor(), upload.single("image"), async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?._id;
        const user = await prisma.user.update({
            where: { id: userId },
            data: { profilePicture: req.file.path }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

