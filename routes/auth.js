import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";
import dotenv from "dotenv";
import emailService from "../services/emailService.js";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import passport, {
  GoogleIdTokenConfigurationError,
  GoogleIdTokenVerificationError,
  hasConflictingGoogleOAuthIdentity,
  isGoogleIdTokenVerificationConfigured,
  verifyGoogleIdToken,
} from "../config/passport.js";
import TwoFactorService from "../services/twoFactorService.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import { getJwtSecret } from "../utils/authConfig.js";

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
 *               client:
 *                 type: string
 *                 description: Optional. Email a 6-digit code to exchange at /api/auth/verify-reset-otp when set to "mobile"; otherwise sends the web reset link.
 *             example:
 *               email: "john@example.com"
 *               client: "mobile"
 *     responses:
 *       200:
 *         description: Generic response returned regardless of account existence or email delivery outcome
 *       400:
 *         description: Bad request (e.g. invalid email)
 *       500:
 *         description: Internal server error
 *
 * /api/auth/verify-reset-otp:
 *   post:
 *     summary: Exchange a 6-digit password reset code for a short-lived reset token
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
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit password reset code emailed to the account
 *                 example: "123456"
 *             example:
 *               email: "john@example.com"
 *               otp: "123456"
 *     responses:
 *       200:
 *         description: Code accepted and exchanged for a reset token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 resetToken:
 *                   type: string
 *                   description: Short-lived token to submit to /api/auth/reset-password
 *       400:
 *         description: Generic rejection returned for an unknown, expired, mismatched or exhausted code
 *       500:
 *         description: Internal server error
 *
 */

dotenv.config(); // Load environment variables

const router = express.Router();
const PASSWORD_RESET_TOKEN_PURPOSE = "password-reset";
const PASSWORD_RESET_TOKEN_AUDIENCE = "password-reset";
const PASSWORD_RESET_JWT_SECRET_PLACEHOLDERS = new Set([
  "replace_with_a_unique_password_reset_secret",
  "replace_with_a_secure_password_reset_secret",
  "your_password_reset_jwt_secret",
  "your_password_reset_secret",
  "your_password_reset_secret_here",
  "password_reset_jwt_secret",
  "changeme",
  "default",
  "secret",
  "undefined",
  "null",
]);
const isPasswordResetJwtSecretPlaceholder = (secret) => {
  const normalizedSecret = secret.trim().toLowerCase();

  return (
    PASSWORD_RESET_JWT_SECRET_PLACEHOLDERS.has(normalizedSecret) ||
    /^<[^>]+>$/.test(normalizedSecret) ||
    /^\[[^\]]+\]$/.test(normalizedSecret)
  );
};
const getPasswordResetJwtSecret = () => {
  const configuredSecret = process.env.PASSWORD_RESET_JWT_SECRET?.trim();

  if (configuredSecret) {
    if (isPasswordResetJwtSecretPlaceholder(configuredSecret)) {
      throw new Error(
        "PASSWORD_RESET_JWT_SECRET must not use an example placeholder",
      );
    }

    return configuredSecret;
  }

  const jwtSecret = getJwtSecret();

  return createHmac("sha256", jwtSecret)
    .update(PASSWORD_RESET_TOKEN_PURPOSE)
    .digest("hex");
};
const hashPasswordResetToken = (token) =>
  createHash("sha256").update(token).digest("hex");

const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_OTP_TOKEN_TTL_MS = 15 * 60 * 1000;

const generatePasswordResetOtp = () => randomInt(100000, 1000000).toString();

// Keyed, not a bare digest: a 6-digit code has only 900k preimages, so an
// unkeyed sha256 of it is reversible offline from any read of the users table.
const hashPasswordResetOtp = (otp) =>
  createHmac("sha256", getPasswordResetJwtSecret()).update(otp).digest("hex");

// The generic /api/auth limiter (100 requests / 15 min / IP) caps neither the
// codes emailed to one address nor the guesses aimed at one account. Key on the
// target email as well as the IP so extra source addresses do not multiply
// either budget.
const passwordResetLimitKey = (req) =>
  `${
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : ""
  }|${ipKeyGenerator(req.ip)}`;

const passwordResetRequestLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: passwordResetLimitKey,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetVerifyLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: passwordResetLimitKey,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper to generate verification code
const generateVerificationCode = () => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, codeExpiresAt };
};

const hasUsableVerificationCode = (emailVerification) => {
  const codeExpiresAt = emailVerification.codeExpiresAt
    ? new Date(emailVerification.codeExpiresAt)
    : null;

  return Boolean(
    typeof emailVerification.verificationCode === "string" &&
    emailVerification.verificationCode.length > 0 &&
    codeExpiresAt &&
    !Number.isNaN(codeExpiresAt.getTime()) &&
    codeExpiresAt > new Date(),
  );
};

const clearVerificationCodeCooldown = (userId, emailVerification) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      emailVerification: {
        ...emailVerification,
        lastCodeSent: null,
      },
    },
  });

const getVerifiedGoogleIdentity = (payload) => {
  const oauthId = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  const email =
    typeof payload?.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";

  if (!oauthId || !email || payload?.email_verified !== true) {
    return null;
  }

  return {
    oauthId,
    email,
    name: typeof payload.name === "string" ? payload.name.trim() : "",
    avatar: typeof payload.picture === "string" ? payload.picture : "",
  };
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
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    }),
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: process.env.OAUTH_FAILURE_REDIRECT || "/auth/failed",
    }),
    async (req, res) => {
      try {
        const payload = {
          id: req.user.id,
          email: req.user.email,
          authTokenVersion: req.user.authTokenVersion ?? 0,
        };
        const token = jwt.sign(payload, getJwtSecret(), {
          expiresIn: "7d",
        });

        // Set JWT in HttpOnly cookie
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect to deep link for mobile app
        const deepLinkUrl = `aeko://(home)?token=${token}`;
        res.redirect(deepLinkUrl);
      } catch (err) {
        console.error("OAuth callback error:", err);
        const failUrl =
          process.env.OAUTH_FAILURE_REDIRECT || "aeko://auth/failed";
        const separator = failUrl.includes("?") ? "&" : "?";
        const errorMessage = encodeURIComponent(
          err.message || "Authentication failed",
        );
        res.redirect(
          `${failUrl}${separator}error=oauth_failed&message=${errorMessage}`,
        );
      }
    },
  );
} else {
  // Provide fallback routes when Google OAuth is not configured
  router.get("/google", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured on this server",
    });
  });

  router.get("/google/callback", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured on this server",
    });
  });
}

/**
 * @swagger
 * /api/auth/google/mobile:
 *   post:
 *     summary: Verify a Google ID token from a mobile app and issue an Aeko session
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
 *                 description: Google ID token. Its aud claim must match a configured Google OAuth client ID.
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
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - missing ID token
 *       401:
 *         description: Invalid ID token
 *       403:
 *         description: Account suspended
 *       409:
 *         description: Email is already linked to a different OAuth identity
 *       503:
 *         description: Google ID-token verification is not configured
 */
