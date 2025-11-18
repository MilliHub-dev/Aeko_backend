import express from 'express';
import BlockingService from '../services/blockingService.js';
import PrivacyManager from '../services/privacyManager.js';
import TwoFactorService from '../services/twoFactorService.js';
import SecurityLogger from '../services/securityLogger.js';
import authMiddleware from '../middleware/authMiddleware.js';
import BlockingMiddleware from '../middleware/blockingMiddleware.js';
import rateLimit from 'express-rate-limit';
import {
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
} from '../middleware/securityValidation.js';
import { SecurityErrorHandler } from '../utils/securityErrors.js';

const router = express.Router();

// Rate limiting for 2FA endpoints
const twoFactorRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many 2FA attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/security/block/{userId}:
 *   post:
 *     summary: Block a user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to block
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for blocking
 *     responses:
 *       200:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 blockedUser:
 *                   type: object
 *       400:
 *         description: Bad request (cannot block yourself, user already blocked)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/block/:userId', authMiddleware, validateBlockUser, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const blockerId = req.user.id;

    const result = await BlockingService.blockUser(blockerId, userId, reason, req);
    
    res.json(result);
  } catch (error) {
    console.error('Error blocking user:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/block/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to unblock
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: User is not blocked
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/block/:userId', authMiddleware, validateUnblockUser, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.id;

    const result = await BlockingService.unblockUser(blockerId, userId, req);
    
    res.json(result);
  } catch (error) {
    console.error('Error unblocking user:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/blocked:
 *   get:
 *     summary: Get list of blocked users
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: List of blocked users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blockedUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       profilePicture:
 *                         type: string
 *                       blockedAt:
 *                         type: string
 *                         format: date-time
 *                       reason:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/blocked', authMiddleware, validateGetBlockedUsers, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await BlockingService.getBlockedUsers(userId, page, limit);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting blocked users:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/block-status/{userId}:
 *   get:
 *     summary: Check if a user is blocked
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to check block status for
 *     responses:
 *       200:
 *         description: Block status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isBlocked:
 *                   type: boolean
 *                 isBlockedBy:
 *                   type: boolean
 *                 canInteract:
 *                   type: boolean
 *       500:
 *         description: Server error
 */
router.get('/block-status/:userId', authMiddleware, validateBlockStatus, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const isBlocked = await BlockingService.isBlocked(currentUserId, userId);
    const isBlockedBy = await BlockingService.isBlocked(userId, currentUserId);
    const canInteract = await BlockingService.enforceBlockingRules(currentUserId, userId);
    
    res.json({
      isBlocked,
      isBlockedBy,
      canInteract
    });
  } catch (error) {
    console.error('Error checking block status:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

// Privacy Settings Endpoints

/**
 * @swagger
 * /api/security/privacy:
 *   put:
 *     summary: Update privacy settings
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPrivate:
 *                 type: boolean
 *                 description: Make account private
 *               allowFollowRequests:
 *                 type: boolean
 *                 description: Allow follow requests for private accounts
 *               showOnlineStatus:
 *                 type: boolean
 *                 description: Show online status to others
 *               allowDirectMessages:
 *                 type: string
 *                 enum: [everyone, followers, none]
 *                 description: Who can send direct messages
 *     responses:
 *       200:
 *         description: Privacy settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 privacy:
 *                   type: object
 *       400:
 *         description: Invalid privacy settings
 *       500:
 *         description: Server error
 */
router.put('/privacy', authMiddleware, validatePrivacySettings, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    const updatedPrivacy = await PrivacyManager.updatePrivacySettings(userId, settings, req);
    
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      privacy: updatedPrivacy
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/privacy:
 *   get:
 *     summary: Get current privacy settings
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 privacy:
 *                   type: object
 *                   properties:
 *                     isPrivate:
 *                       type: boolean
 *                     allowFollowRequests:
 *                       type: boolean
 *                     showOnlineStatus:
 *                       type: boolean
 *                     allowDirectMessages:
 *                       type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/privacy', authMiddleware, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user privacy settings directly from database
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId).select('privacy');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      privacy: user.privacy
    });
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/follow-request/{userId}:
 *   post:
 *     summary: Send a follow request
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to send follow request to
 *     responses:
 *       200:
 *         description: Follow request sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 type:
 *                   type: string
 *                   enum: [direct_follow, follow_request]
 *       400:
 *         description: Bad request (already following, request already sent, etc.)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/follow-request/:userId', authMiddleware, validateFollowRequest, handleValidationErrors, BlockingMiddleware.checkFollowAccess(), validateSecurityRules, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user.id;

    const result = await PrivacyManager.sendFollowRequest(requesterId, userId, req);
    
    res.json(result);
  } catch (error) {
    console.error('Error sending follow request:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/follow-request/{requesterId}:
 *   put:
 *     summary: Handle a follow request (approve or reject)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user who sent the follow request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to take on the follow request
 *     responses:
 *       200:
 *         description: Follow request handled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 action:
 *                   type: string
 *       400:
 *         description: Invalid action or request not found
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/follow-request/:requesterId', authMiddleware, validateHandleFollowRequest, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const { requesterId } = req.params;
    const { action } = req.body;
    const targetId = req.user.id;

    const result = await PrivacyManager.handleFollowRequest(targetId, requesterId, action, req);
    
    res.json(result);
  } catch (error) {
    console.error('Error handling follow request:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/follow-requests:
 *   get:
 *     summary: Get follow requests
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, all]
 *           default: pending
 *         description: Filter by request status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Follow requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           name:
 *                             type: string
 *                           profilePicture:
 *                             type: string
 *                       requestedAt:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalRequests:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/follow-requests', authMiddleware, validateGetFollowRequests, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await PrivacyManager.getFollowRequests(userId, status, page, limit);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting follow requests:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

// Two-Factor Authentication Endpoints

/**
 * @swagger
 * /api/security/2fa/setup:
 *   post:
 *     summary: Initialize 2FA setup
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 secret:
 *                   type: string
 *                   description: Base32 encoded secret for manual entry
 *                 qrCode:
 *                   type: string
 *                   description: Base64 encoded QR code image
 *                 manualEntryKey:
 *                   type: string
 *                   description: Manual entry key for authenticator apps
 *       400:
 *         description: 2FA already enabled
 *       500:
 *         description: Server error
 */
router.post('/2fa/setup', authMiddleware, validate2FASetup, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if 2FA is already enabled
    const status = await TwoFactorService.get2FAStatus(userId);
    if (status.isEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled for this account'
      });
    }

    // Generate secret and QR code
    const secretData = await TwoFactorService.generateSecret(userId);
    const qrCode = await TwoFactorService.generateQRCode(userId, secretData.secret);

    res.json({
      success: true,
      secret: secretData.secret,
      qrCode: qrCode,
      manualEntryKey: secretData.manual_entry_key
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa/verify-setup:
 *   post:
 *     summary: Complete 2FA setup with verification
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               secret:
 *                 type: string
 *                 description: The secret key from setup
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *             required:
 *               - secret
 *               - token
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Backup codes for account recovery
 *       400:
 *         description: Invalid token or 2FA already enabled
 *       500:
 *         description: Server error
 */
router.post('/2fa/verify-setup', authMiddleware, validate2FASetupVerification, handleValidationErrors, twoFactorRateLimit, validate2FARateLimit, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const { secret, token } = req.body;

    const backupCodes = await TwoFactorService.enableTwoFactor(userId, secret, token, req);

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: backupCodes
    });
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa/verify:
 *   post:
 *     summary: Verify 2FA token during login
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: 2FA verification successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 verified:
 *                   type: boolean
 *       400:
 *         description: Invalid token or 2FA not enabled
 *       500:
 *         description: Server error
 */
router.post('/2fa/verify', authMiddleware, validate2FAVerification, handleValidationErrors, twoFactorRateLimit, validate2FARateLimit, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    const verified = await TwoFactorService.verifyTOTP(userId, token, req);

    res.json({
      success: true,
      message: verified ? '2FA verification successful' : 'Invalid 2FA token',
      verified: verified
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa:
 *   delete:
 *     summary: Disable 2FA
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Current account password
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *             required:
 *               - password
 *               - token
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid password/token or 2FA not enabled
 *       500:
 *         description: Server error
 */
router.delete('/2fa', authMiddleware, validate2FADisable, handleValidationErrors, twoFactorRateLimit, validate2FARateLimit, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, token } = req.body;

    await TwoFactorService.disableTwoFactor(userId, password, token, req);

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa/backup-codes:
 *   post:
 *     summary: Generate new backup codes
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: Backup codes generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid token or 2FA not enabled
 *       500:
 *         description: Server error
 */
router.post('/2fa/backup-codes', authMiddleware, validate2FAVerification, handleValidationErrors, twoFactorRateLimit, validate2FARateLimit, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    // Verify current TOTP token before generating new backup codes
    const verified = await TwoFactorService.verifyTOTP(userId, token, req);
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TOTP token'
      });
    }

    const backupCodes = await TwoFactorService.generateBackupCodes(userId, 10, req);

    res.json({
      success: true,
      message: 'Backup codes generated successfully',
      backupCodes: backupCodes
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa/backup-verify:
 *   post:
 *     summary: Verify backup code for emergency access
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: 8-character backup code
 *             required:
 *               - code
 *     responses:
 *       200:
 *         description: Backup code verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 verified:
 *                   type: boolean
 *       400:
 *         description: Invalid backup code or 2FA not enabled
 *       500:
 *         description: Server error
 */
router.post('/2fa/backup-verify', authMiddleware, validateBackupCodeVerification, handleValidationErrors, twoFactorRateLimit, validate2FARateLimit, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const { backupCode } = req.body;

    const verified = await TwoFactorService.verifyBackupCode(userId, backupCode, req);

    res.json({
      success: true,
      message: verified ? 'Backup code verified successfully' : 'Invalid or used backup code',
      verified: verified
    });
  } catch (error) {
    console.error('Error verifying backup code:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isEnabled:
 *                   type: boolean
 *                 enabledAt:
 *                   type: string
 *                   format: date-time
 *                 lastUsed:
 *                   type: string
 *                   format: date-time
 *                 backupCodesCount:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get('/2fa/status', authMiddleware, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const status = await TwoFactorService.get2FAStatus(userId);
    
    res.json(status);
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

// Security Event Logging Endpoints

/**
 * @swagger
 * /api/security/events:
 *   get:
 *     summary: Get user's security events
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [block, unblock, privacy_change, follow_request_sent, follow_request_approved, follow_request_rejected, 2fa_enabled, 2fa_disabled, 2fa_used, backup_code_used, backup_codes_generated]
 *         description: Filter by event type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering events
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering events
 *     responses:
 *       200:
 *         description: Security events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       eventType:
 *                         type: string
 *                       targetUser:
 *                         type: object
 *                       metadata:
 *                         type: object
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       success:
 *                         type: boolean
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/events', authMiddleware, validateSecurityEventQuery, handleValidationErrors, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      eventType,
      page = 1,
      limit = 50,
      startDate,
      endDate
    } = req.query;

    const options = {
      eventType,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate
    };

    const result = await SecurityLogger.getUserSecurityEvents(userId, options);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting security events:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

/**
 * @swagger
 * /api/security/stats:
 *   get:
 *     summary: Get user's security statistics
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back for statistics
 *     responses:
 *       200:
 *         description: Security statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Event type
 *                   count:
 *                     type: integer
 *                     description: Number of events
 *                   lastOccurrence:
 *                     type: string
 *                     format: date-time
 *                     description: Last occurrence of this event type
 *       500:
 *         description: Server error
 */
router.get('/stats', authMiddleware, validateSecurityRules, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    const stats = await SecurityLogger.getUserSecurityStats(userId, days);
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting security stats:', error);
    return SecurityErrorHandler.handleError(error, res);
  }
});

export default router;