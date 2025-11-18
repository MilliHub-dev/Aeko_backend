import BlockingMiddleware from './blockingMiddleware.js';
import privacyFilterMiddleware from './privacyMiddleware.js';
import twoFactorMiddleware, { optionalTwoFactor } from './twoFactorMiddleware.js';

/**
 * Comprehensive security middleware that combines blocking, privacy, and 2FA enforcement
 * This module provides a unified interface for applying security controls across the application
 */
class SecurityMiddleware {
  
  /**
   * Blocking middleware methods
   */
  static blocking = {
    // Check if users can interact based on blocking relationships
    checkInteraction: (targetUserParam = 'userId') => 
      BlockingMiddleware.checkBlockingRelationship(targetUserParam),
    
    // Filter content arrays to remove blocked users' content
    filterContent: (contentField = 'posts', authorField = 'user._id') => 
      BlockingMiddleware.filterBlockedContent(contentField, authorField),
    
    // Check profile access permissions
    checkProfileAccess: () => BlockingMiddleware.checkProfileAccess(),
    
    // Check messaging permissions
    checkMessaging: () => BlockingMiddleware.checkMessagingAccess(),
    
    // Check post interaction permissions (like, comment, share)
    checkPostInteraction: () => BlockingMiddleware.checkPostInteraction(),
    
    // Check follow/unfollow permissions
    checkFollowAccess: () => BlockingMiddleware.checkFollowAccess()
  };

  /**
   * Privacy middleware methods
   */
  static privacy = {
    // Filter posts in response based on privacy settings
    filterPosts: (postsField = 'posts') => 
      privacyFilterMiddleware.filterResponsePosts(postsField),
    
    // Check access to a single post
    checkPostAccess: () => privacyFilterMiddleware.checkPostAccess(),
    
    // Check profile viewing permissions
    checkProfileAccess: () => privacyFilterMiddleware.checkProfileAccess(),
    
    // Check post viewing permissions for user's posts
    checkPostViewAccess: () => privacyFilterMiddleware.checkPostViewAccess()
  };

  /**
   * Two-Factor Authentication middleware methods
   */
  static twoFactor = {
    // Require 2FA verification for sensitive operations
    require: () => twoFactorMiddleware.requireTwoFactor(),
    
    // Add 2FA status to request without requiring verification
    addStatus: () => optionalTwoFactor()
  };

  /**
   * Combined middleware for comprehensive user interaction security
   * Applies both blocking and privacy checks for user interactions
   * @param {string} targetUserParam - Parameter name containing target user ID
   * @returns {Array} Array of middleware functions
   */
  static userInteraction(targetUserParam = 'userId') {
    return [
      this.blocking.checkInteraction(targetUserParam),
      this.privacy.checkProfileAccess()
    ];
  }

  /**
   * Combined middleware for post-related operations
   * Applies blocking, privacy, and optionally 2FA checks
   * @param {Object} options - Configuration options
   * @param {boolean} options.require2FA - Whether to require 2FA verification
   * @param {string} options.contentField - Field name for content filtering
   * @returns {Array} Array of middleware functions
   */
  static postOperations(options = {}) {
    const { require2FA = false, contentField = 'posts' } = options;
    
    const middleware = [
      this.blocking.checkPostInteraction(),
      this.privacy.checkPostAccess()
    ];

    if (require2FA) {
      middleware.push(this.twoFactor.require());
    }

    return middleware;
  }

  /**
   * Combined middleware for content viewing operations
   * Applies blocking and privacy filtering for content arrays
   * @param {Object} options - Configuration options
   * @param {string} options.contentField - Field name containing content array
   * @param {string} options.authorField - Field path to author ID in content objects
   * @returns {Array} Array of middleware functions
   */
  static contentViewing(options = {}) {
    const { contentField = 'posts', authorField = 'user._id' } = options;
    
    return [
      this.blocking.filterContent(contentField, authorField),
      this.privacy.filterPosts(contentField)
    ];
  }

  /**
   * Combined middleware for messaging operations
   * Applies blocking checks and optionally 2FA for sensitive messaging
   * @param {Object} options - Configuration options
   * @param {boolean} options.require2FA - Whether to require 2FA verification
   * @returns {Array} Array of middleware functions
   */
  static messaging(options = {}) {
    const { require2FA = false } = options;
    
    const middleware = [
      this.blocking.checkMessaging()
    ];

    if (require2FA) {
      middleware.push(this.twoFactor.require());
    }

    return middleware;
  }

  /**
   * Combined middleware for follow/unfollow operations
   * Applies blocking and privacy checks
   * @returns {Array} Array of middleware functions
   */
  static followOperations() {
    return [
      this.blocking.checkFollowAccess(),
      this.privacy.checkProfileAccess()
    ];
  }

  /**
   * Combined middleware for sensitive account operations
   * Requires 2FA verification and applies security checks
   * @param {Object} options - Configuration options
   * @param {string} options.targetUserParam - Parameter name for target user
   * @returns {Array} Array of middleware functions
   */
  static sensitiveOperations(options = {}) {
    const { targetUserParam = 'userId' } = options;
    
    return [
      this.twoFactor.require(),
      this.blocking.checkInteraction(targetUserParam)
    ];
  }

  /**
   * Middleware for admin operations that bypasses user-level security
   * Only applies 2FA requirement for admin actions
   * @returns {Array} Array of middleware functions
   */
  static adminOperations() {
    return [
      this.twoFactor.addStatus() // Add status but don't require for admin operations
    ];
  }

  /**
   * Middleware for public content that only applies privacy filtering
   * Used for public feeds, search results, etc.
   * @param {Object} options - Configuration options
   * @param {string} options.contentField - Field name containing content array
   * @returns {Array} Array of middleware functions
   */
  static publicContent(options = {}) {
    const { contentField = 'posts' } = options;
    
    return [
      this.privacy.filterPosts(contentField)
    ];
  }

  /**
   * Apply multiple middleware functions in sequence
   * Helper method to flatten middleware arrays
   * @param {Array} middlewareArrays - Arrays of middleware functions
   * @returns {Array} Flattened array of middleware functions
   */
  static apply(...middlewareArrays) {
    return middlewareArrays.flat();
  }
}

export default SecurityMiddleware;