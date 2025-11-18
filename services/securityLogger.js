import SecurityEvent from '../models/SecurityEvent.js';

/**
 * Service for logging security events and audit trails
 */
class SecurityLogger {
  /**
   * Extract IP address and user agent from request
   * @param {Object} req - Express request object
   * @returns {Object} IP address and user agent
   */
  extractRequestInfo(req) {
    const ipAddress = req.ip || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     req.headers['x-forwarded-for']?.split(',')[0] || 
                     'unknown';
    
    const userAgent = req.get('User-Agent') || 'unknown';
    
    return { ipAddress, userAgent };
  }

  /**
   * Log a security event
   * @param {Object} eventData - Event data
   * @param {string} eventData.user - User ID who performed the action
   * @param {string} eventData.eventType - Type of security event
   * @param {string} eventData.targetUser - Target user ID (optional)
   * @param {Object} eventData.metadata - Additional event metadata (optional)
   * @param {Object} eventData.req - Express request object (optional)
   * @param {string} eventData.ipAddress - IP address (optional, extracted from req if not provided)
   * @param {string} eventData.userAgent - User agent (optional, extracted from req if not provided)
   * @param {boolean} eventData.success - Whether the action was successful (default: true)
   * @param {string} eventData.errorMessage - Error message if action failed (optional)
   * @returns {Promise<Object|null>} Created security event or null if failed
   */
  async logEvent(eventData) {
    try {
      let ipAddress = eventData.ipAddress;
      let userAgent = eventData.userAgent;
      
      // Extract from request if not provided
      if (eventData.req && (!ipAddress || !userAgent)) {
        const requestInfo = this.extractRequestInfo(eventData.req);
        ipAddress = ipAddress || requestInfo.ipAddress;
        userAgent = userAgent || requestInfo.userAgent;
      }
      
      const event = await SecurityEvent.logEvent({
        user: eventData.user,
        eventType: eventData.eventType,
        targetUser: eventData.targetUser,
        metadata: eventData.metadata || {},
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        success: eventData.success !== undefined ? eventData.success : true,
        errorMessage: eventData.errorMessage
      });
      
      return event;
    } catch (error) {
      console.error('SecurityLogger: Failed to log event:', error);
      return null;
    }
  }

  /**
   * Log blocking events
   */
  async logBlockEvent(userId, targetUserId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: 'block',
      targetUser: targetUserId,
      metadata: {
        reason: metadata.reason || '',
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async logUnblockEvent(userId, targetUserId, req, success = true, errorMessage = null) {
    return this.logEvent({
      user: userId,
      eventType: 'unblock',
      targetUser: targetUserId,
      req,
      success,
      errorMessage
    });
  }

  /**
   * Log privacy events
   */
  async logPrivacyChangeEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: 'privacy_change',
      metadata: {
        changes: metadata.changes || {},
        previousSettings: metadata.previousSettings || {},
        newSettings: metadata.newSettings || {},
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async logFollowRequestSentEvent(userId, targetUserId, req, success = true, errorMessage = null) {
    return this.logEvent({
      user: userId,
      eventType: 'follow_request_sent',
      targetUser: targetUserId,
      req,
      success,
      errorMessage
    });
  }

  async logFollowRequestApprovedEvent(userId, targetUserId, req, success = true, errorMessage = null) {
    return this.logEvent({
      user: userId,
      eventType: 'follow_request_approved',
      targetUser: targetUserId,
      req,
      success,
      errorMessage
    });
  }

  async logFollowRequestRejectedEvent(userId, targetUserId, req, success = true, errorMessage = null) {
    return this.logEvent({
      user: userId,
      eventType: 'follow_request_rejected',
      targetUser: targetUserId,
      req,
      success,
      errorMessage
    });
  }

  /**
   * Log 2FA events
   */
  async log2FAEnabledEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: '2fa_enabled',
      metadata: {
        method: metadata.method || 'totp',
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async log2FADisabledEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: '2fa_disabled',
      metadata: {
        method: metadata.method || 'manual',
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async log2FAUsedEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: '2fa_used',
      metadata: {
        method: metadata.method || 'totp',
        loginAttempt: metadata.loginAttempt || false,
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async logBackupCodeUsedEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: 'backup_code_used',
      metadata: {
        codeIndex: metadata.codeIndex,
        remainingCodes: metadata.remainingCodes,
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  async logBackupCodesGeneratedEvent(userId, req, success = true, errorMessage = null, metadata = {}) {
    return this.logEvent({
      user: userId,
      eventType: 'backup_codes_generated',
      metadata: {
        codesCount: metadata.codesCount || 10,
        regenerated: metadata.regenerated || false,
        ...metadata
      },
      req,
      success,
      errorMessage
    });
  }

  /**
   * Get security events for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Security events with pagination
   */
  async getUserSecurityEvents(userId, options = {}) {
    return SecurityEvent.getUserEvents(userId, options);
  }

  /**
   * Get security statistics for a user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back (default: 30)
   * @returns {Promise<Array>} Security statistics
   */
  async getUserSecurityStats(userId, days = 30) {
    return SecurityEvent.getSecurityStats(userId, days);
  }

  /**
   * Get recent security events across all users (admin function)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Recent security events with pagination
   */
  async getRecentSecurityEvents(options = {}) {
    const {
      eventType = null,
      page = 1,
      limit = 100,
      startDate = null,
      endDate = null
    } = options;
    
    const query = {};
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const [events, total] = await Promise.all([
      SecurityEvent.find(query)
        .populate('user', 'username name')
        .populate('targetUser', 'username name')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityEvent.countDocuments(query)
    ]);
    
    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export default new SecurityLogger();