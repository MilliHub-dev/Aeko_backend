import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { hasCurrentAuthTokenVersion } from '../utils/authTokenUtils.js';
import { getJwtSecret } from '../utils/authConfig.js';

/**
 * Middleware to check if user is an admin
 */
const adminMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token, authorization denied'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.purpose === 'password-reset') {
            return res.status(401).json({
                success: false,
                message: 'Token is not valid or expired'
            });
        }
        
        // Find user and check if admin
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!hasCurrentAuthTokenVersion(decoded, user)) {
            return res.status(401).json({
                success: false,
                message: 'Token is not valid or expired'
            });
        }

        if (!user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Token is not valid or expired',
            error: error.message
        });
    }
};

export default adminMiddleware;
