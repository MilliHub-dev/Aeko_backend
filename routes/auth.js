import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import emailService from "../services/emailService.js";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
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
 *         id:
 *           type: string
 *           description: User ID
 *         name:
 *           type: string
 *           description: User's full name
 *         username:
 *           type: string
 *           description: Unique username
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
 *             hasVerifiedEmail:
 *               type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439011"
 *         name: "John Doe"
 *         username: "johndoe"
 *         email: "john@example.com"
 *         profilePicture: "https://example.com/profile.jpg"
 *         bio: "Tech enthusiast"
 *         blueTick: true
 *         goldenTick: false
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

// Helper to generate verification code
const generateVerificationCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { code, codeExpiresAt };
};

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
      const payload = { id: req.user.id, email: req.user.email };
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
    let dbUser = await prisma.user.findFirst({ 
        where: { oauthProvider: 'google', oauthId }
    });

    if (!dbUser) {
      if (email) {
        dbUser = await prisma.user.findUnique({ where: { email } });
      }

      if (dbUser) {
        // Link existing account
        const currentEmailVerification = dbUser.emailVerification || {};
        dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                oauthProvider: 'google',
                oauthId: oauthId,
                avatar: user?.photo || dbUser.avatar || '',
                emailVerification: { ...currentEmailVerification, isVerified: true }
            }
        });
        console.log(`Linked existing account ${email} to Google OAuth (mobile)`);
      } else {
        // Create new user with unique username
        const usernameBase = user?.name || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        let username = usernameBase.replace(/\s+/g, '').toLowerCase();
        let counter = 1;
        
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${usernameBase.replace(/\s+/g, '').toLowerCase()}${counter}`;
          counter++;
        }

        dbUser = await prisma.user.create({
          data: {
            name: user?.name || username,
            username,
            email: email || `${oauthId}@google-oauth.local`,
            password: oauthId,
            oauthProvider: 'google',
            oauthId,
            avatar: user?.photo || '',
            emailVerification: { isVerified: true },
          }
        });
        console.log(`Created new user ${username} via Google OAuth (mobile)`);
      }
    }

    // Update last login and avatar
    const updateData = { lastLoginAt: new Date() };
    if (user?.photo && dbUser.avatar !== user.photo) {
      updateData.avatar = user.photo;
    }
    
    dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: updateData
    });

    // Generate JWT
    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      deepLink: `aeko://(home)?token=${token}`,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        username: dbUser.username,
        email: dbUser.email,
        profilePicture: dbUser.profilePicture,
        avatar: dbUser.avatar,
        bio: dbUser.bio,
        blueTick: dbUser.blueTick,
        goldenTick: dbUser.goldenTick,
        emailVerification: { isVerified: dbUser.emailVerification?.isVerified },
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
        const existingUser = await prisma.user.findFirst({ 
            where: {
                OR: [{ email }, { username }] 
            }
        });

        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: existingUser.email === email ? "Email already registered" : "Username already taken" 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification code
        const { code: verificationCode, codeExpiresAt } = generateVerificationCode();

        // Create new user
        const newUser = await prisma.user.create({
            data: { 
                name, 
                username, 
                email, 
                password: hashedPassword,
                emailVerification: {
                    isVerified: false,
                    verificationCode: verificationCode,
                    codeExpiresAt: codeExpiresAt,
                    codeAttempts: 0,
                    lastCodeSent: new Date()
                },
                profileCompletion: {
                    hasProfilePicture: false,
                    hasBio: false,
                    hasFollowers: false,
                    hasVerifiedEmail: false,
                    completionPercentage: 0
                }
            }
        });

        // Send verification email
        const emailResult = await emailService.sendVerificationCode(email, verificationCode, name);
        
        if (!emailResult.success) {
            console.error('Failed to send verification email:', emailResult.message);
            console.log(`🔐 DEVELOPMENT MODE - Verification code for ${email}: ${verificationCode}`);
        }

        res.status(201).json({ 
            success: true,
            message: emailResult.success 
                ? "Registration successful! Check your email for verification code"
                : `Registration successful! Email service unavailable. Your verification code is: ${verificationCode}`,
            userId: newUser.id,
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

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        const emailVerification = user.emailVerification || {};

        if (emailVerification.isVerified) {
            return res.status(400).json({ 
                success: false, 
                message: "Email already verified" 
            });
        }

        // Verification logic
        if (!emailVerification.verificationCode) {
             return res.status(400).json({ success: false, message: 'No verification code found' });
        }

        if (new Date(emailVerification.codeExpiresAt) < new Date()) {
             return res.status(400).json({ success: false, message: 'Verification code has expired' });
        }

        if ((emailVerification.codeAttempts || 0) >= 3) {
             return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new code' });
        }

        if (emailVerification.verificationCode === verificationCode) {
            // Success
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    emailVerification: {
                        ...emailVerification,
                        isVerified: true,
                        verificationCode: null,
                        codeExpiresAt: null,
                        codeAttempts: 0
                    },
                    profileCompletion: {
                        ...(user.profileCompletion || {}),
                        hasVerifiedEmail: true,
                        // Could update percentage here too
                    }
                }
            });

            // Send welcome email
            await emailService.sendWelcomeEmail(user.email, user.name);

            // Generate JWT token
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

            res.json({ 
                success: true,
                message: "Email verified successfully! Welcome to Aeko!",
                token,
                deepLink: `aeko://(home)?token=${token}`,
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    profilePicture: updatedUser.profilePicture,
                    bio: updatedUser.bio,
                    blueTick: updatedUser.blueTick,
                    emailVerification: { isVerified: true },
                    profileCompletion: updatedUser.profileCompletion
                }
            });

        } else {
            // Fail
            await prisma.user.update({
                where: { id: userId },
                data: {
                    emailVerification: {
                        ...emailVerification,
                        codeAttempts: (emailVerification.codeAttempts || 0) + 1
                    }
                }
            });
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid verification code' 
            });
        }

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

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        const emailVerification = user.emailVerification || {};

        if (emailVerification.isVerified) {
            return res.status(400).json({ 
                success: false, 
                message: "Email already verified" 
            });
        }

        const lastCodeSent = emailVerification.lastCodeSent ? new Date(emailVerification.lastCodeSent) : null;
        if (lastCodeSent && (new Date() - lastCodeSent < 60000)) {
             return res.status(429).json({ 
                success: false, 
                message: "Please wait 1 minute before requesting a new code" 
            });
        }

        // Reset attempts and generate new code
        const { code: verificationCode, codeExpiresAt } = generateVerificationCode();
        
        await prisma.user.update({
            where: { id: userId },
            data: {
                emailVerification: {
                    ...emailVerification,
                    verificationCode,
                    codeExpiresAt,
                    codeAttempts: 0,
                    lastCodeSent: new Date()
                }
            }
        });

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

        const user = await prisma.user.findUnique({ where: { email } });
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
        const emailVerification = user.emailVerification || {};
        if (!emailVerification.isVerified) {
            return res.status(401).json({ 
                success: false, 
                message: "Please verify your email before logging in",
                emailVerified: false,
                userId: user.id
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
        // Note: TwoFactorService will need to be checked if it uses Mongoose
        const twoFactorStatus = await TwoFactorService.get2FAStatus(user.id);
        
        if (twoFactorStatus.isEnabled) {
            // 2FA is enabled, verify the token or backup code
            if (!twoFactorToken && !backupCode) {
                return res.status(200).json({
                    success: false,
                    message: "2FA verification required",
                    requires2FA: true,
                    userId: user.id
                });
            }

            let twoFactorValid = false;

            if (backupCode) {
                // Verify backup code
                try {
                    twoFactorValid = await TwoFactorService.verifyBackupCodeForLogin(user.id, backupCode);
                } catch (error) {
                    console.log(`2FA backup code verification failed for user ${email}:`, error.message);
                }
            } else if (twoFactorToken) {
                // Verify TOTP token
                try {
                    twoFactorValid = await TwoFactorService.validateLoginWith2FA(user.id, twoFactorToken);
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

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Send login notification email
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const time = new Date().toLocaleString();
        
        // Don't await this to avoid delaying the response
        emailService.sendLoginNotification(user.email, user.name, time, userAgent)
            .catch(err => console.error('Failed to send login notification:', err));
        
        res.json({ 
            success: true,
            message: "Login successful",
            token,
            deepLink: `aeko://(home)?token=${token}`,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                blueTick: user.blueTick,
                goldenTick: user.goldenTick,
                aekoBalance: user.aekoBalance,
                emailVerification: { isVerified: emailVerification.isVerified },
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
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        const profileCompletion = user.profileCompletion || {};

        // Generate next steps
        const nextSteps = [];
        if (!profileCompletion.hasProfilePicture) {
            nextSteps.push("Add a profile picture");
        }
        if (!profileCompletion.hasBio) {
            nextSteps.push("Write a bio (minimum 10 characters)");
        }
        if (!profileCompletion.hasFollowers) {
            nextSteps.push("Get your first follower");
        }
        if (!profileCompletion.hasVerifiedEmail) {
            nextSteps.push("Verify your email address");
        }

        res.json({ 
            success: true,
            profileCompletion: {
                ...profileCompletion,
                blueTick: user.blueTick,
                nextSteps: nextSteps,
                requirements: {
                    profilePicture: profileCompletion.hasProfilePicture,
                    bio: profileCompletion.hasBio,
                    followers: profileCompletion.hasFollowers,
                    email: profileCompletion.hasVerifiedEmail
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

// Get current authenticated user (useful after OAuth)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Remove sensitive fields manually since .select() is not available in Prisma findUnique (it is, but we want to exclude)
        // Actually, explicit select is better
        
        res.json({ 
            success: true,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                avatar: user.avatar,
                bio: user.bio,
                blueTick: user.blueTick,
                goldenTick: user.goldenTick,
                emailVerification: { isVerified: user.emailVerification?.isVerified },
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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            clearTimeout(timeout);
            // Don't reveal that the email doesn't exist for security
            return res.json({ 
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
        }

        const resetToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // In a real app, you would save this token hash in the DB to invalidate it after use
        // or check against it. For now we just send it.

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        
        await emailService.sendPasswordResetEmail(email, user.name, resetLink);
        
        clearTimeout(timeout);
        res.json({ 
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.' 
        });

    } catch (error) {
        clearTimeout(timeout);
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to process request', 
            error: error.message 
        });
    }
});

// ✅ Reset Password Route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token and new password are required'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
            error: error.message
        });
    }
});

export default router;
