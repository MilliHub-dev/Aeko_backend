import  express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from"../models/User.js";
const router = express.Router();
import Web3  from "web3"; // Correct way to import in Web3 v4
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import privacyFilterMiddleware from "../middleware/privacyMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";

const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.infura.io/")); // Use Polygon zkEVM



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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();
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
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/users/wallet-login:
 *   post:
 *     summary: Login by verifying a wallet signature
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, message, signature]
 *             properties:
 *               address: { type: string }
 *               message: { type: string }
 *               signature: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid signature
 *       500:
 *         description: Server error
 */
// User login with wallet signature verification
router.post("/wallet-login", async (req, res) => {
  const { address, message, signature } = req.body;

  try {
    const recoveredAddress = web3.eth.accounts.recover(message, signature);
    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      const token = jwt.sign({ address }, process.env.JWT_SECRET, { expiresIn: "24h" });
      return res.json({ message: "Login successful", token });
    }
    res.status(401).json({ message: "Invalid signature" });
  } catch (error) {
    res.status(500).json({ message: "Error verifying signature", error });
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
router.get("/:id", authMiddleware, BlockingMiddleware.checkProfileAccess(), privacyFilterMiddleware.checkProfileAccess(), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password -twoFactorAuth.secret -twoFactorAuth.backupCodes");
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Filter sensitive information based on privacy settings
        const viewerId = req.userId;
        const profileId = req.params.id;
        
        // If viewing own profile, return full information
        if (viewerId === profileId) {
            return res.json(user);
        }

        // For other users, filter based on privacy settings
        const filteredUser = {
            _id: user._id,
            username: user.username,
            name: user.name,
            profilePicture: user.profilePicture,
            bio: user.bio,
            blueTick: user.blueTick,
            goldenTick: user.goldenTick,
            createdAt: user.createdAt
        };

        // Show follower counts and following status based on privacy
        if (!user.privacy?.isPrivate) {
            filteredUser.followers = user.followers;
            filteredUser.following = user.following;
            filteredUser.posts = user.posts;
        } else {
            // For private accounts, only show if viewer is a follower
            const isFollower = user.followers.includes(viewerId);
            if (isFollower) {
                filteredUser.followers = user.followers;
                filteredUser.following = user.following;
                filteredUser.posts = user.posts;
            } else {
                filteredUser.isPrivate = true;
                filteredUser.followersCount = user.followers?.length || 0;
                filteredUser.followingCount = user.following?.length || 0;
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
        let query = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get total count for pagination
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        // Get users with pagination
        const users = await User.find(query)
            .select("-password -twoFactorAuth.secret -twoFactorAuth.backupCodes -emailVerification.code -emailVerification.codeAttempts")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Filter users based on privacy settings
        const filteredUsers = users.map(user => {
            const userObj = user.toObject();
            
            // Remove sensitive fields and apply privacy filters
            const publicUser = {
                _id: userObj._id,
                name: userObj.name,
                username: userObj.username,
                profilePicture: userObj.profilePicture,
                avatar: userObj.avatar,
                bio: userObj.bio,
                blueTick: userObj.blueTick,
                goldenTick: userObj.goldenTick,
                createdAt: userObj.createdAt,
                emailVerification: { isVerified: userObj.emailVerification?.isVerified || false }
            };

            // Add follower counts if profile is not private
            if (!userObj.privacy?.isPrivate) {
                publicUser.followersCount = userObj.followers?.length || 0;
                publicUser.followingCount = userObj.following?.length || 0;
                publicUser.postsCount = userObj.posts?.length || 0;
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
        const user = await User.findByIdAndUpdate(req.userId, { profilePicture: req.file.path }, { new: true });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



export default router;

