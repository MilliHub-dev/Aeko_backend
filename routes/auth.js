import express from "express";
import jwt from "jsonwebtoken";
import Web3 from "web3";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import emailService from "../services/emailService.js";
import nodemailer from 'nodemailer';
import passport from "../config/passport.js";


/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: User registration with email verification
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               username:
 *                 type: string
 *                 description: Unique username
 *                 example: "johndoe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: User registered successfully, verification code sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Registration successful! Check your email for verification code"
 *                 userId:
 *                   type: string
 *                   description: User ID for verification
 *       400:
 *         description: Bad request - validation errors
 *       409:
 *         description: User already exists
 *
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email with 4-digit code
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - verificationCode
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID from registration
 *               verificationCode:
 *                 type: string
 *                 pattern: '^[0-9]{4}$'
 *                 description: 4-digit verification code
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Email verified successfully"
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid or expired code
 *
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification code
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *     responses:
 *       200:
 *         description: New verification code sent
 *       429:
 *         description: Rate limit exceeded
 *
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials or unverified email
 *
 * /api/auth/profile-completion:
 *   get:
 *     summary: Get profile completion status
 *     tags:
 *       - Authentication
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profileCompletion:
 *                   type: object
 *                   properties:
 *                     completionPercentage:
 *                       type: number
 *                       example: 80
 *                     hasProfilePicture:
 *                       type: boolean
 *                     hasBio:
 *                       type: boolean
 *                     hasFollowers:
 *                       type: boolean
 *                     hasWalletConnected:
 *                       type: boolean
 *                       description: "Optional - not required for blue tick"
 *                     hasVerifiedEmail:
 *                       type: boolean
 *                     blueTick:
 *                       type: boolean
 *                     nextSteps:
 *                       type: array
 *                       items:
 *                         type: string
 *
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         name:
 *           type: string
 *           description: User's full name
 *         username:
 *           type: string
 *           description: Username
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         profilePicture:
 *           type: string
 *           description: Profile picture URL
 *         bio:
 *           type: string
 *           description: User bio
 *         blueTick:
 *           type: boolean
 *           description: Blue tick verification status
 *         goldenTick:
 *           type: boolean
 *           description: Golden tick verification status
 *         aekoBalance:
 *           type: number
 *           description: Aeko coin balance
 *         emailVerification:
 *           type: object
 *           properties:
 *             isVerified:
 *               type: boolean
 *         profileCompletion:
 *           type: object
 *           properties:
 *             completionPercentage:
 *               type: number
 *             hasProfilePicture:
 *               type: boolean
 *             hasBio:
 *               type: boolean
 *             hasFollowers:
 *               type: boolean
 *             hasWalletConnected:
 *               type: boolean
 *             hasVerifiedEmail:
 *               type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         _id: "507f1f77bcf86cd799439011"
 *         name: "John Doe"
 *         username: "johndoe"
 *         email: "john@example.com"
 *         profilePicture: "https://example.com/profile.jpg"
 *         bio: "Tech enthusiast and crypto lover"
 *         blueTick: true
 *         goldenTick: false
 *         aekoBalance: 1500.75
 *         emailVerification:
 *           isVerified: true
 *         profileCompletion:
 *           completionPercentage: 100
 *           hasProfilePicture: true
 *           hasBio: true
 *           hasFollowers: true
 *           hasWalletConnected: true
 *           hasVerifiedEmail: true
 *         createdAt: "2024-01-01T12:00:00Z"
 *         updatedAt: "2024-01-01T12:00:00Z"
 */


dotenv.config(); // Load environment variables

const router = express.Router();
const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.infura.io/")); // Polygon zkEVM

