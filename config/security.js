/**
 * Security configuration constants for the Aeko platform
 */

export const SECURITY_CONFIG = {
  // Blocking system configuration
  BLOCKING: {
    MAX_BLOCKED_USERS: 1000, // Maximum number of users a single user can block
    PAGINATION_LIMIT: 20,     // Default pagination limit for blocked users list
    MAX_PAGINATION_LIMIT: 100 // Maximum allowed pagination limit
  },

  // Privacy settings configuration
  PRIVACY: {
    DEFAULT_SETTINGS: {
      isPrivate: false,
      allowFollowRequests: true,
      showOnlineStatus: true,
      allowDirectMessages: 'everyone'
    },
    DIRECT_MESSAGE_OPTIONS: ['everyone', 'followers', 'none'],
    MAX_FOLLOW_REQUESTS: 500 // Maximum pending follow requests
  },

  // Two-Factor Authentication configuration
  TWO_FACTOR_AUTH: {
    APP_NAME: 'Aeko Social',
    ISSUER: 'Aeko',
    SECRET_LENGTH: 32,        // Length of TOTP secret
    TOKEN_WINDOW: 2,          // Time window for TOTP verification (in 30-second steps)
    BACKUP_CODES_COUNT: 10,   // Number of backup codes to generate
    BACKUP_CODE_LENGTH: 8,    // Length of each backup code (in hex characters)
    MAX_VERIFICATION_ATTEMPTS: 5, // Maximum 2FA verification attempts per session
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes in milliseconds
    RATE_LIMIT_MAX_ATTEMPTS: 10 // Maximum attempts per rate limit window
  },

  // Security event types for logging
  EVENT_TYPES: {
    BLOCK_USER: 'block_user',
    UNBLOCK_USER: 'unblock_user',
    PRIVACY_CHANGE: 'privacy_change',
    FOLLOW_REQUEST_SENT: 'follow_request_sent',
    FOLLOW_REQUEST_APPROVED: 'follow_request_approved',
    FOLLOW_REQUEST_REJECTED: 'follow_request_rejected',
    TWO_FA_ENABLED: '2fa_enabled',
    TWO_FA_DISABLED: '2fa_disabled',
    TWO_FA_USED: '2fa_used',
    BACKUP_CODE_USED: 'backup_code_used',
    TWO_FA_SETUP_STARTED: '2fa_setup_started',
    TWO_FA_VERIFICATION_FAILED: '2fa_verification_failed'
  },

  // Error codes for security operations
  ERROR_CODES: {
    // Blocking errors
    ALREADY_BLOCKED: 'ALREADY_BLOCKED',
    NOT_BLOCKED: 'NOT_BLOCKED',
    CANNOT_BLOCK_SELF: 'CANNOT_BLOCK_SELF',
    BLOCKER_NOT_FOUND: 'BLOCKER_NOT_FOUND',
    BLOCKED_USER_NOT_FOUND: 'BLOCKED_USER_NOT_FOUND',
    MAX_BLOCKS_EXCEEDED: 'MAX_BLOCKS_EXCEEDED',

    // Privacy errors
    PRIVATE_ACCOUNT: 'PRIVATE_ACCOUNT',
    FOLLOW_REQUEST_PENDING: 'FOLLOW_REQUEST_PENDING',
    FOLLOW_REQUEST_REJECTED: 'FOLLOW_REQUEST_REJECTED',
    INVALID_PRIVACY_SETTING: 'INVALID_PRIVACY_SETTING',
    FOLLOW_REQUEST_EXISTS: 'FOLLOW_REQUEST_EXISTS',
    ALREADY_FOLLOWING: 'ALREADY_FOLLOWING',
    CANNOT_FOLLOW_SELF: 'CANNOT_FOLLOW_SELF',
    MAX_FOLLOW_REQUESTS_EXCEEDED: 'MAX_FOLLOW_REQUESTS_EXCEEDED',

    // 2FA errors
    INVALID_TOTP: 'INVALID_TOTP',
    TWO_FA_NOT_ENABLED: '2FA_NOT_ENABLED',
    TWO_FA_ALREADY_ENABLED: '2FA_ALREADY_ENABLED',
    INVALID_BACKUP_CODE: 'INVALID_BACKUP_CODE',
    BACKUP_CODE_USED: 'BACKUP_CODE_USED',
    INVALID_SECRET: 'INVALID_SECRET',
    VERIFICATION_FAILED: 'VERIFICATION_FAILED',
    MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
    INVALID_PASSWORD: 'INVALID_PASSWORD'
  },

  // Rate limiting configuration
  RATE_LIMITS: {
    BLOCK_OPERATIONS: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // Maximum 20 block/unblock operations per window
      message: 'Too many blocking operations. Please try again later.'
    },
    FOLLOW_REQUESTS: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50, // Maximum 50 follow requests per hour
      message: 'Too many follow requests. Please try again later.'
    },
    TWO_FA_VERIFICATION: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Maximum 10 2FA verification attempts per window
      message: 'Too many 2FA verification attempts. Please try again later.'
    },
    PRIVACY_UPDATES: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // Maximum 5 privacy updates per window
      message: 'Too many privacy setting updates. Please try again later.'
    }
  },

  // Security middleware configuration
  MIDDLEWARE: {
    ENFORCE_BLOCKING: true,     // Whether to enforce blocking rules globally
    ENFORCE_PRIVACY: true,      // Whether to enforce privacy rules globally
    REQUIRE_2FA_FOR_SENSITIVE: false, // Whether to require 2FA for sensitive operations
    LOG_SECURITY_EVENTS: true  // Whether to log all security events
  },

  // Encryption settings
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_DERIVATION: 'scrypt',
    SALT: 'aeko-security-salt',
    IV_LENGTH: 16,
    TAG_LENGTH: 16
  }
};

