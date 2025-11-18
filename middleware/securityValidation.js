import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { SecurityErrorHandler, BlockingError, PrivacyError, TwoFactorError } from '../utils/securityErrors.js';

// Privacy setting enum values
const PRIVACY_SETTINGS = {
  allowDirectMessages: ['everyone', 'followers', 'none'],
  followRequestStatus: ['pending', 'approved', 'rejected']
};

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return SecurityErrorHandler.handleError(
      new SecurityError('Validation failed', 'VALIDATION_ERROR', errorDetails),
      res
    );
  }
  next();
};

/**
 * Custom validator to check if value is a valid MongoDB ObjectId
 */
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Custom validator to check if user ID is not the same as current user
 */
const isNotSameUser = (value, { req }) => {
  if (value === req.user?.id || value === req.user?._id?.toString()) {
    throw new Error('Cannot perform this action on yourself');
  }
  return true;
};

/**
 * Validation for blocking a user
 */
export const validateBlockUser = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid user ID format')
    .custom(isNotSameUser)
    .withMessage('Cannot block yourself'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Block reason must not exceed 500 characters')
];

/**
 * Validation for unblocking a user
 */
export const validateUnblockUser = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid user ID format')
    .custom(isNotSameUser)
    .withMessage('Cannot unblock yourself')
];

/**
 * Validation for checking block status
 */
export const validateBlockStatus = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid user ID format')
];

/**
 * Validation for getting blocked users list
 */
export const validateGetBlockedUsers = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Validation for updating privacy settings
 */
export const validatePrivacySettings = [
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  
  body('allowFollowRequests')
    .optional()
    .isBoolean()
    .withMessage('allowFollowRequests must be a boolean'),
  
  body('showOnlineStatus')
    .optional()
    .isBoolean()
    .withMessage('showOnlineStatus must be a boolean'),
  
  body('allowDirectMessages')
    .optional()
    .isIn(PRIVACY_SETTINGS.allowDirectMessages)
    .withMessage(`allowDirectMessages must be one of: ${PRIVACY_SETTINGS.allowDirectMessages.join(', ')}`),
  
  // Validate that at least one setting is provided
  body()
    .custom((value) => {
      const validFields = ['isPrivate', 'allowFollowRequests', 'showOnlineStatus', 'allowDirectMessages'];
      const hasValidField = validFields.some(field => value.hasOwnProperty(field));
      if (!hasValidField) {
        throw new Error('At least one privacy setting must be provided');
      }
      return true;
    })
];

/**
 * Validation for sending follow request
 */
export const validateFollowRequest = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid user ID format')
    .custom(isNotSameUser)
    .withMessage('Cannot send follow request to yourself')
];

/**
 * Validation for handling follow request
 */
export const validateHandleFollowRequest = [
  param('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .custom(isValidObjectId)
    .withMessage('Invalid request ID format'),
  
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be either "approve" or "reject"')
];

/**
 * Validation for getting follow requests
 */
export const validateGetFollowRequests = [
  query('status')
    .optional()
    .isIn(PRIVACY_SETTINGS.followRequestStatus)
    .withMessage(`Status must be one of: ${PRIVACY_SETTINGS.followRequestStatus.join(', ')}`),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Validation for 2FA setup initialization
 */
export const validate2FASetup = [
  body('password')
    .notEmpty()
    .withMessage('Current password is required for 2FA setup')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty')
];

/**
 * Validation for 2FA setup verification
 */
export const validate2FASetupVerification = [
  body('token')
    .notEmpty()
    .withMessage('TOTP token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP token must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP token must contain only numbers'),
  
  body('secret')
    .notEmpty()
    .withMessage('2FA secret is required')
    .isLength({ min: 16 })
    .withMessage('Invalid 2FA secret format')
];

/**
 * Validation for 2FA login verification
 */
export const validate2FAVerification = [
  body('token')
    .notEmpty()
    .withMessage('TOTP token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP token must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP token must contain only numbers')
];

/**
 * Validation for 2FA disable
 */
export const validate2FADisable = [
  body('password')
    .notEmpty()
    .withMessage('Current password is required to disable 2FA')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
  
  body('token')
    .notEmpty()
    .withMessage('TOTP token is required to disable 2FA')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP token must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP token must contain only numbers')
];

/**
 * Validation for backup code verification
 */
export const validateBackupCodeVerification = [
  body('backupCode')
    .notEmpty()
    .withMessage('Backup code is required')
    .isLength({ min: 8, max: 12 })
    .withMessage('Backup code must be between 8 and 12 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Backup code must contain only uppercase letters and numbers')
];

/**
 * Rate limiting validation for 2FA attempts
 */
export const validate2FARateLimit = (req, res, next) => {
  const userId = req.user?.id || req.user?._id?.toString();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // This would typically integrate with a rate limiting service
  // For now, we'll add basic validation
  if (!userId) {
    return SecurityErrorHandler.handleError(
      new TwoFactorError('User authentication required for 2FA operations', 'AUTHENTICATION_REQUIRED'),
      res
    );
  }
  
  next();
};

/**
 * Validation for security event queries
 */
export const validateSecurityEventQuery = [
  query('eventType')
    .optional()
    .isIn(['block', 'unblock', 'privacy_change', '2fa_enabled', '2fa_disabled', '2fa_used', 'backup_code_used'])
    .withMessage('Invalid event type'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Custom validation middleware for complex security rules
 */
export const validateSecurityRules = (req, res, next) => {
  try {
    const { user } = req;
    const { method, path } = req;
    
    // Additional security validations based on user state
    if (user?.banned) {
      return SecurityErrorHandler.handleError(
        new SecurityError('Account is suspended', 'ACCOUNT_SUSPENDED'),
        res
      );
    }
    
    // Validate 2FA requirements for sensitive operations
    if (path.includes('/2fa/') && method === 'DELETE') {
      if (!user?.twoFactorAuth?.isEnabled) {
        return SecurityErrorHandler.handleError(
          new TwoFactorError('2FA is not enabled for this account', 'TWO_FA_NOT_ENABLED'),
          res
        );
      }
    }
    
    next();
  } catch (error) {
    return SecurityErrorHandler.handleError(error, res);
  }
};

export default {
  handleValidationErrors,
  validateBlockUser,
  validateUnblockUser,
  validateBlockStatus,
  validateGetBlockedUsers,
  validatePrivacySettings,
  validateFollowRequest,
  validateHandleFollowRequest,
  validateGetFollowRequests,
  validate2FASetup,
  validate2FASetupVerification,
  validate2FAVerification,
  validate2FADisable,
  validateBackupCodeVerification,
  validate2FARateLimit,
  validateSecurityEventQuery,
  validateSecurityRules
};