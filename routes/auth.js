import express from "express";
import jwt from "jsonwebtoken";
import Web3 from "web3";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";


/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: User registration
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 *
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/auth/wallet-login:
 *   post:
 *     summary: Wallet login with signature verification
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 description: User's wallet address
 *               message:
 *                 type: string
 *                 description: Message to sign
 *               signature:
 *                 type: string
 *                 description: User's signature
 *             required:
 *               - address
 *               - message
 *               - signature
 *     responses:
 *       200:
 *         description: Login successful
 *
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags:
 *       - auth
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the logout was successful
 *                 message:
 *                   type: string
 *                   description: Logout message
 *
 * /api/auth/forgot-password:
 *   post:
 *     summary: Forgot password
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: User's email address
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Password reset link sent to email
 *
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password
 *     tags:
 *       - auth
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         description: Password reset token
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 description: New password for the user
 *             required:
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password reset successful
 *
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         walletAddress:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 *         - username
 *         - email
 *         - password
 *       example:
 *         name: John Doe
 *         username: johndoe
 *         email: example@example.com
 *         password: password123
 *         walletAddress: 0x1234567890abcdef1234567890abcdef12345678
 *         createdAt: 2023-10-01T12:00:00Z
 *         updatedAt: 2023-10-01T12:00:00Z
 *
 *     LoginRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *       required:
 *         - email
 *         - password
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         token:
 *           type: string
 *       example:
 *         message: Login successful
 *         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         error:
 *           type: string
 *       example:
 *         message: Invalid credentials
 *         error: "User not found"
 */


dotenv.config(); // Load environment variables

const router = express.Router();
const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.infura.io/")); // Polygon zkEVM

// User registration
router.post("/signup",  async (req, res) => {
    try {
        const { name, username, email, password } = req.body;

        //const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, username, email, password: hashedPassword });
        await newUser.save();

        res.json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
});

//User login
 router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error: error.message });
    }
});
 
/* router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email, password });

    const user = await User.findOne({ email });
    if (!user) {
      console.log("No user found");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("User found:", user);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Is password valid?", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
}); */


// Wallet login with signature verification
router.post("/wallet-login", async (req, res) => {
    try {
        const { address, message, signature } = req.body;

        const recoveredAddress = web3.eth.accounts.recover(message, signature);
        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            const token = jwt.sign({ address }, process.env.JWT_SECRET, { expiresIn: "24h" });
            return res.json({ message: "Login successful", token });
        }
        res.status(401).json({ message: "Invalid signature" });
    } catch (error) {
        res.status(500).json({ message: "Error verifying signature", error: error.message });
    }
});

// ✅ Logout Route
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
  });
  
  // ✅ Forgot Password Route
  router.post('/forgot-password',authMiddleware, async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found' });
  
      const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  
      // Send email (Use your SMTP settings)
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `<p>Click <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}">here</a> to reset your password.</p>`
      };
  
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Password reset link sent to email' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ✅ Reset Password Route
  router.post('/reset-password/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
      const user = await User.findById(decoded.userId);
      if (!user) return res.status(404).json({ error: 'Invalid token or user not found' });
  
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
  
      res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

export default router; // ✅ ES Module export
