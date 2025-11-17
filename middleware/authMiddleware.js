import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: "Unauthorized: No token provided" 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle both 'id' and 'userId' from different token formats
    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      return res.status(403).json({ 
        success: false,
        error: "Forbidden: Invalid token format" 
      });
    }

    // Fetch user and attach to request
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({ 
        success: false,
        error: "Account suspended" 
      });
    }

    req.user = user;
    req.userId = userId; // For backward compatibility
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false,
        error: "Forbidden: Invalid token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: "Token expired" 
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error" 
    });
  }
};

export default authMiddleware;

// Named exports for convenience
export const protect = authMiddleware;
export const authenticate = authMiddleware;
