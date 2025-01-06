const jwt = require('jsonwebtoken');
const { User } = require('../models');

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

        if (!decoded.id) {
            console.log('[Auth] Invalid token payload - missing id');
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        // Get fresh user data from database
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code']
        });

        if (!user) {
            console.log('[Auth] User not found:', { id: decoded.id });
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request
        req.user = user;
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
        console.log('[Auth] Authenticating API key');
        
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            console.log('[Auth] No API key provided');
            return res.status(401).json({
                success: false,
                message: 'API key is required'
            });
        }

        // 验证 API 密钥
        if (apiKey !== process.env.API_KEY) {
            console.log('[Auth] Invalid API key');
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        next();
    } catch (error) {
        console.error('[Auth] API key authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        console.log('[Auth] Checking admin status');

        if (!req.user) {
            console.log('[Auth] No user data in request');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get fresh user data to ensure admin status is current
        const user = await User.findOne({
            where: { id: req.user.id },
            attributes: ['id', 'email', 'is_admin']
        });

        if (!user) {
            console.log('[Auth] User not found:', { id: req.user.id });
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.is_admin) {
            console.log('[Auth] Access denied - not admin:', { id: user.id, email: user.email });
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Update req.user with fresh data
        req.user = {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        };

        console.log('[Auth] Admin check successful:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        next();
    } catch (error) {
        console.error('[Auth] Admin check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking admin status'
        });
    }
};

const isAdminSimple = (req, res, next) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        next();
    } catch (error) {
        console.error('Error in isAdmin middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking admin status'
        });
    }
};

module.exports = {
    authenticateToken,
    authenticateApiKey,
    isAdmin,
    isAdminSimple
};
