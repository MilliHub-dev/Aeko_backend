import express from "express";
import jwt from "jsonwebtoken";
import Web3 from "web3";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import emailService from "../services/emailService.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import nodemailer from 'nodemailer';
import passport from "../config/passport.js";
import TwoFactorService from "../services/twoFactorService.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";


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
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset for user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             example:
 *               email: "john@example.com"
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Bad request (e.g. invalid email)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 * 
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
// Google OAuth routes - only available if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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

      // Redirect to deep link for mobile app
      const deepLinkUrl = `aeko://(home)?token=${token}`;
      res.redirect(deepLinkUrl);
    } catch (err) {
      console.error('OAuth callback error:', err);
      const failUrl = process.env.OAUTH_FAILURE_REDIRECT || "aeko://auth/failed";
      const separator = failUrl.includes('?') ? '&' : '?';
      const errorMessage = encodeURIComponent(err.message || 'Authentication failed');
      res.redirect(`${failUrl}${separator}error=oauth_failed&message=${errorMessage}`);
    }
  }
  );
} else {
  // Provide fallback routes when Google OAuth is not configured
  router.get("/google", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured on this server"
    });
  });

  router.get("/google/callback", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured on this server"
    });
  });
}

/**
 * @swagger
 * /api/auth/google/mobile:
 *   post:
 *     summary: Google OAuth for mobile apps (React Native)
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from mobile SDK
 *               user:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   photo:
 *                     type: string
 *     responses:
 *       200:
 *         description: Successful authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 deepLink:
 *                   type: string
 *                   description: Deep link URL for mobile app navigation
 *                   example: "aeko://(home)?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - missing ID token
 *       401:
 *         description: Invalid ID token
 */
// Mobile Google OAuth endpoint - only available if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.post('/google/mobile', async (req, res) => {
    try {
      const { idToken, user } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          message: 'ID token is required'
        });
      }

    // Import and verify the ID token
    const passportModule = await import('../config/passport.js');
    const verifyGoogleIdToken = passportModule.verifyGoogleIdToken;
    
    const payload = await verifyGoogleIdToken(idToken);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ID token'
      });
    }

    const email = payload.email?.toLowerCase();
    const oauthId = payload.sub;

    // Find or create user (same logic as web OAuth)
    let dbUser = await User.findOne({ oauthProvider: 'google', oauthId });

    if (!dbUser) {
      if (email) {
        dbUser = await User.findOne({ email });
      }

      if (dbUser) {
        // Link existing account
        dbUser.oauthProvider = 'google';
        dbUser.oauthId = oauthId;
        dbUser.avatar = user?.photo || dbUser.avatar || '';
        dbUser.emailVerification.isVerified = true;
        await dbUser.save();
        console.log(`Linked existing account ${email} to Google OAuth (mobile)`);
      } else {
        // Create new user with unique username
        const usernameBase = user?.name || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        let username = usernameBase.replace(/\s+/g, '').toLowerCase();
        let counter = 1;
        
        while (await User.findOne({ username })) {
          username = `${usernameBase.replace(/\s+/g, '').toLowerCase()}${counter}`;
          counter++;
        }

        dbUser = await User.create({
          name: user?.name || username,
          username,
          email: email || `${oauthId}@google-oauth.local`,
          password: oauthId,
          oauthProvider: 'google',
          oauthId,
          avatar: user?.photo || '',
          'emailVerification.isVerified': true,
        });
        console.log(`Created new user ${username} via Google OAuth (mobile)`);
      }
    }

    // Update last login and avatar
    dbUser.lastLoginAt = new Date();
    if (user?.photo && dbUser.avatar !== user.photo) {
      dbUser.avatar = user.photo;
    }
    await dbUser.save();

    // Generate JWT
    const token = jwt.sign(
      { id: dbUser._id, email: dbUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      deepLink: `aeko://(home)?token=${token}`,
      user: {
        _id: dbUser._id,
        name: dbUser.name,
        username: dbUser.username,
        email: dbUser.email,
        profilePicture: dbUser.profilePicture,
        avatar: dbUser.avatar,
        bio: dbUser.bio,
        blueTick: dbUser.blueTick,
        goldenTick: dbUser.goldenTick,
        aekoBalance: dbUser.aekoBalance,
        emailVerification: { isVerified: dbUser.emailVerification.isVerified },
        profileCompletion: dbUser.profileCompletion,
        isAdmin: dbUser.isAdmin,
        oauthProvider: dbUser.oauthProvider,
      }
    });
  } catch (error) {
    console.error('Mobile Google OAuth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
  });
} else {
  // Provide fallback route when Google OAuth is not configured
  router.post('/google/mobile', (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured on this server"
    });
  });
}

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
            deepLink: `aeko://(home)?token=${token}`,
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

