/**
 * Custom error classes for security operations
 */

/**
 * Error class for blocking-related operations
 */
export class BlockingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BlockingError';
    this.code = code;
  }
}

/**
 * Error class for privacy-related operations
 */
export class PrivacyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PrivacyError';
    this.code = code;
  }
}

/**
 * Error class for two-factor authentication operations
 */
export class TwoFactorError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TwoFactorError';
    this.code = code;
  }
}

/**
 * General security error class
 */
export class SecurityError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Error handler for security operations
 */
export class SecurityErrorHandler {
  /**
   * Handle and format security errors for API responses
   * @param {Error} error - The error to handle
   * @param {Object} res - Express response object
   * @returns {Object} Formatted error response
   */
  static handleError(error, res) {
    let statusCode = 500;
    let errorResponse = {
      success: false,
      error: {
        name: error.name || 'Error',
        message: error.message || 'An unexpected error occurred',
        code: error.code || 'UNKNOWN_ERROR'
      }
    };

    // Set appropriate status codes based on error type
    if (error instanceof BlockingError) {
      statusCode = this.getBlockingErrorStatus(error.code);
    } else if (error instanceof PrivacyError) {
      statusCode = this.getPrivacyErrorStatus(error.code);
    } else if (error instanceof TwoFactorError) {
      statusCode = this.getTwoFactorErrorStatus(error.code);
    } else if (error instanceof SecurityError) {
      statusCode = 400;
    }

    // Add details if available
    if (error.details) {
      errorResponse.error.details = error.details;
    }

    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Get appropriate HTTP status code for blocking errors
   * @param {string} code - Error code
   * @returns {number} HTTP status code
   */
  static getBlockingErrorStatus(code) {
    switch (code) {
      case 'ALREADY_BLOCKED':
      case 'NOT_BLOCKED':
      case 'CANNOT_BLOCK_SELF':
        return 400; // Bad Request
      case 'BLOCKER_NOT_FOUND':
      case 'BLOCKED_USER_NOT_FOUND':
        return 404; // Not Found
      case 'MAX_BLOCKS_EXCEEDED':
        return 429; // Too Many Requests
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Get appropriate HTTP status code for privacy errors
   * @param {string} code - Error code
   * @returns {number} HTTP status code
   */
  static getPrivacyErrorStatus(code) {
    switch (code) {
      case 'PRIVATE_ACCOUNT':
      case 'FOLLOW_REQUEST_REJECTED':
        return 403; // Forbidden
      case 'FOLLOW_REQUEST_PENDING':
      case 'INVALID_PRIVACY_SETTING':
      case 'FOLLOW_REQUEST_EXISTS':
      case 'ALREADY_FOLLOWING':
      case 'CANNOT_FOLLOW_SELF':
        return 400; // Bad Request
      case 'MAX_FOLLOW_REQUESTS_EXCEEDED':
        return 429; // Too Many Requests
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Get appropriate HTTP status code for 2FA errors
   * @param {string} code - Error code
   * @returns {number} HTTP status code
   */
  static getTwoFactorErrorStatus(code) {
    switch (code) {
      case 'INVALID_TOTP':
      case 'INVALID_BACKUP_CODE':
      case 'BACKUP_CODE_USED':
      case 'VERIFICATION_FAILED':
      case 'INVALID_PASSWORD':
        return 401; // Unauthorized
      case 'TWO_FA_NOT_ENABLED':
      case 'TWO_FA_ALREADY_ENABLED':
      case 'INVALID_SECRET':
        return 400; // Bad Request
      case 'MAX_ATTEMPTS_EXCEEDED':
        return 429; // Too Many Requests
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Create a standardized error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   * @returns {Object} Standardized error response
   */
  static createErrorResponse(message, code, statusCode = 400, details = null) {
    const response = {
      success: false,
      error: {
        message,
        code,
        statusCode
      }
    };

    if (details) {
      response.error.details = details;
    }

    return response;
  }
}

export default {
  BlockingError,
  PrivacyError,
  TwoFactorError,
  SecurityError,
  SecurityErrorHandler
};