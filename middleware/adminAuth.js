import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Admin Authentication Middleware
export const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.adminToken;
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No admin token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Invalid admin token.' });
    }

    // Check if user is admin (you can add admin field to User model or check specific criteria)
    if (!user.isAdmin && !user.goldenTick) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid admin token.' });
  }
};

// Middleware to check if user is super admin
export const superAdminAuth = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }
    next();
  } catch (error) {
    res.status(403).json({ message: 'Access denied.' });
  }
};

// Admin login function
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check admin privileges
    if (!user.isAdmin && !user.goldenTick) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie for admin session
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        goldenTick: user.goldenTick
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during admin login' });
  }
};

// Admin logout function
export const adminLogout = (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true, message: 'Admin logged out successfully' });
};