// Enhanced user registration with email verification
/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Redirect to Google for OAuth login/signup
 *     tags:
 *       - Authentication
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth consent screen
 *
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback. Issues JWT and redirects to frontend
 *     tags:
 *       - Authentication
 *     responses:
 *       302:
 *         description: Redirects to success or failure URL after issuing JWT
 *       401:
 *         description: OAuth failed
 */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: process.env.OAUTH_FAILURE_REDIRECT || "/auth/failed" }),
  async (req, res) => {
    try {
      const payload = { id: req.user._id, email: req.user.email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

      // Set JWT in HttpOnly cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Redirect to frontend
      const successUrl = process.env.OAUTH_SUCCESS_REDIRECT || "http://localhost:3000/auth/success";
      res.redirect(successUrl);
    } catch (err) {
      const failUrl = process.env.OAUTH_FAILURE_REDIRECT || "http://localhost:3000/auth/failed";
      res.redirect(failUrl);
    }
  }
);

router.post("/signup", async (req, res) => {
    try {
        const { name, username, email, password } = req.body;

        // Validation
        if (!name || !username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 6 characters long" 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: existingUser.email === email ? "Email already registered" : "Username already taken" 
            });
        }

        // Create new user (password will be hashed by pre-save hook)
        const newUser = new User({ 
            name, 
            username, 
            email, 
            password 
        });

        // Generate and send verification code
        const verificationCode = newUser.generateVerificationCode();
        await newUser.save();

        // Send verification email
        const emailResult = await emailService.sendVerificationCode(email, verificationCode, name);
        
        if (!emailResult.success) {
            console.error('Failed to send verification email:', emailResult.message);
        }

        // For development: log the verification code to console if email fails
        if (!emailResult.success) {
            console.log(`🔐 DEVELOPMENT MODE - Verification code for ${email}: ${verificationCode}`);
        }

        res.status(201).json({ 
            success: true,
            message: emailResult.success 
                ? "Registration successful! Check your email for verification code"
                : `Registration successful! Email service unavailable. Your verification code is: ${verificationCode}`,
            userId: newUser._id,
            emailSent: emailResult.success,
            verificationCode: !emailResult.success ? verificationCode : undefined // Only include in response if email failed
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Registration failed", 
            error: error.message 
        });
    }
});

// Verify email with 4-digit code
router.post("/verify-email", async (req, res) => {
    try {
        const { userId, verificationCode } = req.body;

        if (!userId || !verificationCode) {
            return res.status(400).json({ 
                success: false, 
                message: "User ID and verification code are required" 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        if (user.emailVerification.isVerified) {
            return res.status(400).json({ 
                success: false, 
                message: "Email already verified" 
            });
        }

        const verificationResult = user.verifyEmailCode(verificationCode);
        
        if (!verificationResult.success) {
            await user.save(); // Save failed attempt count
            return res.status(400).json({ 
                success: false, 
                message: verificationResult.message 
            });
        }

        await user.save();

        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, user.name);

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ 
            success: true,
            message: "Email verified successfully! Welcome to Aeko!",
            token,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                blueTick: user.blueTick,
                emailVerification: { isVerified: true },
                profileCompletion: user.profileCompletion
            }
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Email verification failed", 
            error: error.message 
        });
    }
});

// Resend verification code
router.post("/resend-verification", async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        if (user.emailVerification.isVerified) {
            return res.status(400).json({ 
                success: false, 
                message: "Email already verified" 
            });
        }

        if (!user.canRequestNewCode()) {
            return res.status(429).json({ 
                success: false, 
                message: "Please wait 1 minute before requesting a new code" 
            });
        }

        // Reset attempts and generate new code
        user.emailVerification.codeAttempts = 0;
        const verificationCode = user.generateVerificationCode();
        await user.save();

        // Send new verification email
        const emailResult = await emailService.sendVerificationCode(user.email, verificationCode, user.name);

        // For development: log the verification code to console if email fails
        if (!emailResult.success) {
            console.log(`🔐 DEVELOPMENT MODE - New verification code for ${user.email}: ${verificationCode}`);
        }

        res.json({ 
            success: true,
            message: emailResult.success 
                ? "New verification code sent to your email"
                : `Email service unavailable. Your new verification code is: ${verificationCode}`,
            emailSent: emailResult.success,
            verificationCode: !emailResult.success ? verificationCode : undefined
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to resend verification code", 
            error: error.message 
        });
    }
});