// Enhanced login with email verification check and 2FA support
router.post("/login", twoFactorMiddleware.checkLoginTwoFactor(), async (req, res) => {
    try {
        const { email, password, twoFactorToken, backupCode } = req.body;

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

        // Check if 2FA is enabled for this user
        const twoFactorStatus = await TwoFactorService.get2FAStatus(user._id);
        
        if (twoFactorStatus.isEnabled) {
            // 2FA is enabled, verify the token or backup code
            if (!twoFactorToken && !backupCode) {
                return res.status(200).json({
                    success: false,
                    message: "2FA verification required",
                    requires2FA: true,
                    userId: user._id
                });
            }

            let twoFactorValid = false;

            if (backupCode) {
                // Verify backup code
                try {
                    twoFactorValid = await TwoFactorService.verifyBackupCodeForLogin(user._id, backupCode);
                } catch (error) {
                    console.log(`2FA backup code verification failed for user ${email}:`, error.message);
                }
            } else if (twoFactorToken) {
                // Verify TOTP token
                try {
                    twoFactorValid = await TwoFactorService.validateLoginWith2FA(user._id, twoFactorToken);
                } catch (error) {
                    console.log(`2FA TOTP verification failed for user ${email}:`, error.message);
                }
            }

            if (!twoFactorValid) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid 2FA token or backup code",
                    requires2FA: true
                });
            }

            console.log(`2FA verification successful for user ${email}`);
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        
        res.json({ 
            success: true,
            message: "Login successful",
            token,
            deepLink: `aeko://(home)?token=${token}`,
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
                isAdmin: user.isAdmin,
                twoFactorEnabled: twoFactorStatus.isEnabled
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

// Get current authenticated user (useful after OAuth)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes');
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                avatar: user.avatar,
                bio: user.bio,
                blueTick: user.blueTick,
                goldenTick: user.goldenTick,
                aekoBalance: user.aekoBalance,
                emailVerification: { isVerified: user.emailVerification.isVerified },
                profileCompletion: user.profileCompletion,
                isAdmin: user.isAdmin,
                oauthProvider: user.oauthProvider,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get user information', 
            error: error.message 
        });
    }
});

// ✅ Logout Route
router.post('/logout', (req, res) => {
    // Clear the token cookie
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    });
    
    res.json({ 
        success: true, 
        message: 'Logged out successfully' 
    });
});

// ✅ Forgot Password Route
router.post('/forgot-password', async (req, res) => {
    const emailSendingTimeout = 10000; // 10 seconds timeout
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                error: 'Email sending timed out. Please try again later.'
            });
        }
    }, emailSendingTimeout);

    try {
        const { email } = req.body;
        
        if (!email) {
            clearTimeout(timeout);
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const user = await User.findOne({ email }).select('_id email');
        if (!user) {
            clearTimeout(timeout);
            // Don't reveal that the email doesn't exist for security
            return res.json({ 
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
        }

        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Use the imported EmailService
        if (!emailService.isAvailable()) {
            clearTimeout(timeout);
            return res.status(500).json({
                success: false,
                error: 'Email service is not properly configured.'
            });
        }

        // Send email in the background
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        // Start email sending in the background
        (async () => {
            try {
                console.log(`Sending password reset email to ${email}...`);
                const emailResult = await emailService.sendPasswordResetEmail(
                    email,
                    user.username || 'User',
                    resetLink
                );
                
                if (emailResult.success) {
                    console.log(`Password reset email sent to ${email}`);
                } else {
                    console.error('Failed to send password reset email:', emailResult.message);
                }
            } catch (emailError) {
                console.error('Background email sending failed:', emailError);
            }
        })();

        // Immediately respond to the client
        clearTimeout(timeout);
        return res.json({ 
            success: true, 
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    } catch (error) {
        clearTimeout(timeout);
        console.error('Password reset error:', error);
        
        // Don't expose internal errors to the client
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An error occurred while processing your request.';
            
        res.status(500).json({ 
            success: false,
            error: errorMessage
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