// Security validation helpers
export const SECURITY_VALIDATORS = {
  /**
   * Validate privacy settings object
   * @param {Object} settings - Privacy settings to validate
   * @returns {boolean} True if valid
   */
  validatePrivacySettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    const validKeys = ['isPrivate', 'allowFollowRequests', 'showOnlineStatus', 'allowDirectMessages'];
    const providedKeys = Object.keys(settings);

    // Check if all provided keys are valid
    if (!providedKeys.every(key => validKeys.includes(key))) {
      return false;
    }

    // Validate specific fields
    if (settings.isPrivate !== undefined && typeof settings.isPrivate !== 'boolean') {
      return false;
    }
    if (settings.allowFollowRequests !== undefined && typeof settings.allowFollowRequests !== 'boolean') {
      return false;
    }
    if (settings.showOnlineStatus !== undefined && typeof settings.showOnlineStatus !== 'boolean') {
      return false;
    }
    if (settings.allowDirectMessages !== undefined && 
        !SECURITY_CONFIG.PRIVACY.DIRECT_MESSAGE_OPTIONS.includes(settings.allowDirectMessages)) {
      return false;
    }

    return true;
  },

  /**
   * Validate TOTP token format
   * @param {string} token - TOTP token to validate
   * @returns {boolean} True if valid format
   */
  validateTOTPToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // TOTP tokens should be 6 digits
    return /^\d{6}$/.test(token);
  },

  /**
   * Validate backup code format
   * @param {string} code - Backup code to validate
   * @returns {boolean} True if valid format
   */
  validateBackupCode(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }

    // Backup codes should be 8 hex characters
    return /^[A-F0-9]{8}$/i.test(code);
  },

  /**
   * Validate user ID format
   * @param {string} userId - User ID to validate
   * @returns {boolean} True if valid MongoDB ObjectId
   */
  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    // Check if it's a valid MongoDB ObjectId
    return /^[0-9a-fA-F]{24}$/.test(userId);
  }
};

export default SECURITY_CONFIG;