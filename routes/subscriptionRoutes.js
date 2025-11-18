import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";

const router = express.Router();




// Subscribe to Golden Tick
router.post("/subscribe", authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  const { userId, paymentSuccess } = req.body; // Payment must be verified

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!paymentSuccess) {
      return res.status(400).json({ message: "Payment failed!" });
    }

    user.goldenTick = true;
    user.subscriptionStatus = "active";
    user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
    await user.save();

    res.status(200).json({ message: "Golden Tick activated! 🏆" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;

/**
 * @swagger
 * /api/subscription/subscribe:
 *   post:
 *     summary: Subscribe to Golden Tick
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - paymentSuccess
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique identifier of the user
 *               paymentSuccess:
 *                 type: boolean
 *                 description: Status of payment transaction
 *     responses:
 *       200:
 *         description: Golden Tick activated successfully
 *       400:
 *         description: Bad request, invalid input
 *       401:
 *         description: Unauthorized, authentication required
 *       500:
 *         description: Internal server error
 */
