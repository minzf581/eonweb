const jwt = require('jsonwebtoken');
const { User } = require('../models');

function logWithTimestamp(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][Auth] ${message}`, data);
}

const validateApiKey = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const version = '2024011626';
    
    logWithTimestamp('开始验证 API Key', { 
        version,
        path: req.path,
        method: req.method,
        headers: {
            'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
            'content-type': req.headers['content-type']
        },
        timestamp
    });
    
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        logWithTimestamp('验证失败：缺少 API Key', { version });
        res.status(401).json({
            success: false,
            message: 'API key not provided'
        });
        return;
    }

    if (apiKey !== process.env.API_KEY) {
        logWithTimestamp('验证失败：无效的 API Key', { version });
        res.status(401).json({
            success: false,
            message: 'Invalid API key'
        });
        return;
    }

    logWithTimestamp('API Key 验证成功', { 
        version,
        path: req.path,
        method: req.method 
    });
    
    next();
};

const authenticateToken = async (req, res, next) => {
    try {
        console.log('[Auth] Authenticating token');
        
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            console.log('[Auth] No authorization header provided');
            return res.status(401).json({
                success: false,
                message: 'Authentication failed: No token provided'
            });
        }

        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) {
            console.log('[Auth] No token found in authorization header');
            return res.status(401).json({
                success: false,
                message: 'Authentication failed: Invalid token format'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('[Auth] Token decoded successfully:', {
                userId: decoded.id,
                email: decoded.email,
                isAdmin: decoded.is_admin,
                exp: new Date(decoded.exp * 1000).toISOString()
            });

            // 获取用户信息
            const user = await User.findOne({
                where: { 
                    id: decoded.id,
                    deleted_at: null
                },
                attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'credits', 'username']
            });

            if (!user) {
                console.log('[Auth] User not found or deleted:', decoded.id);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication failed: User not found'
                });
            }

            // 验证用户权限是否与token中的一致
            if (user.is_admin !== decoded.is_admin) {
                console.log('[Auth] User privileges mismatch:', {
                    tokenAdmin: decoded.is_admin,
                    userAdmin: user.is_admin
                });
                return res.status(401).json({
                    success: false,
                    message: 'Authentication failed: Invalid privileges'
                });
            }

            req.user = user;
            console.log('[Auth] User authenticated successfully:', {
                id: user.id,
                email: user.email,
                is_admin: user.is_admin,
                username: user.username
            });

            next();
        } catch (error) {
            console.error('[Auth] Token verification failed:', {
                error: error.message,
                name: error.name
            });
            return res.status(401).json({
                success: false,
                message: 'Authentication failed: Invalid token'
            });
        }
    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const isAdmin = (req, res, next) => {
    console.log('[Auth] Checking admin privileges:', {
        userId: req.user?.id,
        email: req.user?.email,
        isAdmin: req.user?.is_admin
    });

    if (!req.user || req.user.is_admin !== true) {
        console.log('[Auth] Admin check failed');
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }

    console.log('[Auth] Admin check passed');
    next();
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
    isAdmin,
    isAdminSimple,
    validateApiKey
};
