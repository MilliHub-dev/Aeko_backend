import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TwoFactorService from "../services/twoFactorService.js";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: "Unauthorized: No token provided" 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle both 'id' and 'userId' from different token formats
    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      return res.status(403).json({ 
        success: false,
        error: "Forbidden: Invalid token format" 
      });
    }

    // Fetch user and attach to request
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({ 
        success: false,
        error: "Account suspended" 
      });
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false,
        error: "Forbidden: Invalid token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: "Token expired" 
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error" 
    });
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
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
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
