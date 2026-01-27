import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import twoFactorMiddleware from '../middleware/twoFactorMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

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
router.post('/', authMiddleware, adminMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
    try {
        const { name, displayName, description = '', icon = '' } = req.body;
        
        // Check if interest already exists
        const existingInterest = await prisma.interest.findUnique({ 
            where: { name: name.toLowerCase() } 
        });
        if (existingInterest) {
            return res.status(409).json({ 
                success: false, 
                message: 'Interest with this name already exists' 
            });
        }

        const interest = await prisma.interest.create({
            data: {
                name: name.toLowerCase(),
                displayName,
                description,
                icon,
                isActive: true
            }
        });
        
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
        const interests = await prisma.interest.findMany({
            where: { isActive: true }
        });
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
router.put('/:id', authMiddleware, adminMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
    try {
        const { displayName, description, icon, isActive } = req.body;
        
        const existing = await prisma.interest.findUnique({
            where: { id: req.params.id }
        });
        
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Interest not found'
            });
        }

        const dataToUpdate = {};
        if (displayName) dataToUpdate.displayName = displayName;
        if (description !== undefined) dataToUpdate.description = description;
        if (icon !== undefined) dataToUpdate.icon = icon;
        if (isActive !== undefined) dataToUpdate.isActive = isActive;
        
        const interest = await prisma.interest.update({
            where: { id: req.params.id },
            data: dataToUpdate
        });
        
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
router.delete('/:id', authMiddleware, adminMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
    try {
        await prisma.interest.delete({ where: { id: req.params.id } });
        
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
