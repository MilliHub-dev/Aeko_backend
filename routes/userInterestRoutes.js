import express from 'express';
import User from '../models/User.js';
import Interest from '../models/Interest.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

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
        const user = await User.findById(req.user.id).populate('interests');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: user.interests || []
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
        const interests = await Interest.find({ 
            _id: { $in: interestIds },
            isActive: true 
        });
        
        if (interests.length !== interestIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more interest IDs are invalid'
            });
        }
        
        // Update user's interests
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { 
                $addToSet: { interests: { $each: interestIds } },
                $set: { 'onboarding.interestsSelected': true }
            },
            { new: true }
        ).populate('interests');
        
        res.json({
            success: true,
            message: 'Interests updated successfully',
            data: user.interests
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
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $pull: { interests: interestId } },
            { new: true }
        ).populate('interests');
        
        res.json({
            success: true,
            message: 'Interest removed successfully',
            data: user.interests
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
