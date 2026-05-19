import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { explorer } from "../chain/client.js";
import { lamportsToAeko } from "../chain/utils.js";

const router = express.Router();

/**
 * @swagger
 * /api/rewards/{address}:
 *   get:
 *     tags: [Rewards]
 *     summary: Get creator reward balance and epoch history
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         description: Creator wallet address
 *     responses:
 *       200:
 *         description: Reward summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 address: { type: string }
 *                 totalEarned: { type: number, description: "Lifetime AEKO earned", example: 1500.0 }
 *                 totalClaimable: { type: number, description: "AEKO available to claim now", example: 240.5 }
 *                 recentEpochs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       epoch: { type: integer }
 *                       amountAeko: { type: number }
 *                       status: { type: string, example: "Claimed" }
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const profile = await explorer.getCreatorProfile(address);
    if (!profile) {
      return res.json({ success: true, address, totalEarned: 0, totalClaimable: 0, recentEpochs: [] });
    }

    res.json({
      success: true,
      address,
      totalEarned:    lamportsToAeko(profile.totalRewardsEarned ?? profile.totalEarned ?? 0),
      totalClaimable: lamportsToAeko(profile.totalClaimableRewards ?? profile.claimable ?? 0),
      recentEpochs:   (profile.recentRewards ?? profile.epochs ?? []).map((r) => ({
        ...r,
        amountAeko: lamportsToAeko(r.amountLamports ?? r.amount ?? 0),
      })),
    });
  } catch (error) {
    console.error("rewards fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rewards" });
  }
});

/**
 * @swagger
 * /api/rewards/prepare-claim:
 *   post:
 *     tags: [Rewards]
 *     summary: Prepare an unsigned creator reward claim transaction
 *     description: Validates requested amount against on-chain claimable balance before building the transaction.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount of AEKO to claim (must not exceed claimable balance)
 *                 example: 100
 *     responses:
 *       200:
 *         description: Unsigned claim transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 amountAeko: { type: number }
 *                 amountLamports: { type: integer }
 *       400:
 *         description: Amount exceeds claimable balance or invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-claim", authMiddleware, async (_req, res) => {
  // Pending SDK support — chain team has not yet shipped the ClaimCreatorReward builder
  res.status(501).json({
    success: false,
    message: "Reward claim transactions are pending SDK support from the chain team.",
  });
});

export default router;
