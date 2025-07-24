const jwt = require('jsonwebtoken');
const { Company } = require('../models');

/**
 * JWT Authentication Middleware
 * 
 * Validates JWT tokens and attaches user information to the request object.
 * This middleware ensures that only authenticated users can access protected endpoints.
 */
const auth = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'No authorization header provided'
            });
        }

        // Check for Bearer token format
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Invalid authorization format. Use Bearer token'
            });
        }

        // Extract the token (remove 'Bearer ' prefix)
        const token = authHeader.substring(7);

        if (!token) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'No token provided'
            });
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

        // Validate that the user/company still exists and is active
        const company = await Company.findOne({
            where: {
                id: decoded.companyId,
                isActive: true
            }
        });

        if (!company) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Invalid token or company no longer active'
            });
        }

        // Attach user information to request object
        req.user = {
            id: decoded.userId || decoded.id,
            companyId: decoded.companyId,
            email: decoded.email,
            role: decoded.role || 'user',
            company: company
        };

        // Proceed to next middleware or route handler
        next();

    } catch (error) {
        console.error('Authentication error:', error);

        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Token has expired'
            });
        }

        // Generic authentication error
        res.status(401).json({
            error: 'Access denied',
            message: 'Authentication failed'
        });
    }
};

/**
 * Optional authentication middleware
 * 
 * Similar to auth middleware but doesn't fail if no token is provided.
 * Useful for endpoints that provide different data for authenticated vs unauthenticated users.
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7);
        
        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
        
        const company = await Company.findOne({
            where: {
                id: decoded.companyId,
                isActive: true
            }
        });

        if (company) {
            req.user = {
                id: decoded.userId || decoded.id,
                companyId: decoded.companyId,
                email: decoded.email,
                role: decoded.role || 'user',
                company: company
            };
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // For optional auth, we don't fail on token errors
        req.user = null;
        next();
    }
};

/**
 * Role-based authorization middleware
 * 
 * @param {string[]} allowedRoles - Array of roles that can access the endpoint
 */
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

/**
 * Utility function to generate JWT tokens
 * 
 * @param {Object} payload - The payload to encode in the token
 * @param {string} expiresIn - Token expiration time (default: 24h)
 */
const generateToken = (payload, expiresIn = '24h') => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_key', {
        expiresIn: expiresIn
    });
};

module.exports = {
    auth,
    optionalAuth,
    authorize,
    generateToken
}; 