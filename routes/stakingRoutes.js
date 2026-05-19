import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { explorer } from "../chain/client.js";
import { lamportsToAeko } from "../chain/utils.js";

const PENDING_SDK = (res) => res.status(501).json({
  success: false,
  message: "Staking transactions are pending SDK support from the chain team.",
});

const router = express.Router();

/**
 * @swagger
 * /api/staking/{address}/positions:
 *   get:
 *     tags: [Staking]
 *     summary: Get all stake positions for a wallet
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         description: Wallet address
 *     responses:
 *       200:
 *         description: Stake positions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 totalStaked: { type: number, description: "Total AEKO staked across active positions" }
 *                 positions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       positionId: { type: string }
 *                       creator: { type: string }
 *                       stakedAmount: { type: number }
 *                       state: { type: string, enum: [Active, CoolingDown, Closed] }
 *                       accumulatedYield: { type: number }
 *                       claimedYield: { type: number }
 *                       claimableYield: { type: number }
 *                       unlockEpoch: { type: integer, nullable: true }
 */
router.get("/:address/positions", async (req, res) => {
  try {
    const { address } = req.params;
    const stakes = await explorer.listSocialStakes({ wallet: address });

    const positions = stakes.map((s) => ({
      positionId:       s.positionId,
      creator:          s.creator,
      stakedAmount:     lamportsToAeko(s.stakedAmount),
      state:            s.state,
      accumulatedYield: lamportsToAeko(s.accumulatedYield),
      claimedYield:     lamportsToAeko(s.claimedYield),
      claimableYield:   lamportsToAeko(s.accumulatedYield - s.claimedYield),
      unlockEpoch:      s.unlockEpoch ?? null,
    }));

    const totalStaked = stakes
      .filter((s) => s.state === "Active")
      .reduce((sum, s) => sum + s.stakedAmount, 0);

    res.json({ success: true, positions, totalStaked: lamportsToAeko(totalStaked) });
  } catch (error) {
    console.error("staking positions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stake positions" });
  }
});

/**
 * @swagger
 * /api/staking/prepare-open:
 *   post:
 *     tags: [Staking]
 *     summary: Prepare an unsigned stake-open transaction
 *     description: Verifies the staker has sufficient balance before building the transaction. Generates a unique positionId.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [creatorAddress, amountAeko]
 *             properties:
 *               creatorAddress:
 *                 type: string
 *                 description: Wallet address of the creator to stake on
 *                 example: "AeKo1234...creator"
 *               amountAeko:
 *                 type: number
 *                 description: Amount of AEKO to stake
 *                 example: 100
 *     responses:
 *       200:
 *         description: Unsigned stake transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 positionId: { type: string, description: "Hex-encoded 32-byte position ID" }
 *       400:
 *         description: Insufficient balance or missing fields
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-open", authMiddleware, (req, res) => PENDING_SDK(res));

/**
 * @swagger
 * /api/staking/prepare-claim-yield:
 *   post:
 *     tags: [Staking]
 *     summary: Prepare an unsigned yield claim transaction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [positionId]
 *             properties:
 *               positionId:
 *                 type: string
 *                 description: Hex-encoded position ID
 *                 example: "a1b2c3d4..."
 *     responses:
 *       200:
 *         description: Unsigned claim-yield transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 claimableAeko: { type: number }
 *       400:
 *         description: No yield to claim
 *       404:
 *         description: Position not found
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-claim-yield", authMiddleware, (req, res) => PENDING_SDK(res));

/**
 * @swagger
 * /api/staking/prepare-unstake:
 *   post:
 *     tags: [Staking]
 *     summary: Prepare an unsigned unstake (begin cooldown) transaction
 *     description: Starts the cooldown period. Position moves to CoolingDown state. Call prepare-finalize-unstake after cooldown completes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [positionId]
 *             properties:
 *               positionId:
 *                 type: string
 *                 example: "a1b2c3d4..."
 *     responses:
 *       200:
 *         description: Unsigned unstake transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 unlockEpoch: { type: integer, description: "Epoch after which finalize-unstake can be called" }
 *                 cooldownDays: { type: integer, example: 7 }
 *       400:
 *         description: Position not Active
 *       404:
 *         description: Position not found
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-unstake", authMiddleware, (req, res) => PENDING_SDK(res));

/**
 * @swagger
 * /api/staking/prepare-finalize-unstake:
 *   post:
 *     tags: [Staking]
 *     summary: Prepare an unsigned finalize-unstake transaction
 *     description: |
 *       Returns AEKO to the staker's wallet after the cooldown period has passed.
 *       Returns a 400 with `epochsRemaining` if the cooldown is not yet complete.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [positionId]
 *             properties:
 *               positionId:
 *                 type: string
 *                 example: "a1b2c3d4..."
 *     responses:
 *       200:
 *         description: Unsigned finalize-unstake transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *       400:
 *         description: Not in CoolingDown state or cooldown not complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 currentEpoch: { type: integer }
 *                 unlockEpoch: { type: integer }
 *                 epochsRemaining: { type: integer }
 *       404:
 *         description: Position not found
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-finalize-unstake", authMiddleware, (req, res) => PENDING_SDK(res));

export default router;
