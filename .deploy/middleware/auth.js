const jwt = require('jsonwebtoken');
const { User } = require('../models');

const validateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: 'API key is required'
            });
        }

        if (apiKey !== process.env.API_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        next();
    } catch (error) {
        console.error('[Auth] API key validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const authenticateToken = async (req, res, next) => {
    try {
        console.log('[Auth] Authenticating token');
        
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            console.log('[Auth] No authorization header');
            return res.status(401).json({
                success: false,
                message: 'No authorization header'
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.log('[Auth] No token provided');
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // Verify and decode the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[Auth] Token decoded:', decoded);

        // Get fresh user data from database
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'credits']
        });

        if (!user) {
            console.log('[Auth] User not found:', decoded);
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request
        req.user = user.toJSON();
        console.log('[Auth] User authenticated:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        next();
    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: 'API key required'
            });
        }

        // TODO: Implement API key validation
        if (apiKey !== process.env.PROXY_API_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        next();
    } catch (error) {
        console.error('[Auth] API key authentication error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        // Get fresh user data to ensure admin status is current
        const user = await User.findOne({
            where: { id: req.user.id },
            attributes: ['id', 'email', 'is_admin']
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        next();
    } catch (error) {
        console.error('[Auth] Admin check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const isAdminSimple = (req, res, next) => {
    if (!req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    authenticateApiKey,
    isAdmin,
    isAdminSimple,
    validateApiKey
};
