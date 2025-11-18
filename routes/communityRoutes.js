import express from 'express';
import { body } from 'express-validator';
import {
  createCommunity,
  getCommunities,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  updateCommunity,
  deleteCommunity
} from '../controllers/communityController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateCommunityPaymentSettings } from '../middleware/paymentValidation.js';
import { 
  isCommunityAdmin, 
  isCommunityAdminOrModerator,
  checkPrivateCommunityAccess 
} from '../middleware/communityMiddleware.js';
import BlockingMiddleware from '../middleware/blockingMiddleware.js';
import twoFactorMiddleware from '../middleware/twoFactorMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/communities:
 *   post:
 *     summary: Create a new community
 *     description: Create a new community. Only users with golden tick can create communities. Requires authentication.
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 description: Community name
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 description: Community description (minimum 10 characters)
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the community is private
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Community tags
 *     responses:
 *       201:
 *         description: Community created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only golden tick users can create communities
 */
router.post(
  '/',
  protect,
  twoFactorMiddleware.requireTwoFactor(),
  [
    body('name', 'Name is required').not().isEmpty().trim(),
    body('description', 'Description is required').isLength({ min: 10 }),
    body('isPrivate').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  createCommunity
);

/**
 * @swagger
 * /api/communities:
 *   get:
 *     summary: Get all communities
 *     description: Retrieve a list of all active communities with pagination and search
 *     tags: [Communities]
 *     parameters:
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
 *         description: Number of communities per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for community name or description
 *     responses:
 *       200:
 *         description: List of communities retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/', getCommunities);

/**
 * @swagger
 * /api/communities/{id}:
 *   get:
 *     summary: Get community by ID
 *     description: Retrieve detailed information about a specific community. Private communities require membership. Requires authentication.
 *     tags: [Communities]
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
 *         description: Community details retrieved successfully
 *       400:
 *         description: Invalid community ID format
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - private community requires membership
 *       404:
 *         description: Community not found
 */
router.get('/:id', protect, checkPrivateCommunityAccess, getCommunity);

/**
 * @swagger
 * /api/communities/{id}/join:
 *   post:
 *     summary: Join a community
 *     description: Join a community. For paid communities, payment is required first. Requires authentication.
 *     tags: [Communities]
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
 *         description: Successfully joined the community
 *       400:
 *         description: Already a member or invalid request
 *       401:
 *         description: Unauthorized - authentication required
 *       402:
 *         description: Payment required - this is a paid community
 *       403:
 *         description: Forbidden - banned from community
 *       404:
 *         description: Community not found
 */
router.post('/:id/join', protect, joinCommunity);

/**
 * @swagger
 * /api/communities/{id}/leave:
 *   post:
 *     summary: Leave a community
 *     description: Leave a community. Community owners cannot leave their own community. Requires authentication.
 *     tags: [Communities]
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
 *         description: Successfully left the community
 *       400:
 *         description: Not a member or owner cannot leave
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Community not found
 */
router.post('/:id/leave', protect, leaveCommunity);

/**
 * @swagger
 * /api/communities/{id}:
 *   put:
 *     summary: Update community
 *     description: Update community details. Only community owner or moderators can update. Requires authentication and authorization.
 *     tags: [Communities]
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
 *               description:
 *                 type: string
 *                 minLength: 10
 *               isPrivate:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Community updated successfully
 *       400:
 *         description: Validation error or invalid community ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only owner or moderators can update
 *       404:
 *         description: Community not found
 */
router.put(
  '/:id',
  protect,
  isCommunityAdminOrModerator,
  [
    body('name').optional().trim(),
    body('description').optional().isLength({ min: 10 }),
    body('isPrivate').optional().isBoolean(),
    body('tags').optional().isArray(),
    body('settings').optional().isObject(),
    ...validateCommunityPaymentSettings
  ],
  updateCommunity
);

/**
 * @swagger
 * /api/communities/{id}:
 *   delete:
 *     summary: Delete community
 *     description: Delete a community permanently. Only community owner can delete. Requires authentication and owner authorization.
 *     tags: [Communities]
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
 *         description: Community deleted successfully
 *       400:
 *         description: Invalid community ID format
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only community owner can delete
 *       404:
 *         description: Community not found
 */
router.delete('/:id', protect, isCommunityAdmin, twoFactorMiddleware.requireTwoFactor(), deleteCommunity);

export default router;
