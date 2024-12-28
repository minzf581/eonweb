const jwt = require('jsonwebtoken');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(403).json({ error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 管理员认证中间件
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        next();
    } catch (error) {
        console.error('Error in admin authentication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    authenticateToken,
    isAdmin
};
