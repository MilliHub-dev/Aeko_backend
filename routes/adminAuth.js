import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { hasCurrentAuthTokenVersion } from '../utils/authTokenUtils.js';
import { getJwtSecret } from '../utils/authConfig.js';

const router = express.Router();

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and check if they're an admin
    const user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user || !user.isAdmin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials or insufficient privileges' 
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        isAdmin: true,
        authTokenVersion: user.authTokenVersion ?? 0,
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    // Set cookie and redirect to admin dashboard
    res.cookie('adminjs', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.redirect('/admin/resources/User');
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: process.env.NODE_ENV === "production" ? undefined : error.message 
    });
  }
});

// Verify admin token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.purpose === 'password-reset') {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user || !user.isAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }

    if (!hasCurrentAuthTokenVersion(decoded, user)) {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
