import express from "express";
import Space from "../models/Space.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a Live Audio Space
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const space = new Space({ title, host: req.user?._id || req.userId, participants: [] });

    await space.save();
    res.json({ success: true, space });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End a Space
router.patch("/:spaceId/end", authMiddleware, async (req, res) => {
  try {
    const space = await Space.findById(req.params.spaceId);
    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    const requesterId = String(req.user?._id || req.userId);
    if (String(space.host) !== requesterId) {
      return res.status(403).json({ success: false, error: "Only the host can end this space" });
    }

    if (!space.isLive) {
      return res.json({ success: true, space });
    }

    space.isLive = false;
    await space.save();
    res.json({ success: true, space });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Video Highlight
router.put("/:spaceId/highlight", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const space = await Space.findByIdAndUpdate(
      req.params.spaceId,
      { $push: { highlights: { videoUrl, timestamp: new Date() } } },
      { new: true }
    );

    res.json({ success: true, space });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * @swagger
 * /api/spaces/create:
 *   post:
 *     summary: Create a Live Audio Space
 *     tags:
 *       - Spaces
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
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the space
 *     responses:
 *       200:
 *         description: Space created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 space:
 *                   $ref: '#/components/schemas/Space'
 *       400:
 *         description: Bad request
 *
 * @swagger
 * /api/spaces/{spaceId}/highlight:
 *   put:
 *     summary: Add a video highlight to a space
 *     tags:
 *       - Spaces
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the space
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoUrl
 *             properties:
 *               videoUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL of the video highlight
 *     responses:
 *       200:
 *         description: Highlight added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       404:
 *         description: Space not found
 *
 * @swagger
 * /api/spaces/{spaceId}:
 *   get:
 *     summary: Get details of a space
 *     tags:
 *       - Spaces
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the space to retrieve
 *     responses:
 *       200:
 *         description: Space details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       404:
 *         description: Space not found
 *       500:
 *         description: Server error
 *
 * @swagger
 * /api/spaces/{spaceId}/end:
 *   patch:
 *     summary: End a space
 *     tags:
 *       - Spaces
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the space to end
 *     responses:
 *       200:
 *         description: Space ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       403:
 *         description: Only the host can end this space
 *       404:
 *         description: Space not found
 */
