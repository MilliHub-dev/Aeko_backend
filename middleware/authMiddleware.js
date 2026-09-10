import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import TwoFactorService from "../services/twoFactorService.js";
import { hasCurrentAuthTokenVersion } from "../utils/authTokenUtils.js";
import { getJwtSecret } from "../utils/authConfig.js";
import { sendError } from "../utils/apiErrors.js";

/**
 * Rejects a request with a response the app can act on.
 *
 * These used to send only `error`, a field the app never displays, so an
 * expired session, a deleted account and a database outage all reached users
 * as the same "Something went wrong. Please try again." `message` is what the
 * user sees; `code` is what the app branches on — TOKEN_INVALID, TOKEN_EXPIRED,
 * TOKEN_MALFORMED and ACCOUNT_NOT_FOUND send it back to the login screen.
 * `error` is kept for older clients.
 */
const reject = (res, status, code, message, error) =>
  res.status(status).json({ success: false, code, message, error });

const SESSION_INVALID = "Your session is no longer valid. Please log in again.";
const SESSION_EXPIRED = "Your session has expired. Please log in again.";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return reject(
        res,
        401,
        "NO_TOKEN",
        "Please log in to continue.",
        "Unauthorized: No token provided",
      );
    }

    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.purpose === "password-reset") {
      return reject(
        res,
        403,
        "TOKEN_MALFORMED",
        SESSION_INVALID,
        "Forbidden: Invalid token format",
      );
    }

    // Handle both 'id' and 'userId' from different token formats
    const userId = decoded.id || decoded.userId;

    if (!userId) {
      return reject(
        res,
        403,
        "TOKEN_MALFORMED",
        SESSION_INVALID,
        "Forbidden: Invalid token format",
      );
    }

    // Fetch user and attach to request
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return reject(
        res,
        404,
        "ACCOUNT_NOT_FOUND",
        "This account no longer exists. Please log in again.",
        "User not found",
      );
    }

    if (!hasCurrentAuthTokenVersion(decoded, user)) {
      // Issued before a password change.
      return reject(res, 401, "TOKEN_EXPIRED", SESSION_EXPIRED, "Token expired");
    }

    // Remove password from user object
    delete user.password;

    // Check if user is banned
    if (user.banned) {
      return reject(
        res,
        403,
        "ACCOUNT_SUSPENDED",
        "Your account has been suspended. Contact support.",
        "Account suspended",
      );
    }

    // Add 2FA status to user object for convenience
    try {
      const twoFactorStatus = await TwoFactorService.get2FAStatus(userId);
      user.twoFactorEnabled = twoFactorStatus.isEnabled;
      user.twoFactorStatus = twoFactorStatus;

      // Check if this is a partial login (2FA required but not yet verified)
      if (decoded.partial && twoFactorStatus.isEnabled) {
        user.partialLogin = true;
      }
    } catch (error) {
      console.error('Error getting 2FA status in auth middleware:', error);
      user.twoFactorEnabled = false;
      user.twoFactorStatus = { isEnabled: false };
    }

    req.user = user;
    req.user.id = userId; // Ensure req.user.id is set
    req.userId = userId; // For backward compatibility with routes that use req.userId
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return reject(res, 401, "TOKEN_EXPIRED", SESSION_EXPIRED, "Token expired");
    }

    // Includes a token signed with a different JWT_SECRET, e.g. after the
    // secret is rotated on the server.
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return reject(
        res,
        403,
        "TOKEN_INVALID",
        SESSION_INVALID,
        "Forbidden: Invalid token",
      );
    }

    // Anything else is the server's fault. sendError tells a database outage
    // (503, "temporarily unavailable") apart from a genuine bug (500), instead
    // of a flat 500 for both.
    return sendError(res, error, "authMiddleware");
  }
};

/**
 * Enhanced auth middleware that requires full authentication (including 2FA if enabled)
 */
const requireFullAuth = async (req, res, next) => {
  // First run the standard auth middleware
  await new Promise((resolve, reject) => {
    authMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Check if user has partial login (2FA required)
  if (req.user?.partialLogin) {
    return res.status(403).json({
      success: false,
      error: "2FA verification required to complete login",
      message: "Enter your two-factor code to finish logging in.",
      requiresTwoFactor: true,
      code: "2FA_REQUIRED"
    });
  }

  next();
};

/**
 * Auth middleware for sensitive operations that require 2FA verification
 */
const requireTwoFactorAuth = async (req, res, next) => {
  // First run the standard auth middleware
  await new Promise((resolve, reject) => {
    authMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const userId = req.user?.id;

  if (!userId) {
    return reject(
      res,
      401,
      "NO_TOKEN",
      "Please log in to continue.",
      "Authentication required",
    );
  }

  // Check if user has 2FA enabled
  if (req.user.twoFactorEnabled) {
    const twoFactorToken = req.headers['x-2fa-token'];

    if (!twoFactorToken) {
      return res.status(403).json({
        success: false,
        message: '2FA verification required for this operation',
        requiresTwoFactor: true,
        code: '2FA_REQUIRED'
      });
    }

    try {
      const isValid = await TwoFactorService.verifyTOTP(userId, twoFactorToken);

      if (!isValid) {
        return res.status(403).json({
          success: false,
          message: 'Invalid 2FA token',
          requiresTwoFactor: true,
          code: 'INVALID_2FA_TOKEN'
        });
      }

      req.twoFactorVerified = true;
    } catch (error) {
      console.error('2FA verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying 2FA token'
      });
    }
  }

  next();
};

export default authMiddleware;

// Named exports for convenience
export const protect = authMiddleware;
export const authenticate = authMiddleware;
export { requireFullAuth };
export { requireTwoFactorAuth };
