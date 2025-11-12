import express from 'express';
import Interest from '../models/Interest.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Interests
 *   description: Interest management
 */

/**
 * @swagger
 * /api/interests:
 *   post:
 *     summary: Create a new interest (Admin only)
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, displayName]
 *             properties:
 *               name: { type: string }
 *               displayName: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *     responses:
 *       201:
 *         description: Interest created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Interest already exists
 */
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, displayName, description = '', icon = '' } = req.body;
        
        // Check if interest already exists
        const existingInterest = await Interest.findOne({ name: name.toLowerCase() });
        if (existingInterest) {
            return res.status(409).json({ 
                success: false, 
                message: 'Interest with this name already exists' 
            });
        }

        const interest = new Interest({
            name: name.toLowerCase(),
            displayName,
            description,
            icon
        });

        await interest.save();
        
        res.status(201).json({
            success: true,
            data: interest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating interest',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/interests:
 *   get:
 *     summary: Get all active interests
 *     tags: [Interests]
 *     responses:
 *       200:
 *         description: List of active interests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Interest'
 */
router.get('/', async (req, res) => {
    try {
        const interests = await Interest.find({ isActive: true });
        res.json({
            success: true,
            data: interests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching interests',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/interests/{id}:
 *   put:
 *     summary: Update an interest (Admin only)
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               displayName: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Interest updated successfully
 *       404:
 *         description: Interest not found
 */
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { displayName, description, icon, isActive } = req.body;
        const interest = await Interest.findById(req.params.id);
        
        if (!interest) {
            return res.status(404).json({
                success: false,
                message: 'Interest not found'
            });
        }

        if (displayName) interest.displayName = displayName;
        if (description !== undefined) interest.description = description;
        if (icon !== undefined) interest.icon = icon;
        if (isActive !== undefined) interest.isActive = isActive;
        
        interest.updatedAt = Date.now();
        await interest.save();
        
        res.json({
            success: true,
            data: interest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating interest',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/interests/{id}:
 *   delete:
 *     summary: Delete an interest (Admin only)
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interest deleted successfully
 *       404:
 *         description: Interest not found
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const interest = await Interest.findByIdAndDelete(req.params.id);
        
        if (!interest) {
            return res.status(404).json({
                success: false,
                message: 'Interest not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Interest deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting interest',
            error: error.message
        });
    }
});

export default router;