// Mobile ID-token verification needs a Google client ID, but never a client secret.
if (isGoogleIdTokenVerificationConfigured()) {
  router.post("/google/mobile", async (req, res) => {
    try {
      const { idToken } = req.body || {};

      if (
        typeof idToken !== "string" ||
        idToken.trim().length === 0 ||
        idToken.length > 10_000
      ) {
        return res.status(400).json({
          success: false,
          message: "A Google ID token is required",
        });
      }

      const payload = await verifyGoogleIdToken(idToken);
      const googleIdentity = getVerifiedGoogleIdentity(payload);

      if (!googleIdentity) {
        return res.status(401).json({
          success: false,
          message: "Invalid Google ID token",
        });
      }

      const { avatar, email, name, oauthId } = googleIdentity;

      // Look up the stable Google subject before considering an email link.
      let dbUser = await prisma.user.findUnique({
        where: {
          oauthProvider_oauthId: { oauthProvider: "google", oauthId },
        },
      });

      if (dbUser?.banned) {
        return res.status(403).json({
          success: false,
          message: "Account suspended",
        });
      }

      if (!dbUser) {
        dbUser = await prisma.user.findUnique({ where: { email } });

        if (dbUser?.banned) {
          return res.status(403).json({
            success: false,
            message: "Account suspended",
          });
        }

        if (dbUser) {
          if (hasConflictingGoogleOAuthIdentity(dbUser, oauthId)) {
            return res.status(409).json({
              success: false,
              message:
                "This email is already linked to a different sign-in method",
            });
          }

          // The signed Google claim, not client-provided profile data, links the account.
          const currentEmailVerification = dbUser.emailVerification || {};
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              oauthProvider: "google",
              oauthId,
              avatar: avatar || dbUser.avatar || "",
              emailVerification: {
                ...currentEmailVerification,
                isVerified: true,
              },
            },
          });
        } else {
          // Create a user from signed claims. OAuth accounts never receive a
          // predictable fallback password.
          const usernameBase =
            name || email.split("@")[0] || `user_${oauthId.slice(-6)}`;
          let username = usernameBase.replace(/\s+/g, "").toLowerCase();
          let counter = 1;

          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${usernameBase.replace(/\s+/g, "").toLowerCase()}${counter}`;
            counter++;
          }

          dbUser = await prisma.user.create({
            data: {
              name: name || username,
              username,
              email,
              password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
              oauthProvider: "google",
              oauthId,
              avatar,
              emailVerification: { isVerified: true },
            },
          });
        }
      }

      // Refresh only data authenticated by Google and record the login.
      const currentEmailVerification = dbUser.emailVerification || {};
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          lastLoginAt: new Date(),
          ...(avatar && dbUser.avatar !== avatar ? { avatar } : {}),
          emailVerification: {
            ...currentEmailVerification,
            isVerified: true,
          },
        },
      });

      // Generate JWT
      const token = jwt.sign(
        {
          id: dbUser.id,
          email: dbUser.email,
          authTokenVersion: dbUser.authTokenVersion ?? 0,
        },
        getJwtSecret(),
        { expiresIn: "7d" },
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
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
          emailVerification: {
            isVerified: dbUser.emailVerification?.isVerified,
          },
          profileCompletion: dbUser.profileCompletion,
          isAdmin: dbUser.isAdmin,
          oauthProvider: dbUser.oauthProvider,
        },
      });
    } catch (error) {
      if (error instanceof GoogleIdTokenConfigurationError) {
        return res.status(503).json({
          success: false,
          message: "Google sign-in is not configured on this server",
        });
      }

      if (error instanceof GoogleIdTokenVerificationError) {
        return res.status(401).json({
          success: false,
          message: "Invalid Google ID token",
        });
      }

      console.error("Mobile Google OAuth error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication failed",
      });
    }
  });
} else {
  // Web OAuth may be configured separately; mobile sign-in only needs an allowed audience.
  router.post("/google/mobile", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google sign-in is not configured on this server",
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
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const { code: verificationCode, codeExpiresAt } =
      generateVerificationCode();

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
          lastCodeSent: new Date(),
        },
        profileCompletion: {
          hasProfilePicture: false,
          hasBio: false,
          hasFollowers: false,
          hasVerifiedEmail: false,
          completionPercentage: 0,
        },
      },
    });

    // Send verification email
    const emailResult = await emailService.sendVerificationCode(
      email,
      verificationCode,
      name,
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email");
      try {
        await clearVerificationCodeCooldown(
          newUser.id,
          newUser.emailVerification || {},
        );
      } catch {
        console.error("Failed to clear verification email cooldown");
      }
    }

    res.status(201).json({
      success: true,
      message: emailResult.success
        ? "Registration successful! Check your email for verification code"
        : "Registration successful, but we could not send a verification email. Please request a new code.",
      userId: newUser.id,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
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
        message: "User ID and verification code are required",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const emailVerification = user.emailVerification || {};

    if (emailVerification.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    // Verification logic
    if (!emailVerification.verificationCode) {
      return res
        .status(400)
        .json({ success: false, message: "No verification code found" });
    }

    if (new Date(emailVerification.codeExpiresAt) < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Verification code has expired" });
    }

    if ((emailVerification.codeAttempts || 0) >= 3) {
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new code",
      });
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
            codeAttempts: 0,
          },
          profileCompletion: {
            ...(user.profileCompletion || {}),
            hasVerifiedEmail: true,
            // Could update percentage here too
          },
        },
      });

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.name);

      // Generate JWT token
      const token = jwt.sign(
        {
          id: updatedUser.id,
          authTokenVersion: updatedUser.authTokenVersion ?? 0,
        },
        getJwtSecret(),
        { expiresIn: "7d" },
      );

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
          profileCompletion: updatedUser.profileCompletion,
        },
      });
    } else {
      // Fail
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerification: {
            ...emailVerification,
            codeAttempts: (emailVerification.codeAttempts || 0) + 1,
          },
        },
      });
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: error.message,
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
        message: "User not found",
      });
    }

    const emailVerification = user.emailVerification || {};

    if (emailVerification.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const lastCodeSent = emailVerification.lastCodeSent
      ? new Date(emailVerification.lastCodeSent)
      : null;
    if (lastCodeSent && new Date() - lastCodeSent < 60000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting a new code",
      });
    }

    // Reset attempts and generate new code
    const { code: verificationCode, codeExpiresAt } =
      generateVerificationCode();

    const updatedEmailVerification = {
      ...emailVerification,
      verificationCode,
      codeExpiresAt,
      codeAttempts: 0,
      lastCodeSent: new Date(),
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerification: updatedEmailVerification,
      },
    });

    // Send new verification email
    const emailResult = await emailService.sendVerificationCode(
      user.email,
      verificationCode,
      user.name,
    );

    if (!emailResult.success) {
      console.error("Failed to resend verification email");
      try {
        await clearVerificationCodeCooldown(userId, updatedEmailVerification);
      } catch {
        console.error("Failed to clear verification email cooldown");
      }
      return res.status(503).json({
        success: false,
        message: "Unable to send a verification code. Please try again later.",
        emailSent: false,
      });
    }

    res.json({
      success: true,
      message: "New verification code sent to your email",
      emailSent: true,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code",
      error: error.message,
    });
  }
});

// Enhanced login with email verification check and 2FA support
router.post(
  "/login",
  twoFactorMiddleware.checkLoginTwoFactor(),
  async (req, res) => {
    try {
      const { email, password, twoFactorToken, backupCode } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`Login attempt failed: User not found for email ${email}`);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log(
          `Login attempt failed: Invalid password for email ${email}`,
        );
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      console.log(
        `Login attempt: User ${email} found, password valid, checking verification status...`,
      );

      // Check if email is verified
      const emailVerification = user.emailVerification || {};
      if (!emailVerification.isVerified) {
        const lastCodeSent = emailVerification.lastCodeSent
          ? new Date(emailVerification.lastCodeSent)
          : null;
        if (
          lastCodeSent &&
          new Date() - lastCodeSent < 60000 &&
          hasUsableVerificationCode(emailVerification)
        ) {
          return res.status(401).json({
            success: false,
            message: "Please verify your email before logging in",
            emailVerified: false,
            userId: user.id,
          });
        }

        const { code: verificationCode, codeExpiresAt } =
          generateVerificationCode();
        const updatedEmailVerification = {
          ...emailVerification,
          verificationCode,
          codeExpiresAt,
          codeAttempts: 0,
          lastCodeSent: new Date(),
        };

        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerification: updatedEmailVerification,
          },
        });

        // Send new verification email
        const emailResult = await emailService.sendVerificationCode(
          user.email,
          verificationCode,
          user.name,
        );

        if (!emailResult.success) {
          console.error("Failed to send verification email during login");
          try {
            await clearVerificationCodeCooldown(
              user.id,
              updatedEmailVerification,
            );
          } catch {
            console.error("Failed to clear verification email cooldown");
          }
          return res.status(503).json({
            success: false,
            message:
              "Unable to send a verification code. Please try again later.",
            emailVerified: false,
            emailSent: false,
            userId: user.id,
          });
        }

        return res.status(401).json({
          success: false,
          message: "Please verify your email before logging in",
          emailVerified: false,
          userId: user.id,
        });
      }

      // Check if user is banned
      if (user.banned) {
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended. Contact support.",
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
            userId: user.id,
          });
        }

        let twoFactorValid = false;

        if (backupCode) {
          // Verify backup code
          try {
            twoFactorValid = await TwoFactorService.verifyBackupCodeForLogin(
              user.id,
              backupCode,
            );
          } catch (error) {
            console.log(
              `2FA backup code verification failed for user ${email}:`,
              error.message,
            );
          }
        } else if (twoFactorToken) {
          // Verify TOTP token
          try {
            twoFactorValid = await TwoFactorService.validateLoginWith2FA(
              user.id,
              twoFactorToken,
            );
          } catch (error) {
            console.log(
              `2FA TOTP verification failed for user ${email}:`,
              error.message,
            );
          }
        }

        if (!twoFactorValid) {
          return res.status(401).json({
            success: false,
            message: "Invalid 2FA token or backup code",
            requires2FA: true,
          });
        }

        console.log(`2FA verification successful for user ${email}`);
      }

      const token = jwt.sign(
        { id: user.id, authTokenVersion: user.authTokenVersion ?? 0 },
        getJwtSecret(),
        { expiresIn: "7d" },
      );

      // Send login notification email
      const userAgent = req.headers["user-agent"] || "Unknown Device";
      const time = new Date().toLocaleString();

      // Don't await this to avoid delaying the response
      emailService
        .sendLoginNotification(user.email, user.name, time, userAgent)
        .catch((err) =>
          console.error("Failed to send login notification:", err),
        );

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
          twoFactorEnabled: twoFactorStatus.isEnabled,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: error.message,
      });
    }
  },
);

// Get profile completion status
router.get("/profile-completion", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
          email: profileCompletion.hasVerifiedEmail,
        },
      },
    });
  } catch (error) {
    console.error("Profile completion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get profile completion status",
      error: error.message,
    });
  }
});

// Get current authenticated user (useful after OAuth)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user information",
      error: error.message,
    });
  }
});

// ✅ Logout Route
router.post("/logout", (req, res) => {
  // Clear the token cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// ✅ Forgot Password Route
router.post("/forgot-password", passwordResetRequestLimit, async (req, res) => {
  try {
    const { email, client } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal that the email doesn't exist for security
      return res.json({
        success: true,
        message:
          "If an account with that email exists, check your inbox for password reset instructions. If you do not receive them, please try again later.",
      });
    }

    if (client === "mobile") {
      const otp = generatePasswordResetOtp();

      // The two reset flows are mutually exclusive: starting the code flow
      // retires any link token already outstanding for this account.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetOtpHash: hashPasswordResetOtp(otp),
          passwordResetOtpExpiresAt: new Date(
            Date.now() + PASSWORD_RESET_OTP_TTL_MS,
          ),
          passwordResetOtpAttempts: 0,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });

      // Not awaited: the unknown-address branch above returns after a single
      // indexed SELECT, so awaiting a live mail round trip here would turn
      // response latency into an account-existence oracle.
      emailService
        .sendPasswordResetCode(email, user.name, otp)
        .then((otpEmailResult) => {
          if (!otpEmailResult.success) {
            console.error("Password reset code email delivery failed");
          }
        })
        .catch((err) =>
          console.error("Password reset code email delivery failed:", err),
        );

      return res.json({
        success: true,
        message:
          "If an account with that email exists, check your inbox for password reset instructions. If you do not receive them, please try again later.",
      });
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: PASSWORD_RESET_TOKEN_PURPOSE },
      getPasswordResetJwtSecret(),
      {
        expiresIn: "1h",
        audience: PASSWORD_RESET_TOKEN_AUDIENCE,
      },
    );
    const passwordResetTokenHash = hashPasswordResetToken(resetToken);
    const passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash,
        passwordResetExpiresAt,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
      },
    });

    const resetBaseUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password`;
    const resetUrl = new URL(resetBaseUrl);
    resetUrl.searchParams.set("token", resetToken);
    const resetLink = resetUrl.toString();

    emailService
      .sendPasswordResetEmail(email, user.name, resetLink)
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error("Password reset email delivery failed");
        }
      })
      .catch((err) =>
        console.error("Password reset email delivery failed:", err),
      );

    res.json({
      success: true,
      message:
        "If an account with that email exists, check your inbox for password reset instructions. If you do not receive them, please try again later.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
});

