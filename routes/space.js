import express from "express";
import Space from "../models/Space.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a Live Audio Space
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const space = new Space({ title, participants: [] });

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
 *     responses:
 *       200:
 *         description: Space created successfully
 *       400:
 *         description: Bad request
 *
 * /api/spaces/{spaceId}/highlight:
 *   put:
 *     summary: Add a video highlight to a space
 *     tags:
 *       - Spaces
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: spaceId
 *         in: path
 *         required: true
 *         description: ID of the space
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Video highlight added successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Space not found
 *
 * /api/spaces/{spaceId}:
 *   get:
 *     summary: Get details of a space
 *     tags:
 *       - Spaces
 *     parameters:
 *       - name: spaceId
 *         in: path
 *         required: true
 *         description: ID of the space
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Space details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Space not found
 *       500:
 *         description: Server error
 */
