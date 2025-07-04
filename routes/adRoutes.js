import express from 'express';
import Ad from '../models/Ad.js';
import { trackView, trackClick } from '../controllers/adController.js';
const router = express.Router();
import authMiddleware from "../middleware/authMiddleware.js";

/**
 * @swagger
 * /api/ads/create:
 *   post:
 *     summary: Create an ad
 *     tags:
 *       - Ads
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
 *               mediaType:
 *                 type: string
 *                 enum: [image, video, text]
 *               mediaUrl:
 *                 type: string
 *               budget:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ad created successfully
 *
 * /api/ads/all:
 *   get:
 *     summary: Fetch all ads (Admin)
 *     tags:
 *       - Ads
 *     responses:
 *       200:
 *         description: List of ads
 *
 * /api/ads/update/{id}:
 *   put:
 *     summary: Update an ad (Admin)
 *     tags:
 *       - Ads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the ad to update
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
 *               mediaType:
 *                 type: string
 *                 enum: [image, video, text]
 *               mediaUrl:
 *                 type: string
 *               budget:
 *                 type: number
 *     responses:
 *       200:
 *         description: Ad updated successfully
 *
 * /api/ads/delete/{id}:
 *   delete:
 *     summary: Delete an ad (Admin)
 *     tags:
 *       - Ads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the ad to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ad deleted successfully
 *       404:
 *         description: Ad not found
 *
 * /api/ads/track-view:
 *   post:
 *     summary: Track ad view
 *     tags:
 *       - Ads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adId:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ad view tracked successfully
 *
 * /api/ads/track-click:
 *   post:
 *     summary: Track ad click
 *     tags:
 *       - Ads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adId:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ad click tracked successfully
 */



// ✅ Create an ad
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const ad = new Ad(req.body);
    await ad.save();
    res.status(201).json({ success: true, ad });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Fetch all ads (Admin)
router.get('/all', async (req, res) => {
  try {
    const ads = await Ad.find();
    res.json({ success: true, ads });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Update ad (Admin)
router.put('/update/:id', async (req, res) => {
  try {
    const updatedAd = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, updatedAd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Delete ad (Admin)
router.delete('/delete/:id', async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ad deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/track-view', trackView);
router.post('/track-click', trackClick);

export default router;