// Enhanced login with email verification check
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and password are required" 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log(`Login attempt failed: User not found for email ${email}`);
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log(`Login attempt failed: Invalid password for email ${email}`);
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }

        console.log(`Login attempt: User ${email} found, password valid, checking verification status...`);

        // Check if email is verified
        if (!user.emailVerification.isVerified) {
            return res.status(401).json({ 
                success: false, 
                message: "Please verify your email before logging in",
                emailVerified: false,
                userId: user._id
            });
        }

        // Check if user is banned
        if (user.banned) {
            return res.status(403).json({ 
                success: false, 
                message: "Your account has been suspended. Contact support." 
            });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        
        res.json({ 
            success: true,
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                blueTick: user.blueTick,
                goldenTick: user.goldenTick,
                aekoBalance: user.aekoBalance,
                emailVerification: { isVerified: user.emailVerification.isVerified },
                profileCompletion: user.profileCompletion,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Login failed", 
            error: error.message 
        });
    }
});

// Get profile completion status
router.get("/profile-completion", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Generate next steps
        const nextSteps = [];
        if (!user.profileCompletion.hasProfilePicture) {
            nextSteps.push("Add a profile picture");
        }
        if (!user.profileCompletion.hasBio) {
            nextSteps.push("Write a bio (minimum 10 characters)");
        }
        if (!user.profileCompletion.hasFollowers) {
            nextSteps.push("Get your first follower");
        }
        // Note: Wallet connection is optional for blue tick
        if (!user.profileCompletion.hasWalletConnected) {
            nextSteps.push("Connect your Solana wallet (optional - for Web3 features)");
        }
        if (!user.profileCompletion.hasVerifiedEmail) {
            nextSteps.push("Verify your email address");
        }

        res.json({ 
            success: true,
            profileCompletion: {
                ...user.profileCompletion.toObject(),
                blueTick: user.blueTick,
                nextSteps: nextSteps,
                requirements: {
                    profilePicture: user.profileCompletion.hasProfilePicture,
                    bio: user.profileCompletion.hasBio,
                    followers: user.profileCompletion.hasFollowers,
                    email: user.profileCompletion.hasVerifiedEmail
                },
                optional: {
                    wallet: user.profileCompletion.hasWalletConnected
                }
            }
        });

    } catch (error) {
        console.error('Profile completion error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to get profile completion status", 
            error: error.message 
        });
    }
});

// Wallet login with signature verification
router.post("/wallet-login", async (req, res) => {
    try {
        const { address, message, signature } = req.body;

        const recoveredAddress = web3.eth.accounts.recover(message, signature);
        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            const token = jwt.sign({ address }, process.env.JWT_SECRET, { expiresIn: "24h" });
            return res.json({ 
                success: true,
                message: "Login successful", 
                token 
            });
        }
        res.status(401).json({ 
            success: false,
            message: "Invalid signature" 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Error verifying signature", 
            error: error.message 
        });
    }
});

// ✅ Logout Route
router.post('/logout', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Logged out successfully' 
    });
});

// ✅ Forgot Password Route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // Send email (Use your SMTP settings)
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: { 
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS 
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `<p>Click <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}">here</a> to reset your password.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ 
            success: true, 
            message: 'Password reset link sent to email' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ✅ Reset Password Route
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'Invalid token or user not found' 
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ 
            success: true, 
            message: 'Password reset successful' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Temporary route to fix double-hashed passwords (remove after fixing)
router.post("/fix-password", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }
        
        // Update password (will be hashed by pre-save hook)
        user.password = password;
        await user.save();
        
        res.json({ 
            success: true, 
            message: "Password fixed successfully" 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Error fixing password", 
            error: error.message 
        });
    }
});

export default router; // ✅ ES Module export
