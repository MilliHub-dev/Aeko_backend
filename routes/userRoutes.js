import  express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from"../models/User.js";
const router = express.Router();
import Web3  from "web3"; // Correct way to import in Web3 v4
import authMiddleware from "../middleware/authMiddleware.js";

const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.infura.io/")); // Use Polygon zkEVM



// Register
router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User login with wallet signature verification
router.post("/wallet-login", async (req, res) => {
  const { address, message, signature } = req.body;

  try {
    const recoveredAddress = web3.eth.accounts.recover(message, signature);
    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      const token = jwt.sign({ address }, process.env.JWT_SECRET, { expiresIn: "24h" });
      return res.json({ message: "Login successful", token });
    }
    res.status(401).json({ message: "Invalid signature" });
  } catch (error) {
    res.status(500).json({ message: "Error verifying signature", error });
  }
});

// Get User Profile
router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

import upload from "../middleware/upload.js";

/**
 * @swagger
 * /api/users/profile-picture:
 *   put:
 *     summary: Upload or update profile picture
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/profile-picture", authMiddleware, upload.single("image"), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.userId, { profilePicture: req.file.path }, { new: true });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



export default router;

