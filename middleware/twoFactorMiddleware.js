import TwoFactorService from '../services/twoFactorService.js';
import { TwoFactorError } from '../utils/securityErrors.js';

/**
 * Middleware to enforce 2FA verification for sensitive operations
 */
const twoFactorMiddleware = {
  /**
   * Require 2FA verification for sensitive operations
   * This middleware should be used on routes that modify sensitive user data
   */
  requireTwoFactor: () => {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Check if user has 2FA enabled
        const twoFactorStatus = await TwoFactorService.get2FAStatus(userId);
        
        if (!twoFactorStatus.isEnabled) {
          // If 2FA is not enabled, allow the request to proceed
          return next();
        }

        // Check if 2FA verification is provided in headers
        const twoFactorToken = req.headers['x-2fa-token'];
        
        if (!twoFactorToken) {
          return res.status(403).json({
            success: false,
            message: '2FA verification required for this operation',
            requiresTwoFactor: true,
            code: '2FA_REQUIRED'
          });
        }

        // Verify the 2FA token
        const isValid = await TwoFactorService.verifyTOTP(userId, twoFactorToken);
        
        if (!isValid) {
          return res.status(403).json({
            success: false,
            message: 'Invalid 2FA token',
            requiresTwoFactor: true,
            code: 'INVALID_2FA_TOKEN'
          });
        }

        // 2FA verification successful, proceed with the request
        req.twoFactorVerified = true;
        next();
        
      } catch (error) {
        console.error('2FA middleware error:', error);
        
        if (error instanceof TwoFactorError) {
          return res.status(400).json({
            success: false,
            message: error.message,
            code: error.code
          });
        }
        
        res.status(500).json({
          success: false,
          message: 'Internal server error during 2FA verification'
        });
      }
    };
  },

  /**
   * Optional 2FA verification - enhances security but doesn't block the request
   * Useful for operations that benefit from 2FA but shouldn't require it
   */
  optionalTwoFactor: () => {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return next();
        }

        // Check if user has 2FA enabled
        const twoFactorStatus = await TwoFactorService.get2FAStatus(userId);
        req.user.twoFactorEnabled = twoFactorStatus.isEnabled;
        
        if (!twoFactorStatus.isEnabled) {
          return next();
        }

        // Check if 2FA verification is provided
        const twoFactorToken = req.headers['x-2fa-token'];
        
        if (twoFactorToken) {
          try {
            const isValid = await TwoFactorService.verifyTOTP(userId, twoFactorToken);
            req.twoFactorVerified = isValid;
          } catch (error) {
            console.error('Optional 2FA verification error:', error);
            req.twoFactorVerified = false;
          }
        } else {
          req.twoFactorVerified = false;
        }

        next();
        
      } catch (error) {
        console.error('Optional 2FA middleware error:', error);
        req.twoFactorVerified = false;
        next();
      }
    };
  },

  /**
   * Check if 2FA is required for login completion
   * Used in the login flow to determine if additional 2FA step is needed
   */
  checkLoginTwoFactor: () => {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return next();
        }

        // Check if user has 2FA enabled
        const twoFactorStatus = await TwoFactorService.get2FAStatus(userId);
        
        if (twoFactorStatus.isEnabled) {
          // Check if this is a 2FA verification request
          const twoFactorToken = req.body.twoFactorToken || req.headers['x-2fa-token'];
          
          if (!twoFactorToken) {
            // 2FA is enabled but no token provided - require 2FA verification
            return res.status(200).json({
              success: false,
              message: '2FA verification required',
              requiresTwoFactor: true,
              userId: userId,
              code: '2FA_REQUIRED'
            });
          }

          // Verify the 2FA token
          const isValid = await TwoFactorService.verifyTOTP(userId, twoFactorToken, req);
          
          if (!isValid) {
            return res.status(400).json({
              success: false,
              message: 'Invalid 2FA token',
              requiresTwoFactor: true,
              code: 'INVALID_2FA_TOKEN'
            });
          }

          // 2FA verification successful
          req.twoFactorVerified = true;
        }

        next();
        
      } catch (error) {
        console.error('Login 2FA check error:', error);
        
        if (error instanceof TwoFactorError) {
          return res.status(400).json({
            success: false,
            message: error.message,
            code: error.code
          });
        }
        
        res.status(500).json({
          success: false,
          message: 'Internal server error during 2FA verification'
        });
      }
    };
  },

  /**
   * Bypass 2FA for specific operations (like 2FA setup/disable)
   * This should be used sparingly and only for operations that manage 2FA itself
   */
  bypassTwoFactor: () => {
    return (req, res, next) => {
      req.twoFactorBypassed = true;
      next();
    };
  }
};

export default twoFactorMiddleware;

// Named exports for convenience
export const requireTwoFactor = twoFactorMiddleware.requireTwoFactor;
export const optionalTwoFactor = twoFactorMiddleware.optionalTwoFactor;
export const checkLoginTwoFactor = twoFactorMiddleware.checkLoginTwoFactor;
export const bypassTwoFactor = twoFactorMiddleware.bypassTwoFactor;