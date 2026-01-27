import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: User Interests
 *   description: User interest management
 */

/**
 * @swagger
 * /api/user/interests:
 *   get:
 *     summary: Get user's interests
 *     tags: [User Interests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's interests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Interest'
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { interests: true }
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const interestIds = Array.isArray(user.interests) ? user.interests : [];

        let interests = [];
        if (interestIds.length > 0) {
            interests = await prisma.interest.findMany({
                where: {
                    id: { in: interestIds },
                    isActive: true
                }
            });
        }
        
        res.json({
            success: true,
            data: interests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user interests',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/user/interests:
 *   post:
 *     summary: Update user's interests
 *     tags: [User Interests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [interestIds]
 *             properties:
 *               interestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of interest IDs
 *     responses:
 *       200:
 *         description: Interests updated successfully
 *       400:
 *         description: Invalid interest IDs
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { interestIds } = req.body;
        
        // Validate that all interest IDs exist
        const interests = await prisma.interest.findMany({
            where: {
                id: { in: interestIds },
                isActive: true
            }
        });
        
        if (interests.length !== interestIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more interest IDs are invalid'
            });
        }
        
        const userId = req.userId;

        // Get existing interests for user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                interests: true,
                profileCompletion: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const existingInterests = Array.isArray(user.interests) ? user.interests : [];
        const mergedInterests = Array.from(new Set([...existingInterests, ...interestIds]));

        const profileCompletion = user.profileCompletion || {};
        profileCompletion.interestsSelected = true;

        await prisma.user.update({
            where: { id: userId },
            data: {
                interests: mergedInterests,
                profileCompletion
            }
        });

        const updatedInterests = await prisma.interest.findMany({
            where: {
                id: { in: mergedInterests },
                isActive: true
            }
        });
        
        res.json({
            success: true,
            message: 'Interests updated successfully',
            data: updatedInterests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating interests',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/user/interests/{interestId}:
 *   delete:
 *     summary: Remove an interest from user's interests
 *     tags: [User Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interest removed successfully
 *       404:
 *         description: Interest not found in user's interests
 */
router.delete('/:interestId', authMiddleware, async (req, res) => {
    try {
        const { interestId } = req.params;
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                interests: true,
                profileCompletion: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const existingInterests = Array.isArray(user.interests) ? user.interests : [];

        if (!existingInterests.includes(interestId)) {
            return res.status(404).json({
                success: false,
                message: 'Interest not found in user interests'
            });
        }

        const updatedInterestIds = existingInterests.filter(id => id !== interestId);
        await prisma.user.update({
            where: { id: userId },
            data: {
                interests: updatedInterestIds
            }
        });

        const updatedInterests = await prisma.interest.findMany({
            where: {
                id: { in: updatedInterestIds },
                isActive: true
            }
        });
        
        res.json({
            success: true,
            message: 'Interest removed successfully',
            data: updatedInterests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing interest',
            error: error.message
        });
    }
});

export default router;
