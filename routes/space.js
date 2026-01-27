import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();

// Create a Live Audio Space
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.id || req.user._id;

    const space = await prisma.space.create({
      data: {
        title,
        hostId: userId,
        participants: [],
        isLive: true
      }
    });

    res.json({ success: true, space });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End a Space
router.patch("/:spaceId/end", authMiddleware, async (req, res) => {
  try {
    const { spaceId } = req.params;
    const userId = req.user.id || req.user._id;

    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    if (space.hostId !== userId) {
      return res.status(403).json({ success: false, error: "Only the host can end this space" });
    }

    if (!space.isLive) {
      return res.json({ success: true, space });
    }

    const updatedSpace = await prisma.space.update({
      where: { id: spaceId },
      data: { isLive: false }
    });

    res.json({ success: true, space: updatedSpace });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Video Highlight
router.put("/:spaceId/highlight", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const { spaceId } = req.params;

    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    const highlights = Array.isArray(space.highlights) ? space.highlights : [];
    highlights.push({ videoUrl, timestamp: new Date() });

    const updatedSpace = await prisma.space.update({
      where: { id: spaceId },
      data: { highlights }
    });

    res.json({ success: true, space: updatedSpace });
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
 * /api/spaces/{spaceId}/end:
 *   patch:
 *     summary: End a Live Audio Space
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
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space ended successfully
 *       403:
 *         description: Only host can end space
 *       404:
 *         description: Space not found
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
 *         description: Space ID
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
 *                 description: URL of the highlight video
 *     responses:
 *       200:
 *         description: Highlight added successfully
 *       404:
 *         description: Space not found
 */
