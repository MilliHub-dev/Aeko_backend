import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import {
  updateCommunityProfile,
  uploadCommunityPhoto,
  updateCommunitySettings,
  followCommunity,
  unfollowCommunity,
  createCommunityPost,
  getCommunityPosts
} from '../controllers/communityProfileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { 
  isCommunityAdmin, 
  isCommunityAdminOrModerator,
  isCommunityMember,
  checkPaidCommunityAccess,
  checkPrivateCommunityAccess
} from '../middleware/communityMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/communities/{id}/profile:
 *   put:
 *     summary: Update community profile
 *     description: Update community profile information. Only community owner or moderators can update. Requires authentication and authorization.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               website:
 *                 type: string
 *                 format: uri
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only owner or moderators can update
 *       404:
 *         description: Community not found
 */
router.put(
  '/:id/profile',
  protect,
  isCommunityAdminOrModerator,
  [
    body('name').optional().trim().isLength({ min: 3, max: 50 }),
    body('description').optional().isLength({ max: 500 }),
    body('website').optional().isURL(),
    body('location').optional().trim()
  ],
  updateCommunityProfile
);

/**
 * @swagger
 * /api/communities/{id}/upload-photo:
 *   post:
 *     summary: Upload community avatar or cover photo
 *     description: Upload community photo. Only community owner or moderators can upload. Requires authentication and authorization.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [avatar, cover]
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only owner or moderators can upload
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/upload-photo',
  protect,
  isCommunityAdminOrModerator,
  upload.single('photo'),
  uploadCommunityPhoto
);

/**
 * @swagger
 * /api/communities/{id}/settings:
 *   put:
 *     summary: Update community settings
 *     description: Update community settings including payment and post settings. Only community owner can update settings. Requires authentication and owner authorization.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 properties:
 *                   payment:
 *                     type: object
 *                     properties:
 *                       isPaidCommunity:
 *                         type: boolean
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       subscriptionType:
 *                         type: string
 *                         enum: [one_time, monthly, yearly]
 *                   postSettings:
 *                     type: object
 *                     properties:
 *                       allowImages:
 *                         type: boolean
 *                       allowVideos:
 *                         type: boolean
 *                       allowLinks:
 *                         type: boolean
 *                       requireApproval:
 *                         type: boolean
 *                       requireMembershipToPost:
 *                         type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Validation error or invalid community ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only community owner can update settings
 *       404:
 *         description: Community not found
 */
router.put(
  '/:id/settings',
  protect,
  isCommunityAdmin,
  [
    body('settings').isObject().optional(),
    body('settings.payment').isObject().optional(),
    body('settings.payment.isPaidCommunity').isBoolean().optional(),
    body('settings.payment.price').isNumeric().optional(),
    body('settings.payment.currency').isString().optional(),
    body('settings.payment.subscriptionType')
      .isIn(['one_time', 'monthly', 'yearly'])
      .optional(),
    body('settings.postSettings').isObject().optional(),
    body('settings.postSettings.allowImages').isBoolean().optional(),
    body('settings.postSettings.allowVideos').isBoolean().optional(),
    body('settings.postSettings.allowLinks').isBoolean().optional(),
    body('settings.postSettings.requireApproval').isBoolean().optional(),
    body('settings.postSettings.requireMembershipToPost').isBoolean().optional()
  ],
  updateCommunitySettings
);

/**
 * @swagger
 * /api/communities/{id}/follow:
 *   post:
 *     summary: Follow a community
 *     description: Follow a community without joining the chat. Requires authentication.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully followed the community
 *       400:
 *         description: Already following or invalid request
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/follow',
  protect,
  followCommunity
);

/**
 * @swagger
 * /api/communities/{id}/unfollow:
 *   post:
 *     summary: Unfollow a community
 *     description: Unfollow a community. Requires authentication.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully unfollowed the community
 *       400:
 *         description: Not following or invalid request
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/unfollow',
  protect,
  unfollowCommunity
);

/**
 * @swagger
 * /api/communities/{id}/posts:
 *   post:
 *     summary: Create a post in community
 *     description: Create a post in a community. Requires active membership. For paid communities, requires active subscription. Requires authentication and membership authorization.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 10
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Validation error or invalid community ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires active membership or subscription
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/posts',
  protect,
  checkPaidCommunityAccess,
  isCommunityMember,
  upload.array('media', 10), // Max 10 files
  [
    body('content').optional().isString().trim(),
    body('media').optional().isArray(),
    body('media.*.url').isString(),
    body('media.*.type').isIn(['image', 'video', 'file'])
  ],
  createCommunityPost
);

/**
 * @swagger
 * /api/communities/{id}/posts:
 *   get:
 *     summary: Get community posts
 *     description: Retrieve posts from a community. Private communities require membership. Paid communities require active subscription. Requires authentication.
 *     tags: [Community Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of posts per page
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       400:
 *         description: Invalid community ID format
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires membership or active subscription
 *       404:
 *         description: Community not found
 */
router.get(
  '/:id/posts',
  protect,
  checkPrivateCommunityAccess,
  checkPaidCommunityAccess,
  getCommunityPosts
);

export default router;
