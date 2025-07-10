import express from 'express';
import { 
    createAd,
    getUserAds,
    getTargetedAds,
    trackImpression,
    trackClick,
    trackConversion,
    getAdAnalytics,
    updateAd,
    deleteAd,
    getAllAdsForReview,
    reviewAd,
    getAdDashboard,
    trackView // Legacy compatibility
} from '../controllers/adController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Advertisement:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Advertisement ID
 *         title:
 *           type: string
 *           description: Advertisement title
 *           example: "Summer Sale - 50% Off"
 *         description:
 *           type: string
 *           description: Advertisement description
 *           example: "Don't miss our biggest summer sale with amazing discounts!"
 *         mediaType:
 *           type: string
 *           enum: [image, video, text, carousel]
 *           description: Type of media content
 *         mediaUrl:
 *           type: string
 *           description: URL of the main media file
 *         targetAudience:
 *           type: object
 *           properties:
 *             age:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                   example: 18
 *                 max:
 *                   type: number
 *                   example: 65
 *             location:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["United States", "Canada"]
 *             interests:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["fashion", "shopping"]
 *             gender:
 *               type: string
 *               enum: [all, male, female, other]
 *               example: "all"
 *         budget:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               example: 1000
 *             daily:
 *               type: number
 *               example: 50
 *             spent:
 *               type: number
 *               example: 150
 *             currency:
 *               type: string
 *               enum: [USD, AEKO]
 *               example: "USD"
 *         pricing:
 *           type: object
 *           properties:
 *             model:
 *               type: string
 *               enum: [cpm, cpc, cpa]
 *               description: Cost per thousand impressions, click, or action
 *             bidAmount:
 *               type: number
 *               example: 2.50
 *         campaign:
 *           type: object
 *           properties:
 *             objective:
 *               type: string
 *               enum: [awareness, traffic, engagement, conversions, app_installs]
 *             schedule:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *         status:
 *           type: string
 *           enum: [draft, pending, approved, rejected, running, paused, completed, expired]
 *         analytics:
 *           type: object
 *           properties:
 *             impressions:
 *               type: number
 *               example: 15000
 *             clicks:
 *               type: number
 *               example: 350
 *             ctr:
 *               type: number
 *               example: 2.33
 *             conversions:
 *               type: number
 *               example: 25
 *             conversionRate:
 *               type: number
 *               example: 7.14
 *         advertiserId:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - title
 *         - description
 *         - mediaType
 *         - budget
 *         - campaign
 *
 * /api/ads:
 *   post:
 *     summary: Create new advertisement
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - mediaType
 *               - budget
 *               - pricing
 *               - campaign
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Summer Sale - 50% Off"
 *               description:
 *                 type: string
 *                 example: "Don't miss our biggest summer sale!"
 *               mediaType:
 *                 type: string
 *                 enum: [image, video, text, carousel]
 *               mediaUrl:
 *                 type: string
 *                 example: "https://example.com/ad-image.jpg"
 *               targetAudience:
 *                 type: object
 *                 properties:
 *                   age:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: number
 *                         example: 18
 *                       max:
 *                         type: number
 *                         example: 45
 *                   location:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["United States"]
 *                   interests:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["fashion", "shopping"]
 *               budget:
 *                 type: object
 *                 required:
 *                   - total
 *                 properties:
 *                   total:
 *                     type: number
 *                     example: 1000
 *                   daily:
 *                     type: number
 *                     example: 50
 *                   currency:
 *                     type: string
 *                     enum: [USD, AEKO]
 *                     example: "USD"
 *               pricing:
 *                 type: object
 *                 required:
 *                   - model
 *                   - bidAmount
 *                 properties:
 *                   model:
 *                     type: string
 *                     enum: [cpm, cpc, cpa]
 *                   bidAmount:
 *                     type: number
 *                     example: 2.50
 *               campaign:
 *                 type: object
 *                 required:
 *                   - objective
 *                   - schedule
 *                 properties:
 *                   objective:
 *                     type: string
 *                     enum: [awareness, traffic, engagement, conversions, app_installs]
 *                   schedule:
 *                     type: object
 *                     required:
 *                       - startDate
 *                       - endDate
 *                     properties:
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *               callToAction:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [learn_more, shop_now, sign_up, download, contact_us, visit_website]
 *                   url:
 *                     type: string
 *                   text:
 *                     type: string
 *     responses:
 *       201:
 *         description: Advertisement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Advertisement created successfully and submitted for review"
 *                 ad:
 *                   $ref: '#/components/schemas/Advertisement'
 *       400:
 *         description: Bad request - validation errors
 *       401:
 *         description: Unauthorized
 *
 *   get:
 *     summary: Get user's advertisements
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         description: Filter ads by status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected, running, paused, completed, expired]
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Number of ads per page
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: User advertisements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ads:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Advertisement'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         total:
 *                           type: integer
 *
 * /api/ads/targeted:
 *   get:
 *     summary: Get targeted advertisements for user
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of ads to return
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Targeted ads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ads:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Advertisement'
 *                     count:
 *                       type: integer
 *
 * /api/ads/track/impression:
 *   post:
 *     summary: Track advertisement impression
 *     tags:
 *       - Advertisements
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adId
 *             properties:
 *               adId:
 *                 type: string
 *                 description: Advertisement ID
 *               metadata:
 *                 type: object
 *                 properties:
 *                   age:
 *                     type: number
 *                   location:
 *                     type: string
 *                   device:
 *                     type: string
 *     responses:
 *       200:
 *         description: Impression tracked successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Advertisement not found
 *
 * /api/ads/track/click:
 *   post:
 *     summary: Track advertisement click
 *     tags:
 *       - Advertisements
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adId
 *             properties:
 *               adId:
 *                 type: string
 *                 description: Advertisement ID
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Click tracked successfully
 *
 * /api/ads/track/conversion:
 *   post:
 *     summary: Track advertisement conversion
 *     tags:
 *       - Advertisements
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adId
 *             properties:
 *               adId:
 *                 type: string
 *               conversionValue:
 *                 type: number
 *               conversionType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversion tracked successfully
 *
 * /api/ads/{adId}/analytics:
 *   get:
 *     summary: Get advertisement analytics
 *     tags:
 *       - Advertisements
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: adId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: timeRange
 *         in: query
 *         schema:
 *           type: string
 *           default: "7d"
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         impressions:
 *                           type: number
 *                         clicks:
 *                           type: number
 *                         ctr:
 *                           type: number
 *                         conversions:
 *                           type: number
 *                         conversionRate:
 *                           type: number
 *                         performanceScore:
 *                           type: number
 *                     budget:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         spent:
 *                           type: number
 *                         remaining:
 *                           type: number
 *
 * /api/ads/{adId}:
 *   put:
 *     summary: Update advertisement
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: adId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, pending, running, paused]
 *               budget:
 *                 type: object
 *     responses:
 *       200:
 *         description: Advertisement updated successfully
 *
 *   delete:
 *     summary: Delete advertisement
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: adId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Advertisement deleted successfully
 *       400:
 *         description: Cannot delete running advertisement
 *
 * /api/ads/dashboard:
 *   get:
 *     summary: Get advertisement dashboard
 *     tags:
 *       - Advertisements
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeRange
 *         in: query
 *         schema:
 *           type: string
 *           default: "30d"
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAds:
 *                           type: number
 *                         activeAds:
 *                           type: number
 *                         totalSpent:
 *                           type: number
 *                         totalImpressions:
 *                           type: number
 *                         totalClicks:
 *                           type: number
 *                         averageCTR:
 *                           type: number
 *
 * /api/ads/admin/review:
 *   get:
 *     summary: Get advertisements for admin review
 *     tags:
 *       - Advertisements
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           default: "pending"
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Ads for review retrieved successfully
 *
 * /api/ads/admin/review/{adId}:
 *   post:
 *     summary: Review advertisement (admin only)
 *     tags:
 *       - Advertisements
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: adId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               rejectionReason:
 *                 type: string
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Advertisement reviewed successfully
 */

// Advertisement management routes
router.post('/', authMiddleware, createAd);
router.get('/', authMiddleware, getUserAds);
router.get('/targeted', authMiddleware, getTargetedAds);
router.get('/dashboard', authMiddleware, getAdDashboard);

// Analytics and tracking routes
router.post('/track/impression', authMiddleware, trackImpression);
router.post('/track/click', authMiddleware, trackClick);
router.post('/track/conversion', authMiddleware, trackConversion);
router.get('/:adId/analytics', authMiddleware, getAdAnalytics);

// CRUD operations for specific ads
router.put('/:adId', authMiddleware, updateAd);
router.delete('/:adId', authMiddleware, deleteAd);

// Admin routes
router.get('/admin/review', adminAuth, getAllAdsForReview);
router.post('/admin/review/:adId', adminAuth, reviewAd);

// Legacy routes for backward compatibility
router.post('/track-view', authMiddleware, trackView);

export default router;