// ✅ Verify Reset OTP Route
router.post("/verify-reset-otp", passwordResetVerifyLimit, async (req, res) => {
  // Every rejection returns this exact body so a caller cannot tell an unknown
  // address from a wrong, expired or exhausted code.
  const rejectCode = () =>
    res.status(400).json({
      success: false,
      error: "Invalid or expired code",
    });

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: "Email and code are required",
      });
    }

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !/^[0-9]{6}$/.test(otp)
    ) {
      return rejectCode();
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      new Date(user.passwordResetOtpExpiresAt) <= new Date()
    ) {
      return rejectCode();
    }

    // Spend the attempt before comparing, in one conditional statement. Reading
    // the counter and incrementing it afterwards lets concurrent requests all
    // pass the cap on the same stale snapshot and share far more than
    // PASSWORD_RESET_OTP_MAX_ATTEMPTS guesses against a single code.
    const claimedAttempt = await prisma.user.updateMany({
      where: {
        id: user.id,
        passwordResetOtpHash: user.passwordResetOtpHash,
        passwordResetOtpExpiresAt: { gt: new Date() },
        passwordResetOtpAttempts: { lt: PASSWORD_RESET_OTP_MAX_ATTEMPTS },
      },
      data: {
        passwordResetOtpAttempts: { increment: 1 },
      },
    });

    if (claimedAttempt.count !== 1) {
      await prisma.user.updateMany({
        where: {
          id: user.id,
          passwordResetOtpAttempts: { gte: PASSWORD_RESET_OTP_MAX_ATTEMPTS },
        },
        data: {
          passwordResetOtpHash: null,
          passwordResetOtpExpiresAt: null,
        },
      });

      return rejectCode();
    }

    const claimedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
        passwordResetOtpAttempts: true,
      },
    });

    if (
      !claimedUser ||
      !claimedUser.passwordResetOtpHash ||
      !claimedUser.passwordResetOtpExpiresAt ||
      new Date(claimedUser.passwordResetOtpExpiresAt) <= new Date()
    ) {
      return rejectCode();
    }

    const submittedOtpHash = Buffer.from(hashPasswordResetOtp(otp), "hex");
    const storedOtpHash = Buffer.from(claimedUser.passwordResetOtpHash, "hex");
    const otpMatches =
      submittedOtpHash.length === storedOtpHash.length &&
      timingSafeEqual(submittedOtpHash, storedOtpHash);

    if (!otpMatches) {
      if (
        claimedUser.passwordResetOtpAttempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS
      ) {
        await prisma.user.updateMany({
          where: {
            id: user.id,
            passwordResetOtpAttempts: { gte: PASSWORD_RESET_OTP_MAX_ATTEMPTS },
          },
          data: {
            passwordResetOtpHash: null,
            passwordResetOtpExpiresAt: null,
          },
        });
      }

      return rejectCode();
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: PASSWORD_RESET_TOKEN_PURPOSE },
      getPasswordResetJwtSecret(),
      {
        expiresIn: "15m",
        audience: PASSWORD_RESET_TOKEN_AUDIENCE,
      },
    );

    const consumedOtp = await prisma.user.updateMany({
      where: {
        id: user.id,
        passwordResetOtpHash: claimedUser.passwordResetOtpHash,
        passwordResetOtpExpiresAt: { gt: new Date() },
      },
      data: {
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
        passwordResetTokenHash: hashPasswordResetToken(resetToken),
        passwordResetExpiresAt: new Date(
          Date.now() + PASSWORD_RESET_OTP_TOKEN_TTL_MS,
        ),
      },
    });

    if (consumedOtp.count !== 1) {
      return rejectCode();
    }

    res.json({
      success: true,
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify reset code",
    });
  }
});

// ✅ Reset Password Route
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Token and new password are required",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, getPasswordResetJwtSecret(), {
        audience: PASSWORD_RESET_TOKEN_AUDIENCE,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    if (
      !decoded ||
      typeof decoded !== "object" ||
      decoded.purpose !== PASSWORD_RESET_TOKEN_PURPOSE ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const consumedToken = await prisma.user.updateMany({
      where: {
        id: decoded.userId,
        passwordResetTokenHash: hashPasswordResetToken(token),
        passwordResetExpiresAt: { gt: new Date() },
      },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordChangedAt,
        authTokenVersion: { increment: 1 },
      },
    });

    if (consumedToken.count !== 1) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
});

export default router;